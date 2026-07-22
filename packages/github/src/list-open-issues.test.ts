import type { Octokit } from 'octokit';

import { describe, expect, it, vi } from 'vitest';

import { listOpenIssues } from './list-open-issues.js';

function makeClient(paginate: ReturnType<typeof vi.fn>): Octokit {
  return {
    paginate,
    rest: { issues: { listForRepo: vi.fn() } },
  } as unknown as Octokit;
}

describe('listOpenIssues', () => {
  it('returns ok:true with normalized issues, filtering out pull requests', async () => {
    const paginate = vi.fn().mockResolvedValue([
      {
        number: 477,
        title: 'Update CLI package README',
        html_url: 'https://github.com/Pushedskydiver/chief-clancy/issues/477',
        state: 'open',
        updated_at: '2026-07-20T12:00:00Z',
      },
      {
        number: 486,
        title: 'build(deps-dev): bump the development-version-deps group',
        html_url: 'https://github.com/Pushedskydiver/chief-clancy/issues/486',
        state: 'open',
        updated_at: '2026-07-19T08:00:00Z',
        pull_request: { url: 'https://api.github.com/repos/x/y/pulls/486' },
      },
    ]);
    const client = makeClient(paginate);

    const result = await listOpenIssues(client, {
      owner: 'Pushedskydiver',
      name: 'chief-clancy',
    });

    expect(paginate).toHaveBeenCalledWith(client.rest.issues.listForRepo, {
      owner: 'Pushedskydiver',
      repo: 'chief-clancy',
      state: 'open',
      per_page: 100,
    });
    expect(result).toEqual({
      ok: true,
      issues: [
        {
          issueNumber: 477,
          title: 'Update CLI package README',
          url: 'https://github.com/Pushedskydiver/chief-clancy/issues/477',
          state: 'open',
          githubUpdatedAt: new Date('2026-07-20T12:00:00Z'),
        },
      ],
    });
  });

  it('returns ok:true with an empty list when the repo has no open issues', async () => {
    const paginate = vi.fn().mockResolvedValue([]);
    const client = makeClient(paginate);

    const result = await listOpenIssues(client, {
      owner: 'Pushedskydiver',
      name: 'chief-clancy',
    });

    expect(result).toEqual({ ok: true, issues: [] });
  });

  it('returns ok:false when the API response fails schema validation', async () => {
    const paginate = vi.fn().mockResolvedValue([{ number: 'not-a-number' }]);
    const client = makeClient(paginate);

    const result = await listOpenIssues(client, {
      owner: 'Pushedskydiver',
      name: 'chief-clancy',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-response');
    }
  });

  it('returns ok:false when the request throws', async () => {
    const paginate = vi.fn().mockRejectedValue(new Error('rate limited'));
    const client = makeClient(paginate);

    const result = await listOpenIssues(client, {
      owner: 'Pushedskydiver',
      name: 'chief-clancy',
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'unknown', cause: new Error('rate limited') },
    });
  });
});
