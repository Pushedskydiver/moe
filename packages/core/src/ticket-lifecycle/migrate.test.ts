import type { Pool } from 'pg';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runMigrations } from './migrate.js';
import { getTestPool, resetDatabase } from './test-db.js';

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'migrations',
);

describe('runMigrations', () => {
  let pool: Pool;

  beforeEach(() => {
    pool = getTestPool();
  });

  afterEach(async () => {
    await resetDatabase(pool);
    await pool.end();
  });

  it('applies pending migrations and records them', async () => {
    const result = await runMigrations(pool, migrationsDir);
    expect(result).toEqual({
      ok: true,
      applied: ['0001_create_tickets_table.sql', '0002_add_ticket_claims.sql'],
    });

    const { rows } = await pool.query<{ id: string }>(
      'SELECT id FROM schema_migrations',
    );
    expect(rows).toEqual([
      { id: '0001_create_tickets_table.sql' },
      { id: '0002_add_ticket_claims.sql' },
    ]);
  });

  it('is idempotent — running twice applies nothing the second time', async () => {
    await runMigrations(pool, migrationsDir);
    const second = await runMigrations(pool, migrationsDir);
    expect(second).toEqual({ ok: true, applied: [] });
  });

  it('creates a table that actually accepts a valid ticket row', async () => {
    await runMigrations(pool, migrationsDir);
    const now = new Date();
    await pool.query(
      `INSERT INTO tickets (id, project_key, title, status, severity, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [
        '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        'chief-clancy',
        'A ticket',
        'Backlog',
        'Medium',
        now,
      ],
    );
    const { rows } = await pool.query('SELECT * FROM tickets');
    expect(rows).toHaveLength(1);
  });

  it('defaults new tickets to unclaimed at version 0', async () => {
    await runMigrations(pool, migrationsDir);
    const now = new Date();
    await pool.query(
      `INSERT INTO tickets (id, project_key, title, status, severity, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [
        '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        'chief-clancy',
        'A ticket',
        'Backlog',
        'Medium',
        now,
      ],
    );
    const { rows } = await pool.query<{
      claimed_by: string | null;
      version: number;
    }>('SELECT claimed_by, version FROM tickets');
    expect(rows).toEqual([{ claimed_by: null, version: 0 }]);
  });

  it('rejects a row with an invalid status via the CHECK constraint', async () => {
    await runMigrations(pool, migrationsDir);
    const now = new Date();
    await expect(
      pool.query(
        `INSERT INTO tickets (id, project_key, title, status, severity, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)`,
        [
          '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          'chief-clancy',
          'A ticket',
          'InProgress',
          'Medium',
          now,
        ],
      ),
    ).rejects.toThrow();
  });
});
