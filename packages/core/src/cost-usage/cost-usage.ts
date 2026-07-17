import { z } from 'zod';

// `z.coerce.number()`, not `z.number()` — `pg`'s default `BIGINT` type parser returns a string,
// not a number (see `schema.ts`'s `PersonaCostDailyTable` doc comment), and this same schema
// validates both freshly-computed candidate rows (real numbers) and rows read back from the
// database (strings) — one schema, one behavior, not a second DB-only parsing path. Exported so
// `../cost-cap/cost-cap.ts`'s monthly-total shape (also `BIGINT`-summed, same coercion need)
// reuses this instead of redefining the same coercion+reasoning a second time.
export const nonNegativeIntSchema = z.coerce.number().int().nonnegative();

/**
 * One persona's accumulated LLM token/cost usage for a single UTC calendar day (BUILD_PLAN
 * 2.6a). `costUsdMicros` is USD × 1,000,000 (an integer, not a float or SQL `NUMERIC`) — `pg`
 * returns both `BIGINT` and `NUMERIC` columns as strings by default (see the comment above), so
 * the choice isn't about avoiding string-typed deserialization, which happens either way. It's
 * about keeping every value in the pipeline — this schema's own coercion, the pricing arithmetic
 * in `@moe/agents`'s `sonnetCostUsdMicros`, and the SQL-side atomic accumulation — an exact
 * integer with no floating-point step anywhere, the way a fractional-cent dollar amount
 * represented as a JS float would require. `day` is a plain `YYYY-MM-DD` string keyed to UTC, not a SQL
 * `DATE`/`Date` object — matches this codebase's existing preference for string timestamps at
 * repository seams (e.g. `compose-gated-reply.ts`'s `now: () => string`) and sidesteps `pg`'s own
 * `DATE` → local-midnight `Date` parsing ambiguity entirely. No `model` field — see
 * `schema.ts`'s `PersonaCostDailyTable` doc comment for why that's a deliberate, revisitable
 * simplification rather than an oversight.
 */
export const personaCostUsageSchema = z.object({
  personaId: z.string().min(1),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'day must be YYYY-MM-DD'),
  inputTokens: nonNegativeIntSchema,
  outputTokens: nonNegativeIntSchema,
  costUsdMicros: nonNegativeIntSchema,
  updatedAt: z.date(),
});

export type PersonaCostUsage = z.infer<typeof personaCostUsageSchema>;

/**
 * The UTC calendar-date portion (`YYYY-MM-DD`) of an ISO timestamp — the `day` bucket key above.
 * Requires `iso` to be a real `Date.prototype.toISOString()` output (always UTC, always
 * `YYYY-MM-DDTHH:mm:ss.sssZ`) — a non-UTC-offset ISO string (e.g. one ending `+02:00`) would
 * silently truncate to the wrong calendar day, since this is a plain string slice, not a real
 * timezone-aware parse.
 */
export function toUtcDay(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * The UTC calendar-month portion (`YYYY-MM`) of an ISO timestamp — the month bucket key
 * `./cost-cap/cost-cap.ts` groups spend-cap alert state by. Same UTC-`Z`-input requirement as
 * `toUtcDay` above.
 */
export function toUtcMonth(iso: string): string {
  return iso.slice(0, 7);
}
