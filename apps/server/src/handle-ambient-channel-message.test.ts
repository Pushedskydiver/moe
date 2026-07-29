import type { HandlerDeps } from './handle-inbound-message.js';
import type { PendingTicketDraft } from '@moe/core';

import { describe, expect, it, vi } from 'vitest';

import { resolvePersonaModel } from '@moe/agents';
import { createBankHolidaysCache } from '@moe/core';

import { handleAmbientChannelMessage } from './handle-ambient-channel-message.js';
import { createSenderTriggerCache } from './sender-trigger-cache.js';
import { makeThreadQueue } from './thread-queue.js';

type CapStore = HandlerDeps['capStore'];
type CostStore = HandlerDeps['costStore'];
type TicketStore = HandlerDeps['ticketStore'];
type DraftStore = HandlerDeps['draftStore'];
type ReviewQueueStore = HandlerDeps['reviewQueueStore'];
type ConfirmingQuestionStore = HandlerDeps['confirmingQuestionStore'];

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

// Every test in this file flows through the Stage 1 classifier's own `.parse()` call first
// (`parseResponse`); a High-band result then reaches the situational-appropriateness gate's own
// `.parse()` call (`appropriatenessResponse`) and, if that gate passes, the ticket-draft
// composer's own `.parse()` call (`draftResponse`) — all three share one Anthropic client, in
// that call order (`handle-ambient-channel-message.ts`'s own `composeAndPostDraft`). Defaults
// keep every option low/no-cost for tests that don't care about it: `parseResponse` defaults to a
// Low-band score so a High-band test has to opt in explicitly, and `appropriatenessResponse`
// defaults to `appropriate: true` so a High-band test that isn't exercising the gate itself
// doesn't need to know it exists.
type MakeAnthropicClientOptions = {
  readonly parseResponse?:
    | { readonly confidence: number; readonly reasoning: string }
    | null
    | (() => never);
  readonly appropriatenessResponse?:
    | { readonly appropriate: boolean; readonly reasoning: string }
    | null
    | (() => never);
  readonly draftResponse?:
    { readonly title: string; readonly body: string } | null | (() => never);
};

