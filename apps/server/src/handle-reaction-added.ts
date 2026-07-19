import type {
  ConfirmingQuestionOutcome,
  InboundReaction,
  ReactionOutcome,
} from '@moe/slack';

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
    channelId: reaction.channelId,
    messageTs: reaction.messageTs,
  });
  if (!found.ok) {
    deps.logger.error('failed to look up pending ticket draft', {
      message: repositoryErrorMessage(found.error),
    });
    return;
  }
  if (found.draft === null) return;

  // Ignored for every outcome, not just ✅/📦 — a resolved draft's ticket already exists, so a 🔁
  // redo would waste a real Anthropic call regenerating content nothing reads anymore.
  // `commitTicketDraft`/`parkTicketDraftToBacklog`'s own atomic claim (`draftStore.resolve`) is
  // the race-safe backstop for the narrow window between this check and that claim; this check is
  // the common-case fast path and the only guard `regenerateTicketDraft` gets.
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
// instead of `pending_ticket_drafts`. `draftFromConfirmingQuestion`/`logConfirmingQuestionAsNo`
// each run their own atomic claim (`confirmingQuestionStore.resolve`) as their race-safe backstop,
// same relationship this resolved-check has to `draftStore.resolve` above.
async function dispatchConfirmingQuestionOutcome(
  deps: ReactionOutcomeDeps,
  reaction: InboundReaction,
  outcome: ConfirmingQuestionOutcome,
): Promise<void> {
  const found = await deps.confirmingQuestionStore.getByMessage({
    channelId: reaction.channelId,
    messageTs: reaction.messageTs,
  });
  if (!found.ok) {
    deps.logger.error('failed to look up pending confirming question', {
      message: repositoryErrorMessage(found.error),
    });
    return;
  }
  if (found.question === null) return;

  if (found.question.resolvedAt !== null) {
    deps.logger.info(
      'ignoring reaction on an already-resolved confirming question',
      { personaId: deps.personaId, questionId: found.question.id, outcome },
    );
    return;
  }

  if (outcome === 'yes') {
    await draftFromConfirmingQuestion(deps, found.question);
  } else {
    await logConfirmingQuestionAsNo(deps, found.question);
  }
}

/**
 * Real, live as of BUILD_PLAN 3.4a-iii: `start-slack-listener.ts` registers a real Socket Mode
 * `reaction_added` listener (`createSocketModeListener`'s `onReactionAdded` opt, `@moe/slack`)
 * wired to `createReactionHandler` below. As of BUILD_PLAN 3.4b-ii, a reaction is classified
 * against *both* legends — the pre-existing 📦/🔁/✅ (High-band draft outcomes) and the new 👍/👎
 * (Mid-band confirming-question answers) — deliberately disjoint short-names (verified at 3.4b-i
 * against Slack's own event docs) so no message-type lookup collision needs resolving here; a
 * reaction outside both is ignored without any repository lookup at all.
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
    await dispatchConfirmingQuestionOutcome(deps, reaction, questionOutcome);
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
