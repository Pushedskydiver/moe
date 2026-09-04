import type { CapStore } from './check-cost-cap.js';
import type { PlanStageDeps } from './handle-plan-stage-ticket.js';
import type { Ticket } from '@moe/core';

import { describe, expect, it, vi } from 'vitest';

import { TEAM_CHANNEL_ID } from '@moe/core';

import {
  createPlanStageNeedsWorkCheck,
  handlePlanStageTicket,
} from './handle-plan-stage-ticket.js';

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    projectKey: 'chief-clancy',
    title: 'webhook delivery retries indefinitely',
    status: 'Plan',
    severity: 'Medium',
    classOfService: 'Standard',
    createdAt: new Date('2026-09-04T09:00:00.000Z'),
    updatedAt: new Date('2026-09-04T09:00:00.000Z'),
    ...overrides,
  };
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeSlackClient(
  overrides: Partial<{
    readonly postMessage: ReturnType<typeof vi.fn>;
  }> = {},
) {
  return {
    chat: {
      postMessage:
        overrides.postMessage ??
        vi.fn().mockResolvedValue({ ok: true, ts: '1700000000.000300' }),
    },
    reactions: { add: vi.fn().mockResolvedValue({ ok: true }) },
  };
}

function makeAnthropicClient(
  parsedOutput:
    | {
        readonly approach: string;
        readonly confidence: string;
        readonly alternativesConsidered: readonly string[];
        readonly openQuestions: readonly string[];
      }
    | (() => never) = {
    approach: 'Add a bounded retry count with a sane default.',
    confidence: 'High',
    alternativesConsidered: ['Exponential backoff'],
    openQuestions: ['What happens after retries are exhausted?'],
  },
) {
  return {
    messages: {
      parse:
        typeof parsedOutput === 'function'
          ? vi.fn(parsedOutput)
          : vi.fn().mockResolvedValue({
              parsed_output: parsedOutput,
              usage: { input_tokens: 30, output_tokens: 120 },
            }),
    },
  };
}

function makeCapStore(
  overrides: Partial<{
    readonly getMonthlyCost: CapStore['getMonthlyCost'];
    readonly getAlertState: CapStore['getAlertState'];
  }> = {},
): CapStore {
  return {
    getMonthlyCost:
      overrides.getMonthlyCost ??
      vi.fn<CapStore['getMonthlyCost']>().mockResolvedValue({
        ok: true,
        total: {
          personaId: 'marcus',
          month: '2026-09',
          inputTokens: 0,
          outputTokens: 0,
          costUsdMicros: 0,
        },
      }),
    getAlertState:
      overrides.getAlertState ??
      vi.fn<CapStore['getAlertState']>().mockResolvedValue({
        ok: true,
        alert: null,
      }),
    claimAlertThreshold: vi
      .fn<CapStore['claimAlertThreshold']>()
      .mockResolvedValue({
        ok: true,
        alert: {
          personaId: 'marcus',
          month: '2026-09',
          highestThresholdAlerted: 50,
          updatedAt: new Date('2026-09-03T09:00:00.000Z'),
        },
      }),
  };
}

const DEFAULT_BRIEF = {
  ticketId: '00000000-0000-0000-0000-000000000001',
  channelId: TEAM_CHANNEL_ID,
  messageTs: '1700000000.000100',
  summary: 'Fix unbounded webhook retries.',
  scope: ['Add a maximum retry count'],
  createdAt: new Date('2026-09-03T09:00:00.000Z'),
};

