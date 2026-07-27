import type { CapStore } from './check-cost-cap.js';
import type { DmIntakeCascadeResult } from './run-dm-intake-cascade.js';
import type { ThreadQueue } from './thread-queue.js';
import type {
  classifyMessageConfidence,
  composeTicketDraft,
  CostCapConfig,
  evaluateSituationalAppropriateness,
  generateReply,
  PersonaId,
} from '@moe/agents';
import type {
  ChannelScopeConfig,
  ConversationTurn,
  ConversationTurnListResult,
  ConversationTurnResult,
  createBankHolidaysCache,
  NewConversationTurn,
  NewPendingConfirmingQuestion,
  NewPendingTicketDraft,
  NewPersonaCostUsage,
  NewReviewQueueEntry,
  NewTicket,
  PendingConfirmingQuestionClaimResult,
  PendingConfirmingQuestionOrNullResult,
  PendingConfirmingQuestionResult,
  PendingTicketDraftOrNullResult,
  PendingTicketDraftResult,
  PersonaCostUsageResult,
  ReviewQueueEntryResult,
  TicketResult,
} from '@moe/core';
import type { addReaction, InboundMessage, postMessage } from '@moe/slack';

import { generateAndPost } from './generate-and-post-reply.js';
import { handleAmbientChannelMessage } from './handle-ambient-channel-message.js';
import { repositoryErrorMessage } from './repository-error.js';
import { resolveThreadKey } from './resolve-thread-key.js';
import { runDmIntakeCascade } from './run-dm-intake-cascade.js';

const MAX_HISTORY_TURNS = 20;

type GenerateReplyClient = Parameters<typeof generateReply>[0];
type ClassifierClient = Parameters<typeof classifyMessageConfidence>[0];
type ComposeDraftClient = Parameters<typeof composeTicketDraft>[0];
type SituationalGateClient = Parameters<
  typeof evaluateSituationalAppropriateness
>[0];
type PostMessageClient = Parameters<typeof postMessage>[0];
type AddReactionClient = Parameters<typeof addReaction>[0];
// BUILD_PLAN 3.4a-i's own operating-rhythm requirement (below) needs to reference the cache's
// type without `@moe/core` publicly exporting the `Cached` class itself (deliberately not
// re-exported yet, per `cached.ts`'s own TSDoc) — deriving it from the one function that *is*
// exported avoids that question entirely, same `ReturnType<typeof X>` idiom this file already
// uses for `GenerateReplyClient`/`ClassifierClient` above.
type BankHolidaysCache = ReturnType<typeof createBankHolidaysCache>;
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

// Same thin DI seam, over `@moe/core`'s ticket repository — BUILD_PLAN 3.4a-ii's ✅/📦 outcome
// paths, real consumers as of BUILD_PLAN 3.4a-iii's live Socket Mode `reaction_added` wiring.
type TicketStore = {
  readonly create: (input: NewTicket) => Promise<TicketResult>;
};

// Same thin DI seam, over `@moe/core`'s pending-ticket-drafts repository (BUILD_PLAN 3.4a-ii's
// "parent-message state"). `create` is BUILD_PLAN 3.4a-iii's own addition — persists a real
// posted draft's `(channelId, messageTs)` so a later real reaction can be looked up against it. No
// `resolve` member — the claim-then-act fallback fix moved the ✅/📦 outcomes' only caller of it
// (`reaction-outcome-actions.ts`'s `commitAsTicket`) onto `@moe/core`'s `createTicketFromDraft`
// instead, which claims via `resolvePendingTicketDraft` inside its own transaction, not through
// this DI seam; `resolve` had no other caller once that landed.
type DraftStore = {
  readonly create: (
    input: NewPendingTicketDraft,
  ) => Promise<PendingTicketDraftResult>;
  readonly getByMessage: (scope: {
    readonly personaId: string;
    readonly channelId: string;
    readonly messageTs: string;
  }) => Promise<PendingTicketDraftOrNullResult>;
  readonly updateContent: (
    id: string,
    content: { readonly draftTitle: string; readonly draftBody: string },
  ) => Promise<PendingTicketDraftResult>;
};

