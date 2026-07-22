import type { DiscoverGithubIssuesDeps } from './discover-github-issues.js';
import type { OpenIssue } from '@moe/github';

import { describe, expect, it, vi } from 'vitest';

import { discoverGithubIssues } from './discover-github-issues.js';

type GithubClient = DiscoverGithubIssuesDeps['githubClient'];
type TriageStore = DiscoverGithubIssuesDeps['triageStore'];

function makeIssue(overrides: Partial<OpenIssue> = {}): OpenIssue {
  return {
    issueNumber: 477,
    title: 'Update CLI package README',
    url: 'https://github.com/Pushedskydiver/chief-clancy/issues/477',
    state: 'open',
    githubUpdatedAt: new Date('2026-07-20T12:00:00.000Z'),
    ...overrides,
  };
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeDeps(
  overrides: Partial<{
    readonly githubClient: GithubClient;
    readonly triageStore: TriageStore;
  }> = {},
): DiscoverGithubIssuesDeps {
  return {
    logger: makeLogger(),
    repo: { owner: 'Pushedskydiver', name: 'chief-clancy' },
    githubClient: {
      listOpenIssues: vi
        .fn<GithubClient['listOpenIssues']>()
        .mockResolvedValue({ ok: true, issues: [] }),
      ...overrides.githubClient,
    },
    triageStore: {
      upsert: vi.fn<TriageStore['upsert']>().mockResolvedValue({
        ok: true,
        entry: {
          repoOwner: 'Pushedskydiver',
          repoName: 'chief-clancy',
          issueNumber: 477,
          title: 'x',
          url: 'x',
          state: 'open',
          githubUpdatedAt: new Date(),
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        },
      }),
      ...overrides.triageStore,
    },
  };
}

describe('discoverGithubIssues', () => {
  it('logs and does nothing else when the repo has no open issues', async () => {
    const deps = makeDeps();

    await discoverGithubIssues(deps, new Date('2026-07-21T09:00:00.000Z'));

    expect(deps.triageStore.upsert).not.toHaveBeenCalled();
    expect(deps.logger.info).toHaveBeenCalledWith(
      'github issue discovery complete',
      { repoOwner: 'Pushedskydiver', repoName: 'chief-clancy', issueCount: 0 },
    );
  });

  it('upserts every listed issue, threading the poll timestamp and repo through', async () => {
    const polledAt = new Date('2026-07-21T09:00:00.000Z');
    const deps = makeDeps({
      githubClient: {
        listOpenIssues: vi
          .fn<GithubClient['listOpenIssues']>()
          .mockResolvedValue({
            ok: true,
            issues: [
              makeIssue({ issueNumber: 477 }),
              makeIssue({ issueNumber: 486 }),
            ],
          }),
      },
    });

    await discoverGithubIssues(deps, polledAt);

    expect(deps.triageStore.upsert).toHaveBeenCalledTimes(2);
    expect(deps.triageStore.upsert).toHaveBeenNthCalledWith(1, {
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
      issueNumber: 477,
      title: 'Update CLI package README',
      url: 'https://github.com/Pushedskydiver/chief-clancy/issues/477',
      state: 'open',
      githubUpdatedAt: new Date('2026-07-20T12:00:00.000Z'),
      polledAt,
    });
    expect(deps.triageStore.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ issueNumber: 486 }) as object,
    );
  });

  it('logs an error and upserts nothing when listing issues fails', async () => {
    const deps = makeDeps({
      githubClient: {
        listOpenIssues: vi
          .fn<GithubClient['listOpenIssues']>()
          .mockResolvedValue({
            ok: false,
            error: { kind: 'unknown', cause: new Error('rate limited') },
          }),
      },
    });

    await discoverGithubIssues(deps, new Date('2026-07-21T09:00:00.000Z'));

    expect(deps.triageStore.upsert).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to list open github issues',
      expect.objectContaining({
        repoOwner: 'Pushedskydiver',
        repoName: 'chief-clancy',
      }) as object,
    );
  });

  it('joins invalid-response schema issues into the logged errorMessage', async () => {
    const deps = makeDeps({
      githubClient: {
        listOpenIssues: vi
          .fn<GithubClient['listOpenIssues']>()
          .mockResolvedValue({
            ok: false,
            error: {
              kind: 'invalid-response',
              issues: ['number: Expected number, received string'],
            },
          }),
      },
    });

    await discoverGithubIssues(deps, new Date('2026-07-21T09:00:00.000Z'));

    expect(deps.triageStore.upsert).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to list open github issues',
      expect.objectContaining({
        errorMessage: 'number: Expected number, received string',
      }) as object,
    );
  });

  it('logs an error but keeps upserting the rest when one upsert fails', async () => {
    const upsert = vi.fn<TriageStore['upsert']>();
    upsert.mockResolvedValueOnce({
      ok: false,
      error: { kind: 'unknown', cause: new Error('db down') },
    });
    upsert.mockResolvedValue({
      ok: true,
      entry: {
        repoOwner: 'Pushedskydiver',
        repoName: 'chief-clancy',
        issueNumber: 486,
        title: 'x',
        url: 'x',
        state: 'open',
        githubUpdatedAt: new Date(),
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      },
    });
    const deps = makeDeps({
      githubClient: {
        listOpenIssues: vi
          .fn<GithubClient['listOpenIssues']>()
          .mockResolvedValue({
            ok: true,
            issues: [
              makeIssue({ issueNumber: 477 }),
              makeIssue({ issueNumber: 486 }),
            ],
          }),
      },
      triageStore: { upsert },
    });

    await discoverGithubIssues(deps, new Date('2026-07-21T09:00:00.000Z'));

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to upsert github issue triage entry',
      expect.objectContaining({ issueNumber: 477 }) as object,
    );
  });
});
