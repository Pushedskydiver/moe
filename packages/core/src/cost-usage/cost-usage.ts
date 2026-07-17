import { z } from 'zod';

// `z.coerce.number()`, not `z.number()` — `pg`'s default `BIGINT` type parser returns a string,
// not a number (see `schema.ts`'s `PersonaCostDailyTable` doc comment), and this same schema
// validates both freshly-computed candidate rows (real numbers) and rows read back from the
// database (strings) — one schema, one behavior, not a second DB-only parsing path.
const nonNegativeInt = z.coerce.number().int().nonnegative();

/**
 * One persona's accumulated LLM token/cost usage for a single UTC calendar day (BUILD_PLAN
 * 2.6a). `costUsdMicros` is USD × 1,000,000 (an integer, not a float or SQL `NUMERIC`) — avoids
 * both floating-point drift and `pg`'s default string-typed `NUMERIC` deserialization, and gives
 * enough precision that a single turn's fractional-cent cost isn't lost to rounding when
 * accumulated across many turns. `day` is a plain `YYYY-MM-DD` string keyed to UTC, not a SQL
 * `DATE`/`Date` object — matches this codebase's existing preference for string timestamps at
 * repository seams (e.g. `compose-gated-reply.ts`'s `now: () => string`) and sidesteps `pg`'s own
 * `DATE` → local-midnight `Date` parsing ambiguity entirely.
 */
export const personaCostUsageSchema = z.object({
  personaId: z.string().min(1),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'day must be YYYY-MM-DD'),
  inputTokens: nonNegativeInt,
  outputTokens: nonNegativeInt,
  costUsdMicros: nonNegativeInt,
  updatedAt: z.date(),
});

export type PersonaCostUsage = z.infer<typeof personaCostUsageSchema>;

/** The UTC calendar-date portion (`YYYY-MM-DD`) of an ISO timestamp — the `day` bucket key above. */
export function toUtcDay(iso: string): string {
  return iso.slice(0, 10);
}
