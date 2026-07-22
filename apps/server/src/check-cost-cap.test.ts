import type { CapStore } from './check-cost-cap.js';

import { describe, expect, it, vi } from 'vitest';

import { checkCostCapAndAlert } from './check-cost-cap.js';

// `reactions.add` is part of `CostCapDeps['slackClient']`'s full type (`PostMessageClient &
// AddReactionClient`, same field `handle-inbound-message.ts`'s `HandlerDeps` uses) even though
// `check-cost-cap.ts` itself only ever calls `postMessage` — stubbed, never asserted on here.
function makeSlackClient(response: {
  readonly ok: boolean;
  readonly error?: string;
  readonly ts?: string;
}) {
  return {
    chat: {
      postMessage: vi.fn().mockResolvedValue({
        ts: response.ok ? '1700000000.000100' : undefined,
        ...response,
      }),
    },
    reactions: { add: vi.fn().mockResolvedValue({ ok: true }) },
  };
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeCapStore(
  overrides: Partial<{
    readonly getMonthlyCost: CapStore['getMonthlyCost'];
    readonly getAlertState: CapStore['getAlertState'];
    readonly claimAlertThreshold: CapStore['claimAlertThreshold'];
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
          highestThresholdAlerted: 50,
          updatedAt: new Date('2026-07-17T09:00:00.000Z'),
        },
      }),
    ...overrides,
  };
}

function makeDeps(
  overrides: Partial<{
    readonly capStore: CapStore;
    readonly slackClient: ReturnType<typeof makeSlackClient>;
    readonly logger: ReturnType<typeof makeLogger>;
  }> = {},
) {
  return {
    capStore: makeCapStore(),
    costCapConfig: {
      monthlyCapUsdMicros: 100_000_000,
      alertSlackUserId: 'U0ALEX',
    },
    personaId: 'sarah' as const,
    slackClient: makeSlackClient({ ok: true }),
    logger: makeLogger(),
    ...overrides,
  };
}

const NOW = new Date('2026-07-17T09:00:00.000Z');

