import type { Database } from '../schema.js';
import type {
  NewTicket,
  TicketRepositoryError,
} from '../ticket-lifecycle/tickets-repository.js';
import type { Ticket } from '../ticket.js';
import type { PendingTicketDraft } from './pending-ticket-draft.js';
import type { PendingTicketDraftClaimError } from './pending-ticket-drafts-repository.js';
import type { Kysely } from 'kysely';

import { createTicket } from '../ticket-lifecycle/tickets-repository.js';
import { resolvePendingTicketDraft } from './pending-ticket-drafts-repository.js';

export type CommitTicketDraftError =
  | { readonly step: 'claim'; readonly error: PendingTicketDraftClaimError }
  | { readonly step: 'create-ticket'; readonly error: TicketRepositoryError };

export type CommitTicketDraftResult =
  | {
      readonly ok: true;
      readonly draft: PendingTicketDraft;
      readonly ticket: Ticket;
    }
  | { readonly ok: false; readonly error: CommitTicketDraftError };

// A module-private marker, not a domain error — the only way to force `db.transaction()` to roll
// back once `resolvePendingTicketDraft`/`createTicket` have both already returned a Result rather
// than throwing (confirmed: neither ever throws on its own). Kysely's `TransactionBuilder.execute`
// rethrows the exact same error reference on any callback throw, so `instanceof` narrows correctly
// in the outer catch below — this class never escapes `createTicketFromDraft`'s own boundary, which
// still returns a pure Result either way.
class RollbackWithError extends Error {
  constructor(readonly failure: CommitTicketDraftError) {
    super('rollback: ticket creation failed');
  }
}

/**
 * Atomically claims a pending ticket draft and creates the resulting ticket in one transaction
 * (BUILD_PLAN follow-up to 3.4b-ii/3.5's own "Known, accepted gap" comments) — closes the
 * claim-then-act failure-recovery gap those two chunks documented but deliberately deferred: if
 * `createTicket` fails after the claim wins, the whole transaction rolls back, including the
 * claim, so the draft is left exactly as it was and a future reaction can retry it. Deliberately
 * left at Kysely's default (READ COMMITTED) isolation level, not upgraded — `claim.ts`'s own
 * TSDoc explains the CAS `UPDATE ... WHERE resolvedAt IS NULL` shape relies on READ COMMITTED's
 * EvalPlanQual re-check to turn a losing concurrent claim into a clean `{kind:'unavailable'}`
 * rather than a thrown serialization error; REPEATABLE READ/SERIALIZABLE would break that.
 * `input.ticket` deliberately excludes `title` — the ticket's title comes from the CLAIMED row's
 * own `draftTitle` (read inside the transaction, after the claim wins), not a caller-supplied
 * value, for the same reason `commitAsTicket`'s own pre-existing TSDoc already documents: a
 * concurrent 🔁 regeneration (`updatePendingTicketDraftContent`, not gated on `resolvedAt`) can
 * update the row's title between the caller's own lookup and this claim, and only the post-claim
 * row is still guaranteed current.
 */
export async function createTicketFromDraft(
  db: Kysely<Database>,
  input: {
    readonly draftId: string;
    readonly ticket: Omit<NewTicket, 'title'>;
  },
): Promise<CommitTicketDraftResult> {
  try {
    return await db.transaction().execute(async (trx) => {
      const claimed = await resolvePendingTicketDraft(trx, input.draftId);
      if (!claimed.ok) {
        return { ok: false, error: { step: 'claim', error: claimed.error } };
      }

      const created = await createTicket(trx, {
        ...input.ticket,
        title: claimed.draft.draftTitle,
      });
      if (!created.ok) {
        throw new RollbackWithError({
          step: 'create-ticket',
          error: created.error,
        });
      }

      return { ok: true, draft: claimed.draft, ticket: created.ticket };
    });
  } catch (cause) {
    if (cause instanceof RollbackWithError) {
      return { ok: false, error: cause.failure };
    }
    return {
      ok: false,
      error: { step: 'create-ticket', error: { kind: 'unknown', cause } },
    };
  }
}
