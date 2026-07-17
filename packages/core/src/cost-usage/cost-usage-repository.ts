import type { Database } from '../schema.js';
import type { PersonaCostUsage } from './cost-usage.js';
import type { Kysely } from 'kysely';

import { personaCostUsageSchema } from './cost-usage.js';

export type NewPersonaCostUsage = Pick<
  PersonaCostUsage,
  'personaId' | 'day' | 'inputTokens' | 'outputTokens' | 'costUsdMicros'
>;

export type PersonaCostUsageRepositoryError =
  | { readonly kind: 'validation-failed'; readonly issues: string }
  | { readonly kind: 'unknown'; readonly cause: unknown };

export type PersonaCostUsageResult =
  | { readonly ok: true; readonly usage: PersonaCostUsage }
  | { readonly ok: false; readonly error: PersonaCostUsageRepositoryError };

export type PersonaCostUsageOrNullResult =
  | { readonly ok: true; readonly usage: PersonaCostUsage | null }
  | { readonly ok: false; readonly error: PersonaCostUsageRepositoryError };

function parsePersonaCostUsageRow(row: unknown): PersonaCostUsageResult {
  const parsed = personaCostUsageSchema.safeParse(row);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: 'validation-failed', issues: parsed.error.message },
    };
  }
  return { ok: true, usage: parsed.data };
}

/**
 * Records one turn's LLM token/cost usage against its persona/day bucket — a real `INSERT ... ON
 * CONFLICT (persona_id, day) DO UPDATE` that adds to whatever is already there, not a
 * read-modify-write from application code. Atomicity here isn't defensive: every persona is its
 * own long-running process (`docs/VISION.md` §4.5), so within one process a naive read-then-write
 * would still race against itself across concurrently-handled threads (`apps/server`'s own
 * `threadQueue` only serializes per-thread, not process-wide) — the same reasoning `claim.ts`
 * already applies to ticket claims, applied here to a sum instead of a compare-and-set.
 */
export async function recordUsage(
  db: Kysely<Database>,
  input: NewPersonaCostUsage,
): Promise<PersonaCostUsageResult> {
  const candidate = {
    personaId: input.personaId,
    day: input.day,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    costUsdMicros: input.costUsdMicros,
    updatedAt: new Date(),
  };

  const validated = parsePersonaCostUsageRow(candidate);
  if (!validated.ok) return validated;

  try {
    const row = await db
      .insertInto('personaCostDaily')
      .values(candidate)
      .onConflict((oc) =>
        oc.columns(['personaId', 'day']).doUpdateSet((eb) => ({
          inputTokens: eb(
            'personaCostDaily.inputTokens',
            '+',
            eb.ref('excluded.inputTokens'),
          ),
          outputTokens: eb(
            'personaCostDaily.outputTokens',
            '+',
            eb.ref('excluded.outputTokens'),
          ),
          costUsdMicros: eb(
            'personaCostDaily.costUsdMicros',
            '+',
            eb.ref('excluded.costUsdMicros'),
          ),
          updatedAt: eb.ref('excluded.updatedAt'),
        })),
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    return parsePersonaCostUsageRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/** Looks up a persona's accumulated usage for one UTC day. No rows yet is not an error. */
export async function getPersonaCostForDay(
  db: Kysely<Database>,
  scope: { readonly personaId: string; readonly day: string },
): Promise<PersonaCostUsageOrNullResult> {
  try {
    const row = await db
      .selectFrom('personaCostDaily')
      .selectAll()
      .where('personaId', '=', scope.personaId)
      .where('day', '=', scope.day)
      .executeTakeFirst();
    if (!row) return { ok: true, usage: null };

    const parsed = parsePersonaCostUsageRow(row);
    return parsed.ok ? { ok: true, usage: parsed.usage } : parsed;
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
