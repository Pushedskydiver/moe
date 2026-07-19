import type { Database } from '../schema.js';
import type { Kysely } from 'kysely';
import type { Pool } from 'pg';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb } from '../ticket-lifecycle/db.js';
import { runMigrations } from '../ticket-lifecycle/migrate.js';
import { getTestPool, resetDatabase } from '../ticket-lifecycle/test-db.js';
import { createReviewQueueEntry } from './review-queue-repository.js';

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'migrations',
);

function newEntryInput() {
  return {
    personaId: 'sarah',
    channelId: 'C123',
    messageTs: '1700000000.000100',
    sourceMessageText: 'anyone know a good coffee place nearby',
    confidence: 12,
    reasoning: 'reads as banter, not a work request',
    outcomeReason: 'low-confidence' as const,
  };
}

describe('review queue repository', () => {
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

  it('creates a review queue entry', async () => {
    const result = await createReviewQueueEntry(db, newEntryInput());

    expect(result).toEqual({
      ok: true,
      entry: expect.objectContaining(newEntryInput()) as unknown,
    });
  });

  it('rejects a blank source message text without writing a row to the database', async () => {
    const result = await createReviewQueueEntry(db, {
      ...newEntryInput(),
      sourceMessageText: '   ',
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'validation-failed', issues: expect.any(String) },
    });
    const all = await db.selectFrom('reviewQueue').selectAll().execute();
    expect(all).toHaveLength(0);
  });

  it('allows two entries for the same (channelId, messageTs) — unlike pending ticket drafts, a review-queue row is a plain log entry, not a workflow object', async () => {
    const first = await createReviewQueueEntry(db, newEntryInput());
    const second = await createReviewQueueEntry(db, newEntryInput());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    const all = await db.selectFrom('reviewQueue').selectAll().execute();
    expect(all).toHaveLength(2);
  });
});
