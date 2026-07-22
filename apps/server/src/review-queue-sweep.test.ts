import type { SweepDeps } from './review-queue-sweep.js';
import type { PendingConfirmingQuestion, ReviewQueueEntry } from '@moe/core';

import { describe, expect, it, vi } from 'vitest';

import { runReviewQueueSweep } from './review-queue-sweep.js';

type SweepStateStore = SweepDeps['sweepStateStore'];
type ReviewQueueStore = SweepDeps['reviewQueueStore'];
type ConfirmingQuestionStore = SweepDeps['confirmingQuestionStore'];
type DraftStore = SweepDeps['draftStore'];

function makeEntry(
  overrides: Partial<ReviewQueueEntry> = {},
): ReviewQueueEntry {
  return {
    id: '5fa85f64-5717-4562-b3fc-2c963f66afa8',
    personaId: 'sarah',
    channelId: 'C123',
    messageTs: '1700000000.000100',
    sourceMessageText: 'anyone know a good coffee place nearby',
    confidence: 12,
    reasoning: 'reads as banter, not a work request',
    outcomeReason: 'low-confidence',
    createdAt: new Date('2026-07-19T09:00:00.000Z'),
    ...overrides,
  };
}

function makeQuestion(
  overrides: Partial<PendingConfirmingQuestion> = {},
): PendingConfirmingQuestion {
  return {
    id: '8fa85f64-5717-4562-b3fc-2c963f66afab',
    personaId: 'sarah',
    channelId: 'C123',
    messageTs: '1700000099.000100',
    sourceMessageTs: '1700000000.000050',
    sourceMessageText:
      'hey, there might be an issue with the CLI on large repos',
    confidence: 55,
    reasoning: 'plausibly describes a bug, but not clearly actionable',
    resolvedAt: null,
    createdAt: new Date('2026-07-18T09:00:00.000Z'),
    ...overrides,
  };
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeDeps(
  overrides: Partial<{
    readonly slackClient: SweepDeps['slackClient'];
    readonly sweepStateStore: SweepStateStore;
    readonly reviewQueueStore: ReviewQueueStore;
    readonly confirmingQuestionStore: ConfirmingQuestionStore;
    readonly draftStore: DraftStore;
  }> = {},
): SweepDeps {
  return {
    personaId: 'sarah',
    alertSlackUserId: 'U04UQ6CLZ1U',
    logger: makeLogger(),
    slackClient: overrides.slackClient ?? {
      chat: { postMessage: vi.fn().mockResolvedValue({ ok: true, ts: 'x' }) },
    },
    sweepStateStore: {
      getSweepState: vi
        .fn<SweepStateStore['getSweepState']>()
        .mockResolvedValue({ ok: true, state: null }),
      recordSweepCompleted: vi
        .fn<SweepStateStore['recordSweepCompleted']>()
        .mockResolvedValue({
          ok: true,
          state: { personaId: 'sarah', lastSweptAt: new Date() },
        }),
      ...overrides.sweepStateStore,
    },
    reviewQueueStore: {
      listSince: vi
        .fn<ReviewQueueStore['listSince']>()
        .mockResolvedValue({ ok: true, entries: [] }),
      ...overrides.reviewQueueStore,
    },
    confirmingQuestionStore: {
      findStale: vi
        .fn<ConfirmingQuestionStore['findStale']>()
        .mockResolvedValue({ ok: true, questions: [] }),
      resolveAndLog: vi.fn<ConfirmingQuestionStore['resolveAndLog']>(),
      ...overrides.confirmingQuestionStore,
    },
    draftStore: {
      getOutcomeCounts: vi
        .fn<DraftStore['getOutcomeCounts']>()
        .mockResolvedValue({
          ok: true,
          counts: { committed: 12, redone: 3, ignored: 2 },
        }),
      ...overrides.draftStore,
    },
  };
}

describe('runReviewQueueSweep', () => {
  it('posts a formatted sweep message grouped by outcomeReason, then records the sweep', async () => {
    const now = new Date('2026-07-19T12:00:00.000Z');
    const deps = makeDeps({
      reviewQueueStore: {
        listSince: vi.fn<ReviewQueueStore['listSince']>().mockResolvedValue({
          ok: true,
          entries: [
            makeEntry({ outcomeReason: 'low-confidence' }),
            makeEntry({
              id: '6fa85f64-5717-4562-b3fc-2c963f66afa9',
              outcomeReason: 'mid-no',
              sourceMessageText: 'the export CLI drops rows over 10k',
            }),
          ],
        }),
      },
    });

    await runReviewQueueSweep(deps, now);

    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'U04UQ6CLZ1U',
        text: expect.stringContaining('Low confidence') as string,
      }),
    );
    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Answered no') as string,
      }),
    );
    expect(deps.sweepStateStore.recordSweepCompleted).toHaveBeenCalledWith({
      personaId: 'sarah',
      sweptAt: now,
    });
  });

  it('includes a draft-outcomes summary line in the digest, with an acceptance rate over committed+ignored only (BUILD_PLAN 3.6)', async () => {
    const now = new Date('2026-07-19T12:00:00.000Z');
    const deps = makeDeps({
      reviewQueueStore: {
        listSince: vi
          .fn<ReviewQueueStore['listSince']>()
          .mockResolvedValue({ ok: true, entries: [makeEntry()] }),
      },
      draftStore: {
        getOutcomeCounts: vi
          .fn<DraftStore['getOutcomeCounts']>()
          .mockResolvedValue({
            ok: true,
            counts: { committed: 3, redone: 1, ignored: 1 },
          }),
      },
    });

    await runReviewQueueSweep(deps, now);

    expect(deps.draftStore.getOutcomeCounts).toHaveBeenCalledWith({
      personaId: 'sarah',
      ignoredOlderThan: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    });
    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(
          '📊 Draft outcomes (all time): 3 committed, 1 redone (open), 1 ignored — 75% acceptance rate',
        ) as string,
      }),
    );
  });

  it('omits the acceptance-rate suffix when there is no terminal (committed/ignored) data yet', async () => {
    const now = new Date('2026-07-19T12:00:00.000Z');
    const deps = makeDeps({
      reviewQueueStore: {
        listSince: vi
          .fn<ReviewQueueStore['listSince']>()
          .mockResolvedValue({ ok: true, entries: [makeEntry()] }),
      },
      draftStore: {
        getOutcomeCounts: vi
          .fn<DraftStore['getOutcomeCounts']>()
          .mockResolvedValue({
            ok: true,
            counts: { committed: 0, redone: 2, ignored: 0 },
          }),
      },
    });

    await runReviewQueueSweep(deps, now);

    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(
          '📊 Draft outcomes (all time): 0 committed, 2 redone (open), 0 ignored\n',
        ) as string,
      }),
    );
  });

  it('does not fetch draft-outcome counts when there is nothing new to report — the counts ride along with an existing post, not an independent trigger', async () => {
    const now = new Date('2026-07-19T12:00:00.000Z');
    const deps = makeDeps();

    await runReviewQueueSweep(deps, now);

    expect(deps.draftStore.getOutcomeCounts).not.toHaveBeenCalled();
    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
  });

  it('still posts the review-queue digest, without a draft-outcomes line, when the counts fetch itself fails', async () => {
    const now = new Date('2026-07-19T12:00:00.000Z');
    const deps = makeDeps({
      reviewQueueStore: {
        listSince: vi
          .fn<ReviewQueueStore['listSince']>()
          .mockResolvedValue({ ok: true, entries: [makeEntry()] }),
      },
      draftStore: {
        getOutcomeCounts: vi
          .fn<DraftStore['getOutcomeCounts']>()
          .mockResolvedValue({
            ok: false,
            error: { kind: 'unknown', cause: new Error('connection reset') },
          }),
      },
    });

    await runReviewQueueSweep(deps, now);

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to fetch draft outcome counts',
      expect.objectContaining({ errorMessage: 'Error: connection reset' }),
    );
    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.not.stringContaining('Draft outcomes') as string,
      }),
    );
    expect(deps.sweepStateStore.recordSweepCompleted).toHaveBeenCalled();
  });

  it('does not advance the sweep state when the digest post itself fails, even though there was real content to report (DA review, chunk 3.5)', async () => {
    const now = new Date('2026-07-19T12:00:00.000Z');
    const deps = makeDeps({
      slackClient: {
        chat: {
          postMessage: vi
            .fn()
            .mockResolvedValue({ ok: false, error: 'channel_not_found' }),
        },
      },
      reviewQueueStore: {
        listSince: vi.fn<ReviewQueueStore['listSince']>().mockResolvedValue({
          ok: true,
          entries: [makeEntry()],
        }),
      },
    });

    await runReviewQueueSweep(deps, now);

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to post review-queue sweep',
      expect.objectContaining({ personaId: 'sarah' }),
    );
    expect(deps.sweepStateStore.recordSweepCompleted).not.toHaveBeenCalled();
  });

  it('does not post anything, but still records the sweep, when there are no new entries', async () => {
    const now = new Date('2026-07-19T12:00:00.000Z');
    const deps = makeDeps();

    await runReviewQueueSweep(deps, now);

    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
    expect(deps.sweepStateStore.recordSweepCompleted).toHaveBeenCalledWith({
      personaId: 'sarah',
      sweptAt: now,
    });
  });

  it('resolves and logs stale unresolved confirming questions as mid-silence review-queue entries before listing', async () => {
    const now = new Date('2026-07-19T12:00:00.000Z');
    const question = makeQuestion();
    const deps = makeDeps({
      confirmingQuestionStore: {
        findStale: vi
          .fn<ConfirmingQuestionStore['findStale']>()
          .mockResolvedValue({ ok: true, questions: [question] }),
        resolveAndLog: vi
          .fn<ConfirmingQuestionStore['resolveAndLog']>()
          .mockResolvedValue({
            ok: true,
            question: { ...question, resolvedAt: now },
            entry: makeEntry({ outcomeReason: 'mid-silence' }),
          }),
      },
    });

    await runReviewQueueSweep(deps, now);

    expect(deps.confirmingQuestionStore.findStale).toHaveBeenCalledWith({
      personaId: 'sarah',
      olderThan: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    });
    expect(deps.confirmingQuestionStore.resolveAndLog).toHaveBeenCalledWith({
      questionId: question.id,
      personaId: 'sarah',
      outcomeReason: 'mid-silence',
    });
  });

  it('logs an error, without throwing, when logging a stale confirming question as silent fails after a successful claim', async () => {
    const now = new Date('2026-07-19T12:00:00.000Z');
    const question = makeQuestion();
    const deps = makeDeps({
      confirmingQuestionStore: {
        findStale: vi
          .fn<ConfirmingQuestionStore['findStale']>()
          .mockResolvedValue({ ok: true, questions: [question] }),
        resolveAndLog: vi
          .fn<ConfirmingQuestionStore['resolveAndLog']>()
          .mockResolvedValue({
            ok: false,
            error: {
              step: 'log',
              error: { kind: 'unknown', cause: new Error('connection reset') },
            },
          }),
      },
    });

    await expect(runReviewQueueSweep(deps, now)).resolves.toBeUndefined();

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to log Mid-band silence to review queue',
      expect.objectContaining({
        personaId: 'sarah',
        questionId: question.id,
        errorMessage: 'Error: connection reset',
      }),
    );
  });

  it('skips a stale confirming question that a real reaction already resolved (race)', async () => {
    const now = new Date('2026-07-19T12:00:00.000Z');
    const deps = makeDeps({
      confirmingQuestionStore: {
        findStale: vi
          .fn<ConfirmingQuestionStore['findStale']>()
          .mockResolvedValue({ ok: true, questions: [makeQuestion()] }),
        resolveAndLog: vi
          .fn<ConfirmingQuestionStore['resolveAndLog']>()
          .mockResolvedValue({
            ok: false,
            error: { step: 'claim', error: { kind: 'unavailable' } },
          }),
      },
    });

    await runReviewQueueSweep(deps, now);

    expect(deps.logger.error).not.toHaveBeenCalled();
  });

  it('does not advance the sweep state when listing review-queue entries fails', async () => {
    const now = new Date('2026-07-19T12:00:00.000Z');
    const deps = makeDeps({
      reviewQueueStore: {
        listSince: vi.fn<ReviewQueueStore['listSince']>().mockResolvedValue({
          ok: false,
          error: { kind: 'unknown', cause: new Error('connection reset') },
        }),
      },
    });

    await runReviewQueueSweep(deps, now);

    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
    expect(deps.sweepStateStore.recordSweepCompleted).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to list review-queue entries',
      expect.objectContaining({ errorMessage: 'Error: connection reset' }),
    );
  });

  it('falls back to sweeping from the beginning of time when reading sweep state fails', async () => {
    const now = new Date('2026-07-19T12:00:00.000Z');
    const deps = makeDeps({
      sweepStateStore: {
        getSweepState: vi
          .fn<SweepStateStore['getSweepState']>()
          .mockResolvedValue({
            ok: false,
            error: { kind: 'unknown', cause: new Error('connection reset') },
          }),
        recordSweepCompleted: vi
          .fn<SweepStateStore['recordSweepCompleted']>()
          .mockResolvedValue({
            ok: true,
            state: { personaId: 'sarah', lastSweptAt: new Date() },
          }),
      },
    });

    await runReviewQueueSweep(deps, now);

    expect(deps.reviewQueueStore.listSince).toHaveBeenCalledWith({
      personaId: 'sarah',
      since: new Date(0),
    });
    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to read sweep state — falling back to sweeping from the beginning',
      expect.objectContaining({ errorMessage: 'Error: connection reset' }),
    );
  });

  it('logs an error but continues the sweep when finding stale confirming questions fails', async () => {
    const now = new Date('2026-07-19T12:00:00.000Z');
    const deps = makeDeps({
      confirmingQuestionStore: {
        findStale: vi
          .fn<ConfirmingQuestionStore['findStale']>()
          .mockResolvedValue({
            ok: false,
            error: { kind: 'unknown', cause: new Error('connection reset') },
          }),
        resolveAndLog: vi.fn<ConfirmingQuestionStore['resolveAndLog']>(),
      },
    });

    await runReviewQueueSweep(deps, now);

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to find stale confirming questions',
      expect.objectContaining({ errorMessage: 'Error: connection reset' }),
    );
    expect(deps.sweepStateStore.recordSweepCompleted).toHaveBeenCalled();
  });
});
