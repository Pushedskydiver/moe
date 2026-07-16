import type { Database } from '../schema.js';
import type { Ticket } from '../ticket.js';
import type { Kysely } from 'kysely';

import { ticketSchema } from '../ticket.js';

export type NewTicket = Pick<
  Ticket,
  'projectKey' | 'title' | 'status' | 'severity'
>;
export type TicketPatch = Partial<NewTicket>;

export type TicketRepositoryError =
  | { readonly kind: 'validation-failed'; readonly issues: string }
  | { readonly kind: 'unknown'; readonly cause: unknown };

export type TicketResult =
  | { readonly ok: true; readonly ticket: Ticket }
  | { readonly ok: false; readonly error: TicketRepositoryError };
export type TicketOrNullResult =
  | { readonly ok: true; readonly ticket: Ticket | null }
  | { readonly ok: false; readonly error: TicketRepositoryError };
export type TicketListResult =
  | { readonly ok: true; readonly tickets: readonly Ticket[] }
  | { readonly ok: false; readonly error: TicketRepositoryError };

function parseTicketRow(row: unknown): TicketResult {
  const parsed = ticketSchema.safeParse(row);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: 'validation-failed', issues: parsed.error.message },
    };
  }
  return { ok: true, ticket: parsed.data };
}

function isFailedTicketResult(
  result: TicketResult,
): result is Extract<TicketResult, { readonly ok: false }> {
  return !result.ok;
}

function isOkTicketResult(
  result: TicketResult,
): result is Extract<TicketResult, { readonly ok: true }> {
  return result.ok;
}

/**
 * Inserts a new ticket. `id` is server-generated (not part of `NewTicket`) and `createdAt`
 * equals `updatedAt` on insert. Validates the full candidate row through `ticketSchema` before
 * writing, so an invalid input (e.g. a blank title) never reaches the database.
 */
export async function createTicket(
  db: Kysely<Database>,
  input: NewTicket,
): Promise<TicketResult> {
  const now = new Date();
  const candidate = {
    id: crypto.randomUUID(),
    projectKey: input.projectKey,
    title: input.title,
    status: input.status,
    severity: input.severity,
    createdAt: now,
    updatedAt: now,
    claimedBy: null,
  };

  const validated = parseTicketRow(candidate);
  if (!validated.ok) return validated;

  try {
    const insert = db.insertInto('tickets').values(candidate);
    const row = await insert.returningAll().executeTakeFirstOrThrow();
    return parseTicketRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/** Looks up a ticket by id. A non-matching id is not an error — returns `{ ok: true, ticket: null }`. */
export async function getTicketById(
  db: Kysely<Database>,
  id: string,
): Promise<TicketOrNullResult> {
  try {
    const query = db.selectFrom('tickets').selectAll().where('id', '=', id);
    const row = await query.executeTakeFirst();
    if (!row) return { ok: true, ticket: null };
    const parsed = parseTicketRow(row);
    return parsed.ok ? { ok: true, ticket: parsed.ticket } : parsed;
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/** Lists tickets, optionally scoped to a single `projectKey`. */
export async function listTickets(
  db: Kysely<Database>,
  filters?: { readonly projectKey?: string },
): Promise<TicketListResult> {
  try {
    const base = db.selectFrom('tickets').selectAll();
    const scoped = filters?.projectKey
      ? base.where('projectKey', '=', filters.projectKey)
      : base;
    const rows = await scoped.execute();

    const parsedRows = rows.map((row) => parseTicketRow(row));
    const failure = parsedRows.find((parsed) => isFailedTicketResult(parsed));
    if (failure) return failure;

    return {
      ok: true,
      tickets: parsedRows
        .filter((parsed) => isOkTicketResult(parsed))
        .map((parsed) => parsed.ticket),
    };
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * Applies a partial update. A non-matching id is not an error — returns
 * `{ ok: true, ticket: null }`. Merges `patch` onto the existing row and validates the result
 * through `ticketSchema` before writing, so a patch that would produce an invalid ticket (e.g. a
 * blank title) never reaches the database.
 */
export async function updateTicket(
  db: Kysely<Database>,
  id: string,
  patch: TicketPatch,
): Promise<TicketOrNullResult> {
  try {
    const existing = await db
      .selectFrom('tickets')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!existing) return { ok: true, ticket: null };

    const updatedAt = new Date();
    const candidate = { ...existing, ...patch, updatedAt };
    const validated = parseTicketRow(candidate);
    if (!validated.ok) return validated;

    const update = db.updateTable('tickets').set({ ...patch, updatedAt });
    const scoped = update.where('id', '=', id);
    const row = await scoped.returningAll().executeTakeFirst();
    if (!row) return { ok: true, ticket: null };
    const parsed = parseTicketRow(row);
    return parsed.ok ? { ok: true, ticket: parsed.ticket } : parsed;
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