function makeDeps(
  overrides: Partial<{
    readonly planStore: PlanStageDeps['planStore'];
    readonly briefStore: PlanStageDeps['briefStore'];
    readonly anthropicClient: ReturnType<typeof makeAnthropicClient>;
    readonly slackClient: ReturnType<typeof makeSlackClient>;
    readonly capStore: CapStore;
  }> = {},
) {
  return {
    personaId: 'marcus',
    logger: makeLogger(),
    anthropicClient: overrides.anthropicClient ?? makeAnthropicClient(),
    slackClient: overrides.slackClient ?? makeSlackClient(),
    costStore: {
      recordUsage: vi.fn().mockResolvedValue({
        ok: true,
        usage: {
          personaId: 'marcus',
          day: '2026-09-04',
          inputTokens: 30,
          outputTokens: 120,
          costUsdMicros: 900,
          updatedAt: new Date('2026-09-04T09:00:00.000Z'),
        },
      }),
    },
    capStore: overrides.capStore ?? makeCapStore(),
    costCapConfig: {
      monthlyCapUsdMicros: 100_000_000,
      alertSlackUserId: 'U0ALEX',
    },
    planStore: overrides.planStore ?? {
      getByTicket: vi.fn().mockResolvedValue({ ok: true, plan: null }),
      create: vi.fn().mockResolvedValue({
        ok: true,
        plan: {
          ticketId: '00000000-0000-0000-0000-000000000001',
          channelId: TEAM_CHANNEL_ID,
          messageTs: '1700000000.000300',
          createdAt: new Date('2026-09-04T09:00:00.000Z'),
        },
      }),
    },
    briefStore: overrides.briefStore ?? {
      getByTicket: vi
        .fn()
        .mockResolvedValue({ ok: true, brief: DEFAULT_BRIEF }),
    },
  };
}

