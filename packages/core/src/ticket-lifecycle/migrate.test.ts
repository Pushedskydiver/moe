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
      applied: [
        '0001_create_tickets_table.sql',
        '0002_add_ticket_claims.sql',
        '0003_create_conversation_turns.sql',
        '0004_create_persona_cost_daily.sql',
        '0005_create_persona_cost_alerts.sql',
        '0006_create_pending_ticket_drafts.sql',
      ],
    });

    const { rows } = await pool.query<{ id: string }>(
      'SELECT id FROM schema_migrations',
    );
    expect(rows).toEqual([
      { id: '0001_create_tickets_table.sql' },
      { id: '0002_add_ticket_claims.sql' },
      { id: '0003_create_conversation_turns.sql' },
      { id: '0004_create_persona_cost_daily.sql' },
      { id: '0005_create_persona_cost_alerts.sql' },
      { id: '0006_create_pending_ticket_drafts.sql' },
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

  it('creates a conversation_turns table that accepts a valid turn row', async () => {
    await runMigrations(pool, migrationsDir);
    await pool.query(
      `INSERT INTO conversation_turns (id, persona_id, channel_id, thread_key, role, content, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        'sarah',
        'C123',
        'dm',
        'user',
        'hello',
        new Date(),
      ],
    );
    const { rows } = await pool.query('SELECT * FROM conversation_turns');
    expect(rows).toHaveLength(1);
  });

  it('rejects a conversation_turns row with an invalid role via the CHECK constraint', async () => {
    await runMigrations(pool, migrationsDir);
    await expect(
      pool.query(
        `INSERT INTO conversation_turns (id, persona_id, channel_id, thread_key, role, content, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          'sarah',
          'C123',
          'dm',
          'system',
          'hello',
          new Date(),
        ],
      ),
    ).rejects.toThrow();
  });

  it('creates a pending_ticket_drafts table that accepts a valid draft row', async () => {
    await runMigrations(pool, migrationsDir);
    await pool.query(
      `INSERT INTO pending_ticket_drafts
         (id, persona_id, channel_id, message_ts, source_message_text, draft_title, draft_body, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        'sarah',
        'C123',
        '1700000000.000100',
        'the CLI hangs on large repos',
        'CLI hangs on large repos',
        'The CLI hangs when run against large repos.',
        new Date(),
      ],
    );
    const { rows } = await pool.query('SELECT * FROM pending_ticket_drafts');
    expect(rows).toHaveLength(1);
  });

  it('rejects a second pending_ticket_drafts row for the same (channel_id, message_ts) pair via the UNIQUE constraint', async () => {
    await runMigrations(pool, migrationsDir);
    const insert = (id: string) =>
      pool.query(
        `INSERT INTO pending_ticket_drafts
           (id, persona_id, channel_id, message_ts, source_message_text, draft_title, draft_body, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          'sarah',
          'C123',
          '1700000000.000100',
          'the CLI hangs on large repos',
          'CLI hangs on large repos',
          'The CLI hangs when run against large repos.',
          new Date(),
        ],
      );
    await insert('3fa85f64-5717-4562-b3fc-2c963f66afa6');
    await expect(
      insert('4fa85f64-5717-4562-b3fc-2c963f66afa7'),
    ).rejects.toThrow();
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
