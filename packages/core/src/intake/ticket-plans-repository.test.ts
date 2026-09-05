import type { Database } from '../schema.js';
import type { Kysely } from 'kysely';
import type { Pool } from 'pg';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb } from '../ticket-lifecycle/db.js';
import { runMigrations } from '../ticket-lifecycle/migrate.js';
import { getTestPool, resetDatabase } from '../ticket-lifecycle/test-db.js';
import { createTicket } from '../ticket-lifecycle/tickets-repository.js';
import { createTicketPlan, getTicketPlan } from './ticket-plans-repository.js';

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'migrations',
);

async function seedTicket(db: Kysely<Database>) {
  const created = await createTicket(db, {
    projectKey: 'chief-clancy',
    title: 'The login page returns a 500 on submit',
    status: 'Plan',
    severity: 'Medium',
    classOfService: 'Standard',
  });
  if (!created.ok) throw new Error('failed to seed ticket');
  return created.ticket;
}

describe('ticket plans repository', () => {
  let pool: Pool;
  let db: Kysely<Database>;

  beforeEach(async () => {
    pool = getTestPool();
    await runMigrations(pool, migrationsDir);
    db = createDb(pool);
  });

  afterEach(async () => {
    await db.destroy();
    const cleanupPool = getTestPool();
    await resetDatabase(cleanupPool);
    await cleanupPool.end();
  });

  it('returns ok:true with plan:null when no plan exists for a ticket', async () => {
    const ticket = await seedTicket(db);

    const result = await getTicketPlan(db, ticket.id);

    expect(result).toEqual({ ok: true, plan: null });
  });

  it('creates a plan pointer and reads it back', async () => {
    const ticket = await seedTicket(db);

    const created = await createTicketPlan(db, {
      ticketId: ticket.id,
      channelId: 'C0B88H0JUA3',
      messageTs: '1700000000.000100',
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.plan.ticketId).toBe(ticket.id);
    expect(created.plan.channelId).toBe('C0B88H0JUA3');
    expect(created.plan.messageTs).toBe('1700000000.000100');

    const found = await getTicketPlan(db, ticket.id);
    expect(found).toEqual({ ok: true, plan: created.plan });
  });

  it('rejects a second plan for the same ticketId via the PRIMARY KEY', async () => {
    const ticket = await seedTicket(db);
    const first = await createTicketPlan(db, {
      ticketId: ticket.id,
      channelId: 'C0B88H0JUA3',
      messageTs: '1700000000.000100',
    });
    expect(first.ok).toBe(true);

    const second = await createTicketPlan(db, {
      ticketId: ticket.id,
      channelId: 'C0B88H0JUA3',
      messageTs: '1700000000.000200',
    });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.kind).toBe('unknown');

    const { rows } = await pool.query('SELECT * FROM ticket_plans');
    expect(rows).toHaveLength(1);
  });
});
