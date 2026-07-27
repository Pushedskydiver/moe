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

// The three ambient outcome reasons this function writes. Deliberately a narrowed subset of
// `ReviewQueueEntry['outcomeReason']` rather than the full union: the other three values
// (`'mid-no'`, `'mid-silence'`, `'mid-yes-failed'`) all belong to the confirming-question answer
// lifecycle and are written elsewhere, two of them transactionally inside
// `resolveConfirmingQuestionAndLog`. Narrowing here means a future value cannot reach this write
// path by accident just because it was added to the enum.
type AmbientIntakeOutcomeReason = Extract<
  ReviewQueueEntry['outcomeReason'],
  'low-confidence' | 'high-band-off-hours' | 'mid-band-off-hours'
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
 *   3.4c. A bug report posted at 18:00 on a Friday left nothing behind at all.
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
