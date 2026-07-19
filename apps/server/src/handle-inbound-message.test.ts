import type { HandlerDeps } from './handle-inbound-message.js';
import type { ConversationTurn, PendingTicketDraft } from '@moe/core';

import { describe, expect, it, vi } from 'vitest';

import { createBankHolidaysCache } from '@moe/core';

import { createInboundMessageHandler } from './handle-inbound-message.js';
import { makeThreadQueue } from './thread-queue.js';

type HistoryStore = HandlerDeps['historyStore'];
type CostStore = HandlerDeps['costStore'];
type CapStore = HandlerDeps['capStore'];

function makeSlackClient(
  response: {
    readonly ok: boolean;
    readonly error?: string;
    readonly ts?: string;
  },
  // Per-call overrides for `reactions.add`, consumed in order (📦 first, then 🔁, then ✅) — only
  // the calls a test cares about need an entry; the rest default to `{ok: true}`.
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
        ts: response.ok ? '1700000000.000100' : undefined,
        ...response,
      }),
    },
    reactions: { add },
  };
}

// `.create` is the DM chat-reply path's own call, configurable per test. `.parse` is the Stage 1
// classifier's call — only reached by this file's one remaining ambient-dispatch test ('routes a
// group message through the ambient classification path'), fixed to a Low-band default so that
// test can't cross into High-band drafting, which this file no longer covers (moved to
// `handle-ambient-channel-message.test.ts` along with the rest of the ambient-path behavior).
function makeAnthropicClient(
  createResponse:
    | {
        readonly content: ReadonlyArray<
          { readonly type: string; readonly text?: string } & Record<
            string,
            unknown
          >
        >;
        readonly usage?: {
          readonly input_tokens: number;
          readonly output_tokens: number;
        };
      }
    | (() => never),
) {
  return {
    messages: {
      create:
        typeof createResponse === 'function'
          ? vi.fn(createResponse)
          : vi.fn().mockResolvedValue(createResponse),
      parse: vi.fn().mockResolvedValue({
        parsed_output: {
          confidence: 10,
          reasoning: 'default test classification',
        },
        usage: { input_tokens: 40, output_tokens: 12 },
      }),
    },
  };
}

function makeLogger() {
  return { info: vi.fn(), error: vi.fn() };
}

function turn(overrides: Partial<ConversationTurn> = {}): ConversationTurn {
  return {
    id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    personaId: 'sarah',
    channelId: 'D123',
    threadKey: 'dm',
    role: 'user',
    content: 'earlier message',
    createdAt: new Date('2026-07-16T09:00:00.000Z'),
    ...overrides,
  };
}

function makeHistoryStore(
  overrides: Partial<{
    readonly getRecentTurns: HistoryStore['getRecentTurns'];
    readonly appendTurn: HistoryStore['appendTurn'];
  }> = {},
): HistoryStore {
  return {
    getRecentTurns: vi
      .fn<HistoryStore['getRecentTurns']>()
      .mockResolvedValue({ ok: true, turns: [] }),
    appendTurn: vi
      .fn<HistoryStore['appendTurn']>()
      .mockResolvedValue({ ok: true, turn: turn() }),
    ...overrides,
  };
}

