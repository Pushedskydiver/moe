import type { HandlerDeps } from './handle-inbound-message.js';

import { describe, expect, it, vi } from 'vitest';

import { classifyMessageForIntake } from './classify-message-for-intake.js';

type CapStore = HandlerDeps['capStore'];
type CostStore = HandlerDeps['costStore'];

function makeCapStore(overrides: Partial<CapStore> = {}): CapStore {
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
          highestThresholdAlerted: 50,
          updatedAt: new Date('2026-07-17T09:00:00.000Z'),
        },
      }),
    ...overrides,
  };
}

function makeCostStore(overrides: Partial<CostStore> = {}): CostStore {
  return {
    recordUsage: vi.fn<CostStore['recordUsage']>().mockResolvedValue({
      ok: true,
      usage: {
        personaId: 'sarah',
        day: '2026-07-17',
        inputTokens: 40,
        outputTokens: 12,
        costUsdMicros: 100,
        updatedAt: new Date('2026-07-17T09:00:00.000Z'),
      },
    }),
    ...overrides,
  };
}

function makeDeps(
  overrides: {
    readonly parseImpl?: unknown;
    readonly capStore?: CapStore;
    readonly costStore?: CostStore;
  } = {},
) {
  const parse = vi.fn();
  if (typeof overrides.parseImpl === 'function') {
    parse.mockImplementation(overrides.parseImpl as () => never);
  } else {
    parse.mockResolvedValue({
      parsed_output: { confidence: 72, reasoning: 'describes a concrete bug' },
      usage: { input_tokens: 40, output_tokens: 12 },
    });
  }

  return {
    anthropicClient: { messages: { create: vi.fn(), parse } },
    slackClient: {
      chat: { postMessage: vi.fn().mockResolvedValue({ ok: true, ts: '1.1' }) },
      reactions: { add: vi.fn().mockResolvedValue({ ok: true }) },
    },
    logger: { info: vi.fn(), error: vi.fn() },
    historyStore: {
      getRecentTurns: vi.fn<HandlerDeps['historyStore']['getRecentTurns']>(),
      appendTurn: vi.fn<HandlerDeps['historyStore']['appendTurn']>(),
    },
    costStore: overrides.costStore ?? makeCostStore(),
    capStore: overrides.capStore ?? makeCapStore(),
    costCapConfig: {
      monthlyCapUsdMicros: 100_000_000,
      alertSlackUserId: 'U0ALEX',
    },
    personaId: 'sarah' as const,
    threadQueue: { run: vi.fn() },
    channelScopeConfig: { workRelevantChannelIds: new Set(['C123']) },
    bankHolidaysCache: {} as HandlerDeps['bankHolidaysCache'],
    ticketStore: { create: vi.fn() },
    draftStore: {
      create: vi.fn(),
      getByMessage: vi.fn(),
      updateContent: vi.fn(),
    },
    reviewQueueStore: { create: vi.fn() },
    confirmingQuestionStore: {
      create: vi.fn(),
      getByMessage: vi.fn(),
      resolve: vi.fn(),
    },
  };
}

const MESSAGE = {
  channelId: 'D123',
  channelType: 'im' as const,
  userId: 'U123',
  text: 'the CLI hangs on large repos',
  ts: '1700000000.000050',
};

const NOW = new Date('2026-07-17T09:00:00.000Z');

describe('classifyMessageForIntake', () => {
  it("returns the classifier's score and reasoning on success", async () => {
    const deps = makeDeps();

    const result = await classifyMessageForIntake(deps, MESSAGE, NOW);

    expect(result).toEqual(
      expect.objectContaining({
        confidence: 72,
        reasoning: 'describes a concrete bug',
      }),
    );
  });

  it("records the call's usage at Haiku pricing — a billed call must never ship unaccounted for (DA, chunk 3.3)", async () => {
    const deps = makeDeps();

    await classifyMessageForIntake(deps, MESSAGE, NOW);

    // 40 input + 12 output at Haiku 4.5's 1/5 micro-USD per token: 40 + 60 = 100.
    expect(deps.costStore.recordUsage).toHaveBeenCalledWith({
      personaId: 'sarah',
      day: '2026-07-17',
      inputTokens: 40,
      outputTokens: 12,
      costUsdMicros: 100,
    });
  });

  it('returns undefined, without calling the classifier at all, once the monthly cost cap is reached', async () => {
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

    const result = await classifyMessageForIntake(deps, MESSAGE, NOW);

    expect(result).toBeUndefined();
    expect(deps.anthropicClient.messages.parse).not.toHaveBeenCalled();
    expect(deps.logger.info).toHaveBeenCalledWith(
      'skipping classification — monthly cost cap reached',
      { personaId: 'sarah', channelId: 'D123' },
    );
  });

  it('returns undefined and logs, without recording usage, when the classifier call fails', async () => {
    const deps = makeDeps({
      parseImpl: () => {
        throw new Error('rate limited');
      },
    });

    const result = await classifyMessageForIntake(deps, MESSAGE, NOW);

    expect(result).toBeUndefined();
    expect(deps.costStore.recordUsage).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to classify inbound message',
      { errorMessage: 'rate limited' },
    );
  });

  it('never throws — both failure modes surface as undefined, which is what lets the DM caller fall through to its reply', async () => {
    // The property BUILD_PLAN 3.7's invariant depends on: this function returning rather than
    // throwing is what keeps a classifier failure from becoming a silent DM.
    const deps = makeDeps({
      parseImpl: () => {
        throw new Error('boom');
      },
    });

    await expect(
      classifyMessageForIntake(deps, MESSAGE, NOW),
    ).resolves.toBeUndefined();
  });
});
