import type { HandlerDeps } from './handle-inbound-message.js';
import type { PendingTicketDraft } from '@moe/core';

import { describe, expect, it, vi } from 'vitest';

import { createBankHolidaysCache } from '@moe/core';

import { runDmIntakeCascade } from './run-dm-intake-cascade.js';
import { makeThreadQueue } from './thread-queue.js';

type CapStore = HandlerDeps['capStore'];
type CostStore = HandlerDeps['costStore'];
type DraftStore = HandlerDeps['draftStore'];
type ReviewQueueStore = HandlerDeps['reviewQueueStore'];
type ConfirmingQuestionStore = HandlerDeps['confirmingQuestionStore'];

function makeSlackClient(
  response: {
    readonly ok: boolean;
    readonly error?: string;
    readonly ts?: string;
  } = { ok: true },
) {
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

// The DM cascade makes **two** `.parse()` calls at most, in this order: the Stage 1 classifier,
// then — only on a High band — the ticket-draft composer. Deliberately no third slot for the
// situational-appropriateness gate, unlike `handle-ambient-channel-message.test.ts`'s own
// equivalent factory: BUILD_PLAN 3.7 settles that gate as not applying to a DM-triggered post, and
// several tests below assert the call count directly to keep that from silently regressing.
type MakeAnthropicClientOptions = {
  readonly parseResponse?:
    | { readonly confidence: number; readonly reasoning: string }
    | null
    | (() => never);
  readonly draftResponse?:
    { readonly title: string; readonly body: string } | null | (() => never);
};

function makeAnthropicClient(options: MakeAnthropicClientOptions = {}) {
  const {
    parseResponse = {
      confidence: 10,
      reasoning: 'default test classification',
    },
    draftResponse,
  } = options;
  const parse = vi.fn();
  if (typeof parseResponse === 'function') {
    parse.mockImplementationOnce(parseResponse);
  } else {
    parse.mockResolvedValueOnce({
      parsed_output: parseResponse,
      usage: { input_tokens: 40, output_tokens: 12 },
    });
  }
  if (draftResponse !== undefined) {
    if (typeof draftResponse === 'function') {
      parse.mockImplementationOnce(draftResponse);
    } else {
      parse.mockResolvedValueOnce({
        parsed_output: draftResponse,
        usage: { input_tokens: 120, output_tokens: 40 },
      });
    }
  }

  return { messages: { create: vi.fn(), parse } };
}

function makeLogger() {
  return { info: vi.fn(), error: vi.fn() };
}

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
        inputTokens: 12,
        outputTokens: 34,
        costUsdMicros: 364,
        updatedAt: new Date('2026-07-17T09:00:00.000Z'),
      },
    }),
    ...overrides,
  };
}

// A real `Cached` instance via the one publicly exported constructor — `Cached` uses a native
// `#private` field, so a plain object literal isn't structurally assignable at all.
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
    channelId: 'D123',
    messageTs: '1700000000.000100',
    sourceMessageText: 'the CLI hangs on large repos',
    draftTitle: 'CLI hangs on large repos',
    draftBody: 'The CLI hangs when run against large repos.',
    resolvedAt: null,
    createdAt: new Date('2026-07-16T09:00:00.000Z'),
    origin: 'high-band-dm',
    ...overrides,
  };
}

function makeDraftStore(overrides: Partial<DraftStore> = {}): DraftStore {
  return {
    create: vi.fn<DraftStore['create']>().mockResolvedValue({
      ok: true,
      draft: makePendingTicketDraft(),
    }),
    getByMessage: vi.fn<DraftStore['getByMessage']>(),
    updateContent: vi.fn<DraftStore['updateContent']>(),
    ...overrides,
  };
}

