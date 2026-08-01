import type { HandlerDeps } from './handle-inbound-message.js';
import type {
  PendingConfirmingQuestion,
  QuestionSourceSurface,
} from '@moe/core';
import type { InboundMessage } from '@moe/slack';

import {
  composeConfirmingQuestionLeadIn,
  fetchPersonaPromptContent,
  resolvePersonaModel,
  sonnetCostUsdMicros,
} from '@moe/agents';
import { addReaction, postMessage } from '@moe/slack';

import {
  evaluateMidBandCostAndRhythmOutcomeReason,
  shouldLogAppropriatenessFailure,
} from './ambient-guard-outcome-reason.js';
import { checkCostCapAndAlert } from './check-cost-cap.js';
import { logAmbientIntakeToReviewQueue } from './log-ambient-intake-to-review-queue.js';
import { recordUsageLogged } from './record-usage-logged.js';
import { repositoryErrorMessage } from './repository-error.js';
import {
  evaluateCostAndRhythmGuard,
  evaluateSenderFrequencyGuard,
  evaluateSituationalAppropriatenessGuard,
} from './standing-proactive-guards.js';

const ACTION_DESCRIPTION = 'confirming-question posting';
const FIXED_TRAILER = 'React 👍 to draft it, or 👎 if not.';

// VISION §5.2's Mid-band reaction legend — 👍 (yes, draft it) / 👎 (no) — deliberately distinct
// from the High-band 📦/🔁/✅ legend so a later reaction-outcome dispatch (BUILD_PLAN 3.4b-ii) can
// tell the two apart by reaction name alone, no message-type lookup collision to resolve. Slack's
// own `reaction_added` event sends the descriptive alias, not GitHub-style `+1`/`-1` shorthand —
// confirmed against Slack's own published event reference (its own example payload literally
// shows `"reaction": "thumbsup"`), not guessed from `iamcal/emoji-data`'s primary/alias field
// split, which would have given the wrong answer here.
const ANSWER_REACTION_LEGEND = ['👍', '👎'] as const;
const REACTION_NAME_BY_LEGEND_EMOJI: Readonly<
  Record<(typeof ANSWER_REACTION_LEGEND)[number], string>
> = {
  '👍': 'thumbsup',
  '👎': 'thumbsdown',
};

// VISION §5.2's "short, low-friction confirming question" — a fixed template originally (Alex
// confirmed via `AskUserQuestion`), now persona-voiced when the lead-in composition succeeds
// (BUILD_PLAN 5.3a-ii). `leadIn` is `undefined` on any compose failure (including a cost-cap
// halt, treated identically) — the trailer naming the literal 👍/👎 mechanic is always the same,
// code-controlled string regardless, so the interactive affordance can never drift out of sync
// with what the model happened to say.
function formatConfirmingQuestionText(leadIn: string | undefined): string {
  return leadIn !== undefined
    ? `${leadIn} ${FIXED_TRAILER}`
    : `This might be worth tracking — want me to draft a ticket for it? ${FIXED_TRAILER}`;
}

// Recursive, not a loop or `.reduce()` (`docs/CONVENTIONS.md`'s Code Style section bans the
// latter outright) — mirrors `handle-ambient-channel-message.ts`'s own `seedReactionLegend`
// exactly, including its "log one failed reaction, still attempt the rest" behavior.
type SeedAnswerLegendInput = {
  readonly message: InboundMessage;
  readonly questionMessageTs: string;
  readonly remaining: readonly (typeof ANSWER_REACTION_LEGEND)[number][];
};

async function seedAnswerLegend(
  deps: HandlerDeps,
  input: SeedAnswerLegendInput,
): Promise<void> {
  const [emoji, ...rest] = input.remaining;
  if (emoji === undefined) return;

  const added = await addReaction(deps.slackClient, {
    channelId: input.message.channelId,
    messageTs: input.questionMessageTs,
    reactionName: REACTION_NAME_BY_LEGEND_EMOJI[emoji],
  });
  if (!added.ok) {
    deps.logger.error('failed to add confirming-question legend reaction', {
      personaId: deps.personaId,
      channelId: input.message.channelId,
      reactionName: REACTION_NAME_BY_LEGEND_EMOJI[emoji],
      errorMessage: added.error.message,
    });
  }

  await seedAnswerLegend(deps, { ...input, remaining: rest });
}

