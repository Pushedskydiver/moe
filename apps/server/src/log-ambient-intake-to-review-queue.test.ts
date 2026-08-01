import type { HandlerDeps } from './handle-inbound-message.js';

import { describe, expect, it, vi } from 'vitest';

import { logAmbientIntakeToReviewQueue } from './log-ambient-intake-to-review-queue.js';

type ReviewQueueStore = HandlerDeps['reviewQueueStore'];

const MESSAGE = {
  channelId: 'C123',
  channelType: 'channel' as const,
  userId: 'U123',
  text: 'the CLI hangs on large repos',
  ts: '1700000000.000050',
};

const CLASSIFIED = {
  confidence: 85,
  reasoning: 'a concrete bug report naming a reproducible failure',
};

function makeDeps(
  overrides: Partial<{ readonly create: ReviewQueueStore['create'] }> = {},
) {
  return {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    personaId: 'sarah' as const,
    reviewQueueStore: {
      create:
        overrides.create ??
        vi.fn<ReviewQueueStore['create']>().mockResolvedValue({
          ok: true,
          entry: {
            id: '9fa85f64-5717-4562-b3fc-2c963f66afaa',
            personaId: 'sarah',
            channelId: MESSAGE.channelId,
            messageTs: MESSAGE.ts,
            sourceMessageText: MESSAGE.text,
            confidence: CLASSIFIED.confidence,
            reasoning: CLASSIFIED.reasoning,
            outcomeReason: 'high-band-off-hours',
            createdAt: new Date('2026-07-16T21:00:00.000Z'),
          },
        }),
    },
  };
}

describe('logAmbientIntakeToReviewQueue', () => {
  // Co-located tests for the extraction itself, not only through its three callers —
  // `docs/REVIEW-PATTERNS.md` records "an extracted function ships without co-located tests" as a
  // recurring miss in this codebase, now on its third instance.
  it.each([
    'low-confidence',
    'high-band-off-hours',
    'mid-band-off-hours',
  ] as const)(
    'writes a %s row keyed on the source message, carrying the classifier output',
    async (outcomeReason) => {
      const deps = makeDeps();

      await logAmbientIntakeToReviewQueue(deps, {
        message: MESSAGE,
        classified: CLASSIFIED,
        outcomeReason,
      });

      expect(deps.reviewQueueStore.create).toHaveBeenCalledWith({
        personaId: 'sarah',
        channelId: 'C123',
        // The **source** message's ts, not a bot-posted one — nothing is posted on the two
        // off-hours paths, and all four `review_queue` writers key on the human message.
        messageTs: MESSAGE.ts,
        sourceMessageText: MESSAGE.text,
        confidence: 85,
        reasoning: CLASSIFIED.reasoning,
        outcomeReason,
      });
      expect(deps.logger.info).toHaveBeenCalledWith(
        'logged ambient message to review queue',
        {
          personaId: 'sarah',
          channelId: 'C123',
          outcomeReason,
          confidence: 85,
        },
      );
    },
  );

  // "Log, don't throw" — every caller is on a path with no reply to carry an error, so a failed
  // write must not propagate. Pinned by resolution, not just by absence of a rejection: an
  // implementation that swallowed the error *and* the log line would be a silent loss inside the
  // function that exists to prevent silent loss.
  it('logs an error naming the outcome reason, without throwing, when the write fails', async () => {
    const deps = makeDeps({
      create: vi.fn<ReviewQueueStore['create']>().mockResolvedValue({
        ok: false,
        error: { kind: 'unknown', cause: new Error('connection reset') },
      }),
    });

    await expect(
      logAmbientIntakeToReviewQueue(deps, {
        message: MESSAGE,
        classified: CLASSIFIED,
        outcomeReason: 'high-band-off-hours',
      }),
    ).resolves.toBeUndefined();

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to log ambient message to review queue',
      {
        personaId: 'sarah',
        channelId: 'C123',
        outcomeReason: 'high-band-off-hours',
        errorMessage: 'Error: connection reset',
      },
    );
    expect(deps.logger.info).not.toHaveBeenCalled();
  });
});
