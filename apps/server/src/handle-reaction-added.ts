import type {
  ConfirmingQuestionOutcome,
  InboundReaction,
  ReactionOutcome,
} from '@moe/slack';

import { ALEX_SLACK_USER_ID, PROJECT_KEY } from '@moe/core';
import {
  classifyConfirmingQuestionOutcome,
  classifyReactionOutcome,
} from '@moe/slack';

import {
  commitTicketDraft,
  draftFromConfirmingQuestion,
  logConfirmingQuestionAsNo,
  parkTicketDraftToBacklog,
  regenerateTicketDraft,
} from './reaction-outcome-actions.js';
import { repositoryErrorMessage } from './repository-error.js';

type ReactionOutcomeDeps = Parameters<typeof commitTicketDraft>[0];

// Extracted from `handleReactionAdded` purely to stay under eslint's `max-lines-per-function`
// (`docs/CONVENTIONS.md` §Code Style) — the pre-existing 📦/🔁/✅ dispatch, unchanged in behavior,
// just moved into its own function once BUILD_PLAN 3.4b-ii added a second, sibling dispatch below.
// The self-authored-reaction filter chunk 3.4a-ii's DA review flagged as a known gap is closed one
// layer up, in `@moe/slack`'s `handleSocketModeReactionEvent` — it compares the event's `user`
// against a `botUserId` fetched once at startup (`fetchBotUserId`) and never calls
// `onReactionAdded` for a self-authored one, so neither dispatch function here ever needs to know
// about bot identity at all.
async function dispatchDraftOutcome(
  deps: ReactionOutcomeDeps,
  reaction: InboundReaction,
  outcome: ReactionOutcome,
): Promise<void> {
  const found = await deps.draftStore.getByMessage({
    personaId: deps.personaId,
    channelId: reaction.channelId,
    messageTs: reaction.messageTs,
  });
  if (!found.ok) {
    deps.logger.error('failed to look up pending ticket draft', {
      errorMessage: repositoryErrorMessage(found.error),
    });
    return;
  }
  if (found.draft === null) return;

  // Ignored for every outcome, not just ✅/📦 — a resolved draft's ticket already exists, so a 🔁
  // redo would waste a real Anthropic call regenerating content nothing reads anymore.
  // `commitTicketDraft`/`parkTicketDraftToBacklog`'s own atomic claim (`deps.commitDraftAsTicket`,
  // `@moe/core`'s `createTicketFromDraft` — the claim-then-act fallback fix's own transactional
  // claim, not `draftStore.resolve` directly) is the race-safe backstop for the narrow window
  // between this check and that claim; this check is the common-case fast path and the only guard
  // `regenerateTicketDraft` gets.
  if (found.draft.resolvedAt !== null) {
    deps.logger.info('ignoring reaction on an already-resolved ticket draft', {
      personaId: deps.personaId,
      draftId: found.draft.id,
      outcome,
    });
    return;
  }

  if (outcome === 'commit') {
    await commitTicketDraft(deps, found.draft);
  } else if (outcome === 'park') {
    await parkTicketDraftToBacklog(deps, found.draft);
  } else {
    await regenerateTicketDraft(deps, found.draft);
  }
}