function makeReviewQueueStore(
  overrides: Partial<ReviewQueueStore> = {},
): ReviewQueueStore {
  return {
    create: vi.fn<ReviewQueueStore['create']>(),
    ...overrides,
  };
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
        channelId: 'D123',
        messageTs: '1700000000.000100',
        sourceMessageTs: '1700000000.000050',
        sourceMessageText: 'there might be an issue with the CLI',
        confidence: 55,
        reasoning: 'plausibly a bug, but not clearly actionable',
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
    readonly logger: ReturnType<typeof makeLogger>;
    readonly costStore: ReturnType<typeof makeCostStore>;
    readonly capStore: ReturnType<typeof makeCapStore>;
    readonly channelScopeConfig: HandlerDeps['channelScopeConfig'];
    readonly bankHolidaysCache: HandlerDeps['bankHolidaysCache'];
    readonly draftStore: HandlerDeps['draftStore'];
    readonly reviewQueueStore: HandlerDeps['reviewQueueStore'];
    readonly confirmingQuestionStore: HandlerDeps['confirmingQuestionStore'];
  }> = {},
) {
  return {
    anthropicClient: makeAnthropicClient(),
    slackClient: makeSlackClient(),
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
    // Deliberately does NOT contain `D123`, the DM fixture's own channel. A `{kind: 'channel'}`
    // Stage 0 mistake would therefore drop every DM here — see the dedicated Stage 0 tests below,
    // which pin the surface-kind decision directly rather than relying on this asymmetry alone.
    channelScopeConfig: { workRelevantChannelIds: new Set(['C123']) },
    bankHolidaysCache: makeBankHolidaysCache(),
    ticketStore: {
      create: vi.fn<HandlerDeps['ticketStore']['create']>(),
    },
    draftStore: makeDraftStore(),
    reviewQueueStore: makeReviewQueueStore(),
    confirmingQuestionStore: makeConfirmingQuestionStore(),
    ...overrides,
  };
}

const DM_MESSAGE = {
  channelId: 'D123',
  channelType: 'im' as const,
  userId: 'U123',
  text: 'the CLI hangs on large repos, can someone look',
  ts: '1700000000.000050',
};

// Thursday 10:00 Europe/London (09:00 UTC, BST) — inside the 08:30-17:00 core-hours window.
const WITHIN_CORE_HOURS = new Date('2026-07-16T09:00:00.000Z');
// Thursday 23:00 Europe/London — well outside it.
const OUTSIDE_CORE_HOURS = new Date('2026-07-16T22:00:00.000Z');

const HIGH_BAND = { confidence: 88, reasoning: 'describes a concrete bug' };
const MID_BAND = { confidence: 55, reasoning: 'plausibly a bug' };
const DRAFT = {
  title: 'CLI hangs on large repos',
  body: 'The CLI hangs when run against large repos.',
};

