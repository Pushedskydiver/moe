import type { HandlerDeps } from './handle-inbound-message.js';

import { describe, expect, it, vi } from 'vitest';

import { createBankHolidaysCache } from '@moe/core';

import {
  isCostAndRhythmGuardSatisfied,
  isSituationallyAppropriate,
} from './standing-proactive-guards.js';

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

type MakeDepsOverrides = Partial<{
  readonly getMonthlyCost: HandlerDeps['capStore']['getMonthlyCost'];
  readonly bankHolidaysCache: HandlerDeps['bankHolidaysCache'];
  readonly parse: (...args: readonly unknown[]) => unknown;
}>;

function makeDeps(overrides: MakeDepsOverrides = {}) {
  return {
    anthropicClient: {
      messages: {
        create: vi.fn(),
        parse:
          overrides.parse ??
          vi.fn().mockResolvedValue({
            parsed_output: { appropriate: true, reasoning: 'fine' },
            usage: { input_tokens: 20, output_tokens: 8 },
          }),
      },
    },
    logger: { info: vi.fn(), error: vi.fn() },
    costStore: {
      recordUsage: vi.fn().mockResolvedValue({
        ok: true,
        usage: {
          personaId: 'sarah',
          day: '2026-07-19',
          inputTokens: 20,
          outputTokens: 8,
          costUsdMicros: 60,
          updatedAt: new Date('2026-07-19T09:00:00.000Z'),
        },
      }),
    },
    capStore: {
      getMonthlyCost:
        overrides.getMonthlyCost ??
        vi.fn().mockResolvedValue({
          ok: true,
          total: {
            personaId: 'sarah',
            month: '2026-07',
            inputTokens: 0,
            outputTokens: 0,
            costUsdMicros: 0,
          },
        }),
      getAlertState: vi.fn().mockResolvedValue({ ok: true, alert: null }),
      claimAlertThreshold: vi.fn().mockResolvedValue({
        ok: true,
        alert: {
          personaId: 'sarah',
          month: '2026-07',
          highestThresholdAlerted: 100,
          updatedAt: new Date('2026-07-19T09:00:00.000Z'),
        },
      }),
    },
    costCapConfig: {
      monthlyCapUsdMicros: 100_000_000,
      alertSlackUserId: 'U0ALEX',
    },
    personaId: 'sarah' as const,
    bankHolidaysCache: overrides.bankHolidaysCache ?? makeBankHolidaysCache(),
  };
}

const MESSAGE = {
  channelId: 'C123',
  channelType: 'channel' as const,
  userId: 'U123',
  text: 'hello',
  ts: '1700000000.000100',
};

describe('isCostAndRhythmGuardSatisfied', () => {
  it('returns true when within core hours and under the cost cap', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps();

      const result = await isCostAndRhythmGuardSatisfied(deps as never, {
        message: MESSAGE,
        now: new Date(),
        actionDescription: 'confirming-question posting',
      });

      expect(result).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns false and logs with the given action description when the cost cap is reached', async () => {
    const deps = makeDeps({
      getMonthlyCost: vi.fn().mockResolvedValue({
        ok: true,
        total: {
          personaId: 'sarah',
          month: '2026-07',
          inputTokens: 0,
          outputTokens: 0,
          costUsdMicros: 100_000_000,
        },
      }),
    });

    const result = await isCostAndRhythmGuardSatisfied(deps as never, {
      message: MESSAGE,
      now: new Date(),
      actionDescription: 'confirming-question posting',
    });

    expect(result).toBe(false);
    expect(deps.logger.info).toHaveBeenCalledWith(
      'skipping confirming-question posting — monthly cost cap reached',
      { personaId: 'sarah', channelId: 'C123' },
    );
  });

  it('returns false and logs with the given action description outside core hours', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T21:00:00.000Z'));
    try {
      const deps = makeDeps();

      const result = await isCostAndRhythmGuardSatisfied(deps as never, {
        message: MESSAGE,
        now: new Date(),
        actionDescription: 'confirming-question posting',
      });

      expect(result).toBe(false);
      expect(deps.logger.info).toHaveBeenCalledWith(
        'deferring confirming-question posting — outside core hours',
        { personaId: 'sarah', channelId: 'C123', reason: 'outside-window' },
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('isSituationallyAppropriate', () => {
  it('returns true and records usage when the gate says appropriate', async () => {
    const deps = makeDeps();

    const result = await isSituationallyAppropriate(deps as never, {
      message: MESSAGE,
      now: new Date(),
      actionDescription: 'confirming-question posting',
    });

    expect(result).toBe(true);
    expect(deps.costStore.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ costUsdMicros: 60 }),
    );
  });

  it('returns false and logs with the given action description when the gate says inappropriate', async () => {
    const deps = makeDeps({
      parse: vi.fn().mockResolvedValue({
        parsed_output: {
          appropriate: false,
          reasoning: 'describes a round of layoffs',
        },
        usage: { input_tokens: 20, output_tokens: 8 },
      }),
    });

    const result = await isSituationallyAppropriate(deps as never, {
      message: MESSAGE,
      now: new Date(),
      actionDescription: 'confirming-question posting',
    });

    expect(result).toBe(false);
    expect(deps.logger.info).toHaveBeenCalledWith(
      'skipping confirming-question posting — situationally inappropriate',
      {
        personaId: 'sarah',
        channelId: 'C123',
        reasoning: 'describes a round of layoffs',
      },
    );
  });

  it('fails closed and logs with the given action description when the gate call errors', async () => {
    const deps = makeDeps({
      parse: vi.fn().mockRejectedValue(new Error('rate limited')),
    });

    const result = await isSituationallyAppropriate(deps as never, {
      message: MESSAGE,
      now: new Date(),
      actionDescription: 'confirming-question posting',
    });

    expect(result).toBe(false);
    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to evaluate situational appropriateness — deferring confirming-question posting (fail-closed)',
      { personaId: 'sarah', channelId: 'C123', message: 'rate limited' },
    );
    expect(deps.costStore.recordUsage).not.toHaveBeenCalled();
  });
});
