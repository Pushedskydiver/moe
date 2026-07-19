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
  return {
    create: vi.fn<ConfirmingQuestionStore['create']>().mockResolvedValue({
      ok: true,
      question: {
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
        createdAt: new Date('2026-07-16T09:00:00.000Z'),
      },
    }),
    getByMessage: vi.fn<ConfirmingQuestionStore['getByMessage']>(),
    resolve: vi.fn<ConfirmingQuestionStore['resolve']>(),
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
    },
    reviewQueueStore: {
      create: vi.fn<HandlerDeps['reviewQueueStore']['create']>(),
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
      });

      expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          thread_ts: '1700000000.000050',
          text: expect.stringContaining('👍') as string,
        }),
      );
      expect(deps.confirmingQuestionStore.create).toHaveBeenCalledWith({
        personaId: 'sarah',
        channelId: 'C123',
        messageTs: '1700000099.000100',
        sourceMessageTs: '1700000000.000050',
        sourceMessageText: CHANNEL_MESSAGE.text,
        confidence: 55,
        reasoning: 'plausibly describes a bug, but not clearly actionable',
      });
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

  it('defers, without posting, when the cost cap is reached', async () => {
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
    });

    expect(deps.logger.info).toHaveBeenCalledWith(
      'skipping confirming-question posting — monthly cost cap reached',
      { personaId: 'sarah', channelId: 'C123' },
    );
    // Not "postMessage never called" — a cap this far over threshold also fires the cost-cap
    // alert ladder's own real DM to Alex (chunk 2.6b), a legitimate, unrelated `postMessage` call.
    // The confirming question itself never gets persisted is the precise thing to verify here.
    expect(deps.confirmingQuestionStore.create).not.toHaveBeenCalled();
  });

  it('defers, without posting, outside core hours', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T21:00:00.000Z'));
    try {
      const deps = makeDeps();

      await composeAndPostConfirmingQuestion(deps, {
        message: CHANNEL_MESSAGE,
        now: new Date(),
        classified: CLASSIFIED,
      });

      expect(deps.logger.info).toHaveBeenCalledWith(
        'deferring confirming-question posting — outside core hours',
        { personaId: 'sarah', channelId: 'C123', reason: 'outside-window' },
      );
      expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails closed — skips posting — when the situational-appropriateness gate errors', async () => {
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
      });

      expect(deps.logger.error).toHaveBeenCalledWith(
        'failed to evaluate situational appropriateness — deferring confirming-question posting (fail-closed)',
        expect.objectContaining({ message: 'rate limited' }),
      );
      expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
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
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs an error, without throwing, when posting the confirming question to Slack fails', async () => {
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
        }),
      ).resolves.toBeUndefined();

      expect(deps.logger.error).toHaveBeenCalledWith(
        'failed to post confirming question',
        { message: 'channel_not_found' },
      );
      expect(deps.confirmingQuestionStore.create).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs an error, without throwing, when persisting the pending confirming question fails after a successful post', async () => {
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
        }),
      ).resolves.toBeUndefined();

      expect(deps.logger.error).toHaveBeenCalledWith(
        'failed to persist pending confirming question',
        { message: 'Error: connection reset' },
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