function makeCostStore(
  overrides: Partial<{ readonly recordUsage: CostStore['recordUsage'] }> = {},
): CostStore {
  return {
    recordUsage: vi.fn<CostStore['recordUsage']>().mockResolvedValue({
      ok: true,
      usage: {
        personaId: 'sarah',
        day: '2026-07-17',
        inputTokens: 12,
        outputTokens: 34,
        costUsdMicros: 364,
        updatedAt: new Date('2026-07-17T09:00:00.000Z'),
      },
    }),
    ...overrides,
  };
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

// A real `Cached` instance (via the one publicly exported constructor), not a hand-rolled mock —
// `Cached` uses a native `#private` field, so a plain object literal isn't structurally
// assignable to `HandlerDeps['bankHolidaysCache']` at all. `dates` defaults to empty (no bank
// holidays), which combined with a pinned in-window `now` (see the High-band tests below) lets
// `evaluateOperatingRhythm` resolve `withinCoreHours: true` without a real network call.
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

function makePendingTicketDraft(
  overrides: Partial<PendingTicketDraft> = {},
): PendingTicketDraft {
  return {
    id: '5fa85f64-5717-4562-b3fc-2c963f66afa8',
    personaId: 'sarah',
    channelId: 'C123',
    messageTs: '1700000000.000100',
    sourceMessageText: 'the CLI hangs on large repos',
    draftTitle: 'CLI hangs on large repos',
    draftBody: 'The CLI hangs when run against large repos.',
    resolvedAt: null,
    createdAt: new Date('2026-07-16T09:00:00.000Z'),
    ...overrides,
  };
}

// BUILD_PLAN 3.4a-ii's ticket store — this file's own reaction-outcome coverage lives in
// `handle-reaction-added.test.ts`/`reaction-outcome-actions.test.ts`; here it's only ever the
// target of a real ✅/📦 write via `composeAndPostDraft`'s own callers, none of which this file
// exercises directly, so a sensible default resolved value is enough.
function makeTicketStore(
  overrides: Partial<HandlerDeps['ticketStore']> = {},
): HandlerDeps['ticketStore'] {
  return {
    create: vi.fn<HandlerDeps['ticketStore']['create']>().mockResolvedValue({
      ok: true,
      ticket: {
        id: '6fa85f64-5717-4562-b3fc-2c963f66afa9',
        projectKey: 'chief-clancy',
        title: 'CLI hangs on large repos',
        status: 'Brief',
        severity: 'Medium',
        createdAt: new Date('2026-07-16T09:00:00.000Z'),
        updatedAt: new Date('2026-07-16T09:00:00.000Z'),
      },
    }),
    ...overrides,
  };
}

// BUILD_PLAN 3.4a-iii's own real consumer: `composeAndPostDraft` calls `create` after a real post
// succeeds, keyed on the posted message's own `ts` (`makeSlackClient`'s default,
// `1700000000.000100`) — matched here so the default wiring is internally consistent end to end.
function makeDraftStore(
  overrides: Partial<HandlerDeps['draftStore']> = {},
): HandlerDeps['draftStore'] {
  return {
    create: vi.fn<HandlerDeps['draftStore']['create']>().mockResolvedValue({
      ok: true,
      draft: makePendingTicketDraft(),
    }),
    getByMessage: vi.fn<HandlerDeps['draftStore']['getByMessage']>(),
    resolve: vi.fn<HandlerDeps['draftStore']['resolve']>(),
    updateContent: vi.fn<HandlerDeps['draftStore']['updateContent']>(),
    ...overrides,
  };
}

// BUILD_PLAN 3.4c's own real consumer, `handle-ambient-channel-message.ts`'s `logToReviewQueue` —
// this file's DM-path tests never exercise it directly (that coverage lives in
// `handle-ambient-channel-message.test.ts`), so a sensible default resolved value is enough.
function makeReviewQueueStore(
  overrides: Partial<HandlerDeps['reviewQueueStore']> = {},
): HandlerDeps['reviewQueueStore'] {
  return {
    create: vi
      .fn<HandlerDeps['reviewQueueStore']['create']>()
      .mockResolvedValue({
        ok: true,
        entry: {
          id: '7fa85f64-5717-4562-b3fc-2c963f66afaa',
          personaId: 'sarah',
          channelId: 'C123',
          messageTs: '1700000000.000100',
          sourceMessageText: 'anyone know a good coffee place nearby',
          confidence: 12,
          reasoning: 'reads as banter, not a work request',
          outcomeReason: 'low-confidence',
          createdAt: new Date('2026-07-16T09:00:00.000Z'),
        },
      }),
    ...overrides,
  };
}

function makeDeps(
  overrides: Partial<{
    readonly anthropicClient: ReturnType<typeof makeAnthropicClient>;
    readonly slackClient: ReturnType<typeof makeSlackClient>;
    readonly logger: ReturnType<typeof makeLogger>;
    readonly historyStore: ReturnType<typeof makeHistoryStore>;
    readonly costStore: ReturnType<typeof makeCostStore>;
    readonly capStore: ReturnType<typeof makeCapStore>;
    readonly costCapConfig: HandlerDeps['costCapConfig'];
    readonly personaId: HandlerDeps['personaId'];
    readonly threadQueue: ReturnType<typeof makeThreadQueue>;
    readonly channelScopeConfig: HandlerDeps['channelScopeConfig'];
    readonly bankHolidaysCache: HandlerDeps['bankHolidaysCache'];
    readonly ticketStore: HandlerDeps['ticketStore'];
    readonly draftStore: HandlerDeps['draftStore'];
    readonly reviewQueueStore: HandlerDeps['reviewQueueStore'];
  }> = {},
) {
  return {
    anthropicClient: makeAnthropicClient(REPLY_MESSAGE),
    slackClient: makeSlackClient({ ok: true }),
    logger: makeLogger(),
    historyStore: makeHistoryStore(),
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
    ticketStore: makeTicketStore(),
    draftStore: makeDraftStore(),
    reviewQueueStore: makeReviewQueueStore(),
    ...overrides,
  };
}

const DM_MESSAGE = {
  channelId: 'D123',
  channelType: 'im' as const,
  userId: 'U123',
  text: 'can you help with something',
  ts: '1700000000.000100',
};

const REPLY_MESSAGE = {
  content: [{ type: 'text', text: 'Sure, tell me more.' }],
  usage: { input_tokens: 12, output_tokens: 34 },
};

describe('createInboundMessageHandler', () => {
  it('generates a reply from the inbound text and posts it back in the same channel', async () => {
    const deps = makeDeps();
    const handler = createInboundMessageHandler(deps);

    await handler(DM_MESSAGE);

    expect(deps.anthropicClient.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: DM_MESSAGE.text }],
      }),
    );
    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'D123',
        text: 'Sure, tell me more.',
      }),
    );
  });

  it("uses the persona's own system prompt, naming it by its personaId, not the generic no-persona placeholder", async () => {
    const deps = makeDeps({ personaId: 'marcus' });
    const handler = createInboundMessageHandler(deps);

    await handler(DM_MESSAGE);

    const call = deps.anthropicClient.messages.create.mock.calls[0]?.[0] as {
      system: string;
    };
    expect(call.system).toContain('Marcus');
  });

  it('replies in the thread when the inbound DM carries a thread_ts', async () => {
    const deps = makeDeps();
    const handler = createInboundMessageHandler(deps);

    await handler({
      ...DM_MESSAGE,
      threadTs: '1699999999.000100',
    });

    const call = deps.slackClient.chat.postMessage.mock.calls[0]?.[0] as {
      thread_ts?: string;
    };
    expect(call.thread_ts).toBe('1699999999.000100');
  });

  it('logs an error and posts a generic fallback reply when the LLM call fails — not silence', async () => {
    const deps = makeDeps({
      anthropicClient: makeAnthropicClient(() => {
        throw new Error('rate limited');
      }),
    });
    const handler = createInboundMessageHandler(deps);

    await expect(handler(DM_MESSAGE)).resolves.toBeUndefined();

    expect(deps.logger.error).toHaveBeenCalledWith('failed to generate reply', {
      message: 'rate limited',
    });
    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'D123',
        text: "Sorry, I ran into a problem generating a reply — I've logged it.",
      }),
    );
  });

  it("records the turn's token usage and its priced cost against the persona/day bucket (BUILD_PLAN 2.6a)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-17T09:00:00.000Z'));
    try {
      const deps = makeDeps();
      const handler = createInboundMessageHandler(deps);

      await handler(DM_MESSAGE);

      // REPLY_MESSAGE's usage is {input_tokens: 12, output_tokens: 34}; introductory Sonnet-5
      // pricing (2026-07-17, before the 2026-08-31 cutover) is $2/$10 per MTok, i.e. 2/10
      // micro-USD per token: 12 * 2 + 34 * 10 = 364.
      expect(deps.costStore.recordUsage).toHaveBeenCalledWith({
        personaId: 'sarah',
        day: '2026-07-17',
        inputTokens: 12,
        outputTokens: 34,
        costUsdMicros: 364,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not record cost usage when the LLM call fails — there is no token usage to account for', async () => {
    const deps = makeDeps({
      anthropicClient: makeAnthropicClient(() => {
        throw new Error('rate limited');
      }),
    });
    const handler = createInboundMessageHandler(deps);

    await handler(DM_MESSAGE);

    expect(deps.costStore.recordUsage).not.toHaveBeenCalled();
  });

  it('logs an error, without throwing, when recording cost usage fails', async () => {
    const deps = makeDeps({
      costStore: makeCostStore({
        recordUsage: vi.fn<CostStore['recordUsage']>().mockResolvedValue({
          ok: false,
          error: { kind: 'unknown', cause: new Error('connection reset') },
        }),
      }),
    });
    const handler = createInboundMessageHandler(deps);

    await expect(handler(DM_MESSAGE)).resolves.toBeUndefined();

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to record LLM cost usage',
      { message: 'Error: connection reset' },
    );
  });

  it('proceeds normally — no halt, no alert — when spend is well below any threshold (BUILD_PLAN 2.6b)', async () => {
    const deps = makeDeps();
    const handler = createInboundMessageHandler(deps);

    await handler(DM_MESSAGE);

    expect(deps.anthropicClient.messages.create).toHaveBeenCalled();
    expect(deps.capStore.claimAlertThreshold).not.toHaveBeenCalled();
    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'U0ALEX' }),
    );
  });

  it('hard-halts new LLM calls and posts a visible message once monthly spend reaches the cap', async () => {
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
    const handler = createInboundMessageHandler(deps);

    await handler(DM_MESSAGE);

    expect(deps.anthropicClient.messages.create).not.toHaveBeenCalled();
    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'D123',
        text: expect.stringContaining('budget'),
      }),
    );
  });

  it('persists a halted turn as a real assistant reply in conversation history (BUILD_PLAN 2.6b DA fold) — HALT_TEXT genuinely reached Slack, so history should match the real transcript, not silently diverge from it for the rest of the month', async () => {
    const priorTurns = [turn({ role: 'user', content: 'hi' })];
    const deps = makeDeps({
      historyStore: makeHistoryStore({
        getRecentTurns: vi
          .fn<HistoryStore['getRecentTurns']>()
          .mockResolvedValue({ ok: true, turns: priorTurns }),
      }),
      capStore: makeCapStore({
        getMonthlyCost: vi.fn<CapStore['getMonthlyCost']>().mockResolvedValue({
          ok: true,
          total: {
            personaId: 'sarah',
            month: '2026-07',
            inputTokens: 0,
            outputTokens: 0,
            costUsdMicros: 999_000_000,
          },
        }),
      }),
    });
    const handler = createInboundMessageHandler(deps);

    await handler(DM_MESSAGE);

    expect(deps.historyStore.appendTurn).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'user' }),
    );
    expect(deps.historyStore.appendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('budget'),
      }),
    );
  });

  it('posts a threshold-crossing alert DM and records the new watermark on first crossing', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-17T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        capStore: makeCapStore({
          getMonthlyCost: vi
            .fn<CapStore['getMonthlyCost']>()
            .mockResolvedValue({
              ok: true,
              total: {
                personaId: 'sarah',
                month: '2026-07',
                inputTokens: 0,
                outputTokens: 0,
                costUsdMicros: 50_000_000,
              },
            }),
        }),
      });
      const handler = createInboundMessageHandler(deps);

      await handler(DM_MESSAGE);

      expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'U0ALEX',
          text: expect.stringContaining('50'),
        }),
      );
      expect(deps.capStore.claimAlertThreshold).toHaveBeenCalledWith({
        personaId: 'sarah',
        month: '2026-07',
        threshold: 50,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not re-alert a threshold that has already been recorded this month', async () => {
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
        getAlertState: vi.fn<CapStore['getAlertState']>().mockResolvedValue({
          ok: true,
          alert: {
            personaId: 'sarah',
            month: '2026-07',
            highestThresholdAlerted: 50,
            updatedAt: new Date('2026-07-17T09:00:00.000Z'),
          },
        }),
      }),
    });
    const handler = createInboundMessageHandler(deps);

    await handler(DM_MESSAGE);

    expect(deps.capStore.claimAlertThreshold).not.toHaveBeenCalled();
    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'U0ALEX' }),
    );
  });

  it('fails open — does not halt — when checking the monthly cost total errors', async () => {
    const deps = makeDeps({
      capStore: makeCapStore({
        getMonthlyCost: vi.fn<CapStore['getMonthlyCost']>().mockResolvedValue({
          ok: false,
          error: { kind: 'unknown', cause: new Error('connection reset') },
        }),
      }),
    });
    const handler = createInboundMessageHandler(deps);

    await handler(DM_MESSAGE);

    expect(deps.anthropicClient.messages.create).toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to fetch monthly cost total',
      { message: 'Error: connection reset' },
    );
  });

  it('logs an error, without throwing, and does not post the alert, when claiming the threshold fails for a real reason', async () => {
    const deps = makeDeps({
      capStore: makeCapStore({
        getMonthlyCost: vi.fn<CapStore['getMonthlyCost']>().mockResolvedValue({
          ok: true,
          total: {
            personaId: 'sarah',
            month: '2026-07',
            inputTokens: 0,
            outputTokens: 0,
            costUsdMicros: 50_000_000,
          },
        }),
        claimAlertThreshold: vi
          .fn<CapStore['claimAlertThreshold']>()
          .mockResolvedValue({
            ok: false,
            error: { kind: 'unknown', cause: new Error('connection reset') },
          }),
      }),
    });
    const handler = createInboundMessageHandler(deps);

    await expect(handler(DM_MESSAGE)).resolves.toBeUndefined();

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to record cost alert threshold',
      { message: 'Error: connection reset' },
    );
    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'U0ALEX' }),
    );
  });

  it('does not post a duplicate alert, and does not log an error, when a concurrent turn already won the claim for this threshold (BUILD_PLAN 2.6b DA fold)', async () => {
    const deps = makeDeps({
      capStore: makeCapStore({
        getMonthlyCost: vi.fn<CapStore['getMonthlyCost']>().mockResolvedValue({
          ok: true,
          total: {
            personaId: 'sarah',
            month: '2026-07',
            inputTokens: 0,
            outputTokens: 0,
            costUsdMicros: 50_000_000,
          },
        }),
        claimAlertThreshold: vi
          .fn<CapStore['claimAlertThreshold']>()
          .mockResolvedValue({ ok: false, error: { kind: 'unavailable' } }),
      }),
    });
    const handler = createInboundMessageHandler(deps);

    await handler(DM_MESSAGE);

    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'U0ALEX' }),
    );
    expect(deps.logger.error).not.toHaveBeenCalledWith(
      'failed to record cost alert threshold',
      expect.anything(),
    );
  });

  it('logs an error, without throwing, when the generated reply fails to send', async () => {
    const deps = makeDeps({
      slackClient: makeSlackClient({ ok: false, error: 'channel_not_found' }),
    });
    const handler = createInboundMessageHandler(deps);

    await expect(handler(DM_MESSAGE)).resolves.toBeUndefined();
    expect(deps.logger.error).toHaveBeenCalledWith('failed to post reply', {
      message: 'channel_not_found',
    });
  });

  it('fetches and forwards DM history, then persists both the user and assistant turns', async () => {
    const priorTurns = [
      turn({ role: 'user', content: 'what is the deploy command?' }),
      turn({ role: 'assistant', content: 'fly deploy --app moe' }),
    ];
    const deps = makeDeps({
      historyStore: makeHistoryStore({
        getRecentTurns: vi
          .fn<HistoryStore['getRecentTurns']>()
          .mockResolvedValue({ ok: true, turns: priorTurns }),
      }),
    });
    const handler = createInboundMessageHandler(deps);

    await handler(DM_MESSAGE);

    expect(deps.historyStore.getRecentTurns).toHaveBeenCalledWith(
      { personaId: 'sarah', channelId: 'D123', threadKey: 'dm' },
      20,
    );
    expect(deps.anthropicClient.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'user', content: 'what is the deploy command?' },
          { role: 'assistant', content: 'fly deploy --app moe' },
          { role: 'user', content: DM_MESSAGE.text },
        ],
      }),
    );
    expect(deps.historyStore.appendTurn).toHaveBeenCalledWith({
      personaId: 'sarah',
      channelId: 'D123',
      threadKey: 'dm',
      role: 'user',
      content: DM_MESSAGE.text,
    });
    expect(deps.historyStore.appendTurn).toHaveBeenCalledWith({
      personaId: 'sarah',
      channelId: 'D123',
      threadKey: 'dm',
      role: 'assistant',
      content: 'Sure, tell me more.',
    });
  });

  it('routes a group message through the ambient classification path — same as a channel message, neither gets a DM-style reply (BUILD_PLAN 3.3)', async () => {
    const deps = makeDeps();
    const handler = createInboundMessageHandler(deps);

    await handler({
      ...DM_MESSAGE,
      channelId: 'C123',
      channelType: 'group' as const,
    });

    expect(deps.anthropicClient.messages.parse).toHaveBeenCalled();
    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
  });

  it('persists the user turn but not an assistant turn when the LLM call fails', async () => {
    const deps = makeDeps({
      anthropicClient: makeAnthropicClient(() => {
        throw new Error('rate limited');
      }),
    });
    const handler = createInboundMessageHandler(deps);

    await handler(DM_MESSAGE);

    expect(deps.historyStore.appendTurn).toHaveBeenCalledWith({
      personaId: 'sarah',
      channelId: 'D123',
      threadKey: 'dm',
      role: 'user',
      content: DM_MESSAGE.text,
    });
    expect(deps.historyStore.appendTurn).not.toHaveBeenCalledWith(
      expect.objectContaining({ role: 'assistant' }),
    );
  });

  it('composes a status claim through the 1.4 gate — a report_status call with no backing evidence reaches Slack, and gets persisted, as "Not yet verified." (BUILD_PLAN 2.5)', async () => {
    const deps = makeDeps({
      anthropicClient: makeAnthropicClient({
        content: [
          {
            type: 'tool_use',
            id: 'toolu_01',
            name: 'report_status',
            input: { claim: 'done' },
          },
        ],
        usage: { input_tokens: 12, output_tokens: 34 },
      }),
    });
    const handler = createInboundMessageHandler(deps);

    await handler(DM_MESSAGE);

    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'D123', text: 'Not yet verified.' }),
    );
    expect(deps.historyStore.appendTurn).toHaveBeenCalledWith({
      personaId: 'sarah',
      channelId: 'D123',
      threadKey: 'dm',
      role: 'assistant',
      content: 'Not yet verified.',
    });
  });

  it('always offers the report_status tool to the model, alongside a plain text reply passing straight through ungated', async () => {
    const deps = makeDeps();
    const handler = createInboundMessageHandler(deps);

    await handler(DM_MESSAGE);

    expect(deps.anthropicClient.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [expect.objectContaining({ name: 'report_status' })],
      }),
    );
    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Sure, tell me more.' }),
    );
  });

  it('falls back to empty history without blocking the reply when the history fetch fails', async () => {
    const deps = makeDeps({
      historyStore: makeHistoryStore({
        getRecentTurns: vi
          .fn<HistoryStore['getRecentTurns']>()
          .mockResolvedValue({
            ok: false,
            error: { kind: 'unknown', cause: new Error('connection reset') },
          }),
      }),
    });
    const handler = createInboundMessageHandler(deps);

    await expect(handler(DM_MESSAGE)).resolves.toBeUndefined();

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to fetch conversation history',
      expect.objectContaining({ message: expect.any(String) as string }),
    );
    expect(deps.anthropicClient.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: DM_MESSAGE.text }],
      }),
    );
    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Sure, tell me more.' }),
    );
  });

  it('serializes two rapid messages in the same thread key via threadQueue, no interleaved fetch/persist', async () => {
    const order: string[] = [];
    const threadQueue = makeThreadQueue();
    const historyStore = makeHistoryStore({
      getRecentTurns: vi
        .fn<HistoryStore['getRecentTurns']>()
        .mockImplementation(async () => {
          order.push('fetch');
          return { ok: true, turns: [] };
        }),
      appendTurn: vi
        .fn<HistoryStore['appendTurn']>()
        .mockImplementation(async (input) => {
          order.push(`persist-${input.role}`);
          return { ok: true, turn: turn() };
        }),
    });
    const deps = makeDeps({ threadQueue, historyStore });
    const handler = createInboundMessageHandler(deps);

    await Promise.all([handler(DM_MESSAGE), handler(DM_MESSAGE)]);

    expect(order).toEqual([
      'fetch',
      'persist-user',
      'persist-assistant',
      'fetch',
      'persist-user',
      'persist-assistant',
    ]);
  });

  it('lets messages from different DM channels run concurrently, not serialized through one global queue lane', async () => {
    const order: string[] = [];
    const threadQueue = makeThreadQueue();
    let releaseFirstFetch: () => void = () => {};
    const firstFetchBlocked = new Promise<void>((resolve) => {
      releaseFirstFetch = resolve;
    });
    const historyStore = makeHistoryStore({
      getRecentTurns: vi
        .fn<HistoryStore['getRecentTurns']>()
        .mockImplementation(async (scope) => {
          order.push(`fetch-${scope.channelId}`);
          if (scope.channelId === 'D123') {
            await firstFetchBlocked;
          }
          return { ok: true, turns: [] };
        }),
    });
    const deps = makeDeps({ threadQueue, historyStore });
    const handler = createInboundMessageHandler(deps);

    const firstCall = handler(DM_MESSAGE);
    const secondCall = handler({ ...DM_MESSAGE, channelId: 'D999' });

    // If the queue key were `threadKey` alone (the constant `'dm'`), this second call — a
    // completely different DM conversation — would never even start its fetch until the first
    // call's blocked fetch resolves, and this `await` would hang forever.
    await secondCall;
    expect(order).toEqual(['fetch-D123', 'fetch-D999']);

    releaseFirstFetch();
    await firstCall;
  });
});