// Bundled into one object, not 3 more params — would otherwise cross eslint's `max-params: 3`,
// same reasoning `standing-proactive-guards.ts`'s own `StandingProactiveGuardInput` documents.
// `classified` carries the Stage 1 classifier's own confidence/reasoning through so a 👎 answer
// (`logConfirmingQuestionAsNo`, BUILD_PLAN 3.4b-ii, `reaction-outcome-actions.ts`) can log it to
// `review_queue` with the same context the Low-band path already provides.
export type ComposeAndPostConfirmingQuestionInput = {
  readonly message: InboundMessage;
  readonly now: Date;
  readonly classified: {
    readonly confidence: number;
    readonly reasoning: string;
  };
  // Same surface-decides-placement rule as `postAndPersistDraft`'s own `surface` option — see its
  // TSDoc for why a DM post is top-level rather than threaded. Also persisted on the
  // `pending_confirming_questions` row, because the 👍 outcome posts its draft long after this
  // `InboundMessage` is gone and would otherwise have no way to match the question's own placement.
  readonly surface: QuestionSourceSurface;
};

// Mirrors `handle-ambient-channel-message.ts`'s own `PostAndPersistDraftResult` exactly, and for
// the same BUILD_PLAN 3.7 reason — see that type's TSDoc. `postedText` is what the DM cascade
// persists as the assistant's `conversation_turns` row when a Mid-band DM is answered with a
// confirming question instead of a chat reply.
export type PostAndPersistConfirmingQuestionResult =
  { readonly ok: true; readonly postedText: string } | { readonly ok: false };

// Extracted purely to keep `postAndPersistConfirmingQuestion` under eslint's
// `max-lines-per-function` — composition code extracts aggressively (`docs/CONVENTIONS.md` §Code
// Style). Returns `undefined` on failure, already logged. Claims the `pending_confirming_questions`
// row *before* posting to Slack, keyed on the source message's own ts (BUILD_PLAN 5.2b) — see
// `postAndPersistConfirmingQuestion`'s own TSDoc below for the full claim-first reasoning.
async function claimQuestion(
  deps: HandlerDeps,
  input: ComposeAndPostConfirmingQuestionInput,
): Promise<PendingConfirmingQuestion | undefined> {
  const { message, classified } = input;
  const claimed = await deps.confirmingQuestionStore.create({
    personaId: deps.personaId,
    channelId: message.channelId,
    sourceSurface: input.surface,
    sourceMessageTs: message.ts,
    sourceMessageText: message.text,
    confidence: classified.confidence,
    reasoning: classified.reasoning,
  });
  if (!claimed.ok) {
    deps.logger.error('failed to claim pending confirming question', {
      errorMessage: repositoryErrorMessage(claimed.error),
    });
    return undefined;
  }
  return claimed.question;
}

// Extracted for the same `max-lines-per-function` reason as `claimQuestion` above — mirrors
// `handle-ambient-channel-message.ts`'s own `releaseDraftClaimAfterPostFailure` exactly (DA
// review, BUILD_PLAN 5.2b).
async function releaseQuestionClaimAfterPostFailure(
  deps: HandlerDeps,
  claimedId: string,
): Promise<void> {
  const released = await deps.confirmingQuestionStore.releaseClaim(claimedId);
  if (!released.ok) {
    deps.logger.error('failed to release pending confirming question claim', {
      errorMessage: String(released.error.cause),
    });
  }
}

