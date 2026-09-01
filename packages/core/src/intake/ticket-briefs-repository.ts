import type { Database } from '../schema.js';
import type { TicketBrief } from './ticket-brief.js';
import type { Kysely } from 'kysely';

import { ticketBriefSchema } from './ticket-brief.js';

export type NewTicketBrief = Pick<
  TicketBrief,
  'ticketId' | 'channelId' | 'messageTs'
>;

export type TicketBriefRepositoryError =
  | { readonly kind: 'validation-failed'; readonly issues: string }
  | { readonly kind: 'unknown'; readonly cause: unknown };

export type TicketBriefResult =
  | { readonly ok: true; readonly brief: TicketBrief }
  | { readonly ok: false; readonly error: TicketBriefRepositoryError };

export type TicketBriefOrNullResult =
  | { readonly ok: true; readonly brief: TicketBrief | null }
  | { readonly ok: false; readonly error: TicketBriefRepositoryError };

function parseBriefRow(row: unknown): TicketBriefResult {
  const parsed = ticketBriefSchema.safeParse(row);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: 'validation-failed', issues: parsed.error.message },
    };
  }
  return { ok: true, brief: parsed.data };
}

/**
 * Plain insert — no claim-then-resolve dance, per `ticket-brief.ts`'s own TSDoc: the caller only
 * ever calls this after `postMessage` has already returned a real `ts`. `ticketId` is the table's
 * own `PRIMARY KEY`, so a second insert for the same ticket fails on the DB constraint rather than
 * silently overwriting — the idempotency guard itself is `getTicketBrief`, called first by
 * `handleBriefStageTicket` before this is ever reached in the normal path.
 */
export async function createTicketBrief(
  db: Kysely<Database>,
  input: NewTicketBrief,
): Promise<TicketBriefResult> {
  const candidate = {
    ticketId: input.ticketId,
    channelId: input.channelId,
    messageTs: input.messageTs,
    createdAt: new Date(),
  };

  const validated = parseBriefRow(candidate);
  if (!validated.ok) return validated;

  try {
    const row = await db
      .insertInto('ticketBriefs')
      .values(candidate)
      .returningAll()
      .executeTakeFirstOrThrow();

    return parseBriefRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * Looks up a ticket's brief pointer — `{ ok: true, brief: null }` on no match. This **is** the
 * idempotency check `handleBriefStageTicket` runs first, before any LLM call or Slack post:
 * BUILD_PLAN 6.1b's hard requirement is that a ticket already briefed is never briefed again.
 */
export async function getTicketBrief(
  db: Kysely<Database>,
  ticketId: string,
): Promise<TicketBriefOrNullResult> {
  try {
    const row = await db
      .selectFrom('ticketBriefs')
      .selectAll()
      .where('ticketId', '=', ticketId)
      .executeTakeFirst();
    if (!row) return { ok: true, brief: null };
    const parsed = parseBriefRow(row);
    return parsed.ok ? { ok: true, brief: parsed.brief } : parsed;
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
