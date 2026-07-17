import { z } from 'zod';

import { nonNegativeIntSchema } from '../cost-usage/cost-usage.js';

/** The spend-alert ladder rungs (`docs/VISION.md` §10) — 50/80/100% of the monthly cap. */
export const COST_CAP_THRESHOLDS = [50, 80, 100] as const;

const ALERTED_THRESHOLD_VALUES = [0, ...COST_CAP_THRESHOLDS] as const;

type AlertedThreshold = (typeof ALERTED_THRESHOLD_VALUES)[number];

// `z.coerce.number()`, not `z.number()` — matches `cost-usage.ts`'s own reasoning, so the same
// schema validates both a freshly-computed candidate row and a row read back from the database.
// Unlike `persona_cost_daily`'s `BIGINT` columns, `highestThresholdAlerted` is a SQL `INTEGER`
// (its whole range of valid values tops out at 100) — `pg`'s default `int4` parser already
// returns a real number, so this coercion is a safety-net for parity, not a required fix.
const alertedThresholdSchema = z.coerce
  .number()
  .refine(
    (value): value is AlertedThreshold =>
      (ALERTED_THRESHOLD_VALUES as readonly number[]).includes(value),
    {
      message: `highestThresholdAlerted must be one of ${ALERTED_THRESHOLD_VALUES.join(', ')}`,
    },
  );

/**
 * One persona's spend-alert dedup state for a single UTC calendar month (BUILD_PLAN 2.6b) —
 * "crossing 50% alerts once, not every turn after" (`docs/VISION.md` §10) needs a persisted
 * watermark, not an in-memory one, since `apps/server` can restart mid-month. `updatedAt` here
 * doubles as "last time the watermark advanced," not a general last-write timestamp.
 * `highestThresholdAlerted` is the highest rung already alerted this month — a month with no
 * spend yet has no row at all, which is the reset mechanism between months, not an explicit
 * month-rollover job.
 */
export const personaCostAlertSchema = z.object({
  personaId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM'),
  highestThresholdAlerted: alertedThresholdSchema,
  updatedAt: z.date(),
});

export type PersonaCostAlert = z.infer<typeof personaCostAlertSchema>;

/**
 * A persona's summed token/cost usage across every day in one UTC calendar month — the figure
 * `evaluateCostCap` (`@moe/agents`) compares against the monthly cap. Not a `PersonaCostUsage`
 * row (no single `day`/`updatedAt`; it's a `SUM(...)` over `persona_cost_daily`, zero when the
 * month has no rows yet, never negative or fractional since it's built entirely from
 * `persona_cost_daily`'s own already-validated integer columns).
 */
export const personaCostMonthlyTotalSchema = z.object({
  personaId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM'),
  inputTokens: nonNegativeIntSchema,
  outputTokens: nonNegativeIntSchema,
  costUsdMicros: nonNegativeIntSchema,
});

export type PersonaCostMonthlyTotal = z.infer<
  typeof personaCostMonthlyTotalSchema
>;
