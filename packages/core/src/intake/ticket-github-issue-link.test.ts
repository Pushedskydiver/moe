import { describe, expect, it } from 'vitest';

import { ticketGithubIssueLinkSchema } from './ticket-github-issue-link.js';

describe('ticketGithubIssueLinkSchema', () => {
  it('accepts a pending (unresolved) link row', () => {
    const result = ticketGithubIssueLinkSchema.safeParse({
      ticketId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
      issueNumber: null,
      issueUrl: null,
      resolvedAt: null,
      createdAt: new Date(),
    });

    expect(result.success).toBe(true);
  });

  it('accepts a resolved link row', () => {
    const result = ticketGithubIssueLinkSchema.safeParse({
      ticketId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
      issueNumber: 42,
      issueUrl: 'https://github.com/Pushedskydiver/chief-clancy/issues/42',
      resolvedAt: new Date(),
      createdAt: new Date(),
    });

    expect(result.success).toBe(true);
  });

  it('rejects a blank repoOwner', () => {
    const result = ticketGithubIssueLinkSchema.safeParse({
      ticketId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      repoOwner: '   ',
      repoName: 'chief-clancy',
      issueNumber: null,
      issueUrl: null,
      resolvedAt: null,
      createdAt: new Date(),
    });

    expect(result.success).toBe(false);
  });

  it('rejects a non-positive issueNumber', () => {
    const result = ticketGithubIssueLinkSchema.safeParse({
      ticketId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
      issueNumber: 0,
      issueUrl: 'https://github.com/Pushedskydiver/chief-clancy/issues/0',
      resolvedAt: new Date(),
      createdAt: new Date(),
    });

    expect(result.success).toBe(false);
  });
});