// Same thin DI seam, over `@moe/core`'s review-queue repository (BUILD_PLAN 3.4c) — VISION §5.2's
// "nothing is silently eaten" backstop. `create` is this chunk's own real consumer
// (`handle-ambient-channel-message.ts`'s Low-band branch); no `getByMessage`/`resolve`/
// `updateContent` counterparts exist here, unlike `DraftStore` above — a review-queue row is a
// plain log entry, never looked up or claimed by a later reaction.
type ReviewQueueStore = {
  readonly create: (
    input: NewReviewQueueEntry,
  ) => Promise<ReviewQueueEntryResult>;
};

// Same thin DI seam, over `@moe/core`'s pending-confirming-questions repository (BUILD_PLAN
// 3.4b-i's own "parent-message state"). `create` is 3.4b-i's own real consumer
// (`compose-and-post-confirming-question.ts`); `getByMessage`/`resolve` are BUILD_PLAN 3.4b-ii's
// own real consumers — the 👍/👎 reaction-dispatch lookup (`handle-reaction-added.ts`'s
// `dispatchConfirmingQuestionOutcome`) and its atomic claim (`reaction-outcome-actions.ts`'s
// `draftFromConfirmingQuestion`/`logConfirmingQuestionAsNo`) — matching `DraftStore`'s own
// precedent at BUILD_PLAN 3.4a-ii/3.4a-iii (built whole, wired to a live reaction listener a
// later chunk).
type ConfirmingQuestionStore = {
  readonly create: (
    input: NewPendingConfirmingQuestion,
  ) => Promise<PendingConfirmingQuestionResult>;
  readonly getByMessage: (scope: {
    readonly personaId: string;
    readonly channelId: string;
    readonly messageTs: string;
  }) => Promise<PendingConfirmingQuestionOrNullResult>;
  readonly resolve: (
    id: string,
  ) => Promise<PendingConfirmingQuestionClaimResult>;
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
  readonly anthropicClient: GenerateReplyClient &
    ClassifierClient &
    ComposeDraftClient &
    SituationalGateClient;
  readonly slackClient: PostMessageClient & AddReactionClient;
  readonly logger: InboundMessageLogger;
  readonly historyStore: HistoryStore;
  readonly costStore: CostStore;
  readonly capStore: CapStore;
  readonly costCapConfig: CostCapConfig;
  readonly personaId: PersonaId;
  readonly threadQueue: ThreadQueue;
  readonly channelScopeConfig: ChannelScopeConfig;
  readonly bankHolidaysCache: BankHolidaysCache;
  readonly ticketStore: TicketStore;
  readonly draftStore: DraftStore;
  readonly reviewQueueStore: ReviewQueueStore;
  readonly confirmingQuestionStore: ConfirmingQuestionStore;
};

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
      errorMessage: repositoryErrorMessage(result.error),
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
      errorMessage: repositoryErrorMessage(result.error),
    });
  }
}

// Both the cascade's own posted text and a conversational reply land here, so the DM's
// `conversation_turns` history matches the real Slack transcript either way. `handleThreadedMessage`
// is the only writer of that table (BUILD_PLAN 3.7's own recorded trap): a High/Mid DM answered
// with a draft instead of a reply and *not* routed through here would leave a hole in the history
// the next reply is generated from.
async function persistTurns(
  deps: HandlerDeps,
  scope: HistoryScope,
  content: { readonly user: string; readonly assistant?: string },
): Promise<void> {
  await appendTurnLogged(deps, {
    ...scope,
    role: 'user',
    content: content.user,
  });
  if (content.assistant !== undefined) {
    await appendTurnLogged(deps, {
      ...scope,
      role: 'assistant',
      content: content.assistant,
    });
  }
}

