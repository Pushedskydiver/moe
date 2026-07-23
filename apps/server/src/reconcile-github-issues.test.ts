import type { ReconcileGithubIssuesDeps } from './reconcile-github-issues.js';

import { describe, expect, it, vi } from 'vitest';

import { reconcileGithubIssues } from './reconcile-github-issues.js';

function makeLink(overrides: {
  readonly ticketId: string;
  readonly issueNumber: number;
}) {
  return {
    ticketId: overrides.ticketId,
    repoOwner: 'Pushedskydiver',
    repoName: 'chief-clancy',
    issueNumber: overrides.issueNumber,
    issueUrl: `https://github.com/Pushedskydiver/chief-clancy/issues/${overrides.issueNumber}`,
    resolvedAt: new Date(),
    createdAt: new Date(),
  };
}

function makeTicket(overrides: {
  readonly id: string;
  readonly status: string;
}) {
  return {
    id: overrides.id,
    projectKey: 'chief-clancy',
    title: 'The login page returns a 500 on submit',
    status: overrides.status,
    severity: 'Medium',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeDeps(
  overrides: Partial<ReconcileGithubIssuesDeps> = {},
): ReconcileGithubIssuesDeps {
  return {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    repo: { owner: 'Pushedskydiver', name: 'chief-clancy' },
    githubClient: { getIssueState: vi.fn() },
    linkStore: {
      listResolved: vi.fn().mockResolvedValue({ ok: true, links: [] }),
    },
    ticketStore: { getById: vi.fn(), update: vi.fn() },
    ...overrides,
  };
}

describe('reconcileGithubIssues', () => {
  it('cancels a ticket whose linked issue is closed', async () => {
    const ticket = makeTicket({ id: 't1', status: 'Brief' });
    const getIssueState = vi.fn().mockResolvedValue({
      ok: true,
      issue: { issueNumber: 489, state: 'closed' },
    });
    const update = vi.fn().mockResolvedValue({ ok: true, ticket });
    const deps = makeDeps({
      linkStore: {
        listResolved: vi.fn().mockResolvedValue({
          ok: true,
          links: [makeLink({ ticketId: 't1', issueNumber: 489 })],
        }),
      },
      githubClient: { getIssueState },
      ticketStore: {
        getById: vi.fn().mockResolvedValue({ ok: true, ticket }),
        update,
      },
    });

    await reconcileGithubIssues(deps);

    expect(getIssueState).toHaveBeenCalledWith(489);
    expect(update).toHaveBeenCalledWith('t1', { status: 'Cancelled' });
  });

  it('cancels a mid-Build ticket too, but logs it as a warning', async () => {
    const ticket = makeTicket({ id: 't1', status: 'Build' });
    const warn = vi.fn();
    const update = vi.fn().mockResolvedValue({ ok: true, ticket });
    const deps = makeDeps({
      logger: { info: vi.fn(), warn, error: vi.fn() },
      linkStore: {
        listResolved: vi.fn().mockResolvedValue({
          ok: true,
          links: [makeLink({ ticketId: 't1', issueNumber: 489 })],
        }),
      },
      githubClient: {
        getIssueState: vi.fn().mockResolvedValue({
          ok: true,
          issue: { issueNumber: 489, state: 'closed' },
        }),
      },
      ticketStore: {
        getById: vi.fn().mockResolvedValue({ ok: true, ticket }),
        update,
      },
    });

    await reconcileGithubIssues(deps);

    expect(update).toHaveBeenCalledWith('t1', { status: 'Cancelled' });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('real work potentially in progress') as string,
      expect.objectContaining({ ticketId: 't1', previousStatus: 'Build' }),
    );
  });

  it('cancels a Review ticket too, logged as a warning', async () => {
    const ticket = makeTicket({ id: 't1', status: 'Review' });
    const warn = vi.fn();
    const update = vi.fn().mockResolvedValue({ ok: true, ticket });
    const deps = makeDeps({
      logger: { info: vi.fn(), warn, error: vi.fn() },
      linkStore: {
        listResolved: vi.fn().mockResolvedValue({
          ok: true,
          links: [makeLink({ ticketId: 't1', issueNumber: 489 })],
        }),
      },
      githubClient: {
        getIssueState: vi.fn().mockResolvedValue({
          ok: true,
          issue: { issueNumber: 489, state: 'closed' },
        }),
      },
      ticketStore: {
        getById: vi.fn().mockResolvedValue({ ok: true, ticket }),
        update,
      },
    });

    await reconcileGithubIssues(deps);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('real work potentially in progress') as string,
      expect.objectContaining({ ticketId: 't1', previousStatus: 'Review' }),
    );
  });

  it('does nothing to an already-Cancelled ticket whose issue is still closed', async () => {
    const ticket = makeTicket({ id: 't1', status: 'Cancelled' });
    const update = vi.fn();
    const deps = makeDeps({
      linkStore: {
        listResolved: vi.fn().mockResolvedValue({
          ok: true,
          links: [makeLink({ ticketId: 't1', issueNumber: 489 })],
        }),
      },
      githubClient: {
        getIssueState: vi.fn().mockResolvedValue({
          ok: true,
          issue: { issueNumber: 489, state: 'closed' },
        }),
      },
      ticketStore: {
        getById: vi.fn().mockResolvedValue({ ok: true, ticket }),
        update,
      },
    });

    await reconcileGithubIssues(deps);

    expect(update).not.toHaveBeenCalled();
  });

  it("logs a notice, but does not un-cancel, when a cancelled ticket's issue is reopened", async () => {
    const ticket = makeTicket({ id: 't1', status: 'Cancelled' });
    const warn = vi.fn();
    const update = vi.fn();
    const deps = makeDeps({
      logger: { info: vi.fn(), warn, error: vi.fn() },
      linkStore: {
        listResolved: vi.fn().mockResolvedValue({
          ok: true,
          links: [makeLink({ ticketId: 't1', issueNumber: 489 })],
        }),
      },
      githubClient: {
        getIssueState: vi.fn().mockResolvedValue({
          ok: true,
          issue: { issueNumber: 489, state: 'open' },
        }),
      },
      ticketStore: {
        getById: vi.fn().mockResolvedValue({ ok: true, ticket }),
        update,
      },
    });

    await reconcileGithubIssues(deps);

    expect(update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      'linked github issue reopened after ticket was cancelled',
      expect.objectContaining({ ticketId: 't1', issueNumber: 489 }),
    );
  });

  it('does nothing when the issue is open and the ticket was never cancelled', async () => {
    const ticket = makeTicket({ id: 't1', status: 'Brief' });
    const update = vi.fn();
    const warn = vi.fn();
    const deps = makeDeps({
      logger: { info: vi.fn(), warn, error: vi.fn() },
      linkStore: {
        listResolved: vi.fn().mockResolvedValue({
          ok: true,
          links: [makeLink({ ticketId: 't1', issueNumber: 489 })],
        }),
      },
      githubClient: {
        getIssueState: vi.fn().mockResolvedValue({
          ok: true,
          issue: { issueNumber: 489, state: 'open' },
        }),
      },
      ticketStore: {
        getById: vi.fn().mockResolvedValue({ ok: true, ticket }),
        update,
      },
    });

    await reconcileGithubIssues(deps);

    expect(update).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('skips a Done ticket entirely, without ever calling GitHub', async () => {
    const ticket = makeTicket({ id: 't1', status: 'Done' });
    const getIssueState = vi.fn();
    const deps = makeDeps({
      linkStore: {
        listResolved: vi.fn().mockResolvedValue({
          ok: true,
          links: [makeLink({ ticketId: 't1', issueNumber: 489 })],
        }),
      },
      githubClient: { getIssueState },
      ticketStore: {
        getById: vi.fn().mockResolvedValue({ ok: true, ticket }),
        update: vi.fn(),
      },
    });

    await reconcileGithubIssues(deps);

    expect(getIssueState).not.toHaveBeenCalled();
  });

  it('logs an error and moves on when the github state fetch fails', async () => {
    const ticket = makeTicket({ id: 't1', status: 'Brief' });
    const error = vi.fn();
    const update = vi.fn();
    const deps = makeDeps({
      logger: { info: vi.fn(), warn: vi.fn(), error },
      linkStore: {
        listResolved: vi.fn().mockResolvedValue({
          ok: true,
          links: [makeLink({ ticketId: 't1', issueNumber: 489 })],
        }),
      },
      githubClient: {
        getIssueState: vi.fn().mockResolvedValue({
          ok: false,
          error: { kind: 'unknown', cause: new Error('boom') },
        }),
      },
      ticketStore: {
        getById: vi.fn().mockResolvedValue({ ok: true, ticket }),
        update,
      },
    });

    await reconcileGithubIssues(deps);

    expect(update).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      'failed to fetch github issue state during reconciliation',
      expect.objectContaining({ ticketId: 't1', issueNumber: 489 }),
    );
  });

  it('logs an error and moves on when the ticket lookup fails', async () => {
    const error = vi.fn();
    const getIssueState = vi.fn();
    const deps = makeDeps({
      logger: { info: vi.fn(), warn: vi.fn(), error },
      linkStore: {
        listResolved: vi.fn().mockResolvedValue({
          ok: true,
          links: [makeLink({ ticketId: 't1', issueNumber: 489 })],
        }),
      },
      githubClient: { getIssueState },
      ticketStore: {
        getById: vi.fn().mockResolvedValue({
          ok: false,
          error: { kind: 'unknown', cause: new Error('db down') },
        }),
        update: vi.fn(),
      },
    });

    await reconcileGithubIssues(deps);

    expect(getIssueState).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      'failed to look up ticket during github issue reconciliation',
      expect.objectContaining({ ticketId: 't1' }),
    );
  });

  it('processes every link even if one fails, and logs the final count', async () => {
    const info = vi.fn();
    const ticketA = makeTicket({ id: 't1', status: 'Brief' });
    const ticketB = makeTicket({ id: 't2', status: 'Backlog' });
    const getIssueState = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { kind: 'unknown', cause: new Error('boom') },
      })
      .mockResolvedValueOnce({
        ok: true,
        issue: { issueNumber: 2, state: 'closed' },
      });
    const update = vi.fn().mockResolvedValue({ ok: true, ticket: ticketB });
    const getById = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, ticket: ticketA })
      .mockResolvedValueOnce({ ok: true, ticket: ticketB });
    const deps = makeDeps({
      logger: { info, warn: vi.fn(), error: vi.fn() },
      linkStore: {
        listResolved: vi.fn().mockResolvedValue({
          ok: true,
          links: [
            makeLink({ ticketId: 't1', issueNumber: 1 }),
            makeLink({ ticketId: 't2', issueNumber: 2 }),
          ],
        }),
      },
      githubClient: { getIssueState },
      ticketStore: { getById, update },
    });

    await reconcileGithubIssues(deps);

    expect(update).toHaveBeenCalledWith('t2', { status: 'Cancelled' });
    expect(info).toHaveBeenCalledWith('github issue reconciliation complete', {
      linkCount: 2,
    });
  });
});
