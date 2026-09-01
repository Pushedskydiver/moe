import type { BoardStatus } from '../board-status.js';
import type { WipLimitReason } from '../capacity/wip-limit-guard.js';
import type { WipLimitsConfig } from '../capacity/wip-limits-config.js';
import type { Database } from '../schema.js';
import type { Ticket } from '../ticket.js';
import type { TicketRepositoryError } from './tickets-repository.js';
import type { Kysely } from 'kysely';

import { sql } from 'kysely';

import { evaluateWipLimit } from '../capacity/wip-limit-guard.js';
import { countTicketsByStatus, parseTicketRow } from './tickets-repository.js';

export type TransitionError =
  | TicketRepositoryError
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'wip-limit-blocked'; readonly reason: WipLimitReason };

export type TransitionResult =
  | { readonly ok: true; readonly ticket: Ticket }
  | { readonly ok: false; readonly error: TransitionError };

/**
 * Moves a ticket forward from `fromStatus` to `toStatus`, gated by `evaluateWipLimit` against
 * `toStatus`'s current count (BUILD_PLAN 4.5's guard, given its first real call site here). The
 * CAS write's `status = fromStatus AND claimedBy = claimedBy` WHERE clause enforces "only the
 * current owner, from the expected state, may transition it," collapsing wrong-owner/wrong-status
 * /nonexistent-id into one `unavailable` kind — the same philosophy `claim.ts`'s `claimTicket`/
 * `releaseTicket` use.
 *
 * Deliberately does NOT clear `claimedBy`. `apps/server/src/pull-loop.ts`'s `workAndRelease`
 * already unconditionally calls `releaseTicket` right after every work step resolves; if this
 * function also cleared `claimedBy`, that subsequent call would find it already NULL and fail its
 * own CAS — logged today as an orphaned-claim warning, which would fire as a false alarm on every
 * successful transition. Leaving `claimedBy` untouched here and letting the existing unconditional
 * release remain the sole ownership-clearing path composes with zero changes to `pull-loop.ts`.
 *
 * Two known, documented (not fixed) races, both low-severity given today's one-ticket-per-tick,
 * 60s-apart pull-loop cadence and the absence of any real caller yet:
 * - The WIP count read and the CAS write are two round trips, not one transaction — two
 *   concurrent transitions into the same `toStatus` could both read a count under the cap and
 *   both succeed, briefly exceeding it by one.
 * - `./tickets-repository.js`'s `updateTicket` has no CAS protection of its own (`id`-only WHERE).
 *   Its one caller is `apps/server/scripts/reconcile-github-issues.ts`'s DI wiring, driven by
 *   `apps/server/src/reconcile-github-issues.ts`'s `reconcileClosedIssue`, which force-cancels
 *   tickets already in `Build`/`Review` with no version/status re-check — a concurrent transition
 *   commit racing that script's stale read could be silently discarded, with no error or log
 *   anywhere. Narrow (Alex-manually-triggered script), documented rather than fixed for the same
 *   reason as the WIP-count race above.
 */
export async function transitionTicketStatus(
  db: Kysely<Database>,
  input: {
    readonly id: string;
    readonly projectKey: string;
    readonly fromStatus: BoardStatus;
    readonly toStatus: BoardStatus;
    readonly claimedBy: string;
    readonly limits?: WipLimitsConfig;
  },
): Promise<TransitionResult> {
  const counted = await countTicketsByStatus(db, {
    projectKey: input.projectKey,
    status: input.toStatus,
  });
  if (!counted.ok) return counted;

  const decision = evaluateWipLimit(
    input.toStatus,
    counted.count,
    input.limits,
  );
  if (!decision.allowed) {
    return {
      ok: false,
      error: { kind: 'wip-limit-blocked', reason: decision.reason },
    };
  }

  try {
    const row = await db
      .updateTable('tickets')
      .set({
        status: input.toStatus,
        version: sql`version + 1`,
        updatedAt: new Date(),
      })
      .where('id', '=', input.id)
      .where('status', '=', input.fromStatus)
      .where('claimedBy', '=', input.claimedBy)
      .returningAll()
      .executeTakeFirst();

    if (!row) return { ok: false, error: { kind: 'unavailable' } };
    return parseTicketRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