// BUILD_PLAN 3.4b-ii's own 👍/👎 dispatch — same lookup → null-check → resolved-check →
// outcome-switch shape as `dispatchDraftOutcome` above, over `pending_confirming_questions`
// instead of `pending_ticket_drafts`. `draftFromConfirmingQuestion` still claims directly via
// `deps.confirmingQuestionStore.resolve` (it can't use the transactional fix — see its own TSDoc);
// `logConfirmingQuestionAsNo` claims via `deps.resolveConfirmingQuestionAndLog` (`@moe/core`'s
// `resolveConfirmingQuestionAndLog`, the claim-then-act fallback fix's shared transactional
// primitive). Either way, each outcome runs its own atomic claim as its race-safe backstop, same
// relationship this resolved-check has to `commitDraftAsTicket`'s own claim above.
//
// BUILD_PLAN 6.1d widened this from `Promise<void>` to `Promise<boolean>`: `thumbsup` is now
// ambiguous between a Mid-band confirming-question "yes" and a Brief-approval reaction (both share
// the emoji — `docs/GLOSSARY.md`'s "Confirming question (Mid-band)" entry has the full
// disambiguation reasoning), so `handleReactionAdded` needs to know whether this function actually
// found a confirming question before deciding whether to try the Brief lookup as a fallback.
// `true` means "this message was definitively a confirming question" (found, regardless of whether
// it was already resolved, and regardless of a lookup error — none of those cases should also try
// the Brief lookup); `false` means "no confirming-question row exists for this message at all,"
// the only case where falling through to `dispatchBriefApproval` is safe/correct.
async function dispatchConfirmingQuestionOutcome(
  deps: ReactionOutcomeDeps,
  reaction: InboundReaction,
  outcome: ConfirmingQuestionOutcome,
): Promise<boolean> {
  const found = await deps.confirmingQuestionStore.getByMessage({
    personaId: deps.personaId,
    channelId: reaction.channelId,
    messageTs: reaction.messageTs,
  });
  if (!found.ok) {
    deps.logger.error('failed to look up pending confirming question', {
      errorMessage: repositoryErrorMessage(found.error),
    });
    return true; // a real error, not "not a confirming question" — don't also try Brief
  }
  if (found.question === null) return false; // genuinely not a confirming question

  if (found.question.resolvedAt !== null) {
    deps.logger.info(
      'ignoring reaction on an already-resolved confirming question',
      { personaId: deps.personaId, questionId: found.question.id, outcome },
    );
    return true; // definitively a confirming question, just already resolved
  }

  if (outcome === 'yes') {
    await draftFromConfirmingQuestion(deps, found.question);
  } else {
    await logConfirmingQuestionAsNo(deps, found.question);
  }
  return true;
}

// The non-ok half of `ApproveBriefResult` (`approve-brief-via-reaction.ts`), derived the same
// `Parameters<>`/`ReturnType<>` way `ReactionOutcomeDeps` itself is, rather than importing the
// named type directly — this file already leans on that derivation idiom for every dep-shaped
// type it needs.
type BriefApprovalFailure = Extract<
  Awaited<ReturnType<ReactionOutcomeDeps['approveBriefAndTransitionToPlan']>>,
  { readonly ok: false }
>['error'];

// Extracted from `dispatchBriefApproval` purely to stay under eslint's `max-lines-per-function`
// (`docs/CONVENTIONS.md` §Code Style) — every non-`ok` outcome's own logging decision, branched by
// `ApproveBriefResult`'s error kind.
function logBriefApprovalFailure(
  deps: ReactionOutcomeDeps,
  ticketId: string,
  error: BriefApprovalFailure,
): void {
  if (error.kind === 'unavailable') {
    // Ticket already moved on (double-fire / already-approved) — transitionTicketStatus's own
    // fromStatus CAS didn't match. Not an error.
    deps.logger.info(
      'ignoring brief-approval reaction — ticket already transitioned',
      { ticketId },
    );
    return;
  }
  if (error.kind === 'claim-failed') {
    // Branch on the preserved claimError kind, same split `runPullLoopTick`'s own claim-failure
    // handling uses — 'unavailable' is the expected multi-persona race-loss outcome (up to 8
    // processes may all be members of #moe-team and all receive the same reaction event); anything
    // else (validation-failed/unknown) is a real problem and must not be silently downgraded to
    // routine race noise.
    if (error.claimError.kind === 'unavailable') {
      deps.logger.info(
        'ignoring brief-approval reaction — another process already claimed this ticket',
        { ticketId },
      );
    } else {
      deps.logger.error(
        'failed to claim ticket for reaction-triggered brief approval',
        { ticketId, errorKind: error.claimError.kind },
      );
    }
    return;
  }
  if (error.kind === 'wip-limit-blocked') {
    // Confirmed with Alex: silent no-op, fail closed. Logged for observability only.
    deps.logger.info(
      'brief-approval reaction blocked by plan wip limit, ticket stays in brief',
      { ticketId },
    );
    return;
  }
  deps.logger.error(
    'unexpected error transitioning brief to plan via reaction',
    {
      ticketId,
      errorKind: error.kind,
    },
  );
}

