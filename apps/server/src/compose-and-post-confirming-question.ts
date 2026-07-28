import type { HandlerDeps } from './handle-inbound-message.js';
import type {
  PendingConfirmingQuestion,
  QuestionSourceSurface,
} from '@moe/core';
import type { InboundMessage } from '@moe/slack';

import { addReaction, postMessage } from '@moe/slack';

import { logAmbientIntakeToReviewQueue } from './log-ambient-intake-to-review-queue.js';
import { repositoryErrorMessage } from './repository-error.js';
import {
  evaluateCostAndRhythmGuard,
  isSituationallyAppropriate,
} from './standing-proactive-guards.js';

const ACTION_DESCRIPTION = 'confirming-question posting';

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

// VISION §5.2's "short, low-friction confirming question" — a fixed template, not an LLM-composed
// one (Alex confirmed via `AskUserQuestion`): no new billed call site, and the question's own
// wording is cheap to change later since it's a plain string, not a schema/architecture choice.
function formatConfirmingQuestionText(): string {
  return (
    'This might be worth tracking — want me to draft a ticket for it? ' +
    'React 👍 to draft it, or 👎 if not.'
  );
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

/**
 * Claims the `pending_confirming_questions` row *before* posting to Slack, keyed on the source
 * message's own ts, then posts the fixed-template question, fills in the real posted message's ts
 * on the claimed row, and seeds the 👍/👎 legend — same claim-first shape as
 * `handle-ambient-channel-message.ts`'s own `postAndPersistDraft` (BUILD_PLAN 5.2b), including that
 * it runs **no guard checks of its own**: gating is the caller's job. `composeAndPostConfirmingQuestion`
 * below (the ambient caller) only reaches it after both `evaluateCostAndRhythmGuard` and
 * `isSituationallyAppropriate` pass. BUILD_PLAN 3.7's DM cascade (`run-dm-intake-cascade.ts`)
 * calls it directly instead, deliberately running neither of those two guards — a DM-triggered
 * post is reactive rather than unprompted, the same distinction 2.7a already settled for DM replies
 * — while still running the cost cap upstream, since the classify call that routed here is billed.
 * Exported for that caller, mirroring `postAndPersistDraft`'s own precedent of being reused
 * directly by a non-ambient caller rather than reimplemented.
 */
// Extracted purely to keep `postAndPersistConfirmingQuestion` under eslint's
// `max-lines-per-function` — composition code extracts aggressively (`docs/CONVENTIONS.md` §Code
// Style). Returns `undefined` on failure, already logged.
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

export async function postAndPersistConfirmingQuestion(
  deps: HandlerDeps,
  input: ComposeAndPostConfirmingQuestionInput,
): Promise<PostAndPersistConfirmingQuestionResult> {
  const { message } = input;

  const claimed = await claimQuestion(deps, input);
  if (claimed === undefined) return { ok: false };

  // Composed once and reused for both the Slack post and the `postedText` returned below, so the
  // persisted conversation turn can never drift from what the user actually saw.
  const questionText = formatConfirmingQuestionText();
  const posted = await postMessage(deps.slackClient, {
    channelId: message.channelId,
    text: questionText,
    ...(input.surface === 'dm' ? {} : { threadTs: message.ts }),
  });
  if (!posted.ok) {
    deps.logger.error('failed to post confirming question', {
      errorMessage: posted.error.message,
    });
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
 * **BUILD_PLAN 3.9 — the off-hours branch no longer drops the message.** This path had the
 * byte-identical silent loss the High-band path did, and 3.9's own spec never mentioned it (found
 * during that chunk's recon; Alex settled covering both bands on 2026-07-27). An ambient Mid-band
 * message outside core hours now writes a `'mid-band-off-hours'` `review_queue` row rather than
 * vanishing. A *distinct* value from the High band's, not a shared one, because the digest groups
 * by reason so a human can tell causes apart: "a draft was never composed" and "a question was
 * never asked" call for different responses from Alex.
 *
 * Only the ambient caller runs this function at all — BUILD_PLAN 3.7's DM cascade calls
 * `postAndPersistConfirmingQuestion` directly and never consults the rhythm guard, so no DM can
 * produce either off-hours row. See `logAmbientIntakeToReviewQueue` for the full reasoning.
 */
export async function composeAndPostConfirmingQuestion(
  deps: HandlerDeps,
  input: ComposeAndPostConfirmingQuestionInput,
): Promise<void> {
  const { message, now, classified } = input;
  const guardInput = { message, now, actionDescription: ACTION_DESCRIPTION };
  const guard = await evaluateCostAndRhythmGuard(deps, guardInput);
  if (!guard.satisfied) {
    // Fail safe, not fail equal — mirrors `composeAndPostDraft`, whose TSDoc carries the reasoning.
    // A future third blocking reason preserves the message rather than silently dropping it.
    if (guard.reason !== 'cost-cap-reached') {
      await logAmbientIntakeToReviewQueue(deps, {
        message,
        classified,
        outcomeReason: 'mid-band-off-hours',
      });
    }
    return;
  }

  const gatePassed = await isSituationallyAppropriate(deps, guardInput);
  if (!gatePassed) return;

  await postAndPersistConfirmingQuestion(deps, input);
}
