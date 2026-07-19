import { z } from 'zod';

import { isNotBlank } from '../is-not-blank.js';

const nonBlankStringSchema = z
  .string()
  .min(1)
  .refine(isNotBlank, 'must not be blank');

/**
 * VISION §5.2's "nothing is silently eaten" backstop (BUILD_PLAN 3.4c) — an append-only log row
 * for a message that didn't become a real ticket draft, captured so BUILD_PLAN 3.5's own sweep can
 * list it for a human. `outcomeReason` records why the row exists: `'low-confidence'` is chunk
 * 3.4c's own write (a Stage 1 score below the Low threshold, `../confidence-band.ts`); `'mid-no'`
 * is BUILD_PLAN 3.4b-ii's own write, when a Mid-band confirming question's 👎 reaction resolves it
 * to "no" (`apps/server`'s `logConfirmingQuestionAsNo`); `'mid-silence'` is a placeholder value
 * pre-seeded here ahead of a real writer — BUILD_PLAN 3.5's own future scheduled sweep is what logs
 * it, once an unanswered confirming question passes some age threshold (no scheduled-job
 * infrastructure exists yet, so 3.4b-ii can only build the reactive yes/no paths). Migration
 * `0009_widen_review_queue_outcome_reason.sql` replaced chunk 3.4c's original single placeholder
 * value, `'mid-no-response'`, with these two distinct values — "no" and "silence"/timeout stay
 * separately identifiable for 3.5's own human-eyeballing sweep, per that chunk's own DA-review-
 * flagged question. Unlike `pending-ticket-draft.ts`'s sibling table,
 * this one has no resolved/claimed state — a review-queue row is a plain log entry, not a
 * workflow object a reaction can act on.
 */
export const reviewQueueEntrySchema = z.object({
  id: z.uuid(),
  personaId: nonBlankStringSchema,
  channelId: nonBlankStringSchema,
  messageTs: nonBlankStringSchema,
  sourceMessageText: nonBlankStringSchema,
  confidence: z.number().int().min(0).max(100),
  reasoning: nonBlankStringSchema,
  outcomeReason: z.enum(['low-confidence', 'mid-no', 'mid-silence']),
  createdAt: z.date(),
});

export type ReviewQueueEntry = z.infer<typeof reviewQueueEntrySchema>;
