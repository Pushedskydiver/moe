import type { Database } from '../schema.js';
import type { Kysely } from 'kysely';
import type { Pool } from 'pg';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PROJECT_KEY } from '../project-key.js';
import { createDb } from '../ticket-lifecycle/db.js';
import { runMigrations } from '../ticket-lifecycle/migrate.js';
import { getTestPool, resetDatabase } from '../ticket-lifecycle/test-db.js';
import { createTicketFromTriageEntry } from './create-ticket-from-triage-entry.js';
import { upsertGithubIssueTriageEntry } from './github-issue-triage-repository.js';
import { linkTicketToExistingGithubIssue } from './ticket-github-issue-link-repository.js';

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'migrations',
);

async function seedTriageEntry(db: Kysely<Database>, issueNumber = 477) {
  const result = await upsertGithubIssueTriageEntry(db, {
    repoOwner: 'Pushedskydiver',
    repoName: 'chief-clancy',
    issueNumber,
    title: `Issue ${issueNumber} title`,
    url: `https://github.com/Pushedskydiver/chief-clancy/issues/${issueNumber}`,
    state: 'open',
    githubUpdatedAt: new Date('2026-07-20T12:00:00.000Z'),
    polledAt: new Date('2026-07-21T09:00:00.000Z'),
  });
  if (!result.ok) throw new Error('failed to seed triage entry');
  return result.entry;
}

describe('createTicketFromTriageEntry', () => {
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

  it('creates a Brief-status ticket and a resolved link in one transaction', async () => {
    const entry = await seedTriageEntry(db, 477);

    const result = await createTicketFromTriageEntry(db, entry, {
      severity: 'Medium',
      classOfService: 'Standard',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ticket.title).toBe(entry.title);
    expect(result.ticket.projectKey).toBe(PROJECT_KEY);
    expect(result.ticket.status).toBe('Brief');
    expect(result.ticket.severity).toBe('Medium');
    expect(result.ticket.classOfService).toBe('Standard');
    expect(result.link.ticketId).toBe(result.ticket.id);
    expect(result.link.issueNumber).toBe(477);
    expect(result.link.resolvedAt).not.toBeNull();

    const { rows: ticketRows } = await pool.query('SELECT * FROM tickets');
    expect(ticketRows).toHaveLength(1);
    const { rows: linkRows } = await pool.query(
      'SELECT * FROM ticket_github_issue_links',
    );
    expect(linkRows).toHaveLength(1);
  });

  it('rolls back the ticket when the link step fails, leaving nothing committed', async () => {
    const entry = await seedTriageEntry(db, 477);
    // Pre-link a different ticket to the same issue number, so the real conversion call's own
    // `linkTicketToExistingGithubIssue` step collides with the existing unique index
    // (`ticket_github_issue_links_issue_idx`) and fails.
    const created = await createDb(pool)
      .insertInto('tickets')
      .values({
        id: crypto.randomUUID(),
        projectKey: PROJECT_KEY,
        title: 'A pre-existing ticket',
        status: 'Brief',
        severity: 'Medium',
        classOfService: 'Standard',
        createdAt: new Date(),
        updatedAt: new Date(),
        claimedBy: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await linkTicketToExistingGithubIssue(db, {
      ticketId: created.id,
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
      issueNumber: 477,
      issueUrl: 'https://github.com/Pushedskydiver/chief-clancy/issues/477',
    });

    const result = await createTicketFromTriageEntry(db, entry, {
      severity: 'Medium',
      classOfService: 'Standard',
    });

    expect(result.ok).toBe(false);

    const { rows: ticketRows } = await pool.query('SELECT * FROM tickets');
    // Only the one pre-existing ticket seeded for this test — the conversion's own attempted
    // ticket never persisted.
    expect(ticketRows).toHaveLength(1);
    const { rows: linkRows } = await pool.query(
      'SELECT * FROM ticket_github_issue_links',
    );
    expect(linkRows).toHaveLength(1);
  });
});
