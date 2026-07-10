import { z } from 'zod';

/** The ticket lifecycle: Sarah triages, Marcus plans, Riley builds (with Priya), Dom reviews (with Priya), merge (VISION §3.3). */
export const boardStatusSchema = z.enum([
  'Backlog',
  'Brief',
  'Plan',
  'Build',
  'Review',
  'Done',
  'Cancelled',
]);

export type BoardStatus = z.infer<typeof boardStatusSchema>;
