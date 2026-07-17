import type { Database } from '../schema.js';
import type { PersonaCostAlert, PersonaCostMonthlyTotal } from './cost-cap.js';
import type { Kysely } from 'kysely';

import {
  personaCostAlertSchema,
  personaCostMonthlyTotalSchema,
} from './cost-cap.js';

export type CostCapRepositoryError =
  | { readonly kind: 'validation-failed'; readonly issues: string }
  | { readonly kind: 'unknown'; readonly cause: unknown };

export type PersonaCostMonthlyTotalResult =
  | { readonly ok: true; readonly total: PersonaCostMonthlyTotal }
  | { readonly ok: false; readonly error: CostCapRepositoryError };

export type PersonaCostAlertResult =
  | { readonly ok: true; readonly alert: PersonaCostAlert }
  | { readonly ok: false; readonly error: CostCapRepositoryError };

export type PersonaCostAlertOrNullResult =
  | { readonly ok: true; readonly alert: PersonaCostAlert | null }
  | { readonly ok: false; readonly error: CostCapRepositoryError };

function parseMonthlyTotal(row: unknown): PersonaCostMonthlyTotalResult {
  const parsed = personaCostMonthlyTotalSchema.safeParse(row);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: 'validation-failed', issues: parsed.error.message },
    };
  }
  return { ok: true, total: parsed.data };
}

function parseAlertRow(row: unknown): PersonaCostAlertResult {
  const parsed = personaCostAlertSchema.safeParse(row);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: 'validation-failed', issues: parsed.error.message },
    };
  }
  return { ok: true, alert: parsed.data };
}

/**
 * Sums a persona's `persona_cost_daily` rows across every day in one UTC calendar month — a
 * `LIKE 'YYYY-MM-%'` prefix match on the `day` column rather than computing exact month-start/
 * month-end date-range boundaries, since `day`'s fixed `YYYY-MM-DD` format makes a prefix match
 * unambiguous and sidesteps December→January rollover arithmetic entirely. A month with no
 * recorded turns yet returns a zero total, not an error or a missing-row case — `COALESCE(SUM(...),
 * 0)` at the SQL level, since Postgres's own `SUM` over zero rows is `NULL`.
 */
export async function getPersonaCostForMonth(
  db: Kysely<Database>,
  scope: { readonly personaId: string; readonly month: string },
): Promise<PersonaCostMonthlyTotalResult> {
  try {
    const row = await db
      .selectFrom('personaCostDaily')
      .select((eb) => [
        eb.fn
          .coalesce(eb.fn.sum<number | string | null>('inputTokens'), eb.lit(0))
          .as('inputTokens'),
        eb.fn
          .coalesce(
            eb.fn.sum<number | string | null>('outputTokens'),
            eb.lit(0),
          )
          .as('outputTokens'),
        eb.fn
          .coalesce(
            eb.fn.sum<number | string | null>('costUsdMicros'),
            eb.lit(0),
          )
          .as('costUsdMicros'),
      ])
      .where('personaId', '=', scope.personaId)
      .where('day', 'like', `${scope.month}-%`)
      .executeTakeFirstOrThrow();

    return parseMonthlyTotal({
      personaId: scope.personaId,
      month: scope.month,
      ...row,
    });
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/** Looks up a persona's spend-alert dedup state for one UTC month. No row yet is not an error. */
export async function getAlertState(
  db: Kysely<Database>,
  scope: { readonly personaId: string; readonly month: string },
): Promise<PersonaCostAlertOrNullResult> {
  try {
    const row = await db
      .selectFrom('personaCostAlerts')
      .selectAll()
      .where('personaId', '=', scope.personaId)
      .where('month', '=', scope.month)
      .executeTakeFirst();
    if (!row) return { ok: true, alert: null };

    const parsed = parseAlertRow(row);
    return parsed.ok ? { ok: true, alert: parsed.alert } : parsed;
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * Advances a persona's spend-alert watermark for one UTC month to `threshold` — a real
 * `INSERT ... ON CONFLICT (persona_id, month) DO UPDATE SET highest_threshold_alerted =
 * GREATEST(...)`, not a read-modify-write, so an out-of-order or concurrent call for a *lower*
 * threshold than what's already recorded can never regress the watermark.
 */
export async function recordAlertThreshold(
  db: Kysely<Database>,
  input: {
    readonly personaId: string;
    readonly month: string;
    readonly threshold: number;
  },
): Promise<PersonaCostAlertResult> {
  const candidate = {
    personaId: input.personaId,
    month: input.month,
    highestThresholdAlerted: input.threshold,
    updatedAt: new Date(),
  };

  const validated = parseAlertRow(candidate);
  if (!validated.ok) return validated;

  try {
    const row = await db
      .insertInto('personaCostAlerts')
      .values(candidate)
      .onConflict((oc) =>
        oc.columns(['personaId', 'month']).doUpdateSet((eb) => ({
          highestThresholdAlerted: eb.fn<number>('greatest', [
            'personaCostAlerts.highestThresholdAlerted',
            'excluded.highestThresholdAlerted',
          ]),
          updatedAt: eb.ref('excluded.updatedAt'),
        })),
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    return parseAlertRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
