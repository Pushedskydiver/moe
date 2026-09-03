import type { ConvertNextTriageEntryDeps } from './convert-next-triage-entry.js';
import type { Logger } from './logger.js';
import type {
  CreateTicketFromTriageEntryResult,
  GithubIssueTriageEntry,
  GithubIssueTriageEntryOrNullResult,
} from '@moe/core';

import { describe, expect, it, vi } from 'vitest';

import { createConvertNextTriageEntryPreTickStep } from './convert-next-triage-entry.js';

function makeLogger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeEntry(
  overrides: Partial<GithubIssueTriageEntry> = {},
): GithubIssueTriageEntry {
  return {
    repoOwner: 'Pushedskydiver',
    repoName: 'chief-clancy',
    issueNumber: 477,
    title: 'Update CLI package README',
    url: 'https://github.com/Pushedskydiver/chief-clancy/issues/477',
    state: 'open',
    githubUpdatedAt: new Date('2026-07-20T12:00:00.000Z'),
    firstSeenAt: new Date('2026-07-21T09:00:00.000Z'),
    lastSeenAt: new Date('2026-07-21T09:00:00.000Z'),
    ...overrides,
  };
}

function makeDeps(
  overrides: Partial<{
    readonly findNextUnconverted: () => Promise<GithubIssueTriageEntryOrNullResult>;
    readonly convert: (
      entry: GithubIssueTriageEntry,
    ) => Promise<CreateTicketFromTriageEntryResult>;
  }> = {},
): ConvertNextTriageEntryDeps {
  return {
    triageStore: {
      findNextUnconverted:
        overrides.findNextUnconverted ??
        vi.fn().mockResolvedValue({ ok: true, entry: null }),
      convert: overrides.convert ?? vi.fn(),
    },
    logger: makeLogger(),
  };
}

describe('createConvertNextTriageEntryPreTickStep', () => {
  it('is a no-op when nothing is eligible for conversion', async () => {
    const deps = makeDeps();
    const preTickStep = createConvertNextTriageEntryPreTickStep(deps);

    await preTickStep();

    expect(deps.triageStore.convert).not.toHaveBeenCalled();
    expect(deps.logger.error).not.toHaveBeenCalled();
  });

  it('converts the one eligible entry into a ticket', async () => {
    const entry = makeEntry();
    const deps = makeDeps({
      findNextUnconverted: vi.fn().mockResolvedValue({ ok: true, entry }),
      convert: vi.fn().mockResolvedValue({
        ok: true,
        ticket: {
          id: '00000000-0000-0000-0000-000000000001',
          projectKey: 'chief-clancy',
          title: entry.title,
          status: 'Brief',
          severity: 'Medium',
          classOfService: 'Standard',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        link: {
          ticketId: '00000000-0000-0000-0000-000000000001',
          repoOwner: entry.repoOwner,
          repoName: entry.repoName,
          issueNumber: entry.issueNumber,
          issueUrl: entry.url,
          resolvedAt: new Date(),
          createdAt: new Date(),
        },
      }),
    });
    const preTickStep = createConvertNextTriageEntryPreTickStep(deps);

    await preTickStep();

    expect(deps.triageStore.convert).toHaveBeenCalledWith(entry);
    expect(deps.logger.error).not.toHaveBeenCalled();
  });

  it('logs and does not attempt a conversion when finding the next entry fails', async () => {
    const deps = makeDeps({
      findNextUnconverted: vi.fn().mockResolvedValue({
        ok: false,
        error: { kind: 'unknown', cause: new Error('db down') },
      }),
    });
    const preTickStep = createConvertNextTriageEntryPreTickStep(deps);

    await preTickStep();

    expect(deps.triageStore.convert).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalled();
  });

  it('logs when the conversion itself fails', async () => {
    const entry = makeEntry();
    const deps = makeDeps({
      findNextUnconverted: vi.fn().mockResolvedValue({ ok: true, entry }),
      convert: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          step: 'link',
          error: { kind: 'unknown', cause: new Error('unique violation') },
        },
      }),
    });
    const preTickStep = createConvertNextTriageEntryPreTickStep(deps);

    await preTickStep();

    expect(deps.logger.error).toHaveBeenCalled();
  });
});
