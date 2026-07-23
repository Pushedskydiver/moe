import type { Database } from '../schema.js';
import type { Kysely } from 'kysely';
import type { Pool } from 'pg';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb } from '../ticket-lifecycle/db.js';
import { runMigrations } from '../ticket-lifecycle/migrate.js';
import { getTestPool, resetDatabase } from '../ticket-lifecycle/test-db.js';
import { createTicket } from '../ticket-lifecycle/tickets-repository.js';
import {
  claimTicketForIssueCreation,
  getTicketGithubIssueLink,
  listResolvedTicketGithubIssueLinks,
  listStuckPendingTicketGithubIssueLinks,
  listTicketsWithoutGithubIssueLink,
  releaseTicketGithubIssueClaim,
  resolveTicketGithubIssueLink,
} from './ticket-github-issue-link-repository.js';

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'migrations',
);

async function seedTicket(db: Kysely<Database>) {
  const created = await createTicket(db, {
    projectKey: 'chief-clancy',
    title: 'The login page returns a 500 on submit',
    status: 'Brief',
    severity: 'Medium',
    classOfService: 'Standard',
  });
  if (!created.ok) throw new Error('failed to seed ticket');
  return created.ticket;
}

describe('ticket github issue link repository', () => {
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

  it('claims a ticket as pending, with no issue number yet', async () => {
    const ticket = await seedTicket(db);

    const result = await claimTicketForIssueCreation(db, {
      ticketId: ticket.id,
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
    });

    expect(result).toEqual({
      ok: true,
      link: {
        ticketId: ticket.id,
        repoOwner: 'Pushedskydiver',
        repoName: 'chief-clancy',
        issueNumber: null,
        issueUrl: null,
        resolvedAt: null,
        createdAt: expect.any(Date) as Date,
      },
    });
  });

  it('a second claim for the same ticket fails — already claimed', async () => {
    const ticket = await seedTicket(db);
    await claimTicketForIssueCreation(db, {
      ticketId: ticket.id,
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
    });

    const result = await claimTicketForIssueCreation(db, {
      ticketId: ticket.id,
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'already-claimed' },
    });
  });

  it('resolves a pending claim with the real issue number/url', async () => {
    const ticket = await seedTicket(db);
    await claimTicketForIssueCreation(db, {
      ticketId: ticket.id,
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
    });

    const result = await resolveTicketGithubIssueLink(db, ticket.id, {
      issueNumber: 42,
      issueUrl: 'https://github.com/Pushedskydiver/chief-clancy/issues/42',
    });

    expect(result).toEqual({
      ok: true,
      link: {
        ticketId: ticket.id,
        repoOwner: 'Pushedskydiver',
        repoName: 'chief-clancy',
        issueNumber: 42,
        issueUrl: 'https://github.com/Pushedskydiver/chief-clancy/issues/42',
        resolvedAt: expect.any(Date) as Date,
        createdAt: expect.any(Date) as Date,
      },
    });
  });

  it('resolving a ticket with no pending claim fails', async () => {
    const ticket = await seedTicket(db);

    const result = await resolveTicketGithubIssueLink(db, ticket.id, {
      issueNumber: 42,
      issueUrl: 'https://github.com/Pushedskydiver/chief-clancy/issues/42',
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'unavailable' },
    });
  });

  it('resolving an already-resolved claim a second time fails', async () => {
    const ticket = await seedTicket(db);
    await claimTicketForIssueCreation(db, {
      ticketId: ticket.id,
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
    });
    await resolveTicketGithubIssueLink(db, ticket.id, {
      issueNumber: 42,
      issueUrl: 'https://github.com/Pushedskydiver/chief-clancy/issues/42',
    });

    const result = await resolveTicketGithubIssueLink(db, ticket.id, {
      issueNumber: 43,
      issueUrl: 'https://github.com/Pushedskydiver/chief-clancy/issues/43',
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'unavailable' },
    });
  });

  it('releases a still-pending claim, allowing a future re-claim', async () => {
    const ticket = await seedTicket(db);
    await claimTicketForIssueCreation(db, {
      ticketId: ticket.id,
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
    });

    const released = await releaseTicketGithubIssueClaim(db, ticket.id);
    expect(released).toEqual({ ok: true });

    const reclaimed = await claimTicketForIssueCreation(db, {
      ticketId: ticket.id,
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
    });
    expect(reclaimed.ok).toBe(true);
  });

  it('releasing an already-resolved claim does not remove it', async () => {
    const ticket = await seedTicket(db);
    await claimTicketForIssueCreation(db, {
      ticketId: ticket.id,
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
    });
    await resolveTicketGithubIssueLink(db, ticket.id, {
      issueNumber: 42,
      issueUrl: 'https://github.com/Pushedskydiver/chief-clancy/issues/42',
    });

    await releaseTicketGithubIssueClaim(db, ticket.id);

    const found = await getTicketGithubIssueLink(db, ticket.id);
    expect(found.ok && found.link?.issueNumber).toBe(42);
  });

  it('getTicketGithubIssueLink returns null when no row exists', async () => {
    const ticket = await seedTicket(db);

    const result = await getTicketGithubIssueLink(db, ticket.id);

    expect(result).toEqual({ ok: true, link: null });
  });

  it('listTicketsWithoutGithubIssueLink lists a ticket with no claim/link row at all', async () => {
    const linked = await seedTicket(db);
    const unlinked = await seedTicket(db);
    await claimTicketForIssueCreation(db, {
      ticketId: linked.id,
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
    });
    await resolveTicketGithubIssueLink(db, linked.id, {
      issueNumber: 42,
      issueUrl: 'https://github.com/Pushedskydiver/chief-clancy/issues/42',
    });

    const result = await listTicketsWithoutGithubIssueLink(db);

    expect(result.ok).toBe(true);
    expect(result.ok && result.tickets.map((t) => t.id)).toEqual([unlinked.id]);
  });

  it('listTicketsWithoutGithubIssueLink excludes a ticket with a still-pending claim', async () => {
    const ticket = await seedTicket(db);
    await claimTicketForIssueCreation(db, {
      ticketId: ticket.id,
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
    });

    const result = await listTicketsWithoutGithubIssueLink(db);

    expect(result).toEqual({ ok: true, tickets: [] });
  });

  it('listStuckPendingTicketGithubIssueLinks finds a claimed-but-never-resolved row', async () => {
    const ticket = await seedTicket(db);
    await claimTicketForIssueCreation(db, {
      ticketId: ticket.id,
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
    });

    const result = await listStuckPendingTicketGithubIssueLinks(db);

    expect(result.ok).toBe(true);
    expect(result.ok && result.links.map((l) => l.ticketId)).toEqual([
      ticket.id,
    ]);
  });

  it('listStuckPendingTicketGithubIssueLinks excludes a resolved link', async () => {
    const ticket = await seedTicket(db);
    await claimTicketForIssueCreation(db, {
      ticketId: ticket.id,
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
    });
    await resolveTicketGithubIssueLink(db, ticket.id, {
      issueNumber: 42,
      issueUrl: 'https://github.com/Pushedskydiver/chief-clancy/issues/42',
    });

    const result = await listStuckPendingTicketGithubIssueLinks(db);

    expect(result).toEqual({ ok: true, links: [] });
  });

  it('listResolvedTicketGithubIssueLinks finds a resolved link', async () => {
    const ticket = await seedTicket(db);
    await claimTicketForIssueCreation(db, {
      ticketId: ticket.id,
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
    });
    await resolveTicketGithubIssueLink(db, ticket.id, {
      issueNumber: 489,
      issueUrl: 'https://github.com/Pushedskydiver/chief-clancy/issues/489',
    });

    const result = await listResolvedTicketGithubIssueLinks(db);

    expect(result.ok).toBe(true);
    expect(result.ok && result.links.map((l) => l.ticketId)).toEqual([
      ticket.id,
    ]);
  });

  it('listResolvedTicketGithubIssueLinks excludes a still-pending claim', async () => {
    const ticket = await seedTicket(db);
    await claimTicketForIssueCreation(db, {
      ticketId: ticket.id,
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
    });

    const result = await listResolvedTicketGithubIssueLinks(db);

    expect(result).toEqual({ ok: true, links: [] });
  });

  it('rejects two tickets resolving to the same (repoOwner, repoName, issueNumber) — the partial unique index', async () => {
    const first = await seedTicket(db);
    const second = await seedTicket(db);
    await claimTicketForIssueCreation(db, {
      ticketId: first.id,
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
    });
    await claimTicketForIssueCreation(db, {
      ticketId: second.id,
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
    });
    await resolveTicketGithubIssueLink(db, first.id, {
      issueNumber: 42,
      issueUrl: 'https://github.com/Pushedskydiver/chief-clancy/issues/42',
    });

    const result = await resolveTicketGithubIssueLink(db, second.id, {
      issueNumber: 42,
      issueUrl: 'https://github.com/Pushedskydiver/chief-clancy/issues/42',
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'unknown', cause: expect.anything() as unknown },
    });
  });

  it('allows two different tickets to both stay pending (NULL issueNumber) at once — the partial index only scopes resolved rows', async () => {
    const first = await seedTicket(db);
    const second = await seedTicket(db);

    const firstClaim = await claimTicketForIssueCreation(db, {
      ticketId: first.id,
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
    });
    const secondClaim = await claimTicketForIssueCreation(db, {
      ticketId: second.id,
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
    });

    expect(firstClaim.ok).toBe(true);
    expect(secondClaim.ok).toBe(true);
  });
});
