import type { Database } from '../schema.js';
import type { Kysely } from 'kysely';
import type { Pool } from 'pg';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb } from '../ticket-lifecycle/db.js';
import { runMigrations } from '../ticket-lifecycle/migrate.js';
import { getTestPool, resetDatabase } from '../ticket-lifecycle/test-db.js';
import { getDraftOutcomeCounts } from './draft-outcome-counts.js';

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'migrations',
);

const IGNORED_OLDER_THAN = new Date('2026-07-19T00:00:00.000Z');

function baseColumns() {
  return {
    persona_id: 'sarah',
    channel_id: 'C123',
    source_message_text: 'the CLI hangs on large repos',
    draft_title: 'CLI hangs on large repos',
    draft_body: 'The CLI hangs when run against large repos.',
  };
}

describe('getDraftOutcomeCounts', () => {
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

  async function insertDraft(input: {
    readonly id: string;
    readonly messageTs: string;
    readonly resolvedAt: Date | null;
    readonly redoCount: number;
    readonly createdAt: Date;
    readonly origin?: 'high-band' | 'mid-band-confirmed';
  }) {
    const base = baseColumns();
    await pool.query(
      `INSERT INTO pending_ticket_drafts
         (id, persona_id, channel_id, message_ts, source_message_text, draft_title, draft_body, resolved_at, created_at, redo_count, origin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        input.id,
        base.persona_id,
        base.channel_id,
        input.messageTs,
        base.source_message_text,
        base.draft_title,
        base.draft_body,
        input.resolvedAt,
        input.createdAt,
        input.redoCount,
        input.origin ?? 'high-band',
      ],
    );
  }

  it('returns all-zero counts for a persona with no drafts', async () => {
    const result = await getDraftOutcomeCounts(db, {
      personaId: 'sarah',
      ignoredOlderThan: IGNORED_OLDER_THAN,
    });

    expect(result).toEqual({
      ok: true,
      counts: { committed: 0, redone: 0, ignored: 0 },
    });
  });

  it('counts a resolved draft as committed regardless of redo history', async () => {
    await insertDraft({
      id: '1fa85f64-5717-4562-b3fc-2c963f66afa1',
      messageTs: '1700000000.000100',
      resolvedAt: new Date('2026-07-19T10:00:00.000Z'),
      redoCount: 2,
      createdAt: new Date('2026-07-18T09:00:00.000Z'),
    });

    const result = await getDraftOutcomeCounts(db, {
      personaId: 'sarah',
      ignoredOlderThan: IGNORED_OLDER_THAN,
    });

    expect(result).toEqual({
      ok: true,
      counts: { committed: 1, redone: 0, ignored: 0 },
    });
  });

  it('counts a still-open, redone draft as redone regardless of age', async () => {
    await insertDraft({
      id: '2fa85f64-5717-4562-b3fc-2c963f66afa2',
      messageTs: '1700000000.000200',
      resolvedAt: null,
      redoCount: 1,
      createdAt: new Date(), // freshly redone, well inside the ignored threshold
    });

    const result = await getDraftOutcomeCounts(db, {
      personaId: 'sarah',
      ignoredOlderThan: IGNORED_OLDER_THAN,
    });

    expect(result).toEqual({
      ok: true,
      counts: { committed: 0, redone: 1, ignored: 0 },
    });
  });

  it('counts a still-open, never-redone draft older than the threshold as ignored', async () => {
    await insertDraft({
      id: '3fa85f64-5717-4562-b3fc-2c963f66afa3',
      messageTs: '1700000000.000300',
      resolvedAt: null,
      redoCount: 0,
      createdAt: new Date('2026-07-01T09:00:00.000Z'),
    });

    const result = await getDraftOutcomeCounts(db, {
      personaId: 'sarah',
      ignoredOlderThan: IGNORED_OLDER_THAN,
    });

    expect(result).toEqual({
      ok: true,
      counts: { committed: 0, redone: 0, ignored: 1 },
    });
  });

  it('does not count a still-open, never-redone draft younger than the threshold at all', async () => {
    await insertDraft({
      id: '4fa85f64-5717-4562-b3fc-2c963f66afa4',
      messageTs: '1700000000.000400',
      resolvedAt: null,
      redoCount: 0,
      createdAt: new Date('2026-07-19T12:00:00.000Z'), // after IGNORED_OLDER_THAN
    });

    const result = await getDraftOutcomeCounts(db, {
      personaId: 'sarah',
      ignoredOlderThan: IGNORED_OLDER_THAN,
    });

    expect(result).toEqual({
      ok: true,
      counts: { committed: 0, redone: 0, ignored: 0 },
    });
  });

  it('scopes counts to the given persona only', async () => {
    await insertDraft({
      id: '5fa85f64-5717-4562-b3fc-2c963f66afa5',
      messageTs: '1700000000.000500',
      resolvedAt: new Date('2026-07-19T10:00:00.000Z'),
      redoCount: 0,
      createdAt: new Date('2026-07-18T09:00:00.000Z'),
    });
    await pool.query(
      `INSERT INTO pending_ticket_drafts
         (id, persona_id, channel_id, message_ts, source_message_text, draft_title, draft_body, resolved_at, created_at, redo_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        '6fa85f64-5717-4562-b3fc-2c963f66afa6',
        'marcus',
        'C123',
        '1700000000.000600',
        'a message for marcus',
        'Title',
        'Body',
        new Date('2026-07-19T10:00:00.000Z'),
        new Date('2026-07-18T09:00:00.000Z'),
        0,
      ],
    );

    const result = await getDraftOutcomeCounts(db, {
      personaId: 'sarah',
      ignoredOlderThan: IGNORED_OLDER_THAN,
    });

    expect(result).toEqual({
      ok: true,
      counts: { committed: 1, redone: 0, ignored: 0 },
    });
  });

  it('excludes a mid-band-confirmed draft from every bucket (DA review, chunk 3.6)', async () => {
    // A resolved Mid-band-confirmed draft would land in `committed` if the origin filter were
    // ever dropped — this is the direct regression pin for the DA-review MATERIAL finding.
    await insertDraft({
      id: '9fa85f64-5717-4562-b3fc-2c963f66afa9',
      messageTs: '1700000000.000900',
      resolvedAt: new Date('2026-07-19T10:00:00.000Z'),
      redoCount: 0,
      createdAt: new Date('2026-07-18T09:00:00.000Z'),
      origin: 'mid-band-confirmed',
    });
    await insertDraft({
      id: 'afa85f64-5717-4562-b3fc-2c963f66afaa',
      messageTs: '1700000000.001000',
      resolvedAt: new Date('2026-07-19T10:00:00.000Z'),
      redoCount: 0,
      createdAt: new Date('2026-07-18T09:00:00.000Z'),
      origin: 'high-band',
    });

    const result = await getDraftOutcomeCounts(db, {
      personaId: 'sarah',
      ignoredOlderThan: IGNORED_OLDER_THAN,
    });

    expect(result).toEqual({
      ok: true,
      counts: { committed: 1, redone: 0, ignored: 0 },
    });
  });

  it('sums multiple drafts into the same bucket', async () => {
    await insertDraft({
      id: '7fa85f64-5717-4562-b3fc-2c963f66afa7',
      messageTs: '1700000000.000700',
      resolvedAt: new Date('2026-07-19T10:00:00.000Z'),
      redoCount: 0,
      createdAt: new Date('2026-07-18T09:00:00.000Z'),
    });
    await insertDraft({
      id: '8fa85f64-5717-4562-b3fc-2c963f66afa8',
      messageTs: '1700000000.000800',
      resolvedAt: new Date('2026-07-19T11:00:00.000Z'),
      redoCount: 0,
      createdAt: new Date('2026-07-18T09:00:00.000Z'),
    });

    const result = await getDraftOutcomeCounts(db, {
      personaId: 'sarah',
      ignoredOlderThan: IGNORED_OLDER_THAN,
    });

    expect(result).toEqual({
      ok: true,
      counts: { committed: 2, redone: 0, ignored: 0 },
    });
  });
});
