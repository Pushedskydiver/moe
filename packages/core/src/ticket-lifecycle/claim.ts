import type { Database } from './schema.js';
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
 * Atomically claims an unclaimed ticket for `claimedBy` — the WHERE clause (`claimedBy IS NULL`)
 * is the compare, evaluated by Postgres against the current row at UPDATE time, so it's safe
 * against any number of racing callers: at most one UPDATE ever matches a given ticket, the rest
 * see zero rows affected. `version` increments only on the winning write.
 */
export async function claimTicket(
  db: Kysely<Database>,
  id: string,
  claimedBy: string,
): Promise<ClaimResult> {
  try {
    const row = await db
      .updateTable('tickets')
      .set({ claimedBy, version: sql`version + 1` })
      .where('id', '=', id)
      .where('claimedBy', 'is', null)
      .returning(['id', 'claimedBy', 'version'])
      .executeTakeFirst();

    if (!row) return { ok: false, error: { kind: 'unavailable' } };
    return parseTicketClaim(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * Atomically releases a ticket currently claimed by `claimedBy` — the WHERE clause
 * (`claimedBy = <caller>`) means a caller can only release its own claim, and a ticket that's
 * unclaimed (`claimedBy IS NULL`) or claimed by someone else never matches.
 */
export async function releaseTicket(
  db: Kysely<Database>,
  id: string,
  claimedBy: string,
): Promise<ClaimResult> {
  try {
    const row = await db
      .updateTable('tickets')
      .set({ claimedBy: null, version: sql`version + 1` })
      .where('id', '=', id)
      .where('claimedBy', '=', claimedBy)
      .returning(['id', 'claimedBy', 'version'])
      .executeTakeFirst();

    if (!row) return { ok: false, error: { kind: 'unavailable' } };
    return parseTicketClaim(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
