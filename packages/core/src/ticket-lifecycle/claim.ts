import type { Database } from '../schema.js';
import type { Kysely } from 'kysely';

import { sql } from 'kysely';
import { z } from 'zod';

const ticketClaimSchema = z.object({
  id: z.uuid(),
  claimedBy: z.string().nullable(),
  version: z.number().int().nonnegative(),
});

export type TicketClaim = z.infer<typeof ticketClaimSchema>;

export type ClaimError =
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'validation-failed'; readonly issues: string }
  | { readonly kind: 'unknown'; readonly cause: unknown };

export type ClaimResult =
  | { readonly ok: true; readonly claim: TicketClaim }
  | { readonly ok: false; readonly error: ClaimError };

function parseTicketClaim(row: unknown): ClaimResult {
  const parsed = ticketClaimSchema.safeParse(row);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: 'validation-failed', issues: parsed.error.message },
    };
  }
  return { ok: true, claim: parsed.data };
}

/**
 * Atomically claims an unclaimed ticket for `claimedBy`. Under Postgres's default READ COMMITTED
 * isolation (this codebase's assumption throughout — nothing here opens an explicit transaction),
 * two concurrent `UPDATE ... WHERE claimedBy IS NULL` on the same row don't race in the naive
 * "both see the old row" sense: the loser blocks on the row lock, and once the winner commits,
 * Postgres re-evaluates the loser's WHERE clause against the now-updated row (EvalPlanQual) before
 * it proceeds — since `claimedBy` is no longer NULL, the loser's WHERE no longer matches and it
 * affects zero rows. A caller that wrapped this in an explicit REPEATABLE READ/SERIALIZABLE
 * transaction would see the loser throw a serialization error instead of cleanly returning
 * `{ kind: 'unavailable' }` — not handled here, since nothing in this codebase does that today.
 */
export async function claimTicket(
  db: Kysely<Database>,
  id: string,
  claimedBy: string,
): Promise<ClaimResult> {
  try {
    const update = db
      .updateTable('tickets')
      .set({ claimedBy, version: sql`version + 1` });
    const scoped = update.where('id', '=', id).where('claimedBy', 'is', null);
    const row = await scoped
      .returning(['id', 'claimedBy', 'version'])
      .executeTakeFirst();

    if (!row) return { ok: false, error: { kind: 'unavailable' } };
    return parseTicketClaim(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * Atomically releases a ticket currently claimed by `claimedBy`, via the same READ-COMMITTED
 * row-lock/re-check mechanism as `claimTicket` (see its TSDoc). The WHERE clause (`claimedBy =
 * <caller>`) means a caller can only release its own claim; a ticket that's unclaimed
 * (`claimedBy IS NULL`) never matches either, since SQL's `NULL = 'x'` evaluates to NULL, not
 * true, under three-valued logic.
 */
export async function releaseTicket(
  db: Kysely<Database>,
  id: string,
  claimedBy: string,
): Promise<ClaimResult> {
  try {
    const update = db
      .updateTable('tickets')
      .set({ claimedBy: null, version: sql`version + 1` });
    const scoped = update
      .where('id', '=', id)
      .where('claimedBy', '=', claimedBy);
    const row = await scoped
      .returning(['id', 'claimedBy', 'version'])
      .executeTakeFirst();

    if (!row) return { ok: false, error: { kind: 'unavailable' } };
    return parseTicketClaim(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
