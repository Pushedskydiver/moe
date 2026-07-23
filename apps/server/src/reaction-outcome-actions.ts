import type { HandlerDeps } from './handle-inbound-message.js';
import type {
  CommitTicketDraftResult,
  NewTicket,
  PendingConfirmingQuestion,
  PendingTicketDraft,
  ResolveConfirmingQuestionAndLogResult,
} from '@moe/core';

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
// `ticketStore`/`draftStore`. `commitDraftAsTicket`/`resolveConfirmingQuestionAndLog` added by
// the claim-then-act fallback fix — bound directly on `ReactionOutcomeDeps` itself, not threaded
// through `HandlerDeps`, since they're a reaction-outcome-only concern the message-handling path
// (`handle-inbound-message.ts`'s own separate `HandlerDeps`-typed construction in
// `start-slack-listener.ts`) never needs; adding them to `HandlerDeps` would force that unrelated
// path to also supply them.
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
  readonly commitDraftAsTicket: (input: {
    readonly draftId: string;
    readonly ticket: Omit<NewTicket, 'title'>;
  }) => Promise<CommitTicketDraftResult>;
  readonly resolveConfirmingQuestionAndLog: (input: {
    readonly questionId: string;
    readonly personaId: string;
    readonly outcomeReason: 'mid-no' | 'mid-silence';
  }) => Promise<ResolveConfirmingQuestionAndLogResult>;
};

// VISION §3.4's single-project scope ("Single-project today (chief-clancy)", `project-key.ts`'s
// own TSDoc) — not an open parameter this chunk needed to resolve.
const PROJECT_KEY = 'chief-clancy';

// VISION §5.4's trust-erosion rule keeps severity assignment off the LLM layer, same reasoning
// that already keeps `composeTicketDraft` from producing one — Alex confirmed via
// `AskUserQuestion`: every auto-drafted ticket gets this fixed placeholder until a real triage
// signal exists (Stage 4+ GitHub/board integration, or a human editing it after creation).
const DEFAULT_SEVERITY = 'Medium';

// docs/decisions/BOARD-AND-CAPACITY-MODEL.md's Decision 3: classOfService is deliberately not
// derived from severity (a different Kanban concept), so it needs its own placeholder — every
// auto-drafted ticket gets 'Standard' until a real Expedite-detection signal exists (an
// #moe-incidents-sourced message, or a real, non-placeholder 'Critical' severity), same
// hardcoded-until-real-signal shape as `DEFAULT_SEVERITY` above.
const DEFAULT_CLASS_OF_SERVICE = 'Standard';

/**
 * The ✅/📦 outcomes share everything except the resulting board status — factored out rather than
 * duplicated. `deps.commitDraftAsTicket` (`@moe/core`'s `createTicketFromDraft`) atomically claims
 * the draft and creates the ticket in one transaction: a reaction landing on an already-resolved
 * draft (a genuine double-fire, or two reactions racing) is logged and ignored, not treated as an
 * error — the same double-processing guard `resolvePendingTicketDraft`'s own TSDoc describes — and
 * a downstream ticket-creation failure now rolls back the claim too (the claim-then-act
 * failure-recovery fix), leaving the draft available for a future retry rather than permanently
 * burning it on a logged error. `createTicketFromDraft`'s own TSDoc has the full reasoning,
 * including why the ticket's title is read from the claimed row inside the transaction rather than
 * passed in from here — the caller's own `draft` parameter can be stale by the time the claim
 * resolves (a concurrent 🔁 regeneration isn't gated on `resolvedAt`), so only the post-claim row
 * is still guaranteed current.
 */
