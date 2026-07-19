import type { HandlerDeps } from './handle-inbound-message.js';
import type { PendingConfirmingQuestion, PendingTicketDraft } from '@moe/core';

import { composeTicketDraft, sonnetCostUsdMicros } from '@moe/agents';

import { checkCostCapAndAlert } from './check-cost-cap.js';
import { postAndPersistDraft } from './handle-ambient-channel-message.js';
import { recordUsageLogged } from './record-usage-logged.js';
import { repositoryErrorMessage } from './repository-error.js';

// Narrowed to just the `composeTicketDraft` client shape, not `HandlerDeps['anthropicClient']`'s
// full `GenerateReplyClient & ClassifierClient & ComposeDraftClient` intersection — this file
// never calls `generateReply`/`classifyMessageConfidence`, so a caller (or a test) shouldn't need
// to also satisfy those clients' `messages.create` shape just to supply this one.
type ComposeDraftClient = Parameters<typeof composeTicketDraft>[0];

// `confirmingQuestionStore`/`reviewQueueStore` added at BUILD_PLAN 3.4b-ii — the 👍/👎
// answer-side outcomes below need them, same as the pre-existing ✅/🔁/📦 outcomes needed
// `ticketStore`/`draftStore`.
type ReactionOutcomeDeps = Omit<
  Pick<
    HandlerDeps,
    | 'anthropicClient'
    | 'ticketStore'
    | 'draftStore'
    | 'costStore'
    | 'capStore'
    | 'costCapConfig'
    | 'personaId'
    | 'slackClient'
    | 'logger'
    | 'confirmingQuestionStore'
    | 'reviewQueueStore'
  >,
  'anthropicClient'
> & {
  readonly anthropicClient: ComposeDraftClient;
};

// VISION §3.4's single-project scope ("Single-project today (chief-clancy)", `project-key.ts`'s
// own TSDoc) — not an open parameter this chunk needed to resolve.
const PROJECT_KEY = 'chief-clancy';

// VISION §5.4's trust-erosion rule keeps severity assignment off the LLM layer, same reasoning
// that already keeps `composeTicketDraft` from producing one — Alex confirmed via
// `AskUserQuestion`: every auto-drafted ticket gets this fixed placeholder until a real triage
// signal exists (Stage 4+ GitHub/board integration, or a human editing it after creation).
const DEFAULT_SEVERITY = 'Medium';

/**
 * The ✅/📦 outcomes share everything except the resulting board status — factored out rather than
 * duplicated. Atomically claims the draft first (`draftStore.resolve`'s CAS): a reaction landing on
 * an already-resolved draft (a genuine double-fire, or two reactions racing) is logged and ignored,
 * not treated as an error — exactly the double-processing guard `resolvePendingTicketDraft`'s own
 * TSDoc describes. Commits `claimed.draft`'s own title, not the `draft` parameter's — the caller's
 * copy may be stale by the time this resolves (a concurrent 🔁 regeneration could have updated the
 * row's content between the caller's own lookup and this claim), and `resolve`'s `RETURNING *`
 * hands back the row's content as of the exact instant this claim won, which is the only version
 * that's still guaranteed current.
 */
async function commitAsTicket(
  deps: ReactionOutcomeDeps,
  draft: PendingTicketDraft,
  status: 'Backlog' | 'Brief',
): Promise<void> {
  const claimed = await deps.draftStore.resolve(draft.id);
  if (!claimed.ok) {
    deps.logger.info('ticket draft already resolved — ignoring reaction', {
      personaId: deps.personaId,
      draftId: draft.id,
    });
    return;
  }

  const created = await deps.ticketStore.create({
    projectKey: PROJECT_KEY,
    title: claimed.draft.draftTitle,
    status,
    severity: DEFAULT_SEVERITY,
  });
  if (!created.ok) {
    deps.logger.error('failed to create ticket from draft', {
      message: repositoryErrorMessage(created.error),
    });
    return;
  }

  deps.logger.info('committed ticket draft', {
    personaId: deps.personaId,
    draftId: draft.id,
    ticketId: created.ticket.id,
    status,
  });
}

/**
 * BUILD_PLAN 3.4a-ii's ✅ outcome: commits the draft as a real, triaged ticket (`Brief`, the board
 * status past `Backlog`'s "untriaged" meaning — VISION §3.3's lifecycle, `Backlog → Brief → ...`).
 */
export async function commitTicketDraft(
  deps: ReactionOutcomeDeps,
  draft: PendingTicketDraft,
): Promise<void> {
  await commitAsTicket(deps, draft, 'Brief');
}

/**
 * BUILD_PLAN 3.4a-ii's 📦 outcome: parks the draft as an untriaged `Backlog` ticket, per BUILD_PLAN
 * 3.4a-i's own reaction-legend wording ("park it to Backlog untriaged").
 */
export async function parkTicketDraftToBacklog(
  deps: ReactionOutcomeDeps,
  draft: PendingTicketDraft,
): Promise<void> {
  await commitAsTicket(deps, draft, 'Backlog');
}

/**
 * BUILD_PLAN 3.4a-ii's 🔁 outcome: recomposes a fresh draft from the *original* source message
 * (not the previous draft's own title/body, which may itself be why the user asked for a redo),
 * then overwrites the pending draft's content in place — not a terminal claim
 * (`draftStore.updateContent`, not `.resolve`), since regeneration leaves the draft open for a
 * further reaction. A real, billed Anthropic call like every other call site in this cascade: its
 * own fresh `checkCostCapAndAlert` check (not a stale one from whichever step dispatched here) and
 * `sonnetCostUsdMicros` accounting via `recordUsageLogged`.
 */
