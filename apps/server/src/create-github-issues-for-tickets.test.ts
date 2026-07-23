import type { CreateGithubIssuesForTicketsDeps } from './create-github-issues-for-tickets.js';

import { describe, expect, it, vi } from 'vitest';

import { createGithubIssuesForTickets } from './create-github-issues-for-tickets.js';

function makeDeps(
  overrides: Partial<CreateGithubIssuesForTicketsDeps> = {},
): CreateGithubIssuesForTicketsDeps {
  return {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    personaId: 'sarah',
    repo: { owner: 'Pushedskydiver', name: 'chief-clancy' },
    githubClient: { createIssue: vi.fn() },
    linkStore: {
      listUnlinkedTickets: vi.fn().mockResolvedValue({ ok: true, tickets: [] }),
      listStuckPending: vi.fn().mockResolvedValue({ ok: true, links: [] }),
      claim: vi.fn(),
      resolve: vi.fn(),
      release: vi.fn(),
    },
    ...overrides,
  };
}

describe('createGithubIssuesForTickets', () => {
  it('claims, creates, and resolves a link for each unlinked ticket', async () => {
    const claim = vi.fn().mockResolvedValue({
      ok: true,
      link: {
        ticketId: 't1',
        repoOwner: 'Pushedskydiver',
        repoName: 'chief-clancy',
        issueNumber: null,
        issueUrl: null,
        resolvedAt: null,
        createdAt: new Date(),
      },
    });
    const createIssue = vi.fn().mockResolvedValue({
      ok: true,
      issue: {
        issueNumber: 42,
        url: 'https://github.com/Pushedskydiver/chief-clancy/issues/42',
      },
    });
    const resolve = vi.fn().mockResolvedValue({ ok: true, link: {} });
    const deps = makeDeps({
      linkStore: {
        listUnlinkedTickets: vi.fn().mockResolvedValue({
          ok: true,
          tickets: [{ id: 't1', title: 'Fix the bug' }],
        }),
        listStuckPending: vi.fn().mockResolvedValue({ ok: true, links: [] }),
        claim,
        resolve,
        release: vi.fn(),
      },
      githubClient: { createIssue },
    });

    await createGithubIssuesForTickets(deps);

    expect(claim).toHaveBeenCalledWith({
      ticketId: 't1',
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
    });
    expect(createIssue).toHaveBeenCalledWith({
      title: 'Fix the bug',
      body: expect.stringContaining('t1') as string,
    });
    expect(resolve).toHaveBeenCalledWith('t1', {
      issueNumber: 42,
      issueUrl: 'https://github.com/Pushedskydiver/chief-clancy/issues/42',
    });
  });

  it('skips a ticket that is already claimed, without calling GitHub', async () => {
    const claim = vi
      .fn()
      .mockResolvedValue({ ok: false, error: { kind: 'already-claimed' } });
    const createIssue = vi.fn();
    const deps = makeDeps({
      linkStore: {
        listUnlinkedTickets: vi.fn().mockResolvedValue({
          ok: true,
          tickets: [{ id: 't1', title: 'Fix the bug' }],
        }),
        listStuckPending: vi.fn().mockResolvedValue({ ok: true, links: [] }),
        claim,
        resolve: vi.fn(),
        release: vi.fn(),
      },
      githubClient: { createIssue },
    });

    await createGithubIssuesForTickets(deps);

    expect(createIssue).not.toHaveBeenCalled();
  });

  it('releases the claim and logs when GitHub issue creation fails', async () => {
    const claim = vi.fn().mockResolvedValue({
      ok: true,
      link: {
        ticketId: 't1',
        repoOwner: 'Pushedskydiver',
        repoName: 'chief-clancy',
        issueNumber: null,
        issueUrl: null,
        resolvedAt: null,
        createdAt: new Date(),
      },
    });
    const createIssue = vi.fn().mockResolvedValue({
      ok: false,
      error: { kind: 'unknown', cause: new Error('403 Forbidden') },
    });
    const release = vi.fn().mockResolvedValue({ ok: true });
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const deps = makeDeps({
      logger,
      linkStore: {
        listUnlinkedTickets: vi.fn().mockResolvedValue({
          ok: true,
          tickets: [{ id: 't1', title: 'Fix the bug' }],
        }),
        listStuckPending: vi.fn().mockResolvedValue({ ok: true, links: [] }),
        claim,
        resolve: vi.fn(),
        release,
      },
      githubClient: { createIssue },
    });

    await createGithubIssuesForTickets(deps);

    expect(release).toHaveBeenCalledWith('t1');
    expect(logger.error).toHaveBeenCalledWith(
      'failed to create github issue for ticket',
      expect.objectContaining({ ticketId: 't1' }),
    );
  });

  it('does NOT release the claim when the issue was created but persisting the link fails', async () => {
    const claim = vi.fn().mockResolvedValue({
      ok: true,
      link: {
        ticketId: 't1',
        repoOwner: 'Pushedskydiver',
        repoName: 'chief-clancy',
        issueNumber: null,
        issueUrl: null,
        resolvedAt: null,
        createdAt: new Date(),
      },
    });
    const createIssue = vi.fn().mockResolvedValue({
      ok: true,
      issue: {
        issueNumber: 42,
        url: 'https://github.com/Pushedskydiver/chief-clancy/issues/42',
      },
    });
    const resolve = vi
      .fn()
      .mockResolvedValue({ ok: false, error: { kind: 'unavailable' } });
    const release = vi.fn();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const deps = makeDeps({
      logger,
      linkStore: {
        listUnlinkedTickets: vi.fn().mockResolvedValue({
          ok: true,
          tickets: [{ id: 't1', title: 'Fix the bug' }],
        }),
        listStuckPending: vi.fn().mockResolvedValue({ ok: true, links: [] }),
        claim,
        resolve,
        release,
      },
      githubClient: { createIssue },
    });

    await createGithubIssuesForTickets(deps);

    expect(release).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('no DB record'),
      expect.objectContaining({ ticketId: 't1', issueNumber: 42 }),
    );
  });

  it('logs an error when tickets are stuck with an unresolved claim, without touching them', async () => {
    const release = vi.fn();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const deps = makeDeps({
      logger,
      linkStore: {
        listUnlinkedTickets: vi
          .fn()
          .mockResolvedValue({ ok: true, tickets: [] }),
        listStuckPending: vi.fn().mockResolvedValue({
          ok: true,
          links: [{ ticketId: 'stuck-1' }],
        }),
        claim: vi.fn(),
        resolve: vi.fn(),
        release,
      },
    });

    await createGithubIssuesForTickets(deps);

    expect(release).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('manual reconciliation'),
      expect.objectContaining({ ticketIds: ['stuck-1'] }),
    );
  });

  it('processes multiple unlinked tickets sequentially', async () => {
    const claim = vi.fn().mockResolvedValue({
      ok: true,
      link: {
        ticketId: 't',
        repoOwner: 'Pushedskydiver',
        repoName: 'chief-clancy',
        issueNumber: null,
        issueUrl: null,
        resolvedAt: null,
        createdAt: new Date(),
      },
    });
    const createIssue = vi.fn().mockResolvedValue({
      ok: true,
      issue: {
        issueNumber: 1,
        url: 'https://github.com/Pushedskydiver/chief-clancy/issues/1',
      },
    });
    const resolve = vi.fn().mockResolvedValue({ ok: true, link: {} });
    const deps = makeDeps({
      linkStore: {
        listUnlinkedTickets: vi.fn().mockResolvedValue({
          ok: true,
          tickets: [
            { id: 't1', title: 'First' },
            { id: 't2', title: 'Second' },
          ],
        }),
        listStuckPending: vi.fn().mockResolvedValue({ ok: true, links: [] }),
        claim,
        resolve,
        release: vi.fn(),
      },
      githubClient: { createIssue },
    });

    await createGithubIssuesForTickets(deps);

    expect(claim).toHaveBeenCalledTimes(2);
    expect(createIssue).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenCalledTimes(2);
  });
});
