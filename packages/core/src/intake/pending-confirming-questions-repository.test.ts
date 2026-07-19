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
  createPendingConfirmingQuestion,
  findStaleUnresolvedConfirmingQuestions,
  getPendingConfirmingQuestionByMessage,
  resolvePendingConfirmingQuestion,
} from './pending-confirming-questions-repository.js';

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'migrations',
);

function newQuestionInput() {
  return {
    personaId: 'sarah',
    channelId: 'C123',
    messageTs: '1700000099.000100',
    sourceMessageTs: '1700000000.000050',
    sourceMessageText:
      'hey, there might be an issue with the CLI on large repos',
    confidence: 55,
    reasoning: 'plausibly describes a bug, but not clearly actionable',
  };
}

describe('pending confirming questions repository', () => {
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

  it('creates a pending confirming question, unresolved by default', async () => {
    const result = await createPendingConfirmingQuestion(
      db,
      newQuestionInput(),
    );

    expect(result).toEqual({
      ok: true,
      question: expect.objectContaining({
        ...newQuestionInput(),
        resolvedAt: null,
      }) as unknown,
    });
  });

  it('rejects a blank source message text without writing a row to the database', async () => {
    const result = await createPendingConfirmingQuestion(db, {
      ...newQuestionInput(),
      sourceMessageText: '   ',
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'validation-failed', issues: expect.any(String) },
    });
    const all = await db
      .selectFrom('pendingConfirmingQuestions')
      .selectAll()
      .execute();
    expect(all).toHaveLength(0);
  });

  it('reads back a created question by (channelId, messageTs)', async () => {
    const created = await createPendingConfirmingQuestion(
      db,
      newQuestionInput(),
    );
    if (!created.ok) throw new Error('setup failed');

    const result = await getPendingConfirmingQuestionByMessage(db, {
      channelId: newQuestionInput().channelId,
      messageTs: newQuestionInput().messageTs,
    });

    expect(result).toEqual({ ok: true, question: created.question });
  });

  it('returns a null question for a (channelId, messageTs) pair that does not exist', async () => {
    const result = await getPendingConfirmingQuestionByMessage(db, {
      channelId: 'C_UNKNOWN',
      messageTs: '0000000000.000000',
    });

    expect(result).toEqual({ ok: true, question: null });
  });

  it('atomically resolves an unresolved question', async () => {
    const created = await createPendingConfirmingQuestion(
      db,
      newQuestionInput(),
    );
    if (!created.ok) throw new Error('setup failed');

    const result = await resolvePendingConfirmingQuestion(
      db,
      created.question.id,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question.resolvedAt).not.toBeNull();
    }
  });

  it('fails to resolve a question that is already resolved (double-processing guard)', async () => {
    const created = await createPendingConfirmingQuestion(
      db,
      newQuestionInput(),
    );
    if (!created.ok) throw new Error('setup failed');
    await resolvePendingConfirmingQuestion(db, created.question.id);

    const result = await resolvePendingConfirmingQuestion(
      db,
      created.question.id,
    );

    expect(result).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });

  it('fails to resolve a question that does not exist', async () => {
    const result = await resolvePendingConfirmingQuestion(
      db,
      '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    );

    expect(result).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });

  it('rejects a second confirming question for the same (channelId, messageTs) pair via the UNIQUE constraint', async () => {
    const first = await createPendingConfirmingQuestion(db, newQuestionInput());
    expect(first.ok).toBe(true);

    const second = await createPendingConfirmingQuestion(
      db,
      newQuestionInput(),
    );

    expect(second).toEqual({
      ok: false,
      error: { kind: 'unknown', cause: expect.anything() as unknown },
    });
  });

  describe('findStaleUnresolvedConfirmingQuestions (BUILD_PLAN 3.5)', () => {
    it('returns only unresolved questions created before the given cutoff', async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-07-19T09:00:00.000Z'));
        const stale = await createPendingConfirmingQuestion(db, {
          ...newQuestionInput(),
          messageTs: '1700000099.000101',
        });
        if (!stale.ok) throw new Error('setup failed');

        vi.setSystemTime(new Date('2026-07-19T12:00:00.000Z'));
        await createPendingConfirmingQuestion(db, {
          ...newQuestionInput(),
          messageTs: '1700000099.000102',
        });

        const cutoff = new Date('2026-07-19T10:00:00.000Z');
        const result = await findStaleUnresolvedConfirmingQuestions(db, {
          personaId: 'sarah',
          olderThan: cutoff,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.questions.map((q) => q.id)).toEqual([stale.question.id]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('excludes an already-resolved question even if it is old enough', async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-07-19T09:00:00.000Z'));
        const created = await createPendingConfirmingQuestion(db, {
          ...newQuestionInput(),
          messageTs: '1700000099.000103',
        });
        if (!created.ok) throw new Error('setup failed');
        await resolvePendingConfirmingQuestion(db, created.question.id);

        const result = await findStaleUnresolvedConfirmingQuestions(db, {
          personaId: 'sarah',
          olderThan: new Date('2026-07-19T10:00:00.000Z'),
        });

        expect(result).toEqual({ ok: true, questions: [] });
      } finally {
        vi.useRealTimers();
      }
    });

    it('scopes to the given persona only', async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-07-19T09:00:00.000Z'));
        await createPendingConfirmingQuestion(db, {
          ...newQuestionInput(),
          messageTs: '1700000099.000104',
          personaId: 'marcus',
        });

        const result = await findStaleUnresolvedConfirmingQuestions(db, {
          personaId: 'sarah',
          olderThan: new Date('2026-07-19T10:00:00.000Z'),
        });

        expect(result).toEqual({ ok: true, questions: [] });
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