// `handleAmbientChannelMessage` takes the full `HandlerDeps['anthropicClient']` intersection
// type, which includes `.messages.create` (the DM chat-reply path's own call) even though the
// ambient path never calls it — `create` stays a bare, uninvoked stub purely to satisfy that
// structural requirement.
function makeAnthropicClient(options: MakeAnthropicClientOptions = {}) {
  const {
    parseResponse = {
      confidence: 10,
      reasoning: 'default test classification',
    },
    appropriatenessResponse = {
      appropriate: true,
      reasoning: 'default: nothing sensitive here',
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
  if (typeof appropriatenessResponse === 'function') {
    parse.mockImplementationOnce(appropriatenessResponse);
  } else {
    parse.mockResolvedValueOnce({
      parsed_output: appropriatenessResponse,
      usage: { input_tokens: 20, output_tokens: 8 },
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

  return {
    messages: {
      create: vi.fn(),
      parse,
    },
  };
}

function makeLogger() {
  return { info: vi.fn(), error: vi.fn() };
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
    sourceMessageTs: '1700000000.000050',
    sourceMessageText: 'the CLI hangs on large repos',
    draftTitle: 'CLI hangs on large repos',
    draftBody: 'The CLI hangs when run against large repos.',
    resolvedAt: null,
    createdAt: new Date('2026-07-16T09:00:00.000Z'),
    origin: 'high-band',
    ...overrides,
  };
}

// Never a real target in this file — `handleAmbientChannelMessage` doesn't touch `ticketStore` at
// all (only its own `composeAndPostDraft` → `draftStore.create` path); a real ✅/📦 write only
// happens via the reaction-outcome path, covered by `handle-reaction-added.test.ts`/
// `reaction-outcome-actions.test.ts`. Kept here purely so `makeDeps` can return a fully-typed
// `HandlerDeps`.
function makeTicketStore(overrides: Partial<TicketStore> = {}): TicketStore {
  return {
    create: vi.fn<TicketStore['create']>().mockResolvedValue({
      ok: true,
      ticket: {
        id: '6fa85f64-5717-4562-b3fc-2c963f66afa9',
        projectKey: 'chief-clancy',
        title: 'CLI hangs on large repos',
        status: 'Brief',
        severity: 'Medium',
        classOfService: 'Standard',
        createdAt: new Date('2026-07-16T09:00:00.000Z'),
        updatedAt: new Date('2026-07-16T09:00:00.000Z'),
      },
    }),
    ...overrides,
  };
}

// `create` is the one real consumer in this file (`postAndPersistDraft`, keyed on the posted
// message's own `ts` — matches `makeSlackClient`'s default, `1700000000.000100`). The other two
// belong to the reaction-outcome path (`handle-reaction-added.ts`), never called here.
function makeDraftStore(overrides: Partial<DraftStore> = {}): DraftStore {
  return {
    create: vi.fn<DraftStore['create']>().mockResolvedValue({
      ok: true,
      draft: makePendingTicketDraft({ messageTs: null }),
    }),
    getByMessage: vi.fn<DraftStore['getByMessage']>(),
    updateContent: vi.fn<DraftStore['updateContent']>(),
    markPosted: vi.fn<DraftStore['markPosted']>().mockResolvedValue({
      ok: true,
      draft: makePendingTicketDraft(),
    }),
    releaseClaim: vi
      .fn<DraftStore['releaseClaim']>()
      .mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

// `create` is the real consumer of a Low-band message (`logAmbientIntakeToReviewQueue`, 3.4c/3.9).
function makeReviewQueueStore(
  overrides: Partial<ReviewQueueStore> = {},
): ReviewQueueStore {
  return {
    create: vi.fn<ReviewQueueStore['create']>().mockResolvedValue({
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

// `create` is the real consumer of a Mid-band message (`composeAndPostConfirmingQuestion`,
// BUILD_PLAN 3.4b-i) — keyed on the posted confirming question's own `ts` (matches
// `makeSlackClient`'s default, `1700000000.000100`), mirroring `makeReviewQueueStore`'s own
// pattern. `getByMessage`/`resolve` have no caller in this file — BUILD_PLAN 3.4b-ii's own real
// consumers (the 👍/👎 reaction-dispatch lookup and its atomic claim, `handle-reaction-added.ts`/
// `reaction-outcome-actions.ts`) live in a different file's own test suite, not this one — bare
// typed stubs here matching `makeDraftStore`'s own precedent for its unused methods.
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
        question: { ...BASE_QUESTION, messageTs: '1700000000.000100' },
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
    readonly logger: ReturnType<typeof makeLogger>;
    readonly costStore: ReturnType<typeof makeCostStore>;
    readonly capStore: ReturnType<typeof makeCapStore>;
    readonly bankHolidaysCache: HandlerDeps['bankHolidaysCache'];
    readonly senderTriggerCache: HandlerDeps['senderTriggerCache'];
    readonly ticketStore: HandlerDeps['ticketStore'];
    readonly draftStore: HandlerDeps['draftStore'];
    readonly reviewQueueStore: HandlerDeps['reviewQueueStore'];
    readonly confirmingQuestionStore: HandlerDeps['confirmingQuestionStore'];
    // BUILD_PLAN 5.2a — the fixture defaults to Sarah, the designated ambient intake listener, so
    // every pre-5.2a test keeps exercising the path it was written for. Overridable so the gate
    // itself can be tested from the other side.
    readonly personaId: HandlerDeps['personaId'];
  }> = {},
) {
  return {
    anthropicClient: makeAnthropicClient(),
    slackClient: makeSlackClient({ ok: true }),
    logger: makeLogger(),
    // `handleAmbientChannelMessage` never touches `historyStore`/`threadQueue` — bare, typed
    // stubs (the same "typed, no implementation" idiom `draftStore`'s own unused methods above
    // use) satisfy `HandlerDeps`'s structural requirement without pretending either is exercised
    // here; `threadQueue` reuses the real, side-effect-free factory instead of a hand-rolled stub.
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
    senderTriggerCache: createSenderTriggerCache(),
    ticketStore: makeTicketStore(),
    draftStore: makeDraftStore(),
    reviewQueueStore: makeReviewQueueStore(),
    confirmingQuestionStore: makeConfirmingQuestionStore(),
    ...overrides,
  };
}

const CHANNEL_MESSAGE = {
  channelId: 'C123',
  channelType: 'channel' as const,
  userId: 'U123',
  text: 'can you help with something',
  ts: '1700000000.000100',
};

describe('handleAmbientChannelMessage', () => {
  it('classifies and logs an in-scope ambient channel message, without fetching/persisting history or posting a reply (BUILD_PLAN 3.3)', async () => {
    const deps = makeDeps({
      anthropicClient: makeAnthropicClient({
        parseResponse: { confidence: 82, reasoning: 'describes a real bug' },
      }),
    });

    await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

    expect(deps.anthropicClient.messages.parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5',
        messages: [{ role: 'user', content: CHANNEL_MESSAGE.text }],
      }),
    );
    expect(deps.logger.info).toHaveBeenCalledWith(
      'classified inbound message',
      {
        personaId: 'sarah',
        channelId: 'C123',
        messageText: CHANNEL_MESSAGE.text,
        confidence: 82,
        reasoning: 'describes a real bug',
      },
    );
    expect(deps.anthropicClient.messages.create).not.toHaveBeenCalled();
    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
    expect(deps.historyStore.getRecentTurns).not.toHaveBeenCalled();
    expect(deps.historyStore.appendTurn).not.toHaveBeenCalled();
  });

  describe('ambient intake scoping (BUILD_PLAN 5.2a)', () => {
    // Every persona is its own process with its own Slack app, so all eight receive the same
    // channel message. Before this gate, all eight classified it: K billed Haiku calls per
    // message — 2K on a High-band message, since the situational-appropriateness gate is a second
    // Haiku call — plus K billed Sonnet drafts and K separately-committable ticket drafts. At the
    // time this gate was written, `pending_ticket_drafts`' `UNIQUE (channel_id, message_ts)` keyed
    // on the *posted* draft's own ts, which differs per persona, so it never collided and never
    // arbitrated anything — this gate was the *only* thing preventing K duplicate drafts. BUILD_PLAN
    // 5.2b later moved the claim key to `(channel_id, source_message_ts)` — identical across
    // personas for the same channel message — specifically so a second layer would also catch it if
    // this gate's own designation were ever wrong; that defence-in-depth doesn't change what this
    // test itself needs to prove, since only one designated persona should ever reach the claim at
    // all.
    it('drops an ambient message entirely for a non-intake persona, before any billed call', async () => {
      const deps = makeDeps({ personaId: 'marcus' });

      await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

      // The cost cap is checked inside `classifyMessageForIntake`, so asserting the cap store is
      // untouched proves the drop happened before even the free pre-flight work, not just before
      // the Anthropic call.
      expect(deps.anthropicClient.messages.parse).not.toHaveBeenCalled();
      expect(deps.capStore.getMonthlyCost).not.toHaveBeenCalled();
      expect(deps.costStore.recordUsage).not.toHaveBeenCalled();
      expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
      expect(deps.draftStore.create).not.toHaveBeenCalled();
      expect(deps.reviewQueueStore.create).not.toHaveBeenCalled();
    });

    it('drops it for a non-intake persona even on a High-band-scoring message in an in-scope channel', async () => {
      // The gate must beat Stage 0 and the classifier both — a non-intake persona should never
      // reach the point where the band could matter.
      const deps = makeDeps({
        personaId: 'nia',
        anthropicClient: makeAnthropicClient({
          parseResponse: { confidence: 95, reasoning: 'a clear bug report' },
          draftResponse: { title: 'x', body: 'y' },
        }),
      });

      await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

      expect(deps.anthropicClient.messages.parse).not.toHaveBeenCalled();
      expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it('still runs the full cascade for the designated intake persona', async () => {
      // The other side of the gate: Sarah is unaffected, which is what keeps every pre-5.2a test
      // in this file meaningful rather than vacuously passing.
      const deps = makeDeps({ personaId: 'sarah' });

      await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

      expect(deps.anthropicClient.messages.parse).toHaveBeenCalled();
    });
  });

  it('does nothing at all for an out-of-scope ambient channel message — the classifier is never called (Stage 0, BUILD_PLAN 3.2)', async () => {
    const deps = makeDeps();

    await handleAmbientChannelMessage(deps, {
      ...CHANNEL_MESSAGE,
      channelId: 'C_NOT_CONFIGURED',
    });

    expect(deps.anthropicClient.messages.parse).not.toHaveBeenCalled();
    expect(deps.anthropicClient.messages.create).not.toHaveBeenCalled();
    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
    expect(deps.logger.info).not.toHaveBeenCalled();
  });

  // BUILD_PLAN 3.11 — this test previously asserted `logger.info` was never called, which is
  // exactly how the underlying silent loss survived: "posted nothing" was treated as the whole
  // requirement, and "persisted nothing either" went unexamined, the identical shape 3.9's own
  // off-hours fix corrected for the rhythm guard. It now pins the message SURVIVING as a
  // `review_queue` row instead.
  it('writes a classification-failed review-queue row, instead of losing the message, when classifying an ambient channel message fails', async () => {
    const deps = makeDeps({
      anthropicClient: makeAnthropicClient({
        parseResponse: () => {
          throw new Error('rate limited');
        },
      }),
    });

    await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to classify inbound message',
      { errorMessage: 'rate limited' },
    );
    expect(deps.reviewQueueStore.create).toHaveBeenCalledWith({
      personaId: 'sarah',
      channelId: 'C123',
      messageTs: CHANNEL_MESSAGE.ts,
      sourceMessageText: CHANNEL_MESSAGE.text,
      confidence: null,
      reasoning: 'rate limited',
      outcomeReason: 'classification-failed',
    });
    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
  });

  it("records the classifier call's token usage and its Haiku-priced cost against the persona/day bucket, same cap-accounting mechanism as the DM path (DA fold, BUILD_PLAN 3.3)", async () => {
    const deps = makeDeps({
      anthropicClient: makeAnthropicClient({
        parseResponse: { confidence: 82, reasoning: 'describes a real bug' },
      }),
    });

    await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

    // The classifier mock's default usage is {input_tokens: 40, output_tokens: 12}; Haiku 4.5 is
    // a flat $1/$5 per MTok: 40 * 1 + 12 * 5 = 100 micro-USD.
    expect(deps.costStore.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        personaId: 'sarah',
        inputTokens: 40,
        outputTokens: 12,
        costUsdMicros: 100,
      }),
    );
  });

  it('does not record cost usage when classifying an ambient channel message fails — there is no token usage to account for', async () => {
    const deps = makeDeps({
      anthropicClient: makeAnthropicClient({
        parseResponse: () => {
          throw new Error('rate limited');
        },
      }),
    });

    await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

    expect(deps.costStore.recordUsage).not.toHaveBeenCalled();
  });

  it('hard-halts and skips classification entirely once monthly spend reaches the cap — ambient messages are gated by the same cap as the DM path (DA fold, BUILD_PLAN 3.3)', async () => {
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

    await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

    expect(deps.anthropicClient.messages.parse).not.toHaveBeenCalled();
    expect(deps.costStore.recordUsage).not.toHaveBeenCalled();
    expect(deps.logger.info).toHaveBeenCalledWith(
      'skipping classification — monthly cost cap reached',
      { personaId: 'sarah', channelId: 'C123' },
    );
    // BUILD_PLAN 3.11's own scope boundary, pinned explicitly rather than left to the type system
    // alone: this branch has no classifier output to persist (`classifyMessageForIntake` never
    // reaches the billed call), unlike the sibling `'classification-failed'` reason below, which
    // does write a row.
    expect(deps.reviewQueueStore.create).not.toHaveBeenCalled();
  });

  it('composes, posts, persists, and seeds the reaction legend for a High-band ambient message, with its own cost accounting (BUILD_PLAN 3.4a-i/3.4a-iii)', async () => {
    // Thursday 10:00 Europe/London (09:00 UTC, BST) — within the 08:30-17:00 core-hours window
    // (BUILD_PLAN 2.7a), so the operating-rhythm guard doesn't block this test's draft-composition
    // path. Real-clock `new Date()` would make this test's pass/fail depend on the time of day it
    // happens to run.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: {
            confidence: 88,
            reasoning: 'describes a concrete bug',
          },
          appropriatenessResponse: {
            appropriate: true,
            reasoning: 'a routine bug report',
          },
          draftResponse: {
            title: 'CLI hangs on large repos',
            body: 'The CLI hangs when run against large repos.',
          },
        }),
        slackClient: makeSlackClient({ ok: true, ts: '1700000099.000100' }),
      });
      const channelMessage = {
        ...CHANNEL_MESSAGE,
        ts: '1700000000.000050',
        text: 'hey, there is an issue about the CLI hanging on large repos — someone want to take a look?',
      };

      await handleAmbientChannelMessage(deps, channelMessage);

      expect(deps.anthropicClient.messages.parse).toHaveBeenCalledTimes(3);
      const thirdCall = deps.anthropicClient.messages.parse.mock
        .calls[2]?.[0] as {
        model: string;
        messages: ReadonlyArray<{ role: string; content: string }>;
      };
      // BUILD_PLAN 5.3a — asserted against resolvePersonaModel's own output for this persona
      // rather than a hardcoded literal, so this still means something once a persona gets a
      // real per-persona override.
      expect(thirdCall.model).toBe(resolvePersonaModel(deps.personaId));
      expect(thirdCall.messages).toEqual([
        { role: 'user', content: channelMessage.text },
      ]);

      // Posted as a threaded reply on the source message, not a new top-level message.
      expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          thread_ts: '1700000000.000050',
          text: expect.stringContaining('CLI hangs on large repos') as string,
        }),
      );

      // Claimed keyed on the *source* message's own ts, before the Slack post ever happens
      // (BUILD_PLAN 5.2b) — not the posted message's ts, which doesn't exist yet at claim time.
      expect(deps.draftStore.create).toHaveBeenCalledWith({
        personaId: 'sarah',
        channelId: 'C123',
        sourceMessageTs: '1700000000.000050',
        sourceMessageText: channelMessage.text,
        draftTitle: 'CLI hangs on large repos',
        draftBody: 'The CLI hangs when run against large repos.',
        origin: 'high-band',
      });

      // messageTs filled in on the claimed row only once the real post succeeds (BUILD_PLAN 5.2b).
      expect(deps.draftStore.markPosted).toHaveBeenCalledWith(
        '5fa85f64-5717-4562-b3fc-2c963f66afa8',
        '1700000099.000100',
      );

      // The 📦/🔁/✅ legend, seeded in order onto the real posted message.
      expect(deps.slackClient.reactions.add).toHaveBeenNthCalledWith(1, {
        channel: 'C123',
        timestamp: '1700000099.000100',
        name: 'package',
      });
      expect(deps.slackClient.reactions.add).toHaveBeenNthCalledWith(2, {
        channel: 'C123',
        timestamp: '1700000099.000100',
        name: 'repeat',
      });
      expect(deps.slackClient.reactions.add).toHaveBeenNthCalledWith(3, {
        channel: 'C123',
        timestamp: '1700000099.000100',
        name: 'white_check_mark',
      });

      expect(deps.logger.info).toHaveBeenCalledWith('posted ticket draft', {
        personaId: 'sarah',
        channelId: 'C123',
        draftId: '5fa85f64-5717-4562-b3fc-2c963f66afa8',
        draftTitle: 'CLI hangs on large repos',
        draftBody: 'The CLI hangs when run against large repos.',
        origin: 'high-band',
      });

      // Three LLM calls this turn (classify + appropriateness + compose) — classifier usage
      // (40in/12out, Haiku: 40*1+12*5=100), appropriateness usage (20in/8out, Haiku:
      // 20*1+8*5=60), and the draft composer's (120in/40out, Sonnet 5 introductory $2/$10 per
      // MTok: 120*2+40*10=640) — three separate calls to recordUsage, in that order.
      expect(deps.costStore.recordUsage).toHaveBeenCalledTimes(3);
      expect(deps.costStore.recordUsage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ costUsdMicros: 100 }),
      );
      expect(deps.costStore.recordUsage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ costUsdMicros: 60 }),
      );
      expect(deps.costStore.recordUsage).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ costUsdMicros: 640 }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails closed — skips composing and posting — when the situational-appropriateness gate itself errors (BUILD_PLAN 3.4a-iii)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: {
            confidence: 88,
            reasoning: 'describes a concrete bug',
          },
          appropriatenessResponse: () => {
            throw new Error('rate limited');
          },
        }),
      });

      await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

      expect(deps.logger.error).toHaveBeenCalledWith(
        'failed to evaluate situational appropriateness — skipping ticket-draft composition (fail-closed)',
        expect.objectContaining({ errorMessage: 'rate limited' }),
      );
      expect(deps.anthropicClient.messages.parse).toHaveBeenCalledTimes(2);
      expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
      // Only the classifier's own usage was recorded — the gate call never succeeded.
      expect(deps.costStore.recordUsage).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips composing and posting when the situational-appropriateness gate says inappropriate (BUILD_PLAN 3.4a-iii)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: {
            confidence: 88,
            reasoning: 'describes a concrete bug',
          },
          appropriatenessResponse: {
            appropriate: false,
            reasoning: 'describes a round of layoffs',
          },
        }),
      });

      await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

      expect(deps.logger.info).toHaveBeenCalledWith(
        'skipping ticket-draft composition — situationally inappropriate',
        {
          personaId: 'sarah',
          channelId: 'C123',
          reasoning: 'describes a round of layoffs',
        },
      );
      expect(deps.anthropicClient.messages.parse).toHaveBeenCalledTimes(2);
      expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
      // The gate call itself succeeded, so its usage IS recorded — only compose never ran.
      expect(deps.costStore.recordUsage).toHaveBeenCalledTimes(2);
      // BUILD_PLAN 3.10's own scope boundary, pinned: a genuine `appropriate: false` verdict is a
      // considered decision, not silent data loss, and stays silent — unlike the gate's OTHER
      // `return false` branch (an infrastructure blip), which now writes a row (see the
      // fail-closed test below).
      expect(deps.reviewQueueStore.create).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs an error, without throwing, when claiming the pending ticket draft fails — before ever posting to Slack (BUILD_PLAN 5.2b)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: {
            confidence: 88,
            reasoning: 'describes a concrete bug',
          },
          appropriatenessResponse: { appropriate: true, reasoning: 'fine' },
          draftResponse: { title: 'x', body: 'y' },
        }),
        draftStore: makeDraftStore({
          create: vi.fn<DraftStore['create']>().mockResolvedValue({
            ok: false,
            error: { kind: 'unknown', cause: new Error('connection reset') },
          }),
        }),
      });

      await expect(
        handleAmbientChannelMessage(deps, CHANNEL_MESSAGE),
      ).resolves.toBeUndefined();

      expect(deps.logger.error).toHaveBeenCalledWith(
        'failed to claim pending ticket draft',
        { errorMessage: 'Error: connection reset' },
      );
      expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
      expect(deps.slackClient.reactions.add).not.toHaveBeenCalled();
      expect(deps.logger.info).not.toHaveBeenCalledWith(
        'posted ticket draft',
        expect.anything(),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs an error, without throwing, when posting the ticket draft to Slack fails — the claim already made is released, not left orphaned (DA review, BUILD_PLAN 5.2b)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: {
            confidence: 88,
            reasoning: 'describes a concrete bug',
          },
          appropriatenessResponse: { appropriate: true, reasoning: 'fine' },
          draftResponse: { title: 'x', body: 'y' },
        }),
        slackClient: makeSlackClient({ ok: false, error: 'channel_not_found' }),
      });

      await expect(
        handleAmbientChannelMessage(deps, CHANNEL_MESSAGE),
      ).resolves.toBeUndefined();

      expect(deps.logger.error).toHaveBeenCalledWith(
        'failed to post ticket draft',
        { errorMessage: 'channel_not_found' },
      );
      expect(deps.draftStore.create).toHaveBeenCalled();
      expect(deps.draftStore.markPosted).not.toHaveBeenCalled();
      expect(deps.draftStore.releaseClaim).toHaveBeenCalledWith(
        '5fa85f64-5717-4562-b3fc-2c963f66afa8',
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
        anthropicClient: makeAnthropicClient({
          parseResponse: {
            confidence: 88,
            reasoning: 'describes a concrete bug',
          },
          appropriatenessResponse: { appropriate: true, reasoning: 'fine' },
          draftResponse: { title: 'x', body: 'y' },
        }),
        slackClient: makeSlackClient({ ok: false, error: 'channel_not_found' }),
        draftStore: makeDraftStore({
          releaseClaim: vi.fn<DraftStore['releaseClaim']>().mockResolvedValue({
            ok: false,
            error: { cause: new Error('connection reset') },
          }),
        }),
      });

      await expect(
        handleAmbientChannelMessage(deps, CHANNEL_MESSAGE),
      ).resolves.toBeUndefined();

      expect(deps.logger.error).toHaveBeenCalledWith(
        'failed to release pending ticket draft claim',
        { errorMessage: 'Error: connection reset' },
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs an error, without throwing, when marking the claimed draft posted fails after a successful Slack post (BUILD_PLAN 5.2b)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: {
            confidence: 88,
            reasoning: 'describes a concrete bug',
          },
          appropriatenessResponse: { appropriate: true, reasoning: 'fine' },
          draftResponse: { title: 'x', body: 'y' },
        }),
        draftStore: makeDraftStore({
          markPosted: vi.fn<DraftStore['markPosted']>().mockResolvedValue({
            ok: false,
            error: { kind: 'unavailable' },
          }),
        }),
      });

      await expect(
        handleAmbientChannelMessage(deps, CHANNEL_MESSAGE),
      ).resolves.toBeUndefined();

      expect(deps.logger.error).toHaveBeenCalledWith(
        'failed to mark pending ticket draft posted',
        {
          errorMessage: 'draft was already marked posted, or no longer exists',
        },
      );
      expect(deps.slackClient.reactions.add).not.toHaveBeenCalled();
      expect(deps.logger.info).not.toHaveBeenCalledWith(
        'posted ticket draft',
        expect.anything(),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs an error for a reaction that fails to add, but still attempts the remaining legend reactions', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: {
            confidence: 88,
            reasoning: 'describes a concrete bug',
          },
          appropriatenessResponse: { appropriate: true, reasoning: 'fine' },
          draftResponse: { title: 'x', body: 'y' },
        }),
        slackClient: makeSlackClient({ ok: true }, [
          { ok: false, error: 'already_reacted' },
        ]),
      });

      await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

      expect(deps.logger.error).toHaveBeenCalledWith(
        'failed to add reaction-gate legend reaction',
        expect.objectContaining({ reactionName: 'package' }),
      );
      expect(deps.slackClient.reactions.add).toHaveBeenCalledTimes(3);
      expect(deps.logger.info).toHaveBeenCalledWith(
        'posted ticket draft',
        expect.anything(),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  // BUILD_PLAN 5.3a — the squeaky-wheel guard: a second High-band trigger from the same sender in
  // the same channel within the cooldown window is suppressed, not posted, but still survives as a
  // review-queue row (same "nothing silently eaten" treatment as every other guard exit).
  it('writes a high-band-repeated-sender review-queue row, and pays for no further Anthropic call, on a second High-band trigger from the same sender in the same channel', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: {
            confidence: 88,
            reasoning: 'describes a concrete bug',
          },
          appropriatenessResponse: {
            appropriate: true,
            reasoning: 'a routine bug report',
          },
          draftResponse: { title: 'x', body: 'y' },
        }),
      });

      await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);
      const callsAfterFirst =
        deps.anthropicClient.messages.parse.mock.calls.length;
      // Queues the second message's own Stage 1 classify response — the mock only pre-loads
      // enough responses for one full flow, and this message's flow should stop at classify.
      deps.anthropicClient.messages.parse.mockResolvedValueOnce({
        parsed_output: {
          confidence: 88,
          reasoning: 'describes a concrete bug',
        },
        usage: { input_tokens: 40, output_tokens: 12 },
      });

      await handleAmbientChannelMessage(deps, {
        ...CHANNEL_MESSAGE,
        ts: '1700000000.000200',
        text: 'a second, different message from the same person',
      });

      // Only one more parse call — the second message's own Stage 1 classify. Neither the
      // situational-appropriateness gate nor the draft composer are paid for: the frequency guard
      // blocks before either runs.
      expect(deps.anthropicClient.messages.parse.mock.calls.length).toBe(
        callsAfterFirst + 1,
      );
      expect(deps.reviewQueueStore.create).toHaveBeenCalledWith({
        personaId: 'sarah',
        channelId: 'C123',
        messageTs: '1700000000.000200',
        sourceMessageText: 'a second, different message from the same person',
        confidence: 88,
        reasoning: 'describes a concrete bug',
        outcomeReason: 'high-band-repeated-sender',
      });
      expect(deps.logger.info).toHaveBeenCalledWith(
        'skipping ticket-draft composition — repeated sender within cooldown window',
        { personaId: 'sarah', channelId: 'C123', userId: 'U123' },
      );
      // Only the first message's own draft was posted — the blocked second one produced nothing.
      expect(deps.slackClient.chat.postMessage).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('is satisfied for a second High-band trigger from a different sender in the same channel, even right after the first', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: {
            confidence: 88,
            reasoning: 'describes a concrete bug',
          },
          appropriatenessResponse: {
            appropriate: true,
            reasoning: 'a routine bug report',
          },
          draftResponse: { title: 'x', body: 'y' },
        }),
      });

      await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);
      // Queues a second full flow's worth of responses (classify, appropriateness, draft) — the
      // mock only pre-loads enough for one, and this message's flow should run all the way through
      // since it's a different sender, not suppressed by the frequency guard.
      deps.anthropicClient.messages.parse
        .mockResolvedValueOnce({
          parsed_output: {
            confidence: 88,
            reasoning: 'describes a concrete bug',
          },
          usage: { input_tokens: 40, output_tokens: 12 },
        })
        .mockResolvedValueOnce({
          parsed_output: {
            appropriate: true,
            reasoning: 'a routine bug report',
          },
          usage: { input_tokens: 20, output_tokens: 8 },
        })
        .mockResolvedValueOnce({
          parsed_output: { title: 'x', body: 'y' },
          usage: { input_tokens: 120, output_tokens: 40 },
        });

      await handleAmbientChannelMessage(deps, {
        ...CHANNEL_MESSAGE,
        ts: '1700000000.000200',
        userId: 'U999',
        text: 'a different person reporting a different bug',
      });

      expect(deps.slackClient.chat.postMessage).toHaveBeenCalledTimes(2);
      expect(deps.reviewQueueStore.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          outcomeReason: 'high-band-repeated-sender',
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  // BUILD_PLAN 3.9 — this test previously asserted only that nothing was posted, which is exactly
  // how the bug survived: "did not post" was treated as the whole requirement, and "did not
  // persist anything either" went unexamined. It now pins the message SURVIVING.
  it('writes a high-band-off-hours review-queue row, instead of losing the message, when the rhythm guard blocks a High-band draft outside core hours (BUILD_PLAN 3.9)', async () => {
    // Thursday 22:00 Europe/London — well past the 17:00 core-hours cutoff.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T21:00:00.000Z'));
    try {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: {
            confidence: 88,
            reasoning: 'describes a concrete bug',
          },
        }),
      });

      await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

      // Still only the Stage 1 classify — the billed situational-appropriateness call is
      // deliberately NOT paid to decide whether to write a private row nothing posts from.
      expect(deps.anthropicClient.messages.parse).toHaveBeenCalledTimes(1);
      expect(deps.reviewQueueStore.create).toHaveBeenCalledWith({
        personaId: 'sarah',
        channelId: 'C123',
        messageTs: CHANNEL_MESSAGE.ts,
        sourceMessageText: CHANNEL_MESSAGE.text,
        confidence: 88,
        reasoning: 'describes a concrete bug',
        outcomeReason: 'high-band-off-hours',
      });
      expect(deps.logger.info).toHaveBeenCalledWith(
        'skipping ticket-draft composition — outside core hours',
        {
          personaId: 'sarah',
          channelId: 'C123',
          reason: 'outside-window',
        },
      );
      // §14's rest rule is still intact: a durable row, but nothing posted into the workspace.
      expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
      expect(deps.logger.info).not.toHaveBeenCalledWith(
        'posted ticket draft',
        expect.anything(),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('writes the same high-band-off-hours row on a bank holiday, even within the core-hours window (BUILD_PLAN 3.9, 2.7a operating-rhythm guard)', async () => {
    // Same in-window instant as the successful High-band test above, but this persona's
    // bank-holidays cache reports that exact London-local date as a bank holiday. Both
    // `evaluateOperatingRhythm` reasons must reach the same review-queue write — a bank holiday is
    // the case VISION §14 names explicitly, so losing the message there would be the worse of the
    // two, not a lesser variant.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: {
            confidence: 88,
            reasoning: 'describes a concrete bug',
          },
        }),
        bankHolidaysCache: makeBankHolidaysCache(['2026-07-16']),
      });

      await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

      expect(deps.anthropicClient.messages.parse).toHaveBeenCalledTimes(1);
      expect(deps.reviewQueueStore.create).toHaveBeenCalledWith(
        expect.objectContaining({ outcomeReason: 'high-band-off-hours' }),
      );
      expect(deps.logger.info).toHaveBeenCalledWith(
        'skipping ticket-draft composition — outside core hours',
        {
          personaId: 'sarah',
          channelId: 'C123',
          reason: 'bank-holiday',
        },
      );
    } finally {
      vi.useRealTimers();
    }
  });

  // BUILD_PLAN 3.10 closes the scope boundary 3.9 deliberately left open: a cost-cap halt now
  // writes a review-queue row too, distinguishably from an off-hours block (`'high-band-cost-cap'`
  // vs `'high-band-off-hours'`) — Alex scoped 3.9 to the rhythm guard only, and the cap case is
  // this chunk's own.
  //
  // An already-over-cap persona halts inside `classifyMessageForIntake`, *before* the draft guard
  // is reached — so that scenario says nothing about the guard's own cap branch. DA review proved
  // it (chunk 3.9): written that way, deleting `composeAndPostDraft`'s reason check entirely left
  // the whole suite green, because the assertion was vacuously true on a function that never ran.
  // This test therefore crosses the cap **mid-turn** — under at classify, over at the guard — which
  // `run-dm-intake-cascade.ts` documents as a real occurrence, not a contrived one, since the
  // classify call is itself billed and recorded before the guard re-checks.
  it('writes a high-band-cost-cap review-queue row, instead of losing the message, when the cost cap is crossed mid-turn, between the classify and the draft guard (BUILD_PLAN 3.10)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const underCap = {
        ok: true as const,
        total: {
          personaId: 'sarah',
          month: '2026-07',
          inputTokens: 0,
          outputTokens: 0,
          costUsdMicros: 0,
        },
      };
      const overCap = {
        ok: true as const,
        total: { ...underCap.total, costUsdMicros: 100_000_000 },
      };
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: {
            confidence: 88,
            reasoning: 'describes a concrete bug',
          },
        }),
        capStore: makeCapStore({
          getMonthlyCost: vi
            .fn<CapStore['getMonthlyCost']>()
            .mockResolvedValueOnce(underCap)
            .mockResolvedValue(overCap),
        }),
      });

      await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

      // Proof the guard was actually reached this time — the classify happened, and the halt is
      // reported against ticket-draft composition, not classification.
      expect(deps.anthropicClient.messages.parse).toHaveBeenCalledTimes(1);
      expect(deps.logger.info).toHaveBeenCalledWith(
        'skipping ticket-draft composition — monthly cost cap reached',
        { personaId: 'sarah', channelId: 'C123' },
      );
      expect(deps.reviewQueueStore.create).toHaveBeenCalledWith({
        personaId: 'sarah',
        channelId: 'C123',
        messageTs: CHANNEL_MESSAGE.ts,
        sourceMessageText: CHANNEL_MESSAGE.text,
        confidence: 88,
        reasoning: 'describes a concrete bug',
        outcomeReason: 'high-band-cost-cap',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  // The OTHER branch DA's mutation testing found unpinned at chunk 3.9 — the fail-closed
  // appropriateness gate also left the suite green. BUILD_PLAN 3.10 closes it: an infrastructure
  // blip (this test) now writes a row, distinguishably from a genuine `appropriate: false` verdict
  // (which stays silent — see the test above pinning that boundary negatively).
  it('writes a high-band-appropriateness-check-failed review-queue row, instead of losing the message, when the situational-appropriateness gate fails closed on a High-band ambient message (BUILD_PLAN 3.10)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: {
            confidence: 88,
            reasoning: 'describes a concrete bug',
          },
          appropriatenessResponse: () => {
            throw new Error('rate limited');
          },
        }),
      });

      await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

      expect(deps.logger.error).toHaveBeenCalledWith(
        'failed to evaluate situational appropriateness — skipping ticket-draft composition (fail-closed)',
        expect.objectContaining({ errorMessage: 'rate limited' }),
      );
      expect(deps.reviewQueueStore.create).toHaveBeenCalledWith({
        personaId: 'sarah',
        channelId: 'C123',
        messageTs: CHANNEL_MESSAGE.ts,
        sourceMessageText: CHANNEL_MESSAGE.text,
        confidence: 88,
        reasoning: 'describes a concrete bug',
        outcomeReason: 'high-band-appropriateness-check-failed',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('posts a real confirming question, not a ticket draft or a review-queue entry, for a Mid-band ambient message (BUILD_PLAN 3.4b-i)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: { confidence: 50, reasoning: 'ambiguous' },
        }),
      });

      await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

      // Two parse calls: the Stage 1 classifier, then the situational-appropriateness gate
      // composeAndPostConfirmingQuestion itself runs — Mid-band no longer stops at classification
      // alone, unlike before this chunk.
      expect(deps.anthropicClient.messages.parse).toHaveBeenCalledTimes(2);
      expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          text: expect.stringContaining('👍') as string,
        }),
      );
      expect(deps.confirmingQuestionStore.create).toHaveBeenCalledTimes(1);
      expect(deps.logger.info).not.toHaveBeenCalledWith(
        'posted ticket draft',
        expect.anything(),
      );
      expect(deps.reviewQueueStore.create).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  // BUILD_PLAN 5.3a — same squeaky-wheel mechanism as the High-band tests above, Mid-band's own
  // outcomeReason. Not re-testing cross-sender/cross-channel independence here — that's the
  // guard's own concern, already covered by `standing-proactive-guards.test.ts` and the High-band
  // tests above; this just pins that the Mid-band caller is wired to the same guard.
  it('writes a mid-band-repeated-sender review-queue row on a second Mid-band trigger from the same sender in the same channel', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: { confidence: 50, reasoning: 'ambiguous' },
        }),
      });

      await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);
      deps.anthropicClient.messages.parse.mockResolvedValueOnce({
        parsed_output: { confidence: 50, reasoning: 'still ambiguous' },
        usage: { input_tokens: 40, output_tokens: 12 },
      });

      await handleAmbientChannelMessage(deps, {
        ...CHANNEL_MESSAGE,
        ts: '1700000000.000200',
        text: 'a second, still-ambiguous message from the same person',
      });

      expect(deps.reviewQueueStore.create).toHaveBeenCalledWith({
        personaId: 'sarah',
        channelId: 'C123',
        messageTs: '1700000000.000200',
        sourceMessageText:
          'a second, still-ambiguous message from the same person',
        confidence: 50,
        reasoning: 'still ambiguous',
        outcomeReason: 'mid-band-repeated-sender',
      });
      // Only the first message's own confirming question was posted.
      expect(deps.confirmingQuestionStore.create).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not post a confirming question for a Mid-band ambient message outside core hours — same operating-rhythm guard as High-band', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T21:00:00.000Z'));
    try {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: { confidence: 50, reasoning: 'ambiguous' },
        }),
      });

      await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

      expect(deps.anthropicClient.messages.parse).toHaveBeenCalledTimes(1);
      expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
      expect(deps.confirmingQuestionStore.create).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("logs a Low-band ambient message to the review queue, carrying the classifier's own confidence/reasoning through — nothing is silently eaten (BUILD_PLAN 3.4c)", async () => {
    const deps = makeDeps({
      anthropicClient: makeAnthropicClient({
        parseResponse: { confidence: 12, reasoning: 'reads as banter' },
      }),
    });

    await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

    expect(deps.reviewQueueStore.create).toHaveBeenCalledWith({
      personaId: 'sarah',
      channelId: 'C123',
      messageTs: CHANNEL_MESSAGE.ts,
      sourceMessageText: CHANNEL_MESSAGE.text,
      confidence: 12,
      reasoning: 'reads as banter',
      outcomeReason: 'low-confidence',
    });
    expect(deps.anthropicClient.messages.create).not.toHaveBeenCalled();
    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
  });

  it('logs an error, without throwing, when persisting a low-confidence message to the review queue fails', async () => {
    const deps = makeDeps({
      anthropicClient: makeAnthropicClient({
        parseResponse: { confidence: 12, reasoning: 'reads as banter' },
      }),
      reviewQueueStore: makeReviewQueueStore({
        create: vi.fn<ReviewQueueStore['create']>().mockResolvedValue({
          ok: false,
          error: { kind: 'unknown', cause: new Error('connection reset') },
        }),
      }),
    });

    await expect(
      handleAmbientChannelMessage(deps, CHANNEL_MESSAGE),
    ).resolves.toBeUndefined();

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to log ambient message to review queue',
      {
        personaId: 'sarah',
        channelId: 'C123',
        // BUILD_PLAN 3.9 — now that three outcome reasons share one writer, the failure log has to
        // say which write failed, or an operator seeing this line cannot tell a lost Low-band note
        // from a lost High-band bug report.
        outcomeReason: 'low-confidence',
        errorMessage: 'Error: connection reset',
      },
    );
  });

  it('does not log a review-queue entry for a High-band ambient message', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: {
            confidence: 88,
            reasoning: 'describes a concrete bug',
          },
          appropriatenessResponse: { appropriate: true, reasoning: 'fine' },
          draftResponse: { title: 'x', body: 'y' },
        }),
      });

      await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

      expect(deps.reviewQueueStore.create).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs an error and records no cost when composing the ticket draft fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
    try {
      const deps = makeDeps({
        anthropicClient: makeAnthropicClient({
          parseResponse: {
            confidence: 88,
            reasoning: 'describes a concrete bug',
          },
          appropriatenessResponse: { appropriate: true, reasoning: 'fine' },
          draftResponse: () => {
            throw new Error('rate limited');
          },
        }),
      });

      await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

      expect(deps.logger.error).toHaveBeenCalledWith(
        'failed to compose ticket draft',
        {
          errorMessage: 'rate limited',
        },
      );
      expect(deps.logger.info).not.toHaveBeenCalledWith(
        'posted ticket draft',
        expect.anything(),
      );
      // Classifier + appropriateness-gate usage were recorded — the draft call never succeeded.
      expect(deps.costStore.recordUsage).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips drafting (but keeps the classification) when the cost cap is reached between the classify and compose calls', async () => {
    const getMonthlyCost = vi
      .fn<CapStore['getMonthlyCost']>()
      .mockResolvedValueOnce({
        ok: true,
        total: {
          personaId: 'sarah',
          month: '2026-07',
          inputTokens: 0,
          outputTokens: 0,
          costUsdMicros: 0,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        total: {
          personaId: 'sarah',
          month: '2026-07',
          inputTokens: 0,
          outputTokens: 0,
          costUsdMicros: 100_000_000,
        },
      });
    const deps = makeDeps({
      anthropicClient: makeAnthropicClient({
        parseResponse: {
          confidence: 88,
          reasoning: 'describes a concrete bug',
        },
      }),
      capStore: makeCapStore({ getMonthlyCost }),
    });

    await handleAmbientChannelMessage(deps, CHANNEL_MESSAGE);

    expect(deps.anthropicClient.messages.parse).toHaveBeenCalledTimes(1);
    expect(deps.logger.info).toHaveBeenCalledWith(
      'classified inbound message',
      expect.objectContaining({ confidence: 88 }),
    );
    expect(deps.logger.info).toHaveBeenCalledWith(
      'skipping ticket-draft composition — monthly cost cap reached',
      { personaId: 'sarah', channelId: 'C123' },
    );
  });
});