// The last structural guarantee behind BUILD_PLAN 3.7's invariant. **No currently reachable path
// throws** — every repository in `@moe/core` and every LLM wrapper in `@moe/agents` catches and
// returns a `Result`, so each modelled failure already returns `handled: false` and falls through.
// This guard is defence-in-depth for the unmodelled case, in the same spirit as the deliberately
// unreachable `threadKey === undefined` narrowing guard below.
//
// It earns its place because the consequence is asymmetric rather than because the risk is live:
// an escaping throw would propagate out of `handleThreadedMessage`, past `threadQueue.run`, to
// `socket-mode-listener.ts`'s own top-level `.catch`, which logs and stops. That is silence — on
// the one surface that is never allowed to be silent, for a DM that would have been answered
// before 3.7. Catching here makes the cascade additive by construction rather than by audit, so a
// future call site added inside it cannot quietly reintroduce that silence. It does not mask bugs:
// an `error`-level log carrying the real message is strictly more visible than a rejected promise
// swallowed two frames up, and this is the same "log, don't throw" convention
// `recordUsageLogged`/`logAmbientIntakeToReviewQueue` already follow.
async function runDmIntakeCascadeSafely(
  deps: HandlerDeps,
  message: InboundMessage,
  now: Date,
): Promise<DmIntakeCascadeResult> {
  try {
    return await runDmIntakeCascade(deps, message, now);
  } catch (error: unknown) {
    deps.logger.error(
      'DM intake cascade threw — falling back to a chat reply',
      {
        personaId: deps.personaId,
        channelId: message.channelId,
        errorMessage: String(error),
      },
    );
    return { handled: false };
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

  // VISION §5.2's cascade, over a DM (BUILD_PLAN 3.7). Runs *before* the conversational reply, and
  // replaces it only on `handled: true` — every other outcome (Low band, cost-cap halt, classifier
  // failure, failed post) falls through to exactly the reply this path produced before 3.7. That
  // ordering is the invariant: the cascade may only add to the DM response, never remove it.
  const now = new Date();
  const cascade = await runDmIntakeCascadeSafely(deps, message, now);
  if (cascade.handled) {
    await persistTurns(deps, scope, {
      user: message.text,
      assistant: cascade.postedText,
    });
    return;
  }

  // Fetched only on the fall-through — the cascade classifies on the message text alone and never
  // reads history, so a High/Mid DM would otherwise pay for a history round-trip it never uses.
  const history = await fetchHistory(deps, scope);
  const generated = await generateAndPost(
    deps,
    message,
    history.map((turn) => toHistoryEntry(turn)),
  );

  await persistTurns(deps, scope, {
    user: message.text,
    ...(generated.ok ? { assistant: generated.text } : {}),
  });
}

/**
 * Handles every inbound DM, thread-scoped (BUILD_PLAN 2.4b — see `resolve-thread-key.ts` for the
 * keying rule) and serialized per thread key via `threadQueue` so two overlapping messages for the
 * same conversation can't race on history.
 *
 * As of BUILD_PLAN 3.7 a DM first runs VISION §5.2's intake cascade (`run-dm-intake-cascade.ts`):
 * a High-band DM gets a ticket draft and a Mid-band DM a confirming question, each *in place of*
 * the chat reply. Everything else — a Low band, a cost-cap halt, a classifier failure, a failed
 * post — falls through to the LLM-generated conversational reply in the placeholder voice
 * (BUILD_PLAN 2.4a; not the persona's real character, which is Stage 5 behind the do-not-touch
 * gate), exactly as this path behaved before 3.7. **The cascade may only ever add to the DM
 * response, never remove it** — see `runDmIntakeCascade`'s own TSDoc for why that invariant is
 * load-bearing rather than stylistic.
 *
 * An ambient channel/group message never reaches this path at all — it runs the same cascade
 * through a different entry point that posts nothing on a Low band and stays silent on every guard
 * or failure (`handle-ambient-channel-message.ts`, BUILD_PLAN 3.3's DMs-only chat decision).
 *
 * A failed LLM call is logged and still posts a generic fallback reply rather than leaving the user
 * with silence; a failed Slack post or history read/write is logged, "log, don't throw, don't
 * retry here" — this proves the wiring end-to-end, not a full retry/backoff UX.
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