describe('handlePlanStageTicket', () => {
  it('skips a ticket that already has a plan, without any brief lookup, LLM call, cost-cap check, or Slack post', async () => {
    const getByTicket = vi.fn().mockResolvedValue({
      ok: true,
      plan: {
        ticketId: '00000000-0000-0000-0000-000000000001',
        channelId: TEAM_CHANNEL_ID,
        messageTs: '1700000000.000100',
        createdAt: new Date('2026-09-03T09:00:00.000Z'),
      },
    });
    const briefStore = { getByTicket: vi.fn() };
    const capStore = makeCapStore();
    const deps = makeDeps({
      planStore: { getByTicket, create: vi.fn() },
      briefStore,
      capStore,
    });

    await handlePlanStageTicket(deps as never, makeTicket());

    expect(getByTicket).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
    );
    expect(briefStore.getByTicket).not.toHaveBeenCalled();
    expect(capStore.getMonthlyCost).not.toHaveBeenCalled();
    expect(deps.anthropicClient.messages.parse).not.toHaveBeenCalled();
    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
    expect(deps.planStore.create).not.toHaveBeenCalled();
  });

  it('skips a ticket with no persisted brief yet, without any cost-cap check or LLM call (brief resolution runs before the cost-cap check)', async () => {
    const briefStore = {
      getByTicket: vi.fn().mockResolvedValue({ ok: true, brief: null }),
    };
    const capStore = makeCapStore();
    const deps = makeDeps({ briefStore, capStore });

    await handlePlanStageTicket(deps as never, makeTicket());

    expect(capStore.getMonthlyCost).not.toHaveBeenCalled();
    expect(deps.anthropicClient.messages.parse).not.toHaveBeenCalled();
    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalled();
  });

  it('skips a ticket whose persisted brief has an empty summary (a legacy pre-migration row), without any cost-cap check or LLM call', async () => {
    const briefStore = {
      getByTicket: vi.fn().mockResolvedValue({
        ok: true,
        brief: { ...DEFAULT_BRIEF, summary: '', scope: [] },
      }),
    };
    const capStore = makeCapStore();
    const deps = makeDeps({ briefStore, capStore });

    await handlePlanStageTicket(deps as never, makeTicket());

    expect(capStore.getMonthlyCost).not.toHaveBeenCalled();
    expect(deps.anthropicClient.messages.parse).not.toHaveBeenCalled();
  });

  it('skips a ticket when the brief lookup itself fails, without any cost-cap check or LLM call', async () => {
    const briefStore = {
      getByTicket: vi.fn().mockResolvedValue({
        ok: false,
        error: { kind: 'unknown', cause: new Error('db down') },
      }),
    };
    const capStore = makeCapStore();
    const deps = makeDeps({ briefStore, capStore });

    await handlePlanStageTicket(deps as never, makeTicket());

    expect(capStore.getMonthlyCost).not.toHaveBeenCalled();
    expect(deps.anthropicClient.messages.parse).not.toHaveBeenCalled();
  });

  it('skips a ticket when the cost cap is halted, without any LLM call or plan post', async () => {
    const capStore = makeCapStore({
      getMonthlyCost: vi.fn<CapStore['getMonthlyCost']>().mockResolvedValue({
        ok: true,
        total: {
          personaId: 'marcus',
          month: '2026-09',
          inputTokens: 0,
          outputTokens: 0,
          costUsdMicros: 200_000_000,
        },
      }),
      getAlertState: vi.fn<CapStore['getAlertState']>().mockResolvedValue({
        ok: true,
        alert: {
          personaId: 'marcus',
          month: '2026-09',
          highestThresholdAlerted: 100,
          updatedAt: new Date('2026-09-03T09:00:00.000Z'),
        },
      }),
    });
    const deps = makeDeps({ capStore });

    await handlePlanStageTicket(deps as never, makeTicket());

    expect(deps.anthropicClient.messages.parse).not.toHaveBeenCalled();
    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
    expect(deps.planStore.create).not.toHaveBeenCalled();
  });

  it('composes a plan grounded in the brief summary/scope', async () => {
    const deps = makeDeps();

    await handlePlanStageTicket(deps as never, makeTicket());

    const call = deps.anthropicClient.messages.parse.mock.calls[0]?.[0] as {
      messages: ReadonlyArray<{ readonly content: string }>;
    };
    expect(call.messages[0]?.content).toContain(
      'Fix unbounded webhook retries.',
    );
    expect(call.messages[0]?.content).toContain('Add a maximum retry count');
    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledTimes(1);
  });

  it('persists the plan pointer with the real posted message ts on a successful post', async () => {
    const create = vi.fn().mockResolvedValue({
      ok: true,
      plan: {
        ticketId: '00000000-0000-0000-0000-000000000001',
        channelId: TEAM_CHANNEL_ID,
        messageTs: '1700000000.000300',
        createdAt: new Date('2026-09-04T09:00:00.000Z'),
      },
    });
    const deps = makeDeps({
      planStore: {
        getByTicket: vi.fn().mockResolvedValue({ ok: true, plan: null }),
        create,
      },
      slackClient: makeSlackClient({
        postMessage: vi
          .fn()
          .mockResolvedValue({ ok: true, ts: '1700000000.000300' }),
      }),
    });

    await handlePlanStageTicket(deps as never, makeTicket());

    expect(create).toHaveBeenCalledWith({
      ticketId: '00000000-0000-0000-0000-000000000001',
      channelId: TEAM_CHANNEL_ID,
      messageTs: '1700000000.000300',
    });
  });

  it('posts the plan to #moe-team formatted with alternatives-considered and open-questions bullets', async () => {
    const postMessage = vi
      .fn()
      .mockResolvedValue({ ok: true, ts: '1700000000.000300' });
    const deps = makeDeps({ slackClient: makeSlackClient({ postMessage }) });

    await handlePlanStageTicket(deps as never, makeTicket());

    expect(postMessage).toHaveBeenCalledWith({
      channel: TEAM_CHANNEL_ID,
      text:
        '📐 *Plan: webhook delivery retries indefinitely*\n' +
        'Add a bounded retry count with a sane default.\n\n' +
        '*Confidence:* High\n\n' +
        '*Alternatives considered:*\n' +
        '• Exponential backoff\n\n' +
        '*Open questions:*\n' +
        '• What happens after retries are exhausted?',
    });
  });

  it('omits the alternatives-considered and open-questions sections entirely when both arrays are empty', async () => {
    const postMessage = vi
      .fn()
      .mockResolvedValue({ ok: true, ts: '1700000000.000300' });
    const anthropicClient = makeAnthropicClient({
      approach: 'Small, contained fix.',
      confidence: 'High',
      alternativesConsidered: [],
      openQuestions: [],
    });
    const deps = makeDeps({
      slackClient: makeSlackClient({ postMessage }),
      anthropicClient,
    });

    await handlePlanStageTicket(deps as never, makeTicket());

    expect(postMessage).toHaveBeenCalledWith({
      channel: TEAM_CHANNEL_ID,
      text:
        '📐 *Plan: webhook delivery retries indefinitely*\n' +
        'Small, contained fix.\n\n' +
        '*Confidence:* High',
    });
  });

  it('does not persist a pointer when the Slack post fails', async () => {
    const create = vi.fn();
    const deps = makeDeps({
      planStore: {
        getByTicket: vi.fn().mockResolvedValue({ ok: true, plan: null }),
        create,
      },
      slackClient: makeSlackClient({
        postMessage: vi
          .fn()
          .mockResolvedValue({ ok: false, error: 'channel_not_found' }),
      }),
    });

    await handlePlanStageTicket(deps as never, makeTicket());

    expect(create).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalled();
  });

  it('logs but does not throw when persisting the pointer fails after a successful post', async () => {
    const create = vi.fn().mockResolvedValue({
      ok: false,
      error: { kind: 'unknown', cause: new Error('connection reset') },
    });
    const deps = makeDeps({
      planStore: {
        getByTicket: vi.fn().mockResolvedValue({ ok: true, plan: null }),
        create,
      },
    });

    await expect(
      handlePlanStageTicket(deps as never, makeTicket()),
    ).resolves.toBeUndefined();

    expect(create).toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalled();
  });
});