describe('runDmIntakeCascade', () => {
  describe('Stage 0 — surface scoping', () => {
    it('classifies a DM whose channel is not in the work-relevant set — Stage 0 is asked about a `dm` surface, not a `channel` one (BUILD_PLAN 3.7)', async () => {
      // The trap this pins: `isSurfaceInScope` short-circuits `{kind: 'dm'}` to always-in-scope,
      // but tests a `{kind: 'channel'}` surface against `workRelevantChannelIds`. A DM channel id
      // (`D…`) is never in that set, so passing `{kind: 'channel'}` here would silently drop
      // *every* DM out of the cascade while looking like an ordinary scoping miss.
      const deps = makeDeps({
        channelScopeConfig: { workRelevantChannelIds: new Set(['C123']) },
      });

      await runDmIntakeCascade(deps, DM_MESSAGE, WITHIN_CORE_HOURS);

      expect(deps.anthropicClient.messages.parse).toHaveBeenCalledTimes(1);
    });

    it('classifies a DM even when no work-relevant channels are configured at all', async () => {
      // The strongest form of the same check: with an empty allow-list, a `{kind: 'channel'}`
      // Stage 0 call cannot possibly pass, so reaching the classifier proves the `dm` arm ran.
      const deps = makeDeps({
        channelScopeConfig: { workRelevantChannelIds: new Set<string>() },
      });

      await runDmIntakeCascade(deps, DM_MESSAGE, WITHIN_CORE_HOURS);

      expect(deps.anthropicClient.messages.parse).toHaveBeenCalledTimes(1);
    });
  });

  describe('High band', () => {
    it('posts a ticket draft, persists it as `high-band-dm`, seeds the legend, and reports the posted text back for the conversation history', async () => {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: HIGH_BAND,
          draftResponse: DRAFT,
        }),
        slackClient: makeSlackClient({ ok: true, ts: '1700000099.000100' }),
      });

      const result = await runDmIntakeCascade(
        deps,
        DM_MESSAGE,
        WITHIN_CORE_HOURS,
      );

      expect(result).toEqual({
        handled: true,
        postedText: expect.stringContaining(
          'CLI hangs on large repos',
        ) as string,
      });

      // Posted as a threaded reply on the source DM, not a new top-level message.
      expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'D123',
          thread_ts: '1700000000.000050',
        }),
      );

      // `high-band-dm`, not `high-band` — keeps DM drafts out of `getDraftOutcomeCounts`'s
      // ambient-classifier acceptance-rate population (VISION §5.4).
      expect(deps.draftStore.create).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'D123',
          messageTs: '1700000099.000100',
          origin: 'high-band-dm',
        }),
      );

      expect(deps.slackClient.reactions.add).toHaveBeenNthCalledWith(1, {
        channel: 'D123',
        timestamp: '1700000099.000100',
        name: 'package',
      });
      expect(deps.slackClient.reactions.add).toHaveBeenNthCalledWith(3, {
        channel: 'D123',
        timestamp: '1700000099.000100',
        name: 'white_check_mark',
      });
    });

    it('returns the exact text that was posted to Slack, so the persisted assistant turn cannot drift from the real transcript', async () => {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: HIGH_BAND,
          draftResponse: DRAFT,
        }),
      });

      const result = await runDmIntakeCascade(
        deps,
        DM_MESSAGE,
        WITHIN_CORE_HOURS,
      );

      const postedArg = deps.slackClient.chat.postMessage.mock
        .calls[0]?.[0] as {
        text: string;
      };
      expect(result).toEqual({ handled: true, postedText: postedArg.text });
    });

    it('never consults the situational-appropriateness gate — a DM-triggered post is reactive, not unprompted (BUILD_PLAN 3.7)', async () => {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: HIGH_BAND,
          draftResponse: DRAFT,
        }),
      });

      await runDmIntakeCascade(deps, DM_MESSAGE, WITHIN_CORE_HOURS);

      // Exactly two `.parse()` calls — Stage 1 classify, then the Sonnet draft composer. A third
      // would mean the Haiku appropriateness gate had crept onto this path; because that gate
      // fails CLOSED, that would silently convert a DM draft into no draft at all on any gate
      // error, which is exactly the silence 3.7's invariant forbids.
      expect(deps.anthropicClient.messages.parse).toHaveBeenCalledTimes(2);
      const secondCall = deps.anthropicClient.messages.parse.mock
        .calls[1]?.[0] as { model: string };
      expect(secondCall.model).toBe('claude-sonnet-5');
    });

    it('still drafts outside core hours — the operating-rhythm guard does not reach a DM-triggered post (BUILD_PLAN 2.7a/3.7)', async () => {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: HIGH_BAND,
          draftResponse: DRAFT,
        }),
      });

      const result = await runDmIntakeCascade(
        deps,
        DM_MESSAGE,
        OUTSIDE_CORE_HOURS,
      );

      expect(result.handled).toBe(true);
      expect(deps.draftStore.create).toHaveBeenCalled();
    });

    it('still drafts on a bank holiday, and on a cold-boot cache that would otherwise fail closed', async () => {
      // `evaluateOperatingRhythm` fails CLOSED when the bank-holidays cache has never completed a
      // successful fetch. If that guard were ever wired onto this path, a cold boot would make
      // every work-shaped DM produce nothing at all — the single worst case 3.7's invariant
      // exists to prevent. A rejecting `fetchFn` reproduces exactly that cold-boot state.
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: HIGH_BAND,
          draftResponse: DRAFT,
        }),
        bankHolidaysCache: createBankHolidaysCache({
          fetchFn: vi.fn().mockRejectedValue(new Error('network down')),
        }),
      });

      const result = await runDmIntakeCascade(
        deps,
        DM_MESSAGE,
        WITHIN_CORE_HOURS,
      );

      expect(result.handled).toBe(true);
      expect(deps.draftStore.create).toHaveBeenCalled();
    });

    it('falls through when composing the draft fails — never leaves the DM unanswered', async () => {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: HIGH_BAND,
          draftResponse: () => {
            throw new Error('rate limited');
          },
        }),
      });

      const result = await runDmIntakeCascade(
        deps,
        DM_MESSAGE,
        WITHIN_CORE_HOURS,
      );

      expect(result).toEqual({ handled: false });
    });

    it('falls through when posting the draft to Slack fails', async () => {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: HIGH_BAND,
          draftResponse: DRAFT,
        }),
        slackClient: makeSlackClient({ ok: false, error: 'channel_not_found' }),
      });

      const result = await runDmIntakeCascade(
        deps,
        DM_MESSAGE,
        WITHIN_CORE_HOURS,
      );

      expect(result).toEqual({ handled: false });
    });

    it('falls through when persisting the pending draft fails after a successful post', async () => {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: HIGH_BAND,
          draftResponse: DRAFT,
        }),
        draftStore: makeDraftStore({
          create: vi.fn<DraftStore['create']>().mockResolvedValue({
            ok: false,
            error: { kind: 'unknown', cause: new Error('connection reset') },
          }),
        }),
      });

      const result = await runDmIntakeCascade(
        deps,
        DM_MESSAGE,
        WITHIN_CORE_HOURS,
      );

      expect(result).toEqual({ handled: false });
    });
  });

  describe('Mid band', () => {
    it('posts a confirming question with the 👍/👎 legend and reports its text back', async () => {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({ parseResponse: MID_BAND }),
        slackClient: makeSlackClient({ ok: true, ts: '1700000099.000100' }),
      });

      const result = await runDmIntakeCascade(
        deps,
        DM_MESSAGE,
        WITHIN_CORE_HOURS,
      );

      expect(result).toEqual({
        handled: true,
        postedText: expect.stringContaining('draft a ticket') as string,
      });
      expect(deps.confirmingQuestionStore.create).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'D123',
          sourceMessageTs: '1700000000.000050',
          confidence: 55,
        }),
      );
      expect(deps.slackClient.reactions.add).toHaveBeenNthCalledWith(1, {
        channel: 'D123',
        timestamp: '1700000099.000100',
        name: 'thumbsup',
      });
    });

    it('never composes a ticket draft — the confirming question is the whole Mid-band action', async () => {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({ parseResponse: MID_BAND }),
      });

      await runDmIntakeCascade(deps, DM_MESSAGE, WITHIN_CORE_HOURS);

      expect(deps.anthropicClient.messages.parse).toHaveBeenCalledTimes(1);
      expect(deps.draftStore.create).not.toHaveBeenCalled();
    });

    it('still posts outside core hours — same reactive reasoning as the High band', async () => {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({ parseResponse: MID_BAND }),
      });

      const result = await runDmIntakeCascade(
        deps,
        DM_MESSAGE,
        OUTSIDE_CORE_HOURS,
      );

      expect(result.handled).toBe(true);
    });

    it('falls through when posting the confirming question fails', async () => {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({ parseResponse: MID_BAND }),
        slackClient: makeSlackClient({ ok: false, error: 'channel_not_found' }),
      });

      const result = await runDmIntakeCascade(
        deps,
        DM_MESSAGE,
        WITHIN_CORE_HOURS,
      );

      expect(result).toEqual({ handled: false });
    });
  });

  describe('Low band', () => {
    it('falls through to the conversational reply and posts nothing itself', async () => {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: { confidence: 10, reasoning: 'reads as chit-chat' },
        }),
      });

      const result = await runDmIntakeCascade(
        deps,
        DM_MESSAGE,
        WITHIN_CORE_HOURS,
      );

      expect(result).toEqual({ handled: false });
      expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it('writes no review-queue row — a DM that got a real answer was not silently eaten (BUILD_PLAN 3.7)', async () => {
      // Deliberately unlike the ambient Low-band path, which *does* write one. VISION §5.2's
      // review queue exists so nothing is silently eaten; a DM always gets a conversational reply,
      // so logging every "thanks" would only bury the 3.5 sweep digest in chatter.
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: { confidence: 10, reasoning: 'reads as chit-chat' },
        }),
      });

      await runDmIntakeCascade(deps, DM_MESSAGE, WITHIN_CORE_HOURS);

      expect(deps.reviewQueueStore.create).not.toHaveBeenCalled();
    });
  });

  describe('the never-silent invariant', () => {
    it('falls through when the classifier itself fails', async () => {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: () => {
            throw new Error('rate limited');
          },
        }),
      });

      const result = await runDmIntakeCascade(
        deps,
        DM_MESSAGE,
        WITHIN_CORE_HOURS,
      );

      expect(result).toEqual({ handled: false });
      expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it('falls through, without classifying, once the monthly cost cap is reached — the conversational path posts the visible HALT_TEXT instead', async () => {
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
                costUsdMicros: 100_000_000,
              },
            }),
        }),
      });

      const result = await runDmIntakeCascade(
        deps,
        DM_MESSAGE,
        WITHIN_CORE_HOURS,
      );

      expect(result).toEqual({ handled: false });
      expect(deps.anthropicClient.messages.parse).not.toHaveBeenCalled();
    });

    it('records the classifier call against the cost cap — a billed call on a new path must not ship unaccounted for (DA, chunk 3.3)', async () => {
      const deps = makeDeps();

      await runDmIntakeCascade(deps, DM_MESSAGE, WITHIN_CORE_HOURS);

      // 40in/12out at Haiku 4.5's 1/5 micro-USD per token: 40 + 60 = 100.
      expect(deps.costStore.recordUsage).toHaveBeenCalledWith(
        expect.objectContaining({ costUsdMicros: 100 }),
      );
    });
  });
});
