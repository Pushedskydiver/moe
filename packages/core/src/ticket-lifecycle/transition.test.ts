import type { Database } from '../schema.js';
import type { Kysely } from 'kysely';
import type { Pool } from 'pg';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { claimTicket } from './claim.js';
import { createDb, DB_POOL_MAX_CONNECTIONS } from './db.js';
import { runMigrations } from './migrate.js';
import { getTestPool, resetDatabase } from './test-db.js';
import { createTicket } from './tickets-repository.js';
import { transitionTicketStatus } from './transition.js';

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
    status: 'Brief' as const,
    severity: 'Medium' as const,
    classOfService: 'Standard' as const,
  };
}

describe('transitionTicketStatus', () => {
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

  it('transitions status, bumps version and updatedAt, leaves claimedBy unchanged', async () => {
    const created = await createTicket(db, newTicketInput());
    if (!created.ok) throw new Error('setup failed');
    await claimTicket(db, created.ticket.id, 'sarah');

    const result = await transitionTicketStatus(db, {
      id: created.ticket.id,
      projectKey: 'chief-clancy',
      fromStatus: 'Brief',
      toStatus: 'Plan',
      claimedBy: 'sarah',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ticket.status).toBe('Plan');
    expect(result.ticket.updatedAt.getTime()).toBeGreaterThanOrEqual(
      created.ticket.updatedAt.getTime(),
    );

    const { rows } = await pool.query<{
      claimed_by: string | null;
      version: number;
    }>('SELECT claimed_by, version FROM tickets WHERE id = $1', [
      created.ticket.id,
    ]);
    expect(rows[0]?.claimed_by).toBe('sarah');
    expect(rows[0]?.version).toBe(2);
  });

  it('fails when the ticket is claimed by someone else', async () => {
    const created = await createTicket(db, newTicketInput());
    if (!created.ok) throw new Error('setup failed');
    await claimTicket(db, created.ticket.id, 'sarah');

    const result = await transitionTicketStatus(db, {
      id: created.ticket.id,
      projectKey: 'chief-clancy',
      fromStatus: 'Brief',
      toStatus: 'Plan',
      claimedBy: 'marcus',
    });

    expect(result).toEqual({ ok: false, error: { kind: 'unavailable' } });
    const { rows } = await pool.query(
      'SELECT status FROM tickets WHERE id = $1',
      [created.ticket.id],
    );
    expect(rows[0]?.status).toBe('Brief');
  });

  it('fails when the actual status does not match fromStatus', async () => {
    const created = await createTicket(db, newTicketInput());
    if (!created.ok) throw new Error('setup failed');
    await claimTicket(db, created.ticket.id, 'sarah');

    const result = await transitionTicketStatus(db, {
      id: created.ticket.id,
      projectKey: 'chief-clancy',
      fromStatus: 'Plan',
      toStatus: 'Build',
      claimedBy: 'sarah',
    });

    expect(result).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });

  it('fails when the ticket does not exist', async () => {
    const result = await transitionTicketStatus(db, {
      id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      projectKey: 'chief-clancy',
      fromStatus: 'Brief',
      toStatus: 'Plan',
      claimedBy: 'sarah',
    });

    expect(result).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });

  describe('WIP gate', () => {
    it('blocks the transition when the destination status is at its cap, without writing', async () => {
      await createTicket(db, { ...newTicketInput(), status: 'Plan' });
      await createTicket(db, { ...newTicketInput(), status: 'Plan' });
      const created = await createTicket(db, newTicketInput());
      if (!created.ok) throw new Error('setup failed');
      await claimTicket(db, created.ticket.id, 'sarah');

      const result = await transitionTicketStatus(db, {
        id: created.ticket.id,
        projectKey: 'chief-clancy',
        fromStatus: 'Brief',
        toStatus: 'Plan',
        claimedBy: 'sarah',
      });

      expect(result).toEqual({
        ok: false,
        error: { kind: 'wip-limit-blocked', reason: 'at-limit' },
      });
      const { rows } = await pool.query(
        'SELECT status FROM tickets WHERE id = $1',
        [created.ticket.id],
      );
      expect(rows[0]?.status).toBe('Brief');
    });

    it('allows the transition at exactly one under the cap', async () => {
      await createTicket(db, { ...newTicketInput(), status: 'Plan' });
      const created = await createTicket(db, newTicketInput());
      if (!created.ok) throw new Error('setup failed');
      await claimTicket(db, created.ticket.id, 'sarah');

      const result = await transitionTicketStatus(db, {
        id: created.ticket.id,
        projectKey: 'chief-clancy',
        fromStatus: 'Brief',
        toStatus: 'Plan',
        claimedBy: 'sarah',
      });

      expect(result.ok).toBe(true);
    });

    it('allows the transition into an uncapped destination status regardless of count', async () => {
      const created = await createTicket(db, {
        ...newTicketInput(),
        status: 'Review',
      });
      if (!created.ok) throw new Error('setup failed');
      await claimTicket(db, created.ticket.id, 'dom');

      const result = await transitionTicketStatus(db, {
        id: created.ticket.id,
        projectKey: 'chief-clancy',
        fromStatus: 'Review',
        toStatus: 'Done',
        claimedBy: 'dom',
      });

      expect(result.ok).toBe(true);
    });
  });

  it('under N racing callers on the same ticket, exactly one wins and the version increments exactly once', async () => {
    const created = await createTicket(db, newTicketInput());
    if (!created.ok) throw new Error('setup failed');
    await claimTicket(db, created.ticket.id, 'sarah');

    // Same reasoning as claim.test.ts's own racing-claimants test: bound to the pool max so every
    // attempt gets its own connection and genuinely races at the Postgres level, and assert the
    // floor so a future pool-size change that would silently stop exercising a real race fails
    // loudly here instead of leaving a green-but-meaningless test.
    expect(DB_POOL_MAX_CONNECTIONS).toBeGreaterThan(1);
    const attempts = Array.from({ length: DB_POOL_MAX_CONNECTIONS }, () =>
      transitionTicketStatus(db, {
        id: created.ticket.id,
        projectKey: 'chief-clancy',
        fromStatus: 'Brief',
        toStatus: 'Plan',
        claimedBy: 'sarah',
      }),
    );
    const results = await Promise.all(attempts);

    const winners = results.filter((result) => result.ok);
    expect(winners).toHaveLength(1);

    const { rows } = await pool.query<{ version: number; status: string }>(
      'SELECT status, version FROM tickets WHERE id = $1',
      [created.ticket.id],
    );
    expect(rows[0]?.version).toBe(2);
    expect(rows[0]?.status).toBe('Plan');
  });
});