async function commitAsTicket(
  deps: ReactionOutcomeDeps,
  draft: PendingTicketDraft,
  status: 'Backlog' | 'Brief',
): Promise<void> {
  const result = await deps.commitDraftAsTicket({
    draftId: draft.id,
    ticket: {
      projectKey: PROJECT_KEY,
      status,
      severity: DEFAULT_SEVERITY,
      classOfService: DEFAULT_CLASS_OF_SERVICE,
    },
  });
  if (!result.ok) {
    if (result.error.step === 'claim') {
      deps.logger.info('ticket draft already resolved — ignoring reaction', {
        personaId: deps.personaId,
        draftId: draft.id,
      });
    } else {
      deps.logger.error('failed to create ticket from draft', {
        errorMessage: repositoryErrorMessage(result.error.error),
      });
    }
    return;
  }

  deps.logger.info('committed ticket draft', {
    personaId: deps.personaId,
    draftId: draft.id,
    ticketId: result.ticket.id,
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
      errorMessage: recomposed.error.message,
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
      errorMessage: repositoryErrorMessage(updated.error),
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

// Extracted from `draftFromConfirmingQuestion` purely to stay under eslint's
// `max-lines-per-function` — the claim-then-act fallback fix's own last-resort write: once a
// confirming question's claim has won but `postAndPersistDraft` then fails (composition, the
// Slack post, or persistence — see that function's own TSDoc for the sub-step breakdown), this
// logs a `review_queue` row (`outcomeReason: 'mid-yes-failed'`) so the confirming question's own
// context isn't lost the way it was before this fix — only a logged error, with the question left
// permanently resolved and no trace anywhere a human would see. Unlike sites 1/3/4's own DB
// transaction (`createTicketFromDraft`/`resolveConfirmingQuestionAndLog`), this can't roll the
// claim itself back — `postAndPersistDraft`'s own Anthropic/Slack calls sit between the claim and
// its final DB write, so a DB transaction can neither hold open across two slow external calls nor
// undo an already-sent Slack message — so this is a best-effort fallback, not a full close: if
// this write also fails, or the process crashes/restarts between the claim winning and this write
// completing, the gap is accepted as a documented residual risk, the same shape `check-cost-
// cap.ts`'s own fail-open reasoning already uses elsewhere in this codebase.
async function logFailedDraftAttempt(
  deps: ReactionOutcomeDeps,
  question: PendingConfirmingQuestion,
): Promise<void> {
  const created = await deps.reviewQueueStore.create({
    personaId: deps.personaId,
    channelId: question.channelId,
    messageTs: question.sourceMessageTs,
    sourceMessageText: question.sourceMessageText,
    confidence: question.confidence,
    reasoning: question.reasoning,
    outcomeReason: 'mid-yes-failed',
  });
  if (!created.ok) {
    deps.logger.error(
      'failed to log Mid-band "yes" draft failure to review queue',
      {
        personaId: deps.personaId,
        questionId: question.id,
        errorMessage: repositoryErrorMessage(created.error),
      },
    );
  }
}

/**
 * BUILD_PLAN 3.4b-ii's 👍 outcome: composes and posts a real ticket draft via the exact same
 * posting flow the High-band path uses (`postAndPersistDraft`, `handle-ambient-channel-message.ts`
 * — reused directly, not reimplemented), threaded on the confirming question's *original* source
 * message (`question.sourceMessageTs`/`sourceMessageText`), not the confirming question's own
 * posted message. Cost-cap checked before the atomic claim, not after — a halted persona leaves
 * the confirming question unresolved, so a later retry (once the cap resets) still has a real
 * question to act on, rather than silently burning the claim on an attempt that never composed
 * anything. If `postAndPersistDraft` fails after the claim wins, `logFailedDraftAttempt` writes a
 * `review_queue` fallback row (the claim-then-act fallback fix) — see its own TSDoc for why this
 * site needs a fallback write rather than the transactional fix `commitAsTicket`/
 * `logConfirmingQuestionAsNo`/chunk 3.5's `logStaleQuestionsAsSilent` all use instead.
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

  const posted = await postAndPersistDraft(
    deps,
    {
      channelId: claimed.question.channelId,
      ts: claimed.question.sourceMessageTs,
      text: claimed.question.sourceMessageText,
    },
    { now, origin: 'mid-band-confirmed' },
  );
  if (!posted.ok) {
    await logFailedDraftAttempt(deps, claimed.question);
  }
}

/**
 * BUILD_PLAN 3.4b-ii's 👎 outcome: logs a real `review_queue` row (`outcomeReason: 'mid-no'`,
 * `0009_widen_review_queue_outcome_reason.sql`'s own new value) carrying the Stage 1 classifier's
 * own `confidence`/`reasoning` through — the same context the Low-band path already provides
 * (`handle-ambient-channel-message.ts`'s `logToReviewQueue`). No billed call here, so no cost-cap
 * check, unlike the 👍 outcome above. `deps.resolveConfirmingQuestionAndLog` (`@moe/core`'s
 * `resolveConfirmingQuestionAndLog`) atomically claims the question and writes the row in one
 * transaction — the claim-then-act failure-recovery fix, shared with chunk 3.5's
 * `logStaleQuestionsAsSilent` (`review-queue-sweep.ts`), which had the identical shape before this
 * fix.
 */
export async function logConfirmingQuestionAsNo(
  deps: ReactionOutcomeDeps,
  question: PendingConfirmingQuestion,
): Promise<void> {
  const result = await deps.resolveConfirmingQuestionAndLog({
    questionId: question.id,
    personaId: deps.personaId,
    outcomeReason: 'mid-no',
  });
  if (!result.ok) {
    if (result.error.step === 'claim') {
      deps.logger.info(
        'confirming question already resolved — ignoring reaction',
        { personaId: deps.personaId, questionId: question.id },
      );
    } else {
      deps.logger.error('failed to log Mid-band "no" answer to review queue', {
        personaId: deps.personaId,
        questionId: question.id,
        errorMessage: repositoryErrorMessage(result.error.error),
      });
    }
    return;
  }

  deps.logger.info('logged Mid-band "no" answer to review queue', {
    personaId: deps.personaId,
    questionId: question.id,
    entryId: result.entry.id,
  });
}
