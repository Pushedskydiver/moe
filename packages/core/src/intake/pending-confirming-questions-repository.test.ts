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
  markPendingConfirmingQuestionPosted,
  resolvePendingConfirmingQuestion,
} from './pending-confirming-questions-repository.js';

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'migrations',
);

const POSTED_MESSAGE_TS = '1700000099.000100';

function newQuestionInput() {
  return {
    personaId: 'sarah',
    channelId: 'C123',
    sourceSurface: 'channel' as const,
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

  it('creates a pending confirming question, unresolved and with no messageTs yet — the claim precedes the Slack post (BUILD_PLAN 5.2b)', async () => {
    const result = await createPendingConfirmingQuestion(
      db,
      newQuestionInput(),
    );

    expect(result).toEqual({
      ok: true,
      question: expect.objectContaining({
        ...newQuestionInput(),
        messageTs: null,
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

  it('reads back a created question by (channelId, messageTs) once the post-succeeded mark has filled messageTs in', async () => {
    const created = await createPendingConfirmingQuestion(
      db,
      newQuestionInput(),
    );
    if (!created.ok) throw new Error('setup failed');
    const posted = await markPendingConfirmingQuestionPosted(
      db,
      created.question.id,
      POSTED_MESSAGE_TS,
    );
    if (!posted.ok) throw new Error('setup failed');

    const result = await getPendingConfirmingQuestionByMessage(db, {
      personaId: newQuestionInput().personaId,
      channelId: newQuestionInput().channelId,
      messageTs: POSTED_MESSAGE_TS,
    });

    expect(result).toEqual({ ok: true, question: posted.question });
  });

  it('returns a null question for a (channelId, messageTs) pair that does not exist', async () => {
    const result = await getPendingConfirmingQuestionByMessage(db, {
      personaId: 'sarah',
      channelId: 'C_UNKNOWN',
      messageTs: '0000000000.000000',
    });

    expect(result).toEqual({ ok: true, question: null });
  });

  it("does not return another persona's question — the \u{1F44D} path is the costlier half of the same defect (DA review, BUILD_PLAN 5.2a)", async () => {
    // Worse than the draft case: `seedAnswerLegend` seeds \u{1F44D} FIRST, so a sibling process reads the
    // posting persona's own legend reaction as a human "yes" and runs `draftFromConfirmingQuestion`
    // — a real billed Sonnet compose and a real draft posted into the channel. Every confirming
    // question would auto-answer itself within seconds of being asked.
    const created = await createPendingConfirmingQuestion(
      db,
      newQuestionInput(),
    );
    if (!created.ok) throw new Error('setup failed');
    await markPendingConfirmingQuestionPosted(
      db,
      created.question.id,
      POSTED_MESSAGE_TS,
    );

    const result = await getPendingConfirmingQuestionByMessage(db, {
      personaId: 'marcus',
      channelId: newQuestionInput().channelId,
      messageTs: POSTED_MESSAGE_TS,
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

  it('rejects a second confirming question for the same (channelId, sourceMessageTs) pair via the UNIQUE constraint (BUILD_PLAN 5.2b)', async () => {
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

  it('fills in messageTs on a claimed question once the Slack post succeeds (BUILD_PLAN 5.2b)', async () => {
    const created = await createPendingConfirmingQuestion(
      db,
      newQuestionInput(),
    );
    if (!created.ok) throw new Error('setup failed');

    const result = await markPendingConfirmingQuestionPosted(
      db,
      created.question.id,
      POSTED_MESSAGE_TS,
    );

    expect(result).toEqual({
      ok: true,
      question: expect.objectContaining({
        id: created.question.id,
        messageTs: POSTED_MESSAGE_TS,
      }) as unknown,
    });
  });

  it('fails to mark a question posted a second time (double-fire/retry guard, BUILD_PLAN 5.2b)', async () => {
    const created = await createPendingConfirmingQuestion(
      db,
      newQuestionInput(),
    );
    if (!created.ok) throw new Error('setup failed');
    await markPendingConfirmingQuestionPosted(
      db,
      created.question.id,
      POSTED_MESSAGE_TS,
    );

    const result = await markPendingConfirmingQuestionPosted(
      db,
      created.question.id,
      '1700000199.000200',
    );

    expect(result).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });

  it('fails to mark posted a question that does not exist (BUILD_PLAN 5.2b)', async () => {
    const result = await markPendingConfirmingQuestionPosted(
      db,
      '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      POSTED_MESSAGE_TS,
    );

    expect(result).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });

  describe('findStaleUnresolvedConfirmingQuestions (BUILD_PLAN 3.5)', () => {
    it('returns only unresolved questions created before the given cutoff', async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-07-19T09:00:00.000Z'));
        const stale = await createPendingConfirmingQuestion(db, {
          ...newQuestionInput(),
          sourceMessageTs: '1700000000.000051',
        });
        if (!stale.ok) throw new Error('setup failed');

        vi.setSystemTime(new Date('2026-07-19T12:00:00.000Z'));
        await createPendingConfirmingQuestion(db, {
          ...newQuestionInput(),
          sourceMessageTs: '1700000000.000052',
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
        const created = await createPendingConfirmingQuestion(
          db,
          newQuestionInput(),
        );
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
