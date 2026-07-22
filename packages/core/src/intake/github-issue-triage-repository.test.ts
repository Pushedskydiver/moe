import type { Database } from '../schema.js';
import type { Kysely } from 'kysely';
import type { Pool } from 'pg';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb } from '../ticket-lifecycle/db.js';
import { runMigrations } from '../ticket-lifecycle/migrate.js';
import { getTestPool, resetDatabase } from '../ticket-lifecycle/test-db.js';
import { upsertGithubIssueTriageEntry } from './github-issue-triage-repository.js';

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'migrations',
);

describe('github issue triage repository', () => {
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

  it('inserts a new issue as a fresh row, first-seen and last-seen equal', async () => {
    const polledAt = new Date('2026-07-21T09:00:00.000Z');

    const result = await upsertGithubIssueTriageEntry(db, {
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
      issueNumber: 477,
      title: 'Update CLI package README',
      url: 'https://github.com/Pushedskydiver/chief-clancy/issues/477',
      state: 'open',
      githubUpdatedAt: new Date('2026-07-20T12:00:00.000Z'),
      polledAt,
    });

    expect(result).toEqual({
      ok: true,
      entry: {
        repoOwner: 'Pushedskydiver',
        repoName: 'chief-clancy',
        issueNumber: 477,
        title: 'Update CLI package README',
        url: 'https://github.com/Pushedskydiver/chief-clancy/issues/477',
        state: 'open',
        githubUpdatedAt: new Date('2026-07-20T12:00:00.000Z'),
        firstSeenAt: polledAt,
        lastSeenAt: polledAt,
      },
    });
  });

  it('re-polling the same issue updates the row in place, not a second row', async () => {
    const firstPoll = new Date('2026-07-21T09:00:00.000Z');
    await upsertGithubIssueTriageEntry(db, {
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
      issueNumber: 477,
      title: 'Update CLI package README',
      url: 'https://github.com/Pushedskydiver/chief-clancy/issues/477',
      state: 'open',
      githubUpdatedAt: new Date('2026-07-20T12:00:00.000Z'),
      polledAt: firstPoll,
    });

    const secondPoll = new Date('2026-07-22T09:00:00.000Z');
    const result = await upsertGithubIssueTriageEntry(db, {
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
      issueNumber: 477,
      title: 'Update CLI package README (edited)',
      url: 'https://github.com/Pushedskydiver/chief-clancy/issues/477',
      state: 'closed',
      githubUpdatedAt: new Date('2026-07-22T08:00:00.000Z'),
      polledAt: secondPoll,
    });

    expect(result).toEqual({
      ok: true,
      entry: {
        repoOwner: 'Pushedskydiver',
        repoName: 'chief-clancy',
        issueNumber: 477,
        title: 'Update CLI package README (edited)',
        url: 'https://github.com/Pushedskydiver/chief-clancy/issues/477',
        state: 'closed',
        githubUpdatedAt: new Date('2026-07-22T08:00:00.000Z'),
        firstSeenAt: firstPoll,
        lastSeenAt: secondPoll,
      },
    });

    const { rows } = await pool.query(
      'SELECT * FROM github_issue_triage WHERE repo_owner = $1 AND repo_name = $2 AND issue_number = $3',
      ['Pushedskydiver', 'chief-clancy', 477],
    );
    expect(rows).toHaveLength(1);
  });

  it('keeps a different issue number as a separate row', async () => {
    const polledAt = new Date('2026-07-21T09:00:00.000Z');
    await upsertGithubIssueTriageEntry(db, {
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
      issueNumber: 477,
      title: 'Issue 477',
      url: 'https://github.com/Pushedskydiver/chief-clancy/issues/477',
      state: 'open',
      githubUpdatedAt: polledAt,
      polledAt,
    });
    await upsertGithubIssueTriageEntry(db, {
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
      issueNumber: 486,
      title: 'Issue 486',
      url: 'https://github.com/Pushedskydiver/chief-clancy/issues/486',
      state: 'open',
      githubUpdatedAt: polledAt,
      polledAt,
    });

    const { rows } = await pool.query(
      'SELECT issue_number FROM github_issue_triage ORDER BY issue_number',
    );
    expect(rows).toEqual([{ issue_number: 477 }, { issue_number: 486 }]);
  });

  it('rejects a blank title without writing a row to the database', async () => {
    const result = await upsertGithubIssueTriageEntry(db, {
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
      issueNumber: 477,
      title: '   ',
      url: 'https://github.com/Pushedskydiver/chief-clancy/issues/477',
      state: 'open',
      githubUpdatedAt: new Date('2026-07-20T12:00:00.000Z'),
      polledAt: new Date('2026-07-21T09:00:00.000Z'),
    });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'validation-failed',
        issues: expect.any(String) as string,
      },
    });
    const { rows } = await pool.query('SELECT * FROM github_issue_triage');
    expect(rows).toHaveLength(0);
  });

  it('returns kind:unknown when the database rejects a value Zod let through', async () => {
    // 99999999999 passes `z.number().int().positive()` (no upper bound) but overflows Postgres'
    // `INTEGER` column — a real DB-level failure distinct from the schema-validation-failed path
    // above, same "force a genuine throw the app-level schema can't catch" precedent as
    // `pending-confirming-questions-repository.test.ts`'s own UNIQUE-constraint test (this table's
    // upsert-on-conflict shape makes a duplicate-key throw impossible to trigger the same way).
    const result = await upsertGithubIssueTriageEntry(db, {
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
      issueNumber: 99999999999,
      title: 'Update CLI package README',
      url: 'https://github.com/Pushedskydiver/chief-clancy/issues/477',
      state: 'open',
      githubUpdatedAt: new Date('2026-07-20T12:00:00.000Z'),
      polledAt: new Date('2026-07-21T09:00:00.000Z'),
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'unknown', cause: expect.anything() as unknown },
    });
  });
});