export async function regenerateTicketDraft(
  deps: ReactionOutcomeDeps,
  draft: PendingTicketDraft,
): Promise<void> {
  const now = new Date();
  const capCheck = await checkCostCapAndAlert(deps, now);
  if (capCheck.halt) {
    deps.logger.info(
      'skipping ticket-draft regeneration — monthly cost cap reached',
      { personaId: deps.personaId, draftId: draft.id },
    );
    return;
  }

  const recomposed = await composeTicketDraft(deps.anthropicClient, {
    text: draft.sourceMessageText,
  });
  if (!recomposed.ok) {
    deps.logger.error('failed to regenerate ticket draft', {
      message: recomposed.error.message,
    });
    return;
  }

  await recordUsageLogged(
    deps,
    {
      usage: recomposed.usage,
      costUsdMicros: sonnetCostUsdMicros(recomposed.usage, now),
    },
    now,
  );

  const updated = await deps.draftStore.updateContent(draft.id, {
    draftTitle: recomposed.title,
    draftBody: recomposed.body,
  });
  if (!updated.ok) {
    deps.logger.error('failed to persist regenerated ticket draft', {
      message: repositoryErrorMessage(updated.error),
    });
    return;
  }

  deps.logger.info('regenerated ticket draft', {
    personaId: deps.personaId,
    draftId: draft.id,
    draftTitle: updated.draft.draftTitle,
    draftBody: updated.draft.draftBody,
  });
}

/**
 * BUILD_PLAN 3.4b-ii's 👍 outcome: composes and posts a real ticket draft via the exact same
 * posting flow the High-band path uses (`postAndPersistDraft`, `handle-ambient-channel-message.ts`
 * — reused directly, not reimplemented), threaded on the confirming question's *original* source
 * message (`question.sourceMessageTs`/`sourceMessageText`), not the confirming question's own
 * posted message. Cost-cap checked before the atomic claim, not after — a halted persona leaves
 * the confirming question unresolved, so a later retry (once the cap resets) still has a real
 * question to act on, rather than silently burning the claim on an attempt that never composed
 * anything.
 *
 * Known, accepted gap (DA review, chunk 3.4b-ii, recurred a third time at chunk 3.5's own
 * `logStaleQuestionsAsSilent`, `review-queue-sweep.ts`): once the claim above succeeds, a
 * downstream failure inside `postAndPersistDraft` (a failed `composeTicketDraft` call, a failed
 * Slack post, a failed `draftStore.create`) leaves the question permanently resolved with no
 * ticket drafted and no `review_queue` fallback row — only a logged error, nothing chunk 3.5's own
 * `review-queue-sweep` script will ever surface. `commitTicketDraft`/`parkTicketDraftToBacklog`
 * above have the identical claim-then-act shape and the same unaddressed gap; fixing this needs a
 * shared design across all three call sites (e.g. a fallback log-to-review-queue on any post-claim
 * failure), not a one-off patch here — out of this chunk's own scope, tracked as a follow-up
 * rather than fixed unilaterally.
 */
export async function draftFromConfirmingQuestion(
  deps: ReactionOutcomeDeps,
  question: PendingConfirmingQuestion,
): Promise<void> {
  const now = new Date();
  const capCheck = await checkCostCapAndAlert(deps, now);
  if (capCheck.halt) {
    deps.logger.info(
      'skipping ticket-draft composition from confirming-question — monthly cost cap reached',
      { personaId: deps.personaId, questionId: question.id },
    );
    return;
  }

  const claimed = await deps.confirmingQuestionStore.resolve(question.id);
  if (!claimed.ok) {
    deps.logger.info(
      'confirming question already resolved — ignoring reaction',
      { personaId: deps.personaId, questionId: question.id },
    );
    return;
  }

  await postAndPersistDraft(
    deps,
    {
      channelId: claimed.question.channelId,
      ts: claimed.question.sourceMessageTs,
      text: claimed.question.sourceMessageText,
    },
    now,
  );
}

/**
 * BUILD_PLAN 3.4b-ii's 👎 outcome: logs a real `review_queue` row (`outcomeReason: 'mid-no'`,
 * `0009_widen_review_queue_outcome_reason.sql`'s own new value) carrying the Stage 1 classifier's
 * own `confidence`/`reasoning` through — the same context the Low-band path already provides
 * (`handle-ambient-channel-message.ts`'s `logToReviewQueue`). No billed call here, so no cost-cap
 * check, unlike the 👍 outcome above.
 */
export async function logConfirmingQuestionAsNo(
  deps: ReactionOutcomeDeps,
  question: PendingConfirmingQuestion,
): Promise<void> {
  const claimed = await deps.confirmingQuestionStore.resolve(question.id);
  if (!claimed.ok) {
    deps.logger.info(
      'confirming question already resolved — ignoring reaction',
      { personaId: deps.personaId, questionId: question.id },
    );
    return;
  }

  const created = await deps.reviewQueueStore.create({
    personaId: deps.personaId,
    channelId: claimed.question.channelId,
    messageTs: claimed.question.sourceMessageTs,
    sourceMessageText: claimed.question.sourceMessageText,
    confidence: claimed.question.confidence,
    reasoning: claimed.question.reasoning,
    outcomeReason: 'mid-no',
  });
  if (!created.ok) {
    deps.logger.error('failed to log Mid-band "no" answer to review queue', {
      personaId: deps.personaId,
      questionId: question.id,
      message: repositoryErrorMessage(created.error),
    });
    return;
  }

  deps.logger.info('logged Mid-band "no" answer to review queue', {
    personaId: deps.personaId,
    questionId: question.id,
    entryId: created.entry.id,
  });
}
