import type { Database } from '../schema.js';
import type { SweepState } from './sweep-state.js';
import type { Kysely } from 'kysely';

import { sweepStateSchema } from './sweep-state.js';

export type SweepStateRepositoryError =
  | { readonly kind: 'validation-failed'; readonly issues: string }
  | { readonly kind: 'unknown'; readonly cause: unknown };

export type SweepStateResult =
  | { readonly ok: true; readonly state: SweepState }
  | { readonly ok: false; readonly error: SweepStateRepositoryError };

export type SweepStateOrNullResult =
  | { readonly ok: true; readonly state: SweepState | null }
  | { readonly ok: false; readonly error: SweepStateRepositoryError };

function parseStateRow(row: unknown): SweepStateResult {
  const parsed = sweepStateSchema.safeParse(row);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: 'validation-failed', issues: parsed.error.message },
    };
  }
  return { ok: true, state: parsed.data };
}

/**
 * Looks up when a persona's `review-queue-sweep` CLI script last ran (BUILD_PLAN 3.5) — the
 * sweep's own scope-since-last-run boundary. Returns a null state, not an error, for a
 * persona that's never swept yet — the sweep's own caller treats that as "since the
 * beginning of time."
 */
export async function getSweepState(
  db: Kysely<Database>,
  personaId: string,
): Promise<SweepStateOrNullResult> {
  try {
    const row = await db
      .selectFrom('sweepState')
      .selectAll()
      .where('personaId', '=', personaId)
      .executeTakeFirst();

    if (!row) return { ok: true, state: null };
    return parseStateRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * Records a completed sweep (BUILD_PLAN 3.5) — an upsert, not an insert: a persona only ever
 * has one `sweep_state` row, so a second sweep overwrites `lastSweptAt` in place rather than
 * accumulating history. No CAS/conditional-update guard, unlike `claimAlertThreshold`'s own
 * upsert — the sweep is a manually-run, single-operator CLI script, not a concurrent-caller
 * race the way a monthly cost-alert threshold is.
 */
export async function recordSweepCompleted(
  db: Kysely<Database>,
  input: { readonly personaId: string; readonly sweptAt: Date },
): Promise<SweepStateResult> {
  const candidate = { personaId: input.personaId, lastSweptAt: input.sweptAt };

  const validated = parseStateRow(candidate);
  if (!validated.ok) return validated;

  try {
    const row = await db
      .insertInto('sweepState')
      .values(candidate)
      .onConflict((oc) =>
        oc.column('personaId').doUpdateSet((eb) => ({
          lastSweptAt: eb.ref('excluded.lastSweptAt'),
        })),
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    return parseStateRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
