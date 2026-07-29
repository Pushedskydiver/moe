import type { HandlerDeps } from './handle-inbound-message.js';

import { describe, expect, it, vi } from 'vitest';

import { resolvePersonaModel } from '@moe/agents';

import { generateAndPost } from './generate-and-post-reply.js';

type CapStore = HandlerDeps['capStore'];

const FALLBACK_TEXT =
  "Sorry, I ran into a problem generating a reply — I've logged it.";
const HALT_TEXT =
  "I've hit my monthly budget cap and can't generate a new reply right now — I'll be back once it resets next month.";

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

function makeDeps(
  overrides: {
    readonly createImpl?: () => never;
    readonly capStore?: CapStore;
    readonly postOk?: boolean;
  } = {},
) {
  const create = vi.fn();
  if (overrides.createImpl) {
    create.mockImplementation(overrides.createImpl);
  } else {
    create.mockResolvedValue({
      content: [{ type: 'text', text: 'Sure, tell me more.' }],
      usage: { input_tokens: 12, output_tokens: 34 },
    });
  }

  const postOk = overrides.postOk ?? true;
  return {
    anthropicClient: { messages: { create, parse: vi.fn() } },
    slackClient: {
      chat: {
        postMessage: vi
          .fn()
          .mockResolvedValue(
            postOk
              ? { ok: true, ts: '1700000000.000100' }
              : { ok: false, error: 'channel_not_found' },
          ),
      },
      reactions: { add: vi.fn().mockResolvedValue({ ok: true }) },
    },
    logger: { info: vi.fn(), error: vi.fn() },
    historyStore: {
      getRecentTurns: vi.fn<HandlerDeps['historyStore']['getRecentTurns']>(),
      appendTurn: vi.fn<HandlerDeps['historyStore']['appendTurn']>(),
    },
    costStore: {
      recordUsage: vi
        .fn<HandlerDeps['costStore']['recordUsage']>()
        .mockResolvedValue({
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
    },
    capStore: overrides.capStore ?? makeCapStore(),
    costCapConfig: {
      monthlyCapUsdMicros: 100_000_000,
      alertSlackUserId: 'U0ALEX',
    },
    personaId: 'sarah' as const,
    threadQueue: { run: vi.fn() },
    channelScopeConfig: { workRelevantChannelIds: new Set(['C123']) },
    bankHolidaysCache: {} as HandlerDeps['bankHolidaysCache'],
    senderTriggerCache: {} as HandlerDeps['senderTriggerCache'],
    ticketStore: { create: vi.fn() },
    draftStore: {
      create: vi.fn(),
      getByMessage: vi.fn(),
      updateContent: vi.fn(),
      markPosted: vi.fn(),
      releaseClaim: vi.fn(),
    },
    reviewQueueStore: { create: vi.fn() },
    confirmingQuestionStore: {
      create: vi.fn(),
      getByMessage: vi.fn(),
      resolve: vi.fn(),
      markPosted: vi.fn(),
      releaseClaim: vi.fn(),
    },
  };
}

const DM_MESSAGE = {
  channelId: 'D123',
  channelType: 'im' as const,
  userId: 'U123',
  text: 'can you help with something',
  ts: '1700000000.000050',
};

describe('generateAndPost', () => {
  it('posts the generated reply and returns it for persistence', async () => {
    const deps = makeDeps();

    const result = await generateAndPost(deps, DM_MESSAGE, []);

    expect(result).toEqual({ ok: true, text: 'Sure, tell me more.' });
    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'D123', text: 'Sure, tell me more.' }),
    );
  });

  it('posts a visible fallback, not silence, when the LLM call fails', async () => {
    const deps = makeDeps({
      createImpl: () => {
        throw new Error('rate limited');
      },
    });

    const result = await generateAndPost(deps, DM_MESSAGE, []);

    // `ok: false` — there is no real reply content to persist, unlike the halt case below.
    expect(result).toEqual({ ok: false });
    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'D123', text: FALLBACK_TEXT }),
    );
  });

  it('posts a visible halt message, and reports it as real content to persist, once the cap is reached', async () => {
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

    const result = await generateAndPost(deps, DM_MESSAGE, []);

    // `ok: true` — `HALT_TEXT` genuinely reached Slack, so history should match the real
    // transcript rather than silently diverging from it for the rest of the month.
    expect(result).toEqual({ ok: true, text: HALT_TEXT });
    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'D123', text: HALT_TEXT }),
    );
    // The halt is a hard stop: the Anthropic API is never reached at all.
    expect(deps.anthropicClient.messages.create).not.toHaveBeenCalled();
  });

  it('never throws when the Slack post itself fails — logs and still reports the generated content', async () => {
    const deps = makeDeps({ postOk: false });

    const result = await generateAndPost(deps, DM_MESSAGE, []);

    // `ok` reflects whether there is real reply content to persist, independent of Slack
    // delivery success — the distinction this function's own TSDoc draws.
    expect(result).toEqual({ ok: true, text: 'Sure, tell me more.' });
    expect(deps.logger.error).toHaveBeenCalledWith('failed to post reply', {
      errorMessage: expect.any(String) as string,
    });
  });

  it('replies inside the thread when the inbound message carries one', async () => {
    const deps = makeDeps();

    await generateAndPost(
      deps,
      { ...DM_MESSAGE, threadTs: '1700000000.000010' },
      [],
    );

    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ thread_ts: '1700000000.000010' }),
    );
  });

  // BUILD_PLAN 5.3a — asserts against `resolvePersonaModel`'s own real output for `deps.personaId`
  // rather than a hardcoded literal, so this test still means something once a persona gets a
  // real override (both currently resolve to the same `claude-sonnet-5` default, so this doesn't
  // yet prove the wiring on its own — `resolve-persona-model.test.ts` covers the resolver itself).
  it('sends the API call the model resolvePersonaModel(deps.personaId) resolves to, not a hardcoded default', async () => {
    const deps = makeDeps();

    await generateAndPost(deps, DM_MESSAGE, []);

    expect(deps.anthropicClient.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: resolvePersonaModel(deps.personaId) }),
    );
  });

  it('forwards prior history to the model', async () => {
    const deps = makeDeps();

    await generateAndPost(deps, DM_MESSAGE, [
      { role: 'user', content: 'earlier question' },
      { role: 'assistant', content: 'earlier answer' },
    ]);

    const callArg = deps.anthropicClient.messages.create.mock.calls[0]?.[0] as {
      messages: ReadonlyArray<{ role: string; content: string }>;
    };
    expect(callArg.messages).toEqual([
      { role: 'user', content: 'earlier question' },
      { role: 'assistant', content: 'earlier answer' },
      { role: 'user', content: DM_MESSAGE.text },
    ]);
  });
});
