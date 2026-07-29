import type { Database } from '../schema.js';
import type { Kysely } from 'kysely';
import type { Pool } from 'pg';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDb } from '../ticket-lifecycle/db.js';
import { runMigrations } from '../ticket-lifecycle/migrate.js';
import { getTestPool, resetDatabase } from '../ticket-lifecycle/test-db.js';
import {
  createReviewQueueEntry,
  listReviewQueueEntriesSince,
} from './review-queue-repository.js';

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

  // BUILD_PLAN 3.9 — the two off-hours values, exercised against the real CHECK constraint rather
  // than only the Zod enum. The Kysely column type is a bare `string` (`../schema.ts`), so a value
  // the migration forgot would pass typecheck and fail only at INSERT time; asserting through
  // `createReviewQueueEntry` is what proves the constraint and the enum actually agree.
  it.each(['high-band-off-hours', 'mid-band-off-hours'] as const)(
    'creates a review queue entry with outcomeReason %s',
    async (outcomeReason) => {
      const result = await createReviewQueueEntry(db, {
        ...newEntryInput(),
        confidence: 85,
        reasoning: 'a concrete bug report naming a reproducible failure',
        outcomeReason,
      });

      expect(result.ok).toBe(true);
      const all = await db.selectFrom('reviewQueue').selectAll().execute();
      expect(all).toHaveLength(1);
      expect(all[0]?.outcomeReason).toBe(outcomeReason);
    },
  );

  // BUILD_PLAN 3.11 — the same real-CHECK-constraint proof as the off-hours values above, plus
  // the null confidence this outcomeReason alone is allowed to carry.
  it('creates a classification-failed review queue entry with a null confidence', async () => {
    const result = await createReviewQueueEntry(db, {
      ...newEntryInput(),
      confidence: null,
      reasoning: 'rate limited',
      outcomeReason: 'classification-failed',
    });

    expect(result.ok).toBe(true);
    const all = await db.selectFrom('reviewQueue').selectAll().execute();
    expect(all).toHaveLength(1);
    expect(all[0]?.outcomeReason).toBe('classification-failed');
    expect(all[0]?.confidence).toBeNull();
  });

  // The cross-field invariant `reviewQueueEntrySchema`'s own `.refine` enforces — a plain
  // `.nullable()` on `confidence` alone would let either of these slip through as a type-level-only
  // guarantee (the exact gap BUILD_PLAN 5.2b's own DA review found for `sourceMessageTs`).
  it('rejects a null confidence on any outcomeReason other than classification-failed, without writing a row', async () => {
    const result = await createReviewQueueEntry(db, {
      ...newEntryInput(),
      confidence: null,
      outcomeReason: 'low-confidence',
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'validation-failed', issues: expect.any(String) },
    });
    const all = await db.selectFrom('reviewQueue').selectAll().execute();
    expect(all).toHaveLength(0);
  });

  it('rejects a non-null confidence on classification-failed, without writing a row', async () => {
    const result = await createReviewQueueEntry(db, {
      ...newEntryInput(),
      confidence: 12,
      outcomeReason: 'classification-failed',
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'validation-failed', issues: expect.any(String) },
    });
    const all = await db.selectFrom('reviewQueue').selectAll().execute();
    expect(all).toHaveLength(0);
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

  describe('listReviewQueueEntriesSince (BUILD_PLAN 3.5)', () => {
    it('returns only entries created strictly after the given timestamp, oldest first', async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-07-19T09:00:00.000Z'));
        await createReviewQueueEntry(db, newEntryInput());
        const cutoff = new Date('2026-07-19T10:00:00.000Z');

        vi.setSystemTime(new Date('2026-07-19T11:00:00.000Z'));
        await createReviewQueueEntry(db, {
          ...newEntryInput(),
          sourceMessageText: 'second, after the cutoff',
        });
        vi.setSystemTime(new Date('2026-07-19T12:00:00.000Z'));
        await createReviewQueueEntry(db, {
          ...newEntryInput(),
          sourceMessageText: 'third, also after the cutoff',
        });

        const result = await listReviewQueueEntriesSince(db, {
          personaId: 'sarah',
          since: cutoff,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.entries.map((e) => e.sourceMessageText)).toEqual([
          'second, after the cutoff',
          'third, also after the cutoff',
        ]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('scopes to the given persona only', async () => {
      const since = new Date('2000-01-01T00:00:00.000Z');
      await createReviewQueueEntry(db, newEntryInput());
      await createReviewQueueEntry(db, {
        ...newEntryInput(),
        personaId: 'marcus',
      });

      const result = await listReviewQueueEntriesSince(db, {
        personaId: 'sarah',
        since,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.personaId).toBe('sarah');
    });

    it('returns an empty list when nothing was created after the given timestamp', async () => {
      const result = await listReviewQueueEntriesSince(db, {
        personaId: 'sarah',
        since: new Date('2000-01-01T00:00:00.000Z'),
      });

      expect(result).toEqual({ ok: true, entries: [] });
    });
  });
});
