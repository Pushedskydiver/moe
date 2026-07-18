import type { CapStore } from './check-cost-cap.js';
import type { ThreadQueue } from './thread-queue.js';
import type { CostCapConfig, GenerateReplyUsage, PersonaId } from '@moe/agents';
import type {
  ChannelScopeConfig,
  ConversationTurn,
  ConversationTurnListResult,
  ConversationTurnResult,
  NewConversationTurn,
  NewPersonaCostUsage,
  PersonaCostUsageResult,
} from '@moe/core';
import type { InboundMessage } from '@moe/slack';

import {
  buildPersonaSystemPrompt,
  classifyMessageConfidence,
  composeGatedReply,
  generateReply,
  sonnetCostUsdMicros,
  STATUS_CLAIM_TOOL,
} from '@moe/agents';
import { isSurfaceInScope, toUtcDay } from '@moe/core';
import { postMessage } from '@moe/slack';

import { checkCostCapAndAlert } from './check-cost-cap.js';
import { repositoryErrorMessage } from './repository-error.js';
import { resolveThreadKey } from './resolve-thread-key.js';

const MAX_HISTORY_TURNS = 20;

type GenerateReplyClient = Parameters<typeof generateReply>[0];
type ClassifierClient = Parameters<typeof classifyMessageConfidence>[0];
type PostMessageClient = Parameters<typeof postMessage>[0];
type InboundMessageLogger = {
  readonly info: (
    message: string,
    fields?: Readonly<Record<string, unknown>>,
  ) => void;
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

// Same thin DI seam as `HistoryStore` above, over `@moe/core`'s cost-usage repository
// (BUILD_PLAN 2.6a) — real binding lives in `start-slack-listener.ts`.
type CostStore = {
  readonly recordUsage: (
    input: NewPersonaCostUsage,
  ) => Promise<PersonaCostUsageResult>;
};

// `historyStore`/`costStore`/`capStore`/`costCapConfig`/`personaId`/`threadQueue`/
// `channelScopeConfig` bundled alongside the pre-existing 3 params into one options object — the
// 3-param signature was already at eslint's `max-params: 3` ceiling, same bundling pattern
// `start-slack-listener.ts` already uses for its own deps. `anthropicClient` satisfies both
// `generateReply`'s (DM chat replies) and `classifyMessageConfidence`'s (ambient-channel Stage 1
// gate, BUILD_PLAN 3.3) client shapes — one real `Anthropic` SDK instance from
// `createAnthropicClient` structurally satisfies both, same "one client, many call sites" pattern
// as the rest of this file's DI seams.
export type HandlerDeps = {
  readonly anthropicClient: GenerateReplyClient & ClassifierClient;
  readonly slackClient: PostMessageClient;
  readonly logger: InboundMessageLogger;
  readonly historyStore: HistoryStore;
  readonly costStore: CostStore;
  readonly capStore: CapStore;
  readonly costCapConfig: CostCapConfig;
  readonly personaId: PersonaId;
  readonly threadQueue: ThreadQueue;
  readonly channelScopeConfig: ChannelScopeConfig;
};

// Non-persona-voiced, same spirit as chunk 2.3's ACK_TEXT — a visible reply on LLM failure beats
// the silent-to-the-user gap a bare "log and stop" would leave (caught live: DA review on this
// chunk's own PR, comparing against chunk 2.3's baseline where every inbound message got a
// visible ack). Retry/backoff itself stays out of scope for this chunk.
const FALLBACK_TEXT =
  "Sorry, I ran into a problem generating a reply — I've logged it.";

// Posted to the user's own channel/thread, not Alex's alert DM (`costAlertText` below) — a hard
// halt (BUILD_PLAN 2.6b) needs its own visible signal same as `FALLBACK_TEXT`, "never silent" per
// this file's own established precedent.
const HALT_TEXT =
  "I've hit my monthly budget cap and can't generate a new reply right now — I'll be back once it resets next month.";

function toHistoryEntry(turn: ConversationTurn): {
  readonly role: 'user' | 'assistant';
  readonly content: string;
} {
  return { role: turn.role, content: turn.content };
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
 * Accounts for one turn's LLM token usage against the persona/day cost bucket (BUILD_PLAN 2.6a) —
 * "log, don't throw" on failure, same as `appendTurnLogged` above; a cost-tracking write should
 * never be why a reply doesn't reach Slack. Only called when `generateReply` itself succeeded —
 * a failed API call returns no `usage` to account for.
 */
async function recordUsageLogged(
  deps: HandlerDeps,
  usage: GenerateReplyUsage,
  now: Date,
): Promise<void> {
  const result = await deps.costStore.recordUsage({
    personaId: deps.personaId,
    day: toUtcDay(now.toISOString()),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costUsdMicros: sonnetCostUsdMicros(usage, now),
  });
  if (!result.ok) {
    deps.logger.error('failed to record LLM cost usage', {
      message: repositoryErrorMessage(result.error),
    });
  }
}

type GenerateAndPostResult =
  { readonly ok: true; readonly text: string } | { readonly ok: false };

async function postHaltReply(
  deps: HandlerDeps,
  message: InboundMessage,
): Promise<void> {
  const posted = await postMessage(deps.slackClient, {
    channelId: message.channelId,
    text: HALT_TEXT,
    ...(message.threadTs !== undefined ? { threadTs: message.threadTs } : {}),
  });
  if (!posted.ok) {
    deps.logger.error('failed to post halt reply', {
      message: posted.error.message,
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
): Promise<GenerateAndPostResult> {
  // One clock read shared by the cap check, cost accounting, and the gated-reply compose below,
  // not a fresh `new Date()` per use — keeps all three derived from the exact same instant.
  const now = new Date();

  const capCheck = await checkCostCapAndAlert(deps, now);
  if (capCheck.halt) {
    await postHaltReply(deps, message);
    // `ok: true`, not `false` — matches the line below's own "ok reflects whether there's real
    // reply content to persist, independent of Slack delivery success" precedent. A halt genuinely
    // produced a reply (`HALT_TEXT`, just posted above); persisting it to conversation history
    // means a real month-long halt doesn't leave the history silently diverging from what the user
    // actually saw in Slack — a plain LLM failure (below) has no such content to persist, which is
    // the one case `ok: false` still covers.
    return { ok: true, text: HALT_TEXT };
  }

  const generated = await generateReply(deps.anthropicClient, {
    text: message.text,
    history,
    system: buildPersonaSystemPrompt(deps.personaId),
    tools: [STATUS_CLAIM_TOOL],
  });

  if (!generated.ok) {
    deps.logger.error('failed to generate reply', {
      message: generated.error.message,
    });
  } else {
    await recordUsageLogged(deps, generated.usage, now);
  }

  // Composed once and reused for both the Slack post and the persisted/buffered history entry
  // below, so the two can never drift apart — avoids redundant work now, and once Stage 6 wires
  // in real evidence that could itself change between calls (e.g. a re-fetched CI status), a
  // second composeGatedReply call could otherwise return a different result than the first.
  const text = generated.ok
    ? composeGatedReply(generated, () => now.toISOString())
    : FALLBACK_TEXT;

  const posted = await postMessage(deps.slackClient, {
    channelId: message.channelId,
    text,
    ...(message.threadTs !== undefined ? { threadTs: message.threadTs } : {}),
  });
  if (!posted.ok) {
    deps.logger.error('failed to post reply', {
      message: posted.error.message,
    });
  }

  return generated.ok ? { ok: true, text } : { ok: false };
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

  const history = await fetchHistory(deps, scope);
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
      content: generated.text,
    });
  }
}

/**
 * VISION §5.2's Stage 0 + Stage 1, run for every ambient channel/group message (never a DM — a DM
 * is already addressed, §5.3). Out-of-scope channels never reach the classifier at all (Stage 0,
 * BUILD_PLAN 3.2's `isSurfaceInScope`); an in-scope one gets a single classification call (Stage 1,
 * `docs/decisions/STAGE-1-CLASSIFIER.md`) and the score is logged, not yet acted on — BUILD_PLAN
 * 3.3's own scope is "run silently in prod for a few days of real traffic to sanity-check the
 * thresholds" before 3.4a-i starts routing on it. No reply is posted either way; this replaces the
 * old "chat back to every message" behavior for ambient surfaces (BUILD_PLAN 3.3's own
 * DMs-only decision) — a DM still gets the full conversational reply path, unchanged, below.
 */
async function handleAmbientChannelMessage(
  deps: HandlerDeps,
  message: InboundMessage,
): Promise<void> {
  const inScope = isSurfaceInScope(
    { kind: 'channel', channelId: message.channelId },
    deps.channelScopeConfig,
  );
  if (!inScope) return;

  const classified = await classifyMessageConfidence(deps.anthropicClient, {
    text: message.text,
  });
  if (!classified.ok) {
    deps.logger.error('failed to classify inbound message', {
      message: classified.error.message,
    });
    return;
  }

  deps.logger.info('classified inbound message', {
    personaId: deps.personaId,
    channelId: message.channelId,
    messageText: message.text,
    confidence: classified.confidence,
    reasoning: classified.reasoning,
  });
}

/**
 * Replies to every inbound DM with an LLM-generated reply in the placeholder voice (BUILD_PLAN
 * 2.4a — not the persona's real character, which is Stage 5 behind the do-not-touch gate),
 * thread-scoped (BUILD_PLAN 2.4b — see `resolve-thread-key.ts` for the keying rule), serialized per
 * thread key via `threadQueue` so two overlapping messages for the same conversation can't race on
 * history. An ambient channel/group message never reaches this path at all — it's classified and
 * logged instead (`handleAmbientChannelMessage`, BUILD_PLAN 3.3's DMs-only decision, made once
 * Stage 3's intake cascade existed to give ambient messages a real, non-chatty purpose). A failed
 * LLM call is logged and still posts a generic fallback reply rather than leaving the user with
 * silence; a failed Slack post or history read/write is logged, "log, don't throw, don't retry
 * here" — this chunk proves the wiring end-to-end, not a full retry/backoff UX.
 */
export function createInboundMessageHandler(
  deps: HandlerDeps,
): (message: InboundMessage) => Promise<void> {
  return async (message) => {
    if (message.channelType !== 'im') {
      await handleAmbientChannelMessage(deps, message);
      return;
    }

    const threadKey = resolveThreadKey(message);
    if (threadKey === undefined) {
      // Unreachable given the `channelType !== 'im'` branch above — `resolveThreadKey` only
      // returns `undefined` for an un-threaded channel/group message, which never reaches here.
      // A narrowing guard instead of an `as`/`!` — defensively correct even if that changed.
      return;
    }

    // `threadKey` alone isn't unique across conversations — every DM resolves to the same
    // constant `'dm'` (`resolve-thread-key.ts`) regardless of which channel it's in, so the queue
    // key must include `channelId` too, or every DM in the whole process would serialize through
    // one lane instead of each conversation getting its own. `JSON.stringify` rather than a
    // hand-delimited string — a plain `${channelId}:${threadKey}` join could collide if either
    // value ever contained a literal `:`; encoding as a JSON array can't.
    const queueKey = JSON.stringify([message.channelId, threadKey]);
    await deps.threadQueue.run(queueKey, () =>
      handleThreadedMessage(deps, message, threadKey),
    );
  };
}
