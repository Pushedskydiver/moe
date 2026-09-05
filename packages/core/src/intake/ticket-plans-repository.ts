import type { Database } from '../schema.js';
import type { TicketPlan } from './ticket-plan.js';
import type { Kysely } from 'kysely';

import { ticketPlanSchema } from './ticket-plan.js';

export type NewTicketPlan = Pick<
  TicketPlan,
  'ticketId' | 'channelId' | 'messageTs'
>;

export type TicketPlanRepositoryError =
  | { readonly kind: 'validation-failed'; readonly issues: string }
  | { readonly kind: 'unknown'; readonly cause: unknown };

export type TicketPlanResult =
  | { readonly ok: true; readonly plan: TicketPlan }
  | { readonly ok: false; readonly error: TicketPlanRepositoryError };

export type TicketPlanOrNullResult =
  | { readonly ok: true; readonly plan: TicketPlan | null }
  | { readonly ok: false; readonly error: TicketPlanRepositoryError };

function parsePlanRow(row: unknown): TicketPlanResult {
  const parsed = ticketPlanSchema.safeParse(row);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: 'validation-failed', issues: parsed.error.message },
    };
  }
  return { ok: true, plan: parsed.data };
}

/**
 * Plain insert — no claim-then-resolve dance, per `ticket-plan.ts`'s own TSDoc: the caller only
 * ever calls this after `postMessage` has already returned a real `ts`. `ticketId` is the table's
 * own `PRIMARY KEY`, so a second insert for the same ticket fails on the DB constraint rather than
 * silently overwriting — the idempotency guard itself is `getTicketPlan`, called first by
 * `handlePlanStageTicket` before this is ever reached in the normal path.
 */
export async function createTicketPlan(
  db: Kysely<Database>,
  input: NewTicketPlan,
): Promise<TicketPlanResult> {
  const candidate = {
    ticketId: input.ticketId,
    channelId: input.channelId,
    messageTs: input.messageTs,
    createdAt: new Date(),
  };

  const validated = parsePlanRow(candidate);
  if (!validated.ok) return validated;

  try {
    const row = await db
      .insertInto('ticketPlans')
      .values(candidate)
      .returningAll()
      .executeTakeFirstOrThrow();

    return parsePlanRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * Looks up a ticket's plan pointer — `{ ok: true, plan: null }` on no match. This **is** the
 * idempotency check `handlePlanStageTicket` runs first, before any LLM call or Slack post: a
 * ticket already planned is never planned again.
 */
export async function getTicketPlan(
  db: Kysely<Database>,
  ticketId: string,
): Promise<TicketPlanOrNullResult> {
  try {
    const row = await db
      .selectFrom('ticketPlans')
      .selectAll()
      .where('ticketId', '=', ticketId)
      .executeTakeFirst();
    if (!row) return { ok: true, plan: null };
    const parsed = parsePlanRow(row);
    return parsed.ok ? { ok: true, plan: parsed.plan } : parsed;
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
