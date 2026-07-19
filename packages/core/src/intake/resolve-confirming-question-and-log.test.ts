import type { Database } from '../schema.js';
import type { Kysely } from 'kysely';
import type { Pool } from 'pg';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb } from '../ticket-lifecycle/db.js';
import { runMigrations } from '../ticket-lifecycle/migrate.js';
import { getTestPool, resetDatabase } from '../ticket-lifecycle/test-db.js';
import { createPendingConfirmingQuestion } from './pending-confirming-questions-repository.js';
import { resolveConfirmingQuestionAndLog } from './resolve-confirming-question-and-log.js';

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

describe('resolveConfirmingQuestionAndLog', () => {
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

  it('claims the question and logs a review-queue entry from the claimed row', async () => {
    const created = await createPendingConfirmingQuestion(
      db,
      newQuestionInput(),
    );
    if (!created.ok) throw new Error('setup failed');

    const result = await resolveConfirmingQuestionAndLog(db, {
      questionId: created.question.id,
      personaId: 'sarah',
      outcomeReason: 'mid-no',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.question.id).toBe(created.question.id);
    expect(result.question.resolvedAt).not.toBeNull();
    expect(result.entry.outcomeReason).toBe('mid-no');
    expect(result.entry.messageTs).toBe(newQuestionInput().sourceMessageTs);
    expect(result.entry.confidence).toBe(newQuestionInput().confidence);
    expect(result.entry.reasoning).toBe(newQuestionInput().reasoning);

    const { rows } = await pool.query('SELECT * FROM review_queue');
    expect(rows).toHaveLength(1);
  });

  it('returns a claim-step error and logs nothing when the question is already resolved', async () => {
    const created = await createPendingConfirmingQuestion(
      db,
      newQuestionInput(),
    );
    if (!created.ok) throw new Error('setup failed');
    const first = await resolveConfirmingQuestionAndLog(db, {
      questionId: created.question.id,
      personaId: 'sarah',
      outcomeReason: 'mid-no',
    });
    if (!first.ok) throw new Error('setup failed');

    const second = await resolveConfirmingQuestionAndLog(db, {
      questionId: created.question.id,
      personaId: 'sarah',
      outcomeReason: 'mid-silence',
    });

    expect(second).toEqual({
      ok: false,
      error: { step: 'claim', error: { kind: 'unavailable' } },
    });
    const { rows } = await pool.query('SELECT * FROM review_queue');
    expect(rows).toHaveLength(1);
  });

  it('rolls back the claim when the review-queue write fails, leaving the question available for retry', async () => {
    const created = await createPendingConfirmingQuestion(
      db,
      newQuestionInput(),
    );
    if (!created.ok) throw new Error('setup failed');

    const result = await resolveConfirmingQuestionAndLog(db, {
      questionId: created.question.id,
      // A blank `personaId` fails `reviewQueueEntrySchema`'s own non-blank validation inside
      // `createReviewQueueEntry`, forcing the rollback path without simulating a real connection
      // failure.
      personaId: '',
      outcomeReason: 'mid-no',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.step).toBe('log');

    const { rows: entryRows } = await pool.query('SELECT * FROM review_queue');
    expect(entryRows).toHaveLength(0);
    const { rows: questionRows } = await pool.query(
      'SELECT resolved_at FROM pending_confirming_questions WHERE id = $1',
      [created.question.id],
    );
    expect(questionRows[0]?.resolved_at).toBeNull();
  });
});
