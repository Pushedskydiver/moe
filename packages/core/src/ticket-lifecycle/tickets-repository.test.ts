import type { Database } from '../schema.js';
import type { Kysely } from 'kysely';
import type { Pool } from 'pg';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb } from './db.js';
import { runMigrations } from './migrate.js';
import { getTestPool, resetDatabase } from './test-db.js';
import {
  createTicket,
  getTicketById,
  listTickets,
  updateTicket,
} from './tickets-repository.js';

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'migrations',
);

function newTicketInput() {
  return {
    projectKey: 'chief-clancy',
    title: 'Fix the Slack rate-limit tier lookup',
    status: 'Backlog' as const,
    severity: 'Medium' as const,
    classOfService: 'Standard' as const,
  };
}

describe('tickets repository', () => {
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

  it('creates a ticket and returns it validated through ticketSchema', async () => {
    const result = await createTicket(db, newTicketInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ticket.projectKey).toBe('chief-clancy');
    expect(result.ticket.title).toBe('Fix the Slack rate-limit tier lookup');
    expect(result.ticket.status).toBe('Backlog');
    expect(result.ticket.severity).toBe('Medium');
    expect(result.ticket.classOfService).toBe('Standard');
    expect(result.ticket.createdAt).toEqual(result.ticket.updatedAt);
  });

  it('rejects a blank title without writing a row to the database', async () => {
    const result = await createTicket(db, {
      ...newTicketInput(),
      title: '   ',
    });

    expect(result.ok).toBe(false);
    const { rows } = await pool.query('SELECT * FROM tickets');
    expect(rows).toHaveLength(0);
  });

  it('reads back a created ticket by id', async () => {
    const created = await createTicket(db, newTicketInput());
    if (!created.ok) throw new Error('setup failed');

    const result = await getTicketById(db, created.ticket.id);

    expect(result).toEqual({ ok: true, ticket: created.ticket });
  });

  it('returns a null ticket for an id that does not exist', async () => {
    const result = await getTicketById(
      db,
      '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    );
    expect(result).toEqual({ ok: true, ticket: null });
  });

  it('lists tickets scoped to a project key', async () => {
    await createTicket(db, newTicketInput());
    await createTicket(db, {
      ...newTicketInput(),
      projectKey: 'other-project',
    });

    const result = await listTickets(db, { projectKey: 'chief-clancy' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tickets).toHaveLength(1);
    expect(result.tickets[0]?.projectKey).toBe('chief-clancy');
  });

  it('updates a ticket and advances updatedAt without changing createdAt', async () => {
    const created = await createTicket(db, newTicketInput());
    if (!created.ok) throw new Error('setup failed');

    const result = await updateTicket(db, created.ticket.id, {
      status: 'Plan',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ticket?.status).toBe('Plan');
    expect(result.ticket?.createdAt).toEqual(created.ticket.createdAt);
    expect(result.ticket?.updatedAt.getTime()).toBeGreaterThanOrEqual(
      created.ticket.updatedAt.getTime(),
    );
  });

  it('rejects a blank-title patch without persisting it', async () => {
    const created = await createTicket(db, newTicketInput());
    if (!created.ok) throw new Error('setup failed');

    const result = await updateTicket(db, created.ticket.id, { title: '  ' });

    expect(result.ok).toBe(false);
    const unchanged = await getTicketById(db, created.ticket.id);
    expect(unchanged).toEqual({ ok: true, ticket: created.ticket });
  });

  it('returns a null ticket when updating an id that does not exist', async () => {
    const result = await updateTicket(
      db,
      '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      {
        status: 'Done',
      },
    );
    expect(result).toEqual({ ok: true, ticket: null });
  });
});
