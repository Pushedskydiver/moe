import type { Octokit } from 'octokit';

import { describe, expect, it, vi } from 'vitest';

import { getGithubIssueBody } from './get-github-issue-body.js';

function makeClient(get: ReturnType<typeof vi.fn>): Octokit {
  return { rest: { issues: { get } } } as unknown as Octokit;
}

describe('getGithubIssueBody', () => {
  it('returns ok:true with the issue title and body', async () => {
    const get = vi.fn().mockResolvedValue({
      data: { number: 489, title: 'A real issue', body: 'The full body text' },
    });
    const client = makeClient(get);

    const result = await getGithubIssueBody(
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
      issue: {
        issueNumber: 489,
        title: 'A real issue',
        body: 'The full body text',
      },
    });
  });

  it('normalizes a null body to an empty string', async () => {
    const get = vi.fn().mockResolvedValue({
      data: { number: 489, title: 'A real issue', body: null },
    });
    const client = makeClient(get);

    const result = await getGithubIssueBody(
      client,
      { owner: 'Pushedskydiver', name: 'chief-clancy' },
      489,
    );

    expect(result).toEqual({
      ok: true,
      issue: { issueNumber: 489, title: 'A real issue', body: '' },
    });
  });

  it('returns ok:false when the API response fails schema validation', async () => {
    const get = vi
      .fn()
      .mockResolvedValue({ data: { number: 489, title: null, body: null } });
    const client = makeClient(get);

    const result = await getGithubIssueBody(
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

    const result = await getGithubIssueBody(
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
