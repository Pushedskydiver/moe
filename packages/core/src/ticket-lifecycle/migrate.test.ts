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
        '0007_create_review_queue.sql',
        '0008_create_pending_confirming_questions.sql',
        '0009_widen_review_queue_outcome_reason.sql',
        '0010_create_sweep_state.sql',
        '0011_widen_review_queue_outcome_reason_again.sql',
        '0012_add_pending_ticket_drafts_redo_count.sql',
        '0013_add_pending_ticket_drafts_origin.sql',
        '0014_create_github_issue_triage.sql',
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
      { id: '0007_create_review_queue.sql' },
      { id: '0008_create_pending_confirming_questions.sql' },
      { id: '0009_widen_review_queue_outcome_reason.sql' },
      { id: '0010_create_sweep_state.sql' },
      { id: '0011_widen_review_queue_outcome_reason_again.sql' },
      { id: '0012_add_pending_ticket_drafts_redo_count.sql' },
      { id: '0013_add_pending_ticket_drafts_origin.sql' },
      { id: '0014_create_github_issue_triage.sql' },
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

  it('creates a review_queue table that accepts a valid low-confidence row', async () => {
    await runMigrations(pool, migrationsDir);
    await pool.query(
      `INSERT INTO review_queue
         (id, persona_id, channel_id, message_ts, source_message_text, confidence, reasoning, outcome_reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        'sarah',
        'C123',
        '1700000000.000100',
        'anyone know a good coffee place nearby',
        12,
        'reads as banter, not a work request',
        'low-confidence',
        new Date(),
      ],
    );
    const { rows } = await pool.query('SELECT * FROM review_queue');
    expect(rows).toHaveLength(1);
  });

  it('allows a second review_queue row for the same (channel_id, message_ts) pair — no uniqueness constraint, unlike pending_ticket_drafts', async () => {
    await runMigrations(pool, migrationsDir);
    const insert = (id: string) =>
      pool.query(
        `INSERT INTO review_queue
           (id, persona_id, channel_id, message_ts, source_message_text, confidence, reasoning, outcome_reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          'sarah',
          'C123',
          '1700000000.000100',
          'anyone know a good coffee place nearby',
          12,
          'reads as banter, not a work request',
          'low-confidence',
          new Date(),
        ],
      );
    await insert('3fa85f64-5717-4562-b3fc-2c963f66afa6');
    await insert('4fa85f64-5717-4562-b3fc-2c963f66afa7');

    const { rows } = await pool.query('SELECT * FROM review_queue');
    expect(rows).toHaveLength(2);
  });

  it('rejects a review_queue row with an invalid outcome_reason via the CHECK constraint', async () => {
    await runMigrations(pool, migrationsDir);
    await expect(
      pool.query(
        `INSERT INTO review_queue
           (id, persona_id, channel_id, message_ts, source_message_text, confidence, reasoning, outcome_reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          'sarah',
          'C123',
          '1700000000.000100',
          'anyone know a good coffee place nearby',
          12,
          'reads as banter, not a work request',
          'high-confidence',
          new Date(),
        ],
      ),
    ).rejects.toThrow();
  });

  it('accepts review_queue rows with the widened mid-no and mid-silence outcome_reason values (BUILD_PLAN 3.4b-ii)', async () => {
    await runMigrations(pool, migrationsDir);
    const insert = (id: string, outcomeReason: string) =>
      pool.query(
        `INSERT INTO review_queue
           (id, persona_id, channel_id, message_ts, source_message_text, confidence, reasoning, outcome_reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          'sarah',
          'C123',
          '1700000000.000100',
          'hey, there might be an issue with the CLI on large repos',
          55,
          'plausibly describes a bug, but not clearly actionable',
          outcomeReason,
          new Date(),
        ],
      );
    await insert('3fa85f64-5717-4562-b3fc-2c963f66afa6', 'mid-no');
    await insert('4fa85f64-5717-4562-b3fc-2c963f66afa7', 'mid-silence');

    const { rows } = await pool.query('SELECT * FROM review_queue');
    expect(rows).toHaveLength(2);
  });

  it('rejects a review_queue row with the now-retired mid-no-response placeholder value — the widening migration replaces it, not adds to it (BUILD_PLAN 3.4b-ii)', async () => {
    await runMigrations(pool, migrationsDir);
    await expect(
      pool.query(
        `INSERT INTO review_queue
           (id, persona_id, channel_id, message_ts, source_message_text, confidence, reasoning, outcome_reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          'sarah',
          'C123',
          '1700000000.000100',
          'hey, there might be an issue with the CLI on large repos',
          55,
          'plausibly describes a bug, but not clearly actionable',
          'mid-no-response',
          new Date(),
        ],
      ),
    ).rejects.toThrow();
  });

  it('accepts a review_queue row with the widened mid-yes-failed outcome_reason value (claim-then-act fallback fix)', async () => {
    await runMigrations(pool, migrationsDir);
    await pool.query(
      `INSERT INTO review_queue
         (id, persona_id, channel_id, message_ts, source_message_text, confidence, reasoning, outcome_reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        '5fa85f64-5717-4562-b3fc-2c963f66afa8',
        'sarah',
        'C123',
        '1700000000.000100',
        'hey, there might be an issue with the CLI on large repos',
        55,
        'plausibly describes a bug, but not clearly actionable',
        'mid-yes-failed',
        new Date(),
      ],
    );

    const { rows } = await pool.query('SELECT * FROM review_queue');
    expect(rows).toHaveLength(1);
  });

  it('adds a redo_count column to pending_ticket_drafts that defaults to 0 and accepts increments (chunk 3.6)', async () => {
    await runMigrations(pool, migrationsDir);
    await pool.query(
      `INSERT INTO pending_ticket_drafts
         (id, persona_id, channel_id, message_ts, source_message_text, draft_title, draft_body, resolved_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        '6fa85f64-5717-4562-b3fc-2c963f66afa9',
        'sarah',
        'C123',
        '1700000000.000100',
        'the CLI hangs on large repos, can someone take a look',
        'CLI hangs on large repos',
        'The CLI hangs when run against large repos.',
        null,
        new Date(),
      ],
    );

    const { rows: defaultRows } = await pool.query<{ redo_count: number }>(
      'SELECT redo_count FROM pending_ticket_drafts WHERE id = $1',
      ['6fa85f64-5717-4562-b3fc-2c963f66afa9'],
    );
    expect(defaultRows[0]?.redo_count).toBe(0);

    await pool.query(
      'UPDATE pending_ticket_drafts SET redo_count = redo_count + 1 WHERE id = $1',
      ['6fa85f64-5717-4562-b3fc-2c963f66afa9'],
    );
    const { rows: incrementedRows } = await pool.query<{
      redo_count: number;
    }>('SELECT redo_count FROM pending_ticket_drafts WHERE id = $1', [
      '6fa85f64-5717-4562-b3fc-2c963f66afa9',
    ]);
    expect(incrementedRows[0]?.redo_count).toBe(1);
  });

  it('defaults a pending_ticket_drafts row with no origin supplied to high-band (chunk 3.6)', async () => {
    await runMigrations(pool, migrationsDir);
    await pool.query(
      `INSERT INTO pending_ticket_drafts
         (id, persona_id, channel_id, message_ts, source_message_text, draft_title, draft_body, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        '7fa85f64-5717-4562-b3fc-2c963f66afaa',
        'sarah',
        'C123',
        '1700000000.000100',
        'the CLI hangs on large repos',
        'CLI hangs on large repos',
        'The CLI hangs when run against large repos.',
        new Date(),
      ],
    );
    const { rows } = await pool.query<{ origin: string }>(
      'SELECT origin FROM pending_ticket_drafts WHERE id = $1',
      ['7fa85f64-5717-4562-b3fc-2c963f66afaa'],
    );
    expect(rows[0]?.origin).toBe('high-band');
  });

  it('rejects a pending_ticket_drafts row with an invalid origin via the CHECK constraint (chunk 3.6)', async () => {
    await runMigrations(pool, migrationsDir);
    await expect(
      pool.query(
        `INSERT INTO pending_ticket_drafts
           (id, persona_id, channel_id, message_ts, source_message_text, draft_title, draft_body, created_at, origin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          '8fa85f64-5717-4562-b3fc-2c963f66afab',
          'sarah',
          'C123',
          '1700000000.000100',
          'the CLI hangs on large repos',
          'CLI hangs on large repos',
          'The CLI hangs when run against large repos.',
          new Date(),
          'bogus-origin',
        ],
      ),
    ).rejects.toThrow();
  });

  it('creates a pending_confirming_questions table that accepts a valid unresolved row', async () => {
    await runMigrations(pool, migrationsDir);
    await pool.query(
      `INSERT INTO pending_confirming_questions
         (id, persona_id, channel_id, message_ts, source_message_ts, source_message_text, confidence, reasoning, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        'sarah',
        'C123',
        '1700000099.000100',
        '1700000000.000050',
        'hey, there might be an issue with the CLI on large repos',
        55,
        'plausibly describes a bug, but not clearly actionable',
        new Date(),
      ],
    );
    const { rows } = await pool.query(
      'SELECT * FROM pending_confirming_questions',
    );
    expect(rows).toHaveLength(1);
  });

  it('rejects a second pending_confirming_questions row for the same (channel_id, message_ts) pair via the UNIQUE constraint', async () => {
    await runMigrations(pool, migrationsDir);
    const insert = (id: string) =>
      pool.query(
        `INSERT INTO pending_confirming_questions
           (id, persona_id, channel_id, message_ts, source_message_ts, source_message_text, confidence, reasoning, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          'sarah',
          'C123',
          '1700000099.000100',
          '1700000000.000050',
          'hey, there might be an issue with the CLI on large repos',
          55,
          'plausibly describes a bug, but not clearly actionable',
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

  it('creates a sweep_state table that accepts one row per persona_id and upserts on conflict (BUILD_PLAN 3.5)', async () => {
    await runMigrations(pool, migrationsDir);
    const first = new Date('2026-07-19T09:00:00.000Z');
    const second = new Date('2026-07-20T09:00:00.000Z');

    await pool.query(
      `INSERT INTO sweep_state (persona_id, last_swept_at) VALUES ($1, $2)`,
      ['sarah', first],
    );
    await pool.query(
      `INSERT INTO sweep_state (persona_id, last_swept_at) VALUES ($1, $2)
       ON CONFLICT (persona_id) DO UPDATE SET last_swept_at = excluded.last_swept_at`,
      ['sarah', second],
    );

    const { rows } = await pool.query<{ last_swept_at: Date }>(
      'SELECT last_swept_at FROM sweep_state WHERE persona_id = $1',
      ['sarah'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.last_swept_at.toISOString()).toBe(second.toISOString());
  });
});
