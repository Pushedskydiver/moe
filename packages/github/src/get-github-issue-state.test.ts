import type { Octokit } from 'octokit';

import { describe, expect, it, vi } from 'vitest';

import { getGithubIssueState } from './get-github-issue-state.js';

function makeClient(get: ReturnType<typeof vi.fn>): Octokit {
  return { rest: { issues: { get } } } as unknown as Octokit;
}

describe('getGithubIssueState', () => {
  it('returns ok:true with the issue open', async () => {
    const get = vi
      .fn()
      .mockResolvedValue({ data: { number: 489, state: 'open' } });
    const client = makeClient(get);

    const result = await getGithubIssueState(
      client,
      { owner: 'Pushedskydiver', name: 'chief-clancy' },
      489,
    );

    expect(get).toHaveBeenCalledWith({
      owner: 'Pushedskydiver',
      repo: 'chief-clancy',
      issue_number: 489,
    });
    expect(result).toEqual({
      ok: true,
      issue: { issueNumber: 489, state: 'open' },
    });
  });

  it('returns ok:true with the issue closed', async () => {
    const get = vi
      .fn()
      .mockResolvedValue({ data: { number: 489, state: 'closed' } });
    const client = makeClient(get);

    const result = await getGithubIssueState(
      client,
      { owner: 'Pushedskydiver', name: 'chief-clancy' },
      489,
    );

    expect(result).toEqual({
      ok: true,
      issue: { issueNumber: 489, state: 'closed' },
    });
  });

  it('returns ok:false when the API response fails schema validation', async () => {
    const get = vi
      .fn()
      .mockResolvedValue({ data: { number: 489, state: 'invalid-state' } });
    const client = makeClient(get);

    const result = await getGithubIssueState(
      client,
      { owner: 'Pushedskydiver', name: 'chief-clancy' },
      489,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-response');
    }
  });

  it('returns ok:false when the request throws (e.g. a 404 for a deleted issue)', async () => {
    const get = vi.fn().mockRejectedValue(new Error('Not Found'));
    const client = makeClient(get);

    const result = await getGithubIssueState(
      client,
      { owner: 'Pushedskydiver', name: 'chief-clancy' },
      489,
    );

    expect(result).toEqual({
      ok: false,
      error: { kind: 'unknown', cause: new Error('Not Found') },
    });
  });
});
