import type { HandlerDeps } from './handle-inbound-message.js';
import type { PendingTicketDraft } from '@moe/core';
import type { InboundReaction } from '@moe/slack';

import { describe, expect, it, vi } from 'vitest';

import {
  createReactionHandler,
  handleReactionAdded,
} from './handle-reaction-added.js';

type TicketStore = HandlerDeps['ticketStore'];
type DraftStore = HandlerDeps['draftStore'];
type CapStore = HandlerDeps['capStore'];
type CostStore = HandlerDeps['costStore'];

function makeDraft(
  overrides: Partial<PendingTicketDraft> = {},
): PendingTicketDraft {
  return {
    id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    personaId: 'sarah',
    channelId: 'C123',
    messageTs: '1700000000.000100',
    sourceMessageText: 'the CLI hangs on large repos, can someone take a look',
    draftTitle: 'CLI hangs on large repos',
    draftBody: 'The CLI hangs when run against large repos.',
    resolvedAt: null,
    createdAt: new Date('2026-07-18T09:00:00.000Z'),
    ...overrides,
  };
}

function makeReaction(
  overrides: Partial<InboundReaction> = {},
): InboundReaction {
  return {
    reactionName: 'white_check_mark',
    userId: 'U123',
    channelId: 'C123',
    messageTs: '1700000000.000100',
    ...overrides,
  };
}

function makeTicketStore(overrides: Partial<TicketStore> = {}): TicketStore {
  return {
    create: vi.fn<TicketStore['create']>().mockResolvedValue({
      ok: true,
      ticket: {
        id: '4fa85f64-5717-4562-b3fc-2c963f66afa7',
        projectKey: 'chief-clancy',
        title: 'CLI hangs on large repos',
        status: 'Brief',
        severity: 'Medium',
        createdAt: new Date('2026-07-18T09:00:00.000Z'),
        updatedAt: new Date('2026-07-18T09:00:00.000Z'),
      },
    }),
    ...overrides,
  };
}

function makeDraftStore(overrides: Partial<DraftStore> = {}): DraftStore {
  return {
    create: vi
      .fn<DraftStore['create']>()
      .mockResolvedValue({ ok: true, draft: makeDraft() }),
    getByMessage: vi
      .fn<DraftStore['getByMessage']>()
      .mockResolvedValue({ ok: true, draft: makeDraft() }),
    resolve: vi.fn<DraftStore['resolve']>().mockResolvedValue({
      ok: true,
      draft: { ...makeDraft(), resolvedAt: new Date() },
    }),
    updateContent: vi.fn<DraftStore['updateContent']>().mockResolvedValue({
      ok: true,
      draft: makeDraft(),
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
        day: '2026-07-18',
        inputTokens: 120,
        outputTokens: 40,
        costUsdMicros: 640,
        updatedAt: new Date('2026-07-18T09:00:00.000Z'),
      },
    }),
    ...overrides,
  };
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
      .mockResolvedValue({ ok: false, error: { kind: 'unavailable' } }),
    ...overrides,
  };
}

function makeLogger() {
  return { info: vi.fn(), error: vi.fn() };
}

function makeDeps(
  overrides: Partial<{
    readonly ticketStore: TicketStore;
    readonly draftStore: DraftStore;
    readonly costStore: CostStore;
    readonly capStore: CapStore;
    readonly logger: ReturnType<typeof makeLogger>;
  }> = {},
) {
  return {
    anthropicClient: {
      messages: {
        parse: vi.fn().mockResolvedValue({
          parsed_output: { title: 'x', body: 'y' },
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      },
    },
    ticketStore: makeTicketStore(),
    draftStore: makeDraftStore(),
    costStore: makeCostStore(),
    capStore: makeCapStore(),
    costCapConfig: {
      monthlyCapUsdMicros: 100_000_000,
      alertSlackUserId: 'U0ALEX',
    },
    personaId: 'sarah' as const,
    slackClient: {
      chat: { postMessage: vi.fn() },
      reactions: { add: vi.fn() },
    },
    logger: makeLogger(),
    ...overrides,
  };
}

describe('handleReactionAdded', () => {
  it('dispatches ✅ to commitTicketDraft', async () => {
    const deps = makeDeps();

    await handleReactionAdded(
      deps,
      makeReaction({ reactionName: 'white_check_mark' }),
    );

    expect(deps.draftStore.resolve).toHaveBeenCalledWith(makeDraft().id);
    expect(deps.ticketStore.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Brief' }),
    );
  });

  it('dispatches 📦 to parkTicketDraftToBacklog', async () => {
    const deps = makeDeps();

    await handleReactionAdded(deps, makeReaction({ reactionName: 'package' }));

    expect(deps.ticketStore.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Backlog' }),
    );
  });

  it('dispatches 🔁 to regenerateTicketDraft', async () => {
    const deps = makeDeps();

    await handleReactionAdded(deps, makeReaction({ reactionName: 'repeat' }));

    expect(deps.anthropicClient.messages.parse).toHaveBeenCalled();
    expect(deps.draftStore.updateContent).toHaveBeenCalled();
    expect(deps.draftStore.resolve).not.toHaveBeenCalled();
  });

  it('ignores a reaction outside the 📦/🔁/✅ legend, without looking up any draft', async () => {
    const deps = makeDeps();

    await handleReactionAdded(deps, makeReaction({ reactionName: 'thumbsup' }));

    expect(deps.draftStore.getByMessage).not.toHaveBeenCalled();
  });

  it('ignores a reaction on a message this persona never drafted', async () => {
    const deps = makeDeps({
      draftStore: makeDraftStore({
        getByMessage: vi
          .fn<DraftStore['getByMessage']>()
          .mockResolvedValue({ ok: true, draft: null }),
      }),
    });

    await handleReactionAdded(deps, makeReaction());

    expect(deps.ticketStore.create).not.toHaveBeenCalled();
  });

  it('logs an error, without throwing, when the draft lookup fails', async () => {
    const deps = makeDeps({
      draftStore: makeDraftStore({
        getByMessage: vi.fn<DraftStore['getByMessage']>().mockResolvedValue({
          ok: false,
          error: { kind: 'unknown', cause: new Error('connection reset') },
        }),
      }),
    });

    await expect(
      handleReactionAdded(deps, makeReaction()),
    ).resolves.toBeUndefined();

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to look up pending ticket draft',
      { message: 'Error: connection reset' },
    );
  });

  it('ignores any reaction on an already-resolved draft, including 🔁 redo', async () => {
    const deps = makeDeps({
      draftStore: makeDraftStore({
        getByMessage: vi.fn<DraftStore['getByMessage']>().mockResolvedValue({
          ok: true,
          draft: { ...makeDraft(), resolvedAt: new Date() },
        }),
      }),
    });

    await handleReactionAdded(deps, makeReaction({ reactionName: 'repeat' }));

    expect(deps.anthropicClient.messages.parse).not.toHaveBeenCalled();
    expect(deps.logger.info).toHaveBeenCalledWith(
      'ignoring reaction on an already-resolved ticket draft',
      expect.objectContaining({ outcome: 'redo' }),
    );
  });
});

describe('createReactionHandler', () => {
  it('returns a handler that dispatches a reaction against the bound deps, same as calling handleReactionAdded directly', async () => {
    const deps = makeDeps();
    const handler = createReactionHandler(deps);

    await handler(makeReaction({ reactionName: 'white_check_mark' }));

    expect(deps.draftStore.resolve).toHaveBeenCalledWith(makeDraft().id);
    expect(deps.ticketStore.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Brief' }),
    );
  });
});
