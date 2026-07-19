import type { SweepDeps } from './review-queue-sweep.js';
import type { PendingConfirmingQuestion, ReviewQueueEntry } from '@moe/core';

import { describe, expect, it, vi } from 'vitest';

import { runReviewQueueSweep } from './review-queue-sweep.js';

type SweepStateStore = SweepDeps['sweepStateStore'];
type ReviewQueueStore = SweepDeps['reviewQueueStore'];
type ConfirmingQuestionStore = SweepDeps['confirmingQuestionStore'];

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
      create: vi
        .fn<ReviewQueueStore['create']>()
        .mockResolvedValue({ ok: true, entry: makeEntry() }),
      ...overrides.reviewQueueStore,
    },
    confirmingQuestionStore: {
      findStale: vi
        .fn<ConfirmingQuestionStore['findStale']>()
        .mockResolvedValue({ ok: true, questions: [] }),
      resolve: vi.fn<ConfirmingQuestionStore['resolve']>(),
      ...overrides.confirmingQuestionStore,
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
        create: vi.fn<ReviewQueueStore['create']>(),
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
        create: vi.fn<ReviewQueueStore['create']>(),
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
        resolve: vi.fn<ConfirmingQuestionStore['resolve']>().mockResolvedValue({
          ok: true,
          question: { ...question, resolvedAt: now },
        }),
      },
    });

    await runReviewQueueSweep(deps, now);

    expect(deps.confirmingQuestionStore.findStale).toHaveBeenCalledWith({
      personaId: 'sarah',
      olderThan: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    });
    expect(deps.confirmingQuestionStore.resolve).toHaveBeenCalledWith(
      question.id,
    );
    expect(deps.reviewQueueStore.create).toHaveBeenCalledWith({
      personaId: 'sarah',
      channelId: question.channelId,
      messageTs: question.sourceMessageTs,
      sourceMessageText: question.sourceMessageText,
      confidence: question.confidence,
      reasoning: question.reasoning,
      outcomeReason: 'mid-silence',
    });
  });

  it('skips a stale confirming question that a real reaction already resolved (race)', async () => {
    const now = new Date('2026-07-19T12:00:00.000Z');
    const deps = makeDeps({
      confirmingQuestionStore: {
        findStale: vi
          .fn<ConfirmingQuestionStore['findStale']>()
          .mockResolvedValue({ ok: true, questions: [makeQuestion()] }),
        resolve: vi
          .fn<ConfirmingQuestionStore['resolve']>()
          .mockResolvedValue({ ok: false, error: { kind: 'unavailable' } }),
      },
    });

    await runReviewQueueSweep(deps, now);

    expect(deps.reviewQueueStore.create).not.toHaveBeenCalled();
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
        create: vi.fn<ReviewQueueStore['create']>(),
      },
    });

    await runReviewQueueSweep(deps, now);

    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
    expect(deps.sweepStateStore.recordSweepCompleted).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to list review-queue entries',
      expect.objectContaining({ message: 'Error: connection reset' }),
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
      expect.objectContaining({ message: 'Error: connection reset' }),
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
        resolve: vi.fn<ConfirmingQuestionStore['resolve']>(),
      },
    });

    await runReviewQueueSweep(deps, now);

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to find stale confirming questions',
      expect.objectContaining({ message: 'Error: connection reset' }),
    );
    expect(deps.sweepStateStore.recordSweepCompleted).toHaveBeenCalled();
  });
});