// BUILD_PLAN 6.1d's own 👍-on-a-Brief dispatch — reached only when `dispatchConfirmingQuestionOutcome`
// above has just returned `false` for a `thumbsup` reaction (genuinely no confirming question at
// this message), so `thumbsup`'s pre-existing meaning is never shadowed: this is purely a fallback
// for the *other* thing `thumbsup` can now mean (VISION §6.3: "👍 on a brief = approval").
// Same lookup → null-check shape as `dispatchDraftOutcome`/`dispatchConfirmingQuestionOutcome`
// above, over `ticket_briefs` instead. The identity check runs first and needs no DB round trip at
// all — `docs/GLOSSARY.md`'s "Confirming question (Mid-band)" entry has the full disambiguation
// reasoning for why `thumbsup` is content-scoped (by reactor identity, not just by message) rather
// than a second reaction short-name.
async function dispatchBriefApproval(
  deps: ReactionOutcomeDeps,
  reaction: InboundReaction,
): Promise<void> {
  if (reaction.userId !== ALEX_SLACK_USER_ID) return; // not Alex — no DB lookup needed at all

  const found = await deps.briefStore.getByMessage({
    channelId: reaction.channelId,
    messageTs: reaction.messageTs,
  });
  if (!found.ok) {
    deps.logger.error('failed to look up ticket brief', {
      errorMessage: repositoryErrorMessage(found.error),
    });
    return;
  }
  if (found.brief === null) return; // some other thumbsup, not on a brief message

  const result = await deps.approveBriefAndTransitionToPlan({
    ticketId: found.brief.ticketId,
    projectKey: PROJECT_KEY,
    claimedBy: deps.personaId,
  });

  if (result.ok) {
    deps.logger.info(
      'brief approved via reaction, ticket transitioned to plan',
      { ticketId: found.brief.ticketId },
    );
    return;
  }
  logBriefApprovalFailure(deps, found.brief.ticketId, result.error);
}

/**
 * Real, live as of BUILD_PLAN 3.4a-iii: `start-slack-listener.ts` registers a real Socket Mode
 * `reaction_added` listener (`createSocketModeListener`'s `onReactionAdded` opt, `@moe/slack`)
 * wired to `createReactionHandler` below. As of BUILD_PLAN 3.4b-ii, a reaction is classified
 * against *both* legends — the pre-existing 📦/🔁/✅ (High-band draft outcomes) and the new 👍/👎
 * (Mid-band confirming-question answers) — deliberately disjoint short-names (verified at 3.4b-i
 * against Slack's own event docs) so no message-type lookup collision needs resolving here; a
 * reaction outside both is ignored without any repository lookup at all.
 *
 * BUILD_PLAN 6.1d adds a third fallthrough: `thumbsup` is now *also* claimed by Brief approval
 * (VISION §6.3), reusing the emoji rather than adding a new one (`docs/GLOSSARY.md`'s "Confirming
 * question (Mid-band)" entry has the full reasoning). Gated specifically on `outcome === 'yes'` —
 * only `thumbsup` collides with Brief approval; `thumbsdown` has no Brief equivalent and must never
 * fall through — and only once `dispatchConfirmingQuestionOutcome` has confirmed this message
 * genuinely isn't a confirming question (`matchedConfirmingQuestion === false`).
 */
export async function handleReactionAdded(
  deps: ReactionOutcomeDeps,
  reaction: InboundReaction,
): Promise<void> {
  const draftOutcome = classifyReactionOutcome(reaction.reactionName);
  if (draftOutcome !== undefined) {
    await dispatchDraftOutcome(deps, reaction, draftOutcome);
    return;
  }

  const questionOutcome = classifyConfirmingQuestionOutcome(
    reaction.reactionName,
  );
  if (questionOutcome !== undefined) {
    const matchedConfirmingQuestion = await dispatchConfirmingQuestionOutcome(
      deps,
      reaction,
      questionOutcome,
    );
    if (!matchedConfirmingQuestion && questionOutcome === 'yes') {
      await dispatchBriefApproval(deps, reaction);
    }
  }
}

/**
 * Binds `handleReactionAdded` to one persona's deps, same factory shape as
 * `createInboundMessageHandler` — `start-slack-listener.ts` passes the result straight through as
 * `createSocketModeListener`'s `onReactionAdded` opt.
 */
export function createReactionHandler(
  deps: ReactionOutcomeDeps,
): (reaction: InboundReaction) => Promise<void> {
  return (reaction) => handleReactionAdded(deps, reaction);
}