// Extracted for the same `max-lines-per-function` reason as `claimQuestion` above. Treats a
// cost-cap halt exactly like a compose failure — skip the billed call, return `undefined` so the
// caller falls back to the fixed template — rather than blocking the whole confirming-question
// action the way the High-band draft path's own cap check does (BUILD_PLAN 5.3a-ii, redesigned
// after spec-grill R1 flagged the original "gate the whole call site" draft of this fix as a
// regression risk: the DM cascade's own Mid band always posts *something*, for free, regardless
// of spend state, and gating entry here would have silently taken that away). Covers both real
// callers from one shared location. **Not a redundant no-op on the ambient path** (DA review
// caught an earlier draft of this comment claiming it was): `composeAndPostConfirmingQuestion`
// below runs `evaluateCostAndRhythmGuard`'s own cap check, but `evaluateSituationalAppropriatenessGuard`'s
// own billed Haiku call (and its `recordUsageLogged`) runs *between* that check and this one, so
// spend can genuinely cross the cap inside this exact turn — the same "the classify/gate call that
// routed here is itself billed and already recorded" reasoning `run-dm-intake-cascade.ts`'s own
// High-band comment already documents for an identical shape. `run-dm-intake-cascade.ts`'s Mid
// band has no upstream check for this specific spend at all, so this is its only gate.
async function composeLeadInUnlessCapped(
  deps: HandlerDeps,
  input: ComposeAndPostConfirmingQuestionInput,
): Promise<string | undefined> {
  const capCheck = await checkCostCapAndAlert(deps, input.now);
  if (capCheck.halt) {
    deps.logger.info(
      'skipping confirming-question lead-in composition — monthly cost cap reached',
      { personaId: deps.personaId, channelId: input.message.channelId },
    );
    return undefined;
  }

  const composed = await composeConfirmingQuestionLeadIn(deps.anthropicClient, {
    text: input.message.text,
    confidence: input.classified.confidence,
    reasoning: input.classified.reasoning,
    model: resolvePersonaModel(deps.personaId),
    personaPromptContent: await fetchPersonaPromptContent(
      deps.personaId,
      deps.logger,
    ),
  });
  if (!composed.ok) {
    deps.logger.error('failed to compose confirming-question lead-in', {
      errorMessage: composed.error.message,
    });
    return undefined;
  }

  await recordUsageLogged(
    deps,
    {
      usage: composed.usage,
      costUsdMicros: sonnetCostUsdMicros(composed.usage, input.now),
    },
    input.now,
  );

  return composed.questionLeadIn;
}

/**
 * Claims the `pending_confirming_questions` row *before* posting to Slack, keyed on the source
 * message's own ts, then posts the (now persona-voiced, BUILD_PLAN 5.3a-ii) question, fills in the
 * real posted message's ts on the claimed row, and seeds the 👍/👎 legend — same claim-first shape
 * as `handle-ambient-channel-message.ts`'s own `postAndPersistDraft` (BUILD_PLAN 5.2b). Runs no
 * *ambient-appropriateness* guard checks of its own — that gating is still the caller's job, exactly
 * as before 5.3a-ii — but does now run its own cost-cap check internally, ahead of the billed
 * lead-in composition (`composeLeadInUnlessCapped`), since that spend has no other gate on the DM
 * path. `composeAndPostConfirmingQuestion` below (the ambient caller) only reaches this function
 * after both `evaluateCostAndRhythmGuard` and `evaluateSituationalAppropriatenessGuard` pass.
 * BUILD_PLAN 3.7's DM cascade (`run-dm-intake-cascade.ts`) calls it directly instead, deliberately
 * running neither of those two guards — a DM-triggered post is reactive rather than unprompted,
 * the same distinction 2.7a already settled for DM replies — while still running the cost cap
 * upstream twice: once inside `classifyMessageForIntake` for the billed classify call, and again
 * inside this function for the billed lead-in composition. Exported for that caller, mirroring
 * `postAndPersistDraft`'s own precedent of being reused directly by a non-ambient caller rather
 * than reimplemented.
 */
export async function postAndPersistConfirmingQuestion(
  deps: HandlerDeps,
  input: ComposeAndPostConfirmingQuestionInput,
): Promise<PostAndPersistConfirmingQuestionResult> {
  const { message } = input;

  const leadIn = await composeLeadInUnlessCapped(deps, input);

  const claimed = await claimQuestion(deps, input);
  if (claimed === undefined) return { ok: false };

  // Composed once and reused for both the Slack post and the `postedText` returned below, so the
  // persisted conversation turn can never drift from what the user actually saw.
  const questionText = formatConfirmingQuestionText(leadIn);
  const posted = await postMessage(deps.slackClient, {
    channelId: message.channelId,
    text: questionText,
    ...(input.surface === 'dm' ? {} : { threadTs: message.ts }),
  });
  if (!posted.ok) {
    deps.logger.error('failed to post confirming question', {
      errorMessage: posted.error.message,
    });
    await releaseQuestionClaimAfterPostFailure(deps, claimed.id);
    return { ok: false };
  }

  const marked = await deps.confirmingQuestionStore.markPosted(
    claimed.id,
    posted.ts,
  );
  if (!marked.ok) {
    deps.logger.error('failed to mark pending confirming question posted', {
      errorMessage:
        marked.error.kind === 'unavailable'
          ? 'question was already marked posted, or no longer exists'
          : repositoryErrorMessage(marked.error),
    });
    return { ok: false };
  }

  await seedAnswerLegend(deps, {
    message,
    questionMessageTs: posted.ts,
    remaining: ANSWER_REACTION_LEGEND,
  });

  deps.logger.info('posted mid-band confirming question', {
    personaId: deps.personaId,
    channelId: message.channelId,
    questionId: claimed.id,
  });
  return { ok: true, postedText: questionText };
}

