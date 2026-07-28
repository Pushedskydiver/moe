import type { HandlerDeps } from './handle-inbound-message.js';

import { describe, expect, it, vi } from 'vitest';

import { createBankHolidaysCache } from '@moe/core';

import { composeAndPostConfirmingQuestion } from './compose-and-post-confirming-question.js';
import { makeThreadQueue } from './thread-queue.js';

type CapStore = HandlerDeps['capStore'];
type ConfirmingQuestionStore = HandlerDeps['confirmingQuestionStore'];

function makeSlackClient(
  response: {
    readonly ok: boolean;
    readonly error?: string;
    readonly ts?: string;
  },
  reactionResponses: ReadonlyArray<{
    readonly ok: boolean;
    readonly error?: string;
  }> = [],
) {
  const add = vi.fn();
  reactionResponses.forEach((reactionResponse) => {
    add.mockResolvedValueOnce(reactionResponse);
  });
  add.mockResolvedValue({ ok: true });

  return {
    chat: {
      postMessage: vi.fn().mockResolvedValue({
        ts: response.ok ? '1700000099.000100' : undefined,
        ...response,
      }),
    },
    reactions: { add },
  };
}

function makeAnthropicClient(
  appropriatenessResponse:
    | { readonly appropriate: boolean; readonly reasoning: string }
    | (() => never) = { appropriate: true, reasoning: 'a routine bug report' },
) {
  const parse = vi.fn();
  if (typeof appropriatenessResponse === 'function') {
    parse.mockImplementationOnce(appropriatenessResponse);
  } else {
    parse.mockResolvedValueOnce({
      parsed_output: appropriatenessResponse,
      usage: { input_tokens: 20, output_tokens: 8 },
    });
  }
  return { messages: { create: vi.fn(), parse } };
}

function makeLogger() {
  return { info: vi.fn(), error: vi.fn() };
}

function makeCapStore(
  overrides: Partial<{
    readonly getMonthlyCost: CapStore['getMonthlyCost'];
  }> = {},
): CapStore {
  return {
    getMonthlyCost: vi.fn<CapStore['getMonthlyCost']>().mockResolvedValue({
      ok: true,
      total: {
        personaId: 'sarah',
        month: '2026-07',
        inputTokens: 0,
        outputTokens: 0,
        costUsdMicros: 0,
      },
    }),
    getAlertState: vi
      .fn<CapStore['getAlertState']>()
      .mockResolvedValue({ ok: true, alert: null }),
    claimAlertThreshold: vi
      .fn<CapStore['claimAlertThreshold']>()
      .mockResolvedValue({
        ok: true,
        alert: {
          personaId: 'sarah',
          month: '2026-07',
          highestThresholdAlerted: 100,
          updatedAt: new Date('2026-07-16T09:00:00.000Z'),
        },
      }),
    ...overrides,
  };
}

function makeCostStore() {
  return {
    recordUsage: vi.fn().mockResolvedValue({
      ok: true,
      usage: {
        personaId: 'sarah',
        day: '2026-07-16',
        inputTokens: 20,
        outputTokens: 8,
        costUsdMicros: 60,
        updatedAt: new Date('2026-07-16T09:00:00.000Z'),
      },
    }),
  };
}

function makeBankHolidaysCache(dates: readonly string[] = []) {
  return createBankHolidaysCache({
    fetchFn: vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          'england-and-wales': {
            division: 'england-and-wales',
            events: dates.map((date) => ({
              title: 'Bank holiday',
              date,
              notes: '',
              bunting: true,
            })),
          },
        }),
    }),
  });
}

