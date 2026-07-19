import { z } from 'zod';

import { isNotBlank } from '../is-not-blank.js';

const nonBlankStringSchema = z
  .string()
  .min(1)
  .refine(isNotBlank, 'must not be blank');

/**
 * VISION §5.2's "nothing is silently eaten" backstop (BUILD_PLAN 3.4c) — an append-only log row
 * for a message that didn't become a real ticket draft, captured so BUILD_PLAN 3.5's own sweep can
 * list it for a human. `outcomeReason` records why the row exists: `'low-confidence'` is this
 * chunk's own write (a Stage 1 score below the Low threshold, `../confidence-band.ts`);
 * `'mid-no-response'` is BUILD_PLAN 3.4b's future write, once its Mid-band confirming question
 * resolves to "no" or silence rather than "yes". Unlike `pending-ticket-draft.ts`'s sibling table,
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
  outcomeReason: z.enum(['low-confidence', 'mid-no-response']),
  createdAt: z.date(),
});

export type ReviewQueueEntry = z.infer<typeof reviewQueueEntrySchema>;
