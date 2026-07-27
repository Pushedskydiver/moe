import { z } from 'zod';

import { isNotBlank } from '../is-not-blank.js';

const nonBlankStringSchema = z
  .string()
  .min(1)
  .refine(isNotBlank, 'must not be blank');

/**
 * VISION §5.2's "nothing is silently eaten" backstop (BUILD_PLAN 3.4c) — an append-only log row
 * for a message that didn't become a real ticket draft, listed for a human by BUILD_PLAN 3.5's own
 * `review-queue-sweep` script. `outcomeReason` records why the row exists: `'low-confidence'` is
 * chunk 3.4c's own write (a Stage 1 score below the Low threshold, `../confidence-band.ts`);
 * `'mid-no'` is BUILD_PLAN 3.4b-ii's own write, when a Mid-band confirming question's 👎 reaction
 * resolves it to "no" (`apps/server`'s `logConfirmingQuestionAsNo`); `'mid-silence'` is BUILD_PLAN
 * 3.5's own write (`apps/server`'s `logStaleQuestionsAsSilent`), once an unanswered confirming
 * question passes a 24-hour threshold; `'mid-yes-failed'` is the claim-then-act fallback fix's own
 * write (`apps/server`'s `draftFromConfirmingQuestion`), when a 👍 answer's downstream draft
 * composition/posting/persistence fails after the confirming question was already claimed. Migration
 * `0009_widen_review_queue_outcome_reason.sql` replaced chunk 3.4c's original single placeholder
 * value, `'mid-no-response'`, with `'mid-no'`/`'mid-silence'` — "no" and "silence"/timeout stay
 * separately identifiable for 3.5's own human-eyeballing sweep, per that chunk's own DA-review-
 * flagged question. Migration `0011_widen_review_queue_outcome_reason_again.sql` added
 * `'mid-yes-failed'` on top of those two, additively (not a replacement, unlike `0009`'s own
 * change). Unlike `pending-ticket-draft.ts`'s sibling table,
 * this one has no resolved/claimed state — a review-queue row is a plain log entry, not a
 * workflow object a reaction can act on.
 *
 * `'high-band-off-hours'` and `'mid-band-off-hours'` are BUILD_PLAN 3.9's own writes
 * (`apps/server`'s `logAmbientIntakeToReviewQueue`, reached from `composeAndPostDraft` and
 * `composeAndPostConfirmingQuestion`), added by migration
 * `0019_widen_review_queue_outcome_reason_off_hours.sql`: an **ambient** message classified High or
 * Mid outside the 2.7a operating-rhythm window, which until 3.9 was dropped with nothing persisted
 * and no scheduler to pick it up. Named for the cause rather than `'…-deferred'` deliberately —
 * nothing is deferred until BUILD_PLAN 3.9's own step (2) builds a timer, and "deferring" is the
 * exact word that chunk exists to stop the codebase using for a drop. **Ambient only:** the DM path
 * never consults the rhythm guard (2.7a settled DM replies as reactive; 3.7 extended that to
 * DM-triggered drafts), so a DM produces its draft or question at any hour and never writes either
 * value.
 */
export const reviewQueueEntrySchema = z.object({
  id: z.uuid(),
  personaId: nonBlankStringSchema,
  channelId: nonBlankStringSchema,
  messageTs: nonBlankStringSchema,
  sourceMessageText: nonBlankStringSchema,
  confidence: z.number().int().min(0).max(100),
  reasoning: nonBlankStringSchema,
  outcomeReason: z.enum([
    'low-confidence',
    'mid-no',
    'mid-silence',
    'mid-yes-failed',
    'high-band-off-hours',
    'mid-band-off-hours',
  ]),
  createdAt: z.date(),
});

export type ReviewQueueEntry = z.infer<typeof reviewQueueEntrySchema>;