/**
 * BUILD_PLAN 3.4b-i's Mid-band action: gated by the same cost-cap+operating-rhythm guard and
 * situational-appropriateness gate the High-band draft path uses
 * (`standing-proactive-guards.ts`), then posts a fixed-template confirming question against the
 * source message — in-thread for an ambient one, top-level for a DM (`surface`) — persists a `pending_confirming_questions` row keyed on the posted message,
 * and seeds the 👍/👎 legend (`postAndPersistConfirmingQuestion`).
 *
 * **BUILD_PLAN 3.9 — the off-hours branch no longer drops the message, and BUILD_PLAN 3.10 — nor
 * do the other two guard exits.** This path has the byte-identical guard chain the High-band draft
 * path does (`composeAndPostDraft`, whose own TSDoc carries the full reasoning this one mirrors):
 * every way this function can decline to post now writes a `review_queue` row except a genuine
 * `appropriate: false` verdict, which stays silent by design. Each `outcomeReason` is a *distinct*
 * value from the High band's, not a shared one, because the digest groups by reason so a human can
 * tell causes apart: "a draft was never composed" and "a question was never asked" call for
 * different responses from Alex.
 *
 * Only the ambient caller runs this function at all — BUILD_PLAN 3.7's DM cascade calls
 * `postAndPersistConfirmingQuestion` directly and never consults either guard, so no DM can
 * produce any of these rows. See `logAmbientIntakeToReviewQueue` for the full reasoning. The
 * cost-and-rhythm label choice and the appropriateness-failure log decision are both shared,
 * exhaustive-`switch` helpers (`ambient-guard-outcome-reason.ts`) — see that file's own TSDoc for
 * why each needs to be exhaustive rather than a ternary/equality check.
 *
 * **BUILD_PLAN 5.3a — `evaluateSenderFrequencyGuard` runs first here too**, mirroring
 * `composeAndPostDraft`'s own reasoning byte-for-byte: cheapest guard first, always writes
 * `'mid-band-repeated-sender'` on block (infra-shaped suppression, not a considered verdict).
 */
export async function composeAndPostConfirmingQuestion(
  deps: HandlerDeps,
  input: ComposeAndPostConfirmingQuestionInput,
): Promise<void> {
  const { message, now, classified } = input;
  const guardInput = { message, now, actionDescription: ACTION_DESCRIPTION };

  const frequency = evaluateSenderFrequencyGuard(deps, guardInput);
  if (!frequency.satisfied) {
    await logAmbientIntakeToReviewQueue(deps, {
      message,
      classified,
      outcomeReason: 'mid-band-repeated-sender',
    });
    return;
  }

  const guard = await evaluateCostAndRhythmGuard(deps, guardInput);
  if (!guard.satisfied) {
    await logAmbientIntakeToReviewQueue(deps, {
      message,
      classified,
      outcomeReason: evaluateMidBandCostAndRhythmOutcomeReason(guard.reason),
    });
    return;
  }

  const appropriateness = await evaluateSituationalAppropriatenessGuard(
    deps,
    guardInput,
  );
  if (!appropriateness.satisfied) {
    if (shouldLogAppropriatenessFailure(appropriateness.reason)) {
      await logAmbientIntakeToReviewQueue(deps, {
        message,
        classified,
        outcomeReason: 'mid-band-appropriateness-check-failed',
      });
    }
    return;
  }

  await postAndPersistConfirmingQuestion(deps, input);
}
