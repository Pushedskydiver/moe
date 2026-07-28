import type { HandlerDeps } from './handle-inbound-message.js';
import type { ReviewQueueEntry } from '@moe/core';
import type { InboundMessage } from '@moe/slack';

import { repositoryErrorMessage } from './repository-error.js';

// Only what this function actually reads off `HandlerDeps` — same "require what's used, not the
// whole bag" reasoning `handle-ambient-channel-message.ts`'s own `DraftPostingDeps` documents.
export type ReviewQueueLoggingDeps = Pick<
  HandlerDeps,
  'logger' | 'personaId' | 'reviewQueueStore'
>;

// The seven ambient outcome reasons this function writes. Deliberately a narrowed subset of
// `ReviewQueueEntry['outcomeReason']` rather than the full union: the other three values
// (`'mid-no'`, `'mid-silence'`, `'mid-yes-failed'`) all belong to the confirming-question answer
// lifecycle and are written elsewhere, two of them transactionally inside
// `resolveConfirmingQuestionAndLog`. Narrowing here means a future value cannot reach this write
// path by accident just because it was added to the enum.
//
// BUILD_PLAN 3.10 added the four `'…-cost-cap'`/`'…-appropriateness-check-failed'` values,
// closing the ambient guard chain's other two silent-loss exits the same way 3.9 closed the
// rhythm-guard one. No value for a genuine `appropriate: false` verdict — Alex settled
// (`AskUserQuestion`, 2026-07-28) that one stays silent; see `standing-proactive-guards.ts`'s own
// `SituationalAppropriatenessGuardDecision` TSDoc for the full reasoning.
type AmbientIntakeOutcomeReason = Extract<
  ReviewQueueEntry['outcomeReason'],
  | 'low-confidence'
  | 'high-band-off-hours'
  | 'mid-band-off-hours'
  | 'high-band-cost-cap'
  | 'mid-band-cost-cap'
  | 'high-band-appropriateness-check-failed'
  | 'mid-band-appropriateness-check-failed'
>;

export type LogAmbientIntakeInput = {
  readonly message: InboundMessage;
  readonly classified: {
    readonly confidence: number;
    readonly reasoning: string;
  };
  readonly outcomeReason: AmbientIntakeOutcomeReason;
};

/**
 * VISION §5.2's "nothing is silently eaten" backstop — persists an **ambient** message that did not
 * become a real draft or confirming question as a plain `review_queue` log row, for BUILD_PLAN
 * 3.5's own `review-queue-sweep` digest to surface.
 *
 * Extracted from `handle-ambient-channel-message.ts`'s own private `logToReviewQueue` at BUILD_PLAN
 * 3.9, once a second and third caller needed the identical write with a different `outcomeReason`
 * — a genuine 3-consumer case, the same bar `standing-proactive-guards.ts`'s own extraction met:
 *
 * - `'low-confidence'` (chunk 3.4c) — a Stage 1 score below the Low threshold. The original, and
 *   still the only one written on the happy path rather than off the back of a blocked action.
 * - `'high-band-off-hours'` / `'mid-band-off-hours'` (chunk 3.9) — the operating-rhythm guard
 *   blocked a High-band draft or a Mid-band confirming question. Until 3.9 these two returned
 *   without persisting anything, so an ambient message that scored *above* the Low threshold was
 *   eaten more completely than one that scored below it: the Low band has written a row since
 *   3.4c. A bug report posted at 18:00 on a Friday left nothing in the database and reached no
 *   human-facing surface — `classifyMessageForIntake` had already logged its text, confidence and
 *   reasoning to the structured log stream, so "no trace at all" would overstate it, but a log line
 *   nobody greps is not a backstop.
 * - `'high-band-cost-cap'` / `'mid-band-cost-cap'` (chunk 3.10) — the same guard's cost-cap
 *   branch, the narrower mid-turn case where spend crosses the cap *between* the classify and the
 *   compose (an already-over-cap persona short-circuits earlier, inside
 *   `classifyMessageForIntake`, with no classifier output yet to write here).
 * - `'high-band-appropriateness-check-failed'` / `'mid-band-appropriateness-check-failed'`
 *   (chunk 3.10) — the situational-appropriateness gate failing CLOSED on an infrastructure blip
 *   (an Anthropic error, timeout, or unparseable response), *not* a genuine `appropriate: false`
 *   verdict — that verdict is a considered decision, not silent data loss, and stays silent by
 *   design (Alex, `AskUserQuestion`, 2026-07-28).
 *
 * **Ambient only.** A DM never reaches here: the DM cascade (BUILD_PLAN 3.7) never consults the
 * rhythm guard, and deliberately writes no row on the Low band either, because a DM always gets a
 * real conversational reply — it was answered, so it was not eaten, and logging every "thanks"
 * would bury the digest in chatter.
 *
 * **"Log, don't throw" on failure**, same as `recordUsageLogged`'s own precedent: on the two
 * off-hours paths there is no reply to carry an error, and on the Low-band path a review-queue
 * write failing should never surface as a visible error either.
 */
export async function logAmbientIntakeToReviewQueue(
  deps: ReviewQueueLoggingDeps,
  input: LogAmbientIntakeInput,
): Promise<void> {
  const { message, classified, outcomeReason } = input;
  const created = await deps.reviewQueueStore.create({
    personaId: deps.personaId,
    channelId: message.channelId,
    // The **source** message's ts, never a bot-posted one — matching all three sibling writers, so
    // every `review_queue` row points at the human message that caused it and the rows line up
    // with each other. Nothing is posted on these paths anyway, so there is no other ts to use.
    messageTs: message.ts,
    sourceMessageText: message.text,
    confidence: classified.confidence,
    reasoning: classified.reasoning,
    outcomeReason,
  });
  if (!created.ok) {
    deps.logger.error('failed to log ambient message to review queue', {
      personaId: deps.personaId,
      channelId: message.channelId,
      outcomeReason,
      errorMessage: repositoryErrorMessage(created.error),
    });
    return;
  }

  deps.logger.info('logged ambient message to review queue', {
    personaId: deps.personaId,
    channelId: message.channelId,
    outcomeReason,
    confidence: classified.confidence,
  });
}
