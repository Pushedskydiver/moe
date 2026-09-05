import type { Database } from '../schema.js';
import type { TicketBrief } from './ticket-brief.js';
import type { Kysely } from 'kysely';

import { ticketBriefSchema } from './ticket-brief.js';

export type NewTicketBrief = Pick<
  TicketBrief,
  'ticketId' | 'channelId' | 'messageTs' | 'summary' | 'scope'
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
 *
 * **Two different shapes of the same logical row, not one** (BUILD_PLAN 6.1c, folding spec-grill's
 * write-side serialization finding): `candidate` — the object `parseBriefRow` validates against
 * `ticketBriefSchema` before any DB call — keeps `scope` as a real array, since that's the shape
 * the schema's `scope: z.array(z.string())` expects. The object actually passed to `.values(...)`
 * needs `scope` stringified instead: the real `pg` driver serializes a raw JS array as a Postgres
 * array literal (`{"a","b"}`), not JSON (`["a","b"]`) — `Array.isArray` is checked before the
 * generic-object branch in `pg`'s own value-preparation code — so a `jsonb` column needs the value
 * already `JSON.stringify`'d before it reaches `.values()`, matching Kysely's own documented
 * default for `JSONColumnType` (insert/update as a stringified JSON string; only the *read* side
 * auto-parses). `schema.ts`'s `TicketBriefsTable.scope: JSONColumnType<readonly string[]>`
 * type-enforces this: `Insertable<TicketBriefsTable>` derives `scope: string`, so passing
 * `candidate.scope` (a real array) to `.values()` directly would fail to compile, not just fail at
 * runtime. No equivalent handling needed on read (`getTicketBrief` below) — `pg` already
 * auto-`JSON.parse`s a `json`/`jsonb` column back into a real array/object, so `ticketBriefSchema`
 * validates a real read correctly as-is.
 */
export async function createTicketBrief(
  db: Kysely<Database>,
  input: NewTicketBrief,
): Promise<TicketBriefResult> {
  const candidate = {
    ticketId: input.ticketId,
    channelId: input.channelId,
    messageTs: input.messageTs,
    summary: input.summary,
    scope: input.scope, // real array — this is what parseBriefRow validates
    createdAt: new Date(),
  };

  const validated = parseBriefRow(candidate);
  if (!validated.ok) return validated;

  try {
    const row = await db
      .insertInto('ticketBriefs')
      .values({ ...candidate, scope: JSON.stringify(candidate.scope) }) // stringified only here
      .returningAll()
      .executeTakeFirstOrThrow();

    return parseBriefRow(row); // pg already auto-parses jsonb back to a real array on read
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

/**
 * Reverse lookup by the Slack message a brief was posted as — BUILD_PLAN 6.1d's own reason for
 * migration `0028`'s `UNIQUE (channel_id, message_ts)` constraint. `dispatchBriefApproval`
 * (`apps/server`) uses this to find the ticket a 👍 reaction on a Brief message belongs to, mirroring
 * `getTicketBrief`'s exact shape with a different WHERE clause.
 */
export async function getTicketBriefByMessage(
  db: Kysely<Database>,
  scope: { readonly channelId: string; readonly messageTs: string },
): Promise<TicketBriefOrNullResult> {
  try {
    const row = await db
      .selectFrom('ticketBriefs')
      .selectAll()
      .where('channelId', '=', scope.channelId)
      .where('messageTs', '=', scope.messageTs)
      .executeTakeFirst();
    if (!row) return { ok: true, brief: null };
    const parsed = parseBriefRow(row);
    return parsed.ok ? { ok: true, brief: parsed.brief } : parsed;
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
