import type { Database } from './schema.js';
import type { Kysely } from 'kysely';
import type { Pool } from 'pg';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { claimTicket, releaseTicket } from './claim.js';
import { createDb } from './db.js';
import { runMigrations } from './migrate.js';
import { getTestPool, resetDatabase } from './test-db.js';
import { createTicket } from './tickets-repository.js';

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
  };
}

describe('claimTicket / releaseTicket', () => {
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

  it('claims an unclaimed ticket and bumps the version', async () => {
    const created = await createTicket(db, newTicketInput());
    if (!created.ok) throw new Error('setup failed');

    const result = await claimTicket(db, created.ticket.id, 'sarah');

    expect(result).toEqual({
      ok: true,
      claim: { id: created.ticket.id, claimedBy: 'sarah', version: 1 },
    });
  });

  it('fails to claim a ticket that is already claimed', async () => {
    const created = await createTicket(db, newTicketInput());
    if (!created.ok) throw new Error('setup failed');
    await claimTicket(db, created.ticket.id, 'sarah');

    const result = await claimTicket(db, created.ticket.id, 'marcus');

    expect(result).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });

  it('fails to claim a ticket that does not exist', async () => {
    const result = await claimTicket(
      db,
      '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      'sarah',
    );

    expect(result).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });

  it('releases a claim and bumps the version again', async () => {
    const created = await createTicket(db, newTicketInput());
    if (!created.ok) throw new Error('setup failed');
    await claimTicket(db, created.ticket.id, 'sarah');

    const result = await releaseTicket(db, created.ticket.id, 'sarah');

    expect(result).toEqual({
      ok: true,
      claim: { id: created.ticket.id, claimedBy: null, version: 2 },
    });
  });

  it('fails to release a claim held by someone else', async () => {
    const created = await createTicket(db, newTicketInput());
    if (!created.ok) throw new Error('setup failed');
    await claimTicket(db, created.ticket.id, 'sarah');

    const result = await releaseTicket(db, created.ticket.id, 'marcus');

    expect(result).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });

  it('fails to release a ticket that is not claimed', async () => {
    const created = await createTicket(db, newTicketInput());
    if (!created.ok) throw new Error('setup failed');

    const result = await releaseTicket(db, created.ticket.id, 'sarah');

    expect(result).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });

  it('under N racing claimants, exactly one wins and the version increments exactly once', async () => {
    const created = await createTicket(db, newTicketInput());
    if (!created.ok) throw new Error('setup failed');

    const claimants = Array.from({ length: 10 }, (_, i) => `persona-${i}`);
    const results = await Promise.all(
      claimants.map((claimedBy) =>
        claimTicket(db, created.ticket.id, claimedBy),
      ),
    );

    const winners = results.filter((result) => result.ok);
    expect(winners).toHaveLength(1);
    const [winner] = winners;
    if (!winner?.ok) throw new Error('expected exactly one winner');

    const { rows } = await pool.query<{
      claimed_by: string;
      version: number;
    }>('SELECT claimed_by, version FROM tickets WHERE id = $1', [
      created.ticket.id,
    ]);
    expect(rows[0]?.version).toBe(1);
    expect(rows[0]?.claimed_by).toBe(winner.claim.claimedBy);
  });
});
