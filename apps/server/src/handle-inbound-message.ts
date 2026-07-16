import type { RootCandidateBuffer } from './root-candidate-buffer.js';
import type { ThreadQueue } from './thread-queue.js';
import type {
  ConversationTurn,
  ConversationTurnListResult,
  ConversationTurnRepositoryError,
  ConversationTurnResult,
  NewConversationTurn,
} from '@moe/core';
import type { InboundMessage } from '@moe/slack';

import { generateReply } from '@moe/agents';
import { postMessage } from '@moe/slack';

import { resolveThreadKey } from './resolve-thread-key.js';

const MAX_HISTORY_TURNS = 20;

type GenerateReplyClient = Parameters<typeof generateReply>[0];
type PostMessageClient = Parameters<typeof postMessage>[0];
type InboundMessageLogger = {
  readonly error: (
    message: string,
    fields?: Readonly<Record<string, unknown>>,
  ) => void;
};

type HistoryScope = {
  readonly personaId: string;
  readonly channelId: string;
  readonly threadKey: string;
};

// A thin, directly-mockable seam over `@moe/core`'s repository functions, pre-bound to a `db`
// handle by the caller (`start-slack-listener.ts`) — keeps this file's own tests free of any real
// Kysely/Postgres dependency, matching this file's existing DI style for `anthropicClient`/
// `slackClient`.
type HistoryStore = {
  readonly getRecentTurns: (
    scope: HistoryScope,
    limit: number,
  ) => Promise<ConversationTurnListResult>;
  readonly appendTurn: (
    input: NewConversationTurn,
  ) => Promise<ConversationTurnResult>;
};

// `historyStore`/`personaId`/`threadQueue`/`rootCandidateBuffer` bundled alongside the pre-existing
// 3 params into one options object — the 3-param signature was already at eslint's `max-params: 3`
// ceiling, same bundling pattern `start-slack-listener.ts` already uses for its own deps.
export type HandlerDeps = {
  readonly anthropicClient: GenerateReplyClient;
  readonly slackClient: PostMessageClient;
  readonly logger: InboundMessageLogger;
  readonly historyStore: HistoryStore;
  readonly personaId: string;
  readonly threadQueue: ThreadQueue;
  readonly rootCandidateBuffer: RootCandidateBuffer;
};

// Non-persona-voiced, same spirit as chunk 2.3's ACK_TEXT — a visible reply on LLM failure beats
// the silent-to-the-user gap a bare "log and stop" would leave (caught live: DA review on this
// chunk's own PR, comparing against chunk 2.3's baseline where every inbound message got a
// visible ack). Retry/backoff itself stays out of scope for this chunk.
const FALLBACK_TEXT =
  "Sorry, I ran into a problem generating a reply — I've logged it.";

function toHistoryEntry(turn: ConversationTurn): {
  readonly role: 'user' | 'assistant';
  readonly content: string;
} {
  return { role: turn.role, content: turn.content };
}

function repositoryErrorMessage(
  error: ConversationTurnRepositoryError,
): string {
  return error.kind === 'validation-failed'
    ? error.issues
    : String(error.cause);
}

async function fetchHistory(
  deps: HandlerDeps,
  scope: HistoryScope,
): Promise<readonly ConversationTurn[]> {
  const result = await deps.historyStore.getRecentTurns(
    scope,
    MAX_HISTORY_TURNS,
  );
  if (!result.ok) {
    deps.logger.error('failed to fetch conversation history', {
      message: repositoryErrorMessage(result.error),
    });
    return [];
  }
  return result.turns;
}

async function appendTurnLogged(
  deps: HandlerDeps,
  input: NewConversationTurn,
): Promise<void> {
  const result = await deps.historyStore.appendTurn(input);
  if (!result.ok) {
    deps.logger.error('failed to persist conversation turn', {
      message: repositoryErrorMessage(result.error),
    });
  }
}

/**
 * On the first reply into a never-before-seen channel/group thread, backfills the message that
 * opened it (Slack's own `message` event never carries `thread_ts` on that message, only on the
 * replies that follow — BUILD_PLAN 2.4b Design §0). A match with no `replyText` yet (the bot's own
 * async reply to the root hasn't landed) backfills the user turn alone — accepted, not corrected;
 * the API silently merges the resulting consecutive user turns rather than erroring.
 */
