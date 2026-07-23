import type { Octokit } from 'octokit';

import { describe, expect, it, vi } from 'vitest';

import { createGithubIssue } from './create-github-issue.js';

function makeClient(create: ReturnType<typeof vi.fn>): Octokit {
  return { rest: { issues: { create } } } as unknown as Octokit;
}

describe('createGithubIssue', () => {
  it('returns ok:true with the created issue number/url', async () => {
    const create = vi.fn().mockResolvedValue({
      data: {
        number: 42,
        html_url: 'https://github.com/Pushedskydiver/chief-clancy/issues/42',
      },
      status: 201,
    });
    const client = makeClient(create);

    const result = await createGithubIssue(
      client,
      { owner: 'Pushedskydiver', name: 'chief-clancy' },
      { title: 'The login page returns a 500 on submit', body: 'Tracked.' },
    );

    expect(create).toHaveBeenCalledWith({
      owner: 'Pushedskydiver',
      repo: 'chief-clancy',
      title: 'The login page returns a 500 on submit',
      body: 'Tracked.',
    });
    expect(result).toEqual({
      ok: true,
      issue: {
        issueNumber: 42,
        url: 'https://github.com/Pushedskydiver/chief-clancy/issues/42',
      },
    });
  });

  it('returns ok:false when the API response fails schema validation', async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ data: { number: 'not-a-number' }, status: 201 });
    const client = makeClient(create);

    const result = await createGithubIssue(
      client,
      { owner: 'Pushedskydiver', name: 'chief-clancy' },
      { title: 'A ticket', body: 'Tracked.' },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-response');
    }
  });

  it('returns ok:false when the request throws (e.g. a 403 permission error)', async () => {
    const create = vi
      .fn()
      .mockRejectedValue(new Error('Resource not accessible by integration'));
    const client = makeClient(create);

    const result = await createGithubIssue(
      client,
      { owner: 'Pushedskydiver', name: 'chief-clancy' },
      { title: 'A ticket', body: 'Tracked.' },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'unknown',
        cause: new Error('Resource not accessible by integration'),
      },
    });
  });
});
