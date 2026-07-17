import type { HandlerDeps } from './handle-inbound-message.js';
import type { ConversationTurn } from '@moe/core';

import { describe, expect, it, vi } from 'vitest';

import { createInboundMessageHandler } from './handle-inbound-message.js';
import { makeRootCandidateBuffer } from './root-candidate-buffer.js';
import { makeThreadQueue } from './thread-queue.js';

type HistoryStore = HandlerDeps['historyStore'];
type CostStore = HandlerDeps['costStore'];
type CapStore = HandlerDeps['capStore'];

function makeSlackClient(response: {
  readonly ok: boolean;
  readonly error?: string;
}) {
  return { chat: { postMessage: vi.fn().mockResolvedValue(response) } };
}

function makeAnthropicClient(
  response:
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
        typeof response === 'function'
          ? vi.fn(response)
          : vi.fn().mockResolvedValue(response),
    },
  };
}

function makeLogger() {
  return { error: vi.fn() };
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
    readonly recordAlertThreshold: CapStore['recordAlertThreshold'];
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
    recordAlertThreshold: vi
      .fn<CapStore['recordAlertThreshold']>()
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
    readonly anthropicClient: ReturnType<typeof makeAnthropicClient>;
    readonly slackClient: ReturnType<typeof makeSlackClient>;
    readonly logger: ReturnType<typeof makeLogger>;
    readonly historyStore: ReturnType<typeof makeHistoryStore>;
    readonly costStore: ReturnType<typeof makeCostStore>;
    readonly capStore: ReturnType<typeof makeCapStore>;
    readonly costCapConfig: HandlerDeps['costCapConfig'];
    readonly personaId: string;
    readonly threadQueue: ReturnType<typeof makeThreadQueue>;
    readonly rootCandidateBuffer: ReturnType<typeof makeRootCandidateBuffer>;
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
    personaId: 'sarah',
    threadQueue: makeThreadQueue(),
    rootCandidateBuffer: makeRootCandidateBuffer(),
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

  it('replies in the thread when the inbound message was threaded', async () => {
    const deps = makeDeps();
    const handler = createInboundMessageHandler(deps);

    await handler({
      ...DM_MESSAGE,
      channelType: 'channel',
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
    expect(deps.capStore.recordAlertThreshold).not.toHaveBeenCalled();
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

  it('does not persist a halted turn as an assistant reply in conversation history', async () => {
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
    expect(deps.historyStore.appendTurn).not.toHaveBeenCalledWith(
      expect.objectContaining({ role: 'assistant' }),
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
      expect(deps.capStore.recordAlertThreshold).toHaveBeenCalledWith({
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

    expect(deps.capStore.recordAlertThreshold).not.toHaveBeenCalled();
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

  it('logs an error, without throwing, when recording the alert threshold fails', async () => {
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
        recordAlertThreshold: vi
          .fn<CapStore['recordAlertThreshold']>()
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

  it('stays fully stateless for an un-threaded channel message — no history fetch/persist, buffer recorded', async () => {
    const deps = makeDeps();
    const handler = createInboundMessageHandler(deps);
    const channelMessage = { ...DM_MESSAGE, channelType: 'channel' as const };

    await handler(channelMessage);

    expect(deps.historyStore.getRecentTurns).not.toHaveBeenCalled();
    expect(deps.historyStore.appendTurn).not.toHaveBeenCalled();
    expect(deps.anthropicClient.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: channelMessage.text }],
      }),
    );
    expect(
      deps.rootCandidateBuffer.takeIfMatches('D123', channelMessage.ts),
    ).toEqual({ text: channelMessage.text, replyText: 'Sure, tell me more.' });
  });

  it('backfills the buffered root message and reply on the first reply into a new channel thread', async () => {
    const rootCandidateBuffer = makeRootCandidateBuffer();
    rootCandidateBuffer.recordCandidate(
      'D123',
      '1699999999.000100',
      'what do you think?',
    );
    rootCandidateBuffer.recordReply(
      'D123',
      '1699999999.000100',
      'good idea, let’s do it',
    );
    const deps = makeDeps({ rootCandidateBuffer });
    const handler = createInboundMessageHandler(deps);

    await handler({
      ...DM_MESSAGE,
      channelType: 'channel',
      threadTs: '1699999999.000100',
    });

    expect(deps.historyStore.appendTurn).toHaveBeenCalledWith({
      personaId: 'sarah',
      channelId: 'D123',
      threadKey: '1699999999.000100',
      role: 'user',
      content: 'what do you think?',
    });
    expect(deps.historyStore.appendTurn).toHaveBeenCalledWith({
      personaId: 'sarah',
      channelId: 'D123',
      threadKey: '1699999999.000100',
      role: 'assistant',
      content: 'good idea, let’s do it',
    });
  });

  it('proceeds with empty history when a channel thread reply has no matching buffered candidate', async () => {
    const deps = makeDeps();
    const handler = createInboundMessageHandler(deps);

    await handler({
      ...DM_MESSAGE,
      channelType: 'channel',
      threadTs: '1699999999.000100',
    });

    // No backfill happened — exactly the current turn's own two persists (user + assistant),
    // not four (which a spurious backfill would add).
    expect(deps.historyStore.appendTurn).toHaveBeenCalledTimes(2);
    expect(deps.anthropicClient.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: DM_MESSAGE.text }],
      }),
    );
  });

  it('backfills only the root user turn, with no fabricated assistant turn, when the candidate has no replyText yet', async () => {
    const rootCandidateBuffer = makeRootCandidateBuffer();
    rootCandidateBuffer.recordCandidate(
      'D123',
      '1699999999.000100',
      'what do you think?',
    );
    const appendTurn = vi
      .fn<HistoryStore['appendTurn']>()
      .mockResolvedValue({ ok: true, turn: turn() });
    const deps = makeDeps({
      rootCandidateBuffer,
      historyStore: makeHistoryStore({ appendTurn }),
    });
    const handler = createInboundMessageHandler(deps);

    await handler({
      ...DM_MESSAGE,
      channelType: 'channel',
      threadTs: '1699999999.000100',
    });

    const appendCalls = appendTurn.mock.calls.map((call) => call[0]);
    expect(appendCalls).toContainEqual({
      personaId: 'sarah',
      channelId: 'D123',
      threadKey: '1699999999.000100',
      role: 'user',
      content: 'what do you think?',
    });
    expect(
      appendCalls.filter(
        (call) =>
          call.content === 'what do you think?' && call.role === 'assistant',
      ),
    ).toHaveLength(0);
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