describe('checkCostCapAndAlert', () => {
  it('halts nothing and sends no alert when spend is under every threshold', async () => {
    const deps = makeDeps();

    const result = await checkCostCapAndAlert(deps, NOW);

    expect(result).toEqual({ halt: false });
    expect(deps.capStore.claimAlertThreshold).not.toHaveBeenCalled();
    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
    expect(deps.logger.error).not.toHaveBeenCalled();
  });

  it('fails open and logs when the monthly cost total read fails', async () => {
    const deps = makeDeps({
      capStore: makeCapStore({
        getMonthlyCost: vi.fn<CapStore['getMonthlyCost']>().mockResolvedValue({
          ok: false,
          error: { kind: 'unknown', cause: new Error('db down') },
        }),
      }),
    });

    const result = await checkCostCapAndAlert(deps, NOW);

    expect(result).toEqual({ halt: false });
    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to fetch monthly cost total',
      { errorMessage: 'Error: db down' },
    );
  });

  it('fails open and logs when the alert state read fails', async () => {
    const deps = makeDeps({
      capStore: makeCapStore({
        getAlertState: vi.fn<CapStore['getAlertState']>().mockResolvedValue({
          ok: false,
          error: { kind: 'unknown', cause: new Error('db down') },
        }),
      }),
    });

    const result = await checkCostCapAndAlert(deps, NOW);

    expect(result).toEqual({ halt: false });
    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to fetch cost alert state',
      { errorMessage: 'Error: db down' },
    );
  });

  it('claims and posts a DM alert for a newly-crossed threshold', async () => {
    const deps = makeDeps({
      capStore: makeCapStore({
        getMonthlyCost: vi.fn<CapStore['getMonthlyCost']>().mockResolvedValue({
          ok: true,
          total: {
            personaId: 'sarah',
            month: '2026-07',
            inputTokens: 0,
            outputTokens: 0,
            costUsdMicros: 60_000_000,
          },
        }),
      }),
    });

    const result = await checkCostCapAndAlert(deps, NOW);

    expect(result).toEqual({ halt: false });
    expect(deps.capStore.claimAlertThreshold).toHaveBeenCalledWith({
      personaId: 'sarah',
      month: '2026-07',
      threshold: 50,
    });
    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith({
      channel: 'U0ALEX',
      text: 'sarah has crossed 50% of its monthly cost cap: $60.00 of $100.00 spent this month.',
    });
    expect(deps.logger.error).not.toHaveBeenCalled();
  });

  it('logs when the claim wins but the Slack DM post itself fails', async () => {
    const deps = makeDeps({
      capStore: makeCapStore({
        getMonthlyCost: vi.fn<CapStore['getMonthlyCost']>().mockResolvedValue({
          ok: true,
          total: {
            personaId: 'sarah',
            month: '2026-07',
            inputTokens: 0,
            outputTokens: 0,
            costUsdMicros: 60_000_000,
          },
        }),
      }),
      slackClient: makeSlackClient({ ok: false, error: 'channel_not_found' }),
    });

    await checkCostCapAndAlert(deps, NOW);

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to post cost cap alert',
      {
        errorMessage: 'channel_not_found',
      },
    );
  });

  it('logs when the threshold claim fails for a reason other than losing the race', async () => {
    const deps = makeDeps({
      capStore: makeCapStore({
        getMonthlyCost: vi.fn<CapStore['getMonthlyCost']>().mockResolvedValue({
          ok: true,
          total: {
            personaId: 'sarah',
            month: '2026-07',
            inputTokens: 0,
            outputTokens: 0,
            costUsdMicros: 60_000_000,
          },
        }),
        claimAlertThreshold: vi
          .fn<CapStore['claimAlertThreshold']>()
          .mockResolvedValue({
            ok: false,
            error: { kind: 'unknown', cause: new Error('db down') },
          }),
      }),
    });

    await checkCostCapAndAlert(deps, NOW);

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to record cost alert threshold',
      { errorMessage: 'Error: db down' },
    );
    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
  });

  it('stays quiet — no log, no post — when the claim legitimately loses the race', async () => {
    const deps = makeDeps({
      capStore: makeCapStore({
        getMonthlyCost: vi.fn<CapStore['getMonthlyCost']>().mockResolvedValue({
          ok: true,
          total: {
            personaId: 'sarah',
            month: '2026-07',
            inputTokens: 0,
            outputTokens: 0,
            costUsdMicros: 60_000_000,
          },
        }),
        claimAlertThreshold: vi
          .fn<CapStore['claimAlertThreshold']>()
          .mockResolvedValue({ ok: false, error: { kind: 'unavailable' } }),
      }),
    });

    await checkCostCapAndAlert(deps, NOW);

    expect(deps.logger.error).not.toHaveBeenCalled();
    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
  });

  it('claims every newly-crossed threshold in ascending order and halts at 100%', async () => {
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

    const result = await checkCostCapAndAlert(deps, NOW);

    expect(result).toEqual({ halt: true });
    expect(deps.capStore.claimAlertThreshold).toHaveBeenNthCalledWith(1, {
      personaId: 'sarah',
      month: '2026-07',
      threshold: 50,
    });
    expect(deps.capStore.claimAlertThreshold).toHaveBeenNthCalledWith(2, {
      personaId: 'sarah',
      month: '2026-07',
      threshold: 80,
    });
    expect(deps.capStore.claimAlertThreshold).toHaveBeenNthCalledWith(3, {
      personaId: 'sarah',
      month: '2026-07',
      threshold: 100,
    });
  });

  it('only reports thresholds above the already-alerted watermark', async () => {
    const deps = makeDeps({
      capStore: makeCapStore({
        getMonthlyCost: vi.fn<CapStore['getMonthlyCost']>().mockResolvedValue({
          ok: true,
          total: {
            personaId: 'sarah',
            month: '2026-07',
            inputTokens: 0,
            outputTokens: 0,
            costUsdMicros: 90_000_000,
          },
        }),
        getAlertState: vi.fn<CapStore['getAlertState']>().mockResolvedValue({
          ok: true,
          alert: {
            personaId: 'sarah',
            month: '2026-07',
            highestThresholdAlerted: 50,
            updatedAt: NOW,
          },
        }),
      }),
    });

    await checkCostCapAndAlert(deps, NOW);

    expect(deps.capStore.claimAlertThreshold).toHaveBeenCalledTimes(1);
    expect(deps.capStore.claimAlertThreshold).toHaveBeenCalledWith({
      personaId: 'sarah',
      month: '2026-07',
      threshold: 80,
    });
  });
});