function makeConfirmingQuestionStore(
  overrides: Partial<ConfirmingQuestionStore> = {},
): ConfirmingQuestionStore {
  const BASE_QUESTION = {
    id: '8fa85f64-5717-4562-b3fc-2c963f66afab',
    personaId: 'sarah',
    channelId: 'C123',
    sourceSurface: 'channel' as const,
    sourceMessageTs: '1700000000.000050',
    sourceMessageText:
      'hey, there might be an issue with the CLI on large repos',
    confidence: 55,
    reasoning: 'plausibly describes a bug, but not clearly actionable',
    resolvedAt: null,
    createdAt: new Date('2026-07-16T09:00:00.000Z'),
  };
  return {
    create: vi.fn<ConfirmingQuestionStore['create']>().mockResolvedValue({
      ok: true,
      question: { ...BASE_QUESTION, messageTs: null },
    }),
    getByMessage: vi.fn<ConfirmingQuestionStore['getByMessage']>(),
    resolve: vi.fn<ConfirmingQuestionStore['resolve']>(),
    markPosted: vi
      .fn<ConfirmingQuestionStore['markPosted']>()
      .mockResolvedValue({
        ok: true,
        question: { ...BASE_QUESTION, messageTs: '1700000099.000100' },
      }),
    releaseClaim: vi
      .fn<ConfirmingQuestionStore['releaseClaim']>()
      .mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

function makeDeps(
  overrides: Partial<{
    readonly anthropicClient: ReturnType<typeof makeAnthropicClient>;
    readonly slackClient: ReturnType<typeof makeSlackClient>;
    readonly capStore: ReturnType<typeof makeCapStore>;
    readonly bankHolidaysCache: HandlerDeps['bankHolidaysCache'];
    readonly confirmingQuestionStore: HandlerDeps['confirmingQuestionStore'];
  }> = {},
) {
  return {
    anthropicClient: makeAnthropicClient(),
    slackClient: makeSlackClient({ ok: true }),
    logger: makeLogger(),
    historyStore: {
      getRecentTurns: vi.fn<HandlerDeps['historyStore']['getRecentTurns']>(),
      appendTurn: vi.fn<HandlerDeps['historyStore']['appendTurn']>(),
    },
    costStore: makeCostStore(),
    capStore: makeCapStore(),
    costCapConfig: {
      monthlyCapUsdMicros: 100_000_000,
      alertSlackUserId: 'U0ALEX',
    },
    personaId: 'sarah' as const,
    threadQueue: makeThreadQueue(),
    channelScopeConfig: { workRelevantChannelIds: new Set(['C123']) },
    bankHolidaysCache: makeBankHolidaysCache(),
    ticketStore: { create: vi.fn<HandlerDeps['ticketStore']['create']>() },
    draftStore: {
      create: vi.fn<HandlerDeps['draftStore']['create']>(),
      getByMessage: vi.fn<HandlerDeps['draftStore']['getByMessage']>(),
      updateContent: vi.fn<HandlerDeps['draftStore']['updateContent']>(),
      markPosted: vi.fn<HandlerDeps['draftStore']['markPosted']>(),
      releaseClaim: vi.fn<HandlerDeps['draftStore']['releaseClaim']>(),
    },
    reviewQueueStore: {
      // Resolves rather than being a bare stub — BUILD_PLAN 3.9 gave this path a real
      // review-queue write (the off-hours row), so an unresolved mock now throws inside the
      // function under test instead of harmlessly recording a call that never happens.
      create: vi
        .fn<HandlerDeps['reviewQueueStore']['create']>()
        .mockResolvedValue({
          ok: true,
          entry: {
            id: '7fa85f64-5717-4562-b3fc-2c963f66afa9',
            personaId: 'sarah',
            channelId: 'C123',
            messageTs: '1700000000.000050',
            sourceMessageText:
              'hey, there might be an issue with the CLI on large repos',
            confidence: 55,
            reasoning: 'plausibly describes a bug, but not clearly actionable',
            outcomeReason: 'mid-band-off-hours',
            createdAt: new Date('2026-07-16T21:00:00.000Z'),
          },
        }),
    },
    confirmingQuestionStore: makeConfirmingQuestionStore(),
    ...overrides,
  };
}

const CHANNEL_MESSAGE = {
  channelId: 'C123',
  channelType: 'channel' as const,
  userId: 'U123',
  text: 'hey, there might be an issue with the CLI on large repos',
  ts: '1700000000.000050',
};

const CLASSIFIED = {
  confidence: 55,
  reasoning: 'plausibly describes a bug, but not clearly actionable',
};

describe('composeAndPostConfirmingQuestion', () => {
  it('posts a confirming question in-thread, persists it, and seeds the 👍/👎 legend', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps();

      await composeAndPostConfirmingQuestion(deps, {
        message: CHANNEL_MESSAGE,
        now: new Date(),
        classified: CLASSIFIED,
        surface: 'channel',
      });

      expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          thread_ts: '1700000000.000050',
          text: expect.stringContaining('👍') as string,
        }),
      );
      // Claimed keyed on the *source* message's own ts, before the Slack post ever happens
      // (BUILD_PLAN 5.2b) — no messageTs here at all, since it doesn't exist yet at claim time.
      expect(deps.confirmingQuestionStore.create).toHaveBeenCalledWith({
        personaId: 'sarah',
        channelId: 'C123',
        // Persisted so the 👍 outcome can post its draft the same way this question was posted
        // (BUILD_PLAN 3.7) — threaded here, top-level on a DM.
        sourceSurface: 'channel',
        sourceMessageTs: '1700000000.000050',
        sourceMessageText: CHANNEL_MESSAGE.text,
        confidence: 55,
        reasoning: 'plausibly describes a bug, but not clearly actionable',
      });
      // messageTs filled in on the claimed row only once the real post succeeds.
      expect(deps.confirmingQuestionStore.markPosted).toHaveBeenCalledWith(
        '8fa85f64-5717-4562-b3fc-2c963f66afab',
        '1700000099.000100',
      );
      expect(deps.slackClient.reactions.add).toHaveBeenNthCalledWith(1, {
        channel: 'C123',
        timestamp: '1700000099.000100',
        name: 'thumbsup',
      });
      expect(deps.slackClient.reactions.add).toHaveBeenNthCalledWith(2, {
        channel: 'C123',
        timestamp: '1700000099.000100',
        name: 'thumbsdown',
      });
      expect(deps.logger.info).toHaveBeenCalledWith(
        'posted mid-band confirming question',
        {
          personaId: 'sarah',
          channelId: 'C123',
          questionId: '8fa85f64-5717-4562-b3fc-2c963f66afab',
        },
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('writes a mid-band-cost-cap review-queue row, instead of losing the message, when the cost cap is reached (BUILD_PLAN 3.10)', async () => {
    const deps = makeDeps({
      capStore: makeCapStore({
        getMonthlyCost: vi.fn<CapStore['getMonthlyCost']>().mockResolvedValue({
          ok: true,
          total: {
            personaId: 'sarah',
            month: '2026-07',
            inputTokens: 0,
            outputTokens: 0,
            costUsdMicros: 100_000_000,
          },
        }),
      }),
    });

    await composeAndPostConfirmingQuestion(deps, {
      message: CHANNEL_MESSAGE,
      now: new Date(),
      classified: CLASSIFIED,
      surface: 'channel',
    });

    expect(deps.logger.info).toHaveBeenCalledWith(
      'skipping confirming-question posting — monthly cost cap reached',
      { personaId: 'sarah', channelId: 'C123' },
    );
    // Not "postMessage never called" — a cap this far over threshold also fires the cost-cap
    // alert ladder's own real DM to Alex (chunk 2.6b), a legitimate, unrelated `postMessage` call.
    // The confirming question itself never gets persisted is the precise thing to verify here.
    expect(deps.confirmingQuestionStore.create).not.toHaveBeenCalled();
    // BUILD_PLAN 3.10 closes the scope boundary 3.9 deliberately left open (Alex scoped 3.9 to the
    // rhythm guard only): a cost-cap halt now writes a row too, distinguishably from an off-hours
    // block via its own `outcomeReason`.
    expect(deps.reviewQueueStore.create).toHaveBeenCalledWith({
      personaId: 'sarah',
      channelId: 'C123',
      messageTs: CHANNEL_MESSAGE.ts,
      sourceMessageText: CHANNEL_MESSAGE.text,
      confidence: CLASSIFIED.confidence,
      reasoning: CLASSIFIED.reasoning,
      outcomeReason: 'mid-band-cost-cap',
    });
  });

  // BUILD_PLAN 3.9 — this path had the byte-identical silent loss the High-band path did, and
  // 3.9's own spec never mentioned it (found during that chunk's recon; Alex settled covering both
  // bands). The old test asserted only "did not post", which is exactly the assertion shape that
  // let the loss go unnoticed: it was satisfied by the bug.
  it('writes a mid-band-off-hours review-queue row, instead of losing the message, outside core hours (BUILD_PLAN 3.9)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T21:00:00.000Z'));
    try {
      const deps = makeDeps();

      await composeAndPostConfirmingQuestion(deps, {
        message: CHANNEL_MESSAGE,
        now: new Date(),
        classified: CLASSIFIED,
        surface: 'channel',
      });

      expect(deps.logger.info).toHaveBeenCalledWith(
        'skipping confirming-question posting — outside core hours',
        { personaId: 'sarah', channelId: 'C123', reason: 'outside-window' },
      );
      expect(deps.reviewQueueStore.create).toHaveBeenCalledWith({
        personaId: 'sarah',
        channelId: 'C123',
        messageTs: CHANNEL_MESSAGE.ts,
        sourceMessageText: CHANNEL_MESSAGE.text,
        confidence: CLASSIFIED.confidence,
        reasoning: CLASSIFIED.reasoning,
        // A distinct value from the High band's, not a shared one — the digest groups by reason so
        // "a question was never asked" and "a draft was never composed" stay tellable apart.
        outcomeReason: 'mid-band-off-hours',
      });
      expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
      expect(deps.confirmingQuestionStore.create).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('writes a mid-band-appropriateness-check-failed review-queue row, instead of losing the message, when the situational-appropriateness gate errors (BUILD_PLAN 3.10)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient(() => {
          throw new Error('rate limited');
        }),
      });

      await composeAndPostConfirmingQuestion(deps, {
        message: CHANNEL_MESSAGE,
        now: new Date(),
        classified: CLASSIFIED,
        surface: 'channel',
      });

      expect(deps.logger.error).toHaveBeenCalledWith(
        'failed to evaluate situational appropriateness — skipping confirming-question posting (fail-closed)',
        expect.objectContaining({ errorMessage: 'rate limited' }),
      );
      expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
      // DA's mutation testing at chunk 3.9 showed that writing a row here left the whole suite
      // green — this infra-blip case (distinct from a genuine inappropriate verdict, pinned
      // negatively below) now writes one.
      expect(deps.reviewQueueStore.create).toHaveBeenCalledWith({
        personaId: 'sarah',
        channelId: 'C123',
        messageTs: CHANNEL_MESSAGE.ts,
        sourceMessageText: CHANNEL_MESSAGE.text,
        confidence: CLASSIFIED.confidence,
        reasoning: CLASSIFIED.reasoning,
        outcomeReason: 'mid-band-appropriateness-check-failed',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips posting when the situational-appropriateness gate says inappropriate', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          appropriate: false,
          reasoning: 'describes a round of layoffs',
        }),
      });

      await composeAndPostConfirmingQuestion(deps, {
        message: CHANNEL_MESSAGE,
        now: new Date(),
        classified: CLASSIFIED,
        surface: 'channel',
      });

      expect(deps.logger.info).toHaveBeenCalledWith(
        'skipping confirming-question posting — situationally inappropriate',
        {
          personaId: 'sarah',
          channelId: 'C123',
          reasoning: 'describes a round of layoffs',
        },
      );
      expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
      // BUILD_PLAN 3.10's own scope boundary, pinned: a genuine `appropriate: false` verdict is a
      // considered decision, not silent data loss, and stays silent — unlike the gate's OTHER
      // `return false` branch (an infrastructure blip), which now writes a row (see the
      // fail-closed test above).
      expect(deps.reviewQueueStore.create).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs an error, without throwing, when posting the confirming question to Slack fails — the claim already made is released, not left orphaned (DA review, BUILD_PLAN 5.2b)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        slackClient: makeSlackClient({ ok: false, error: 'channel_not_found' }),
      });

      await expect(
        composeAndPostConfirmingQuestion(deps as never, {
          message: CHANNEL_MESSAGE,
          now: new Date(),
          classified: CLASSIFIED,
          surface: 'channel',
        }),
      ).resolves.toBeUndefined();

      expect(deps.logger.error).toHaveBeenCalledWith(
        'failed to post confirming question',
        { errorMessage: 'channel_not_found' },
      );
      expect(deps.confirmingQuestionStore.create).toHaveBeenCalled();
      expect(deps.confirmingQuestionStore.markPosted).not.toHaveBeenCalled();
      expect(deps.confirmingQuestionStore.releaseClaim).toHaveBeenCalledWith(
        '8fa85f64-5717-4562-b3fc-2c963f66afab',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs an error, without throwing, when releasing the claim itself fails after a Slack-post failure (BUILD_PLAN 5.2b)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        slackClient: makeSlackClient({ ok: false, error: 'channel_not_found' }),
        confirmingQuestionStore: makeConfirmingQuestionStore({
          releaseClaim: vi
            .fn<ConfirmingQuestionStore['releaseClaim']>()
            .mockResolvedValue({
              ok: false,
              error: { cause: new Error('connection reset') },
            }),
        }),
      });

      await expect(
        composeAndPostConfirmingQuestion(deps as never, {
          message: CHANNEL_MESSAGE,
          now: new Date(),
          classified: CLASSIFIED,
          surface: 'channel',
        }),
      ).resolves.toBeUndefined();

      expect(deps.logger.error).toHaveBeenCalledWith(
        'failed to release pending confirming question claim',
        { errorMessage: 'Error: connection reset' },
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs an error, without throwing, when claiming the pending confirming question fails — before ever posting to Slack (BUILD_PLAN 5.2b)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        confirmingQuestionStore: makeConfirmingQuestionStore({
          create: vi.fn<ConfirmingQuestionStore['create']>().mockResolvedValue({
            ok: false,
            error: { kind: 'unknown', cause: new Error('connection reset') },
          }),
        }),
      });

      await expect(
        composeAndPostConfirmingQuestion(deps as never, {
          message: CHANNEL_MESSAGE,
          now: new Date(),
          classified: CLASSIFIED,
          surface: 'channel',
        }),
      ).resolves.toBeUndefined();

      expect(deps.logger.error).toHaveBeenCalledWith(
        'failed to claim pending confirming question',
        { errorMessage: 'Error: connection reset' },
      );
      expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
      expect(deps.slackClient.reactions.add).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs an error, without throwing, when marking the claimed question posted fails after a successful Slack post (BUILD_PLAN 5.2b)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        confirmingQuestionStore: makeConfirmingQuestionStore({
          markPosted: vi
            .fn<ConfirmingQuestionStore['markPosted']>()
            .mockResolvedValue({ ok: false, error: { kind: 'unavailable' } }),
        }),
      });

      await expect(
        composeAndPostConfirmingQuestion(deps as never, {
          message: CHANNEL_MESSAGE,
          now: new Date(),
          classified: CLASSIFIED,
          surface: 'channel',
        }),
      ).resolves.toBeUndefined();

      expect(deps.logger.error).toHaveBeenCalledWith(
        'failed to mark pending confirming question posted',
        {
          errorMessage:
            'question was already marked posted, or no longer exists',
        },
      );
      expect(deps.slackClient.reactions.add).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs an error for a reaction that fails to add, but still attempts the remaining legend reaction', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        slackClient: makeSlackClient({ ok: true }, [
          { ok: false, error: 'already_reacted' },
        ]),
      });

      await composeAndPostConfirmingQuestion(deps, {
        message: CHANNEL_MESSAGE,
        now: new Date(),
        classified: CLASSIFIED,
        surface: 'channel',
      });

      expect(deps.logger.error).toHaveBeenCalledWith(
        'failed to add confirming-question legend reaction',
        expect.objectContaining({ reactionName: 'thumbsup' }),
      );
      expect(deps.slackClient.reactions.add).toHaveBeenCalledTimes(2);
      expect(deps.logger.info).toHaveBeenCalledWith(
        'posted mid-band confirming question',
        expect.anything(),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