describe('createPlanStageNeedsWorkCheck (starvation-safe, per BUILD_PLAN 6.1c)', () => {
  it('resolves true when the ticket has no plan yet and has a real, content-bearing brief', async () => {
    const planGetByTicket = vi.fn().mockResolvedValue({ ok: true, plan: null });
    const briefGetByTicket = vi
      .fn()
      .mockResolvedValue({ ok: true, brief: DEFAULT_BRIEF });
    const deps = makeDeps({
      planStore: { getByTicket: planGetByTicket, create: vi.fn() },
      briefStore: { getByTicket: briefGetByTicket },
    });
    const needsWork = createPlanStageNeedsWorkCheck(deps as never);

    await expect(needsWork(makeTicket())).resolves.toBe(true);
  });

  it('resolves false when the ticket already has a plan (never even checks the brief)', async () => {
    const briefGetByTicket = vi.fn();
    const deps = makeDeps({
      planStore: {
        getByTicket: vi.fn().mockResolvedValue({
          ok: true,
          plan: {
            ticketId: '00000000-0000-0000-0000-000000000001',
            channelId: TEAM_CHANNEL_ID,
            messageTs: '1700000000.000100',
            createdAt: new Date('2026-09-03T09:00:00.000Z'),
          },
        }),
        create: vi.fn(),
      },
      briefStore: { getByTicket: briefGetByTicket },
    });
    const needsWork = createPlanStageNeedsWorkCheck(deps as never);

    await expect(needsWork(makeTicket())).resolves.toBe(false);
    expect(briefGetByTicket).not.toHaveBeenCalled();
  });

  it('resolves false when no plan exists but no brief exists either (the starvation-fix case — a permanently brief-less ticket is excluded from candidacy rather than reported as needing work forever)', async () => {
    const deps = makeDeps({
      planStore: {
        getByTicket: vi.fn().mockResolvedValue({ ok: true, plan: null }),
        create: vi.fn(),
      },
      briefStore: {
        getByTicket: vi.fn().mockResolvedValue({ ok: true, brief: null }),
      },
    });
    const needsWork = createPlanStageNeedsWorkCheck(deps as never);

    await expect(needsWork(makeTicket())).resolves.toBe(false);
  });

  it('resolves false when no plan exists but the persisted brief has an empty summary (a legacy pre-migration row)', async () => {
    const deps = makeDeps({
      planStore: {
        getByTicket: vi.fn().mockResolvedValue({ ok: true, plan: null }),
        create: vi.fn(),
      },
      briefStore: {
        getByTicket: vi.fn().mockResolvedValue({
          ok: true,
          brief: { ...DEFAULT_BRIEF, summary: '', scope: [] },
        }),
      },
    });
    const needsWork = createPlanStageNeedsWorkCheck(deps as never);

    await expect(needsWork(makeTicket())).resolves.toBe(false);
  });

  it("resolves false (fails closed on this function's own resolved return value) when the planStore read fails", async () => {
    const deps = makeDeps({
      planStore: {
        getByTicket: vi.fn().mockResolvedValue({
          ok: false,
          error: { kind: 'unknown', cause: new Error('db down') },
        }),
        create: vi.fn(),
      },
    });
    const needsWork = createPlanStageNeedsWorkCheck(deps as never);

    await expect(needsWork(makeTicket())).resolves.toBe(false);
  });

  it('resolves false when no plan exists but the brief read fails', async () => {
    const deps = makeDeps({
      planStore: {
        getByTicket: vi.fn().mockResolvedValue({ ok: true, plan: null }),
        create: vi.fn(),
      },
      briefStore: {
        getByTicket: vi.fn().mockResolvedValue({
          ok: false,
          error: { kind: 'unknown', cause: new Error('db down') },
        }),
      },
    });
    const needsWork = createPlanStageNeedsWorkCheck(deps as never);

    await expect(needsWork(makeTicket())).resolves.toBe(false);
  });
});
