import { z } from 'zod';

import { isNotBlank } from '../is-not-blank.js';

const nonBlankStringSchema = z
  .string()
  .min(1)
  .refine(isNotBlank, 'must not be blank');

/**
 * BUILD_PLAN 3.5's own tracking row for the `review-queue-sweep` CLI script — one row per
 * persona, `personaId` itself the primary key (not a surrogate `id`), since a persona only
 * ever has one "when did I last sweep" value, never a history of them.
 */
export const sweepStateSchema = z.object({
  personaId: nonBlankStringSchema,
  lastSweptAt: z.date(),
});

export type SweepState = z.infer<typeof sweepStateSchema>;