async function backfillRootCandidate(
  deps: HandlerDeps,
  message: InboundMessage,
  scope: HistoryScope,
): Promise<void> {
  const candidate = deps.rootCandidateBuffer.takeIfMatches(
    message.channelId,
    scope.threadKey,
  );
  if (candidate === undefined) return;

  await appendTurnLogged(deps, {
    ...scope,
    role: 'user',
    content: candidate.text,
  });
  if (candidate.replyText !== undefined) {
    await appendTurnLogged(deps, {
      ...scope,
      role: 'assistant',
      content: candidate.replyText,
    });
  }
}

async function generateAndPost(
  deps: HandlerDeps,
  message: InboundMessage,
  history: ReadonlyArray<{
    readonly role: 'user' | 'assistant';
    readonly content: string;
  }>,
) {
  const generated = await generateReply(deps.anthropicClient, {
    text: message.text,
    history,
  });

  if (!generated.ok) {
    deps.logger.error('failed to generate reply', {
      message: generated.error.message,
    });
  }

  const posted = await postMessage(deps.slackClient, {
    channelId: message.channelId,
    text: generated.ok ? generated.reply : FALLBACK_TEXT,
    ...(message.threadTs !== undefined ? { threadTs: message.threadTs } : {}),
  });
  if (!posted.ok) {
    deps.logger.error('failed to post reply', {
      message: posted.error.message,
    });
  }

  return generated;
}

async function handleUnthreadedMessage(
  deps: HandlerDeps,
  message: InboundMessage,
): Promise<void> {
  deps.rootCandidateBuffer.recordCandidate(
    message.channelId,
    message.ts,
    message.text,
  );

  const generated = await generateAndPost(deps, message, []);

  if (generated.ok) {
    deps.rootCandidateBuffer.recordReply(
      message.channelId,
      message.ts,
      generated.reply,
    );
  }
}

async function handleThreadedMessage(
  deps: HandlerDeps,
  message: InboundMessage,
  threadKey: string,
): Promise<void> {
  const scope: HistoryScope = {
    personaId: deps.personaId,
    channelId: message.channelId,
    threadKey,
  };

  const initialHistory = await fetchHistory(deps, scope);
  const isNeverSeenChannelThread =
    initialHistory.length === 0 && message.channelType !== 'im';
  if (isNeverSeenChannelThread) {
    await backfillRootCandidate(deps, message, scope);
  }
  const history = isNeverSeenChannelThread
    ? await fetchHistory(deps, scope)
    : initialHistory;

  const generated = await generateAndPost(
    deps,
    message,
    history.map((turn) => toHistoryEntry(turn)),
  );

  await appendTurnLogged(deps, {
    ...scope,
    role: 'user',
    content: message.text,
  });
  if (generated.ok) {
    await appendTurnLogged(deps, {
      ...scope,
      role: 'assistant',
      content: generated.reply,
    });
  }
}

/**
 * Replies to every inbound message with an LLM-generated reply in the placeholder voice
 * (BUILD_PLAN 2.4a — not the persona's real character, which is Stage 5 behind the do-not-touch
 * gate), now thread-scoped (BUILD_PLAN 2.4b — see `resolve-thread-key.ts` for the keying rule). A
 * DM or an in-thread channel/group reply fetches/persists conversation history, serialized per
 * thread key via `threadQueue` so two overlapping messages for the same thread can't race on
 * history; an un-threaded channel/group message stays fully stateless, identical to 2.4a. A failed
 * LLM call is logged and still posts a generic fallback reply rather than leaving the user with
 * silence; a failed Slack post or history read/write is logged, "log, don't throw, don't retry
 * here" — this chunk proves the wiring end-to-end, not a full retry/backoff UX.
 */
export function createInboundMessageHandler(
  deps: HandlerDeps,
): (message: InboundMessage) => Promise<void> {
  return async (message) => {
    const threadKey = resolveThreadKey(message);

    if (threadKey === undefined) {
      await handleUnthreadedMessage(deps, message);
      return;
    }

    await deps.threadQueue.run(threadKey, () =>
      handleThreadedMessage(deps, message, threadKey),
    );
  };
}
