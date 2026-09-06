import type { ApproveBriefResult } from './approve-brief-via-reaction.js';
import type { HandlerDeps } from './handle-inbound-message.js';
import type {
  CommitTicketDraftResult,
  PendingConfirmingQuestion,
  PendingTicketDraft,
  ResolveConfirmingQuestionAndLogResult,
  TicketBrief,
  TicketBriefOrNullResult,
} from '@moe/core';
import type { InboundReaction } from '@moe/slack';

import { describe, expect, it, vi } from 'vitest';

import { ALEX_SLACK_USER_ID } from '@moe/core';

import {
  createReactionHandler,
  handleReactionAdded,
} from './handle-reaction-added.js';

type TicketStore = HandlerDeps['ticketStore'];
type DraftStore = HandlerDeps['draftStore'];
type CapStore = HandlerDeps['capStore'];
type CostStore = HandlerDeps['costStore'];
type ConfirmingQuestionStore = HandlerDeps['confirmingQuestionStore'];
type ReviewQueueStore = HandlerDeps['reviewQueueStore'];
type BriefStore = {
  readonly getByMessage: (scope: {
    readonly channelId: string;
    readonly messageTs: string;
  }) => Promise<TicketBriefOrNullResult>;
};

function makeDraft(
  overrides: Partial<PendingTicketDraft> = {},
): PendingTicketDraft {
  return {
    id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    personaId: 'sarah',
    channelId: 'C123',
    messageTs: '1700000000.000100',
    sourceMessageTs: '1700000000.000050',
    sourceMessageText: 'the CLI hangs on large repos, can someone take a look',
    draftTitle: 'CLI hangs on large repos',
    draftBody: 'The CLI hangs when run against large repos.',
    resolvedAt: null,
    createdAt: new Date('2026-07-18T09:00:00.000Z'),
    origin: 'high-band',
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

function makeBrief(overrides: Partial<TicketBrief> = {}): TicketBrief {
  return {
    ticketId: '9fa85f64-5717-4562-b3fc-2c963f66afac',
    channelId: 'C0B88H0JUA3',
    messageTs: '1700000300.000100',
    summary: 'The CLI silently drops rows over 10k on export.',
    scope: ['Reproduce the truncation', 'Fix the export pagination'],
    createdAt: new Date('2026-09-01T09:00:00.000Z'),
    ...overrides,
  };
}

function makeQuestion(
  overrides: Partial<PendingConfirmingQuestion> = {},
): PendingConfirmingQuestion {
  return {
    id: '8fa85f64-5717-4562-b3fc-2c963f66afab',
    personaId: 'sarah',
    channelId: 'C123',
    sourceSurface: 'channel' as const,
    messageTs: '1700000099.000100',
    sourceMessageTs: '1700000000.000050',
    sourceMessageText:
      'hey, there might be an issue with the CLI on large repos',
    confidence: 55,
    reasoning: 'plausibly describes a bug, but not clearly actionable',
    resolvedAt: null,
    createdAt: new Date('2026-07-19T09:00:00.000Z'),
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
        classOfService: 'Standard',
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
    updateContent: vi.fn<DraftStore['updateContent']>().mockResolvedValue({
      ok: true,
      draft: makeDraft(),
    }),
    markPosted: vi.fn<DraftStore['markPosted']>().mockResolvedValue({
      ok: true,
      draft: makeDraft(),
    }),
    releaseClaim: vi
      .fn<DraftStore['releaseClaim']>()
      .mockResolvedValue({ ok: true }),
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

function makeConfirmingQuestionStore(
  overrides: Partial<ConfirmingQuestionStore> = {},
): ConfirmingQuestionStore {
  return {
    create: vi.fn<ConfirmingQuestionStore['create']>(),
    getByMessage: vi
      .fn<ConfirmingQuestionStore['getByMessage']>()
      .mockResolvedValue({ ok: true, question: makeQuestion() }),
    resolve: vi.fn<ConfirmingQuestionStore['resolve']>().mockResolvedValue({
      ok: true,
      question: { ...makeQuestion(), resolvedAt: new Date() },
    }),
    markPosted: vi
      .fn<ConfirmingQuestionStore['markPosted']>()
      .mockResolvedValue({ ok: true, question: makeQuestion() }),
    releaseClaim: vi
      .fn<ConfirmingQuestionStore['releaseClaim']>()
      .mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

function makeReviewQueueStore(
  overrides: Partial<ReviewQueueStore> = {},
): ReviewQueueStore {
  return {
    create: vi.fn<ReviewQueueStore['create']>().mockResolvedValue({
      ok: true,
      entry: {
        id: '5fa85f64-5717-4562-b3fc-2c963f66afa8',
        personaId: 'sarah',
        channelId: 'C123',
        messageTs: '1700000000.000050',
        sourceMessageText:
          'hey, there might be an issue with the CLI on large repos',
        confidence: 55,
        reasoning: 'plausibly describes a bug, but not clearly actionable',
        outcomeReason: 'mid-no',
        createdAt: new Date('2026-07-19T09:00:00.000Z'),
      },
    }),
    ...overrides,
  };
}

function makeBriefStore(overrides: Partial<BriefStore> = {}): BriefStore {
  return {
    getByMessage: vi
      .fn<BriefStore['getByMessage']>()
      .mockResolvedValue({ ok: true, brief: makeBrief() }),
    ...overrides,
  };
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeCommitDraftAsTicket(result?: CommitTicketDraftResult) {
  return vi.fn().mockResolvedValue(
    result ?? {
      ok: true,
      draft: { ...makeDraft(), resolvedAt: new Date() },
      ticket: {
        id: '4fa85f64-5717-4562-b3fc-2c963f66afa7',
        projectKey: 'chief-clancy',
        title: 'CLI hangs on large repos',
        status: 'Brief',
        severity: 'Medium',
        classOfService: 'Standard',
        createdAt: new Date('2026-07-18T09:00:00.000Z'),
        updatedAt: new Date('2026-07-18T09:00:00.000Z'),
      },
    },
  );
}

function makeResolveConfirmingQuestionAndLog(
  result?: ResolveConfirmingQuestionAndLogResult,
) {
  return vi.fn().mockResolvedValue(
    result ?? {
      ok: true,
      question: { ...makeQuestion(), resolvedAt: new Date() },
      entry: {
        id: '5fa85f64-5717-4562-b3fc-2c963f66afa8',
        personaId: 'sarah',
        channelId: 'C123',
        messageTs: '1700000000.000050',
        sourceMessageText:
          'hey, there might be an issue with the CLI on large repos',
        confidence: 55,
        reasoning: 'plausibly describes a bug, but not clearly actionable',
        outcomeReason: 'mid-no',
        createdAt: new Date('2026-07-19T09:00:00.000Z'),
      },
    },
  );
}

function makeApproveBriefAndTransitionToPlan(result?: ApproveBriefResult) {
  return vi.fn().mockResolvedValue(
    result ?? {
      ok: true,
      ticket: {
        id: makeBrief().ticketId,
        projectKey: 'chief-clancy',
        title: 'The CLI silently drops rows over 10k on export.',
        status: 'Plan',
        severity: 'Medium',
        classOfService: 'Standard',
        createdAt: new Date('2026-09-01T09:00:00.000Z'),
        updatedAt: new Date('2026-09-05T09:00:00.000Z'),
      },
    },
  );
}

function makeDeps(
  overrides: Partial<{
    readonly ticketStore: TicketStore;
    readonly draftStore: DraftStore;
    readonly costStore: CostStore;
    readonly capStore: CapStore;
    readonly logger: ReturnType<typeof makeLogger>;
    readonly confirmingQuestionStore: ConfirmingQuestionStore;
    readonly reviewQueueStore: ReviewQueueStore;
    readonly briefStore: BriefStore;
    readonly commitDraftAsTicket: ReturnType<typeof makeCommitDraftAsTicket>;
    readonly resolveConfirmingQuestionAndLog: ReturnType<
      typeof makeResolveConfirmingQuestionAndLog
    >;
    readonly approveBriefAndTransitionToPlan: ReturnType<
      typeof makeApproveBriefAndTransitionToPlan
    >;
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
      chat: {
        postMessage: vi
          .fn()
          .mockResolvedValue({ ok: true, ts: '1700000200.000100' }),
      },
      reactions: { add: vi.fn().mockResolvedValue({ ok: true }) },
    },
    logger: makeLogger(),
    confirmingQuestionStore: makeConfirmingQuestionStore(),
    reviewQueueStore: makeReviewQueueStore(),
    briefStore: makeBriefStore(),
    commitDraftAsTicket: makeCommitDraftAsTicket(),
    resolveConfirmingQuestionAndLog: makeResolveConfirmingQuestionAndLog(),
    approveBriefAndTransitionToPlan: makeApproveBriefAndTransitionToPlan(),
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

    // The lookup is persona-scoped as of BUILD_PLAN 5.2a (DA review). Pinned at the server layer
    // as well as the repository, because the value passed is what makes the scoping real — the
    // type only forces the field to be *present*, not correct. A persona must resolve reactions
    // only on drafts it posted itself, or in a shared channel each draft's own seeded 📦/🔁/✅
    // legend gets dispatched by its siblings as though a human had reacted.
    expect(deps.draftStore.getByMessage).toHaveBeenCalledWith({
      personaId: 'sarah',
      channelId: 'C123',
      messageTs: '1700000000.000100',
    });
    expect(deps.commitDraftAsTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: makeDraft().id,
        ticket: expect.objectContaining({ status: 'Brief' }) as unknown,
      }),
    );
  });

  it('dispatches 📦 to parkTicketDraftToBacklog', async () => {
    const deps = makeDeps();

    await handleReactionAdded(deps, makeReaction({ reactionName: 'package' }));

    expect(deps.commitDraftAsTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        ticket: expect.objectContaining({ status: 'Backlog' }) as unknown,
      }),
    );
  });

  it('dispatches 🔁 to regenerateTicketDraft', async () => {
    const deps = makeDeps();

    await handleReactionAdded(deps, makeReaction({ reactionName: 'repeat' }));

    expect(deps.anthropicClient.messages.parse).toHaveBeenCalled();
    expect(deps.draftStore.updateContent).toHaveBeenCalled();
    expect(deps.commitDraftAsTicket).not.toHaveBeenCalled();
  });

  it('ignores a reaction outside both the 📦/🔁/✅ and 👍/👎 legends, without looking up any draft or confirming question', async () => {
    const deps = makeDeps();

    await handleReactionAdded(deps, makeReaction({ reactionName: 'eyes' }));

    expect(deps.draftStore.getByMessage).not.toHaveBeenCalled();
    expect(deps.confirmingQuestionStore.getByMessage).not.toHaveBeenCalled();
  });

  it('does not look up a confirming question for a 📦/🔁/✅ reaction — the two legends are checked in order, not both unconditionally', async () => {
    const deps = makeDeps();

    await handleReactionAdded(
      deps,
      makeReaction({ reactionName: 'white_check_mark' }),
    );

    expect(deps.confirmingQuestionStore.getByMessage).not.toHaveBeenCalled();
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

    expect(deps.commitDraftAsTicket).not.toHaveBeenCalled();
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
      { errorMessage: 'Error: connection reset' },
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

describe('handleReactionAdded — confirming-question dispatch (BUILD_PLAN 3.4b-ii)', () => {
  it('dispatches 👍 to draftFromConfirmingQuestion', async () => {
    const deps = makeDeps();

    await handleReactionAdded(deps, makeReaction({ reactionName: 'thumbsup' }));

    // `personaId` is part of the lookup as of BUILD_PLAN 5.2a (DA review): a persona must only
    // resolve reactions on messages it posted itself, or every persona in a shared channel
    // dispatches every other persona's reactions — including each draft's own seeded legend.
    expect(deps.confirmingQuestionStore.getByMessage).toHaveBeenCalledWith({
      personaId: 'sarah',
      channelId: 'C123',
      messageTs: '1700000000.000100',
    });
    expect(deps.confirmingQuestionStore.resolve).toHaveBeenCalledWith(
      makeQuestion().id,
    );
    expect(deps.slackClient.chat.postMessage).toHaveBeenCalled();
    expect(deps.draftStore.getByMessage).not.toHaveBeenCalled();
  });

  it('dispatches 👎 to logConfirmingQuestionAsNo', async () => {
    const deps = makeDeps();

    await handleReactionAdded(
      deps,
      makeReaction({ reactionName: 'thumbsdown' }),
    );

    expect(deps.resolveConfirmingQuestionAndLog).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: makeQuestion().id,
        outcomeReason: 'mid-no',
      }),
    );
  });

  it('ignores a 👍/👎 reaction on a message this persona never posted a confirming question to', async () => {
    const deps = makeDeps({
      confirmingQuestionStore: makeConfirmingQuestionStore({
        getByMessage: vi
          .fn<ConfirmingQuestionStore['getByMessage']>()
          .mockResolvedValue({ ok: true, question: null }),
      }),
    });

    await handleReactionAdded(deps, makeReaction({ reactionName: 'thumbsup' }));

    expect(deps.confirmingQuestionStore.resolve).not.toHaveBeenCalled();
  });

  it('logs an error, without throwing, when the confirming-question lookup fails', async () => {
    const deps = makeDeps({
      confirmingQuestionStore: makeConfirmingQuestionStore({
        getByMessage: vi
          .fn<ConfirmingQuestionStore['getByMessage']>()
          .mockResolvedValue({
            ok: false,
            error: { kind: 'unknown', cause: new Error('connection reset') },
          }),
      }),
    });

    await expect(
      handleReactionAdded(deps, makeReaction({ reactionName: 'thumbsup' })),
    ).resolves.toBeUndefined();

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to look up pending confirming question',
      { errorMessage: 'Error: connection reset' },
    );
  });

  it('ignores any reaction on an already-resolved confirming question, including 👍', async () => {
    const deps = makeDeps({
      confirmingQuestionStore: makeConfirmingQuestionStore({
        getByMessage: vi
          .fn<ConfirmingQuestionStore['getByMessage']>()
          .mockResolvedValue({
            ok: true,
            question: { ...makeQuestion(), resolvedAt: new Date() },
          }),
      }),
    });

    await handleReactionAdded(
      deps,
      makeReaction({ reactionName: 'thumbsup', userId: ALEX_SLACK_USER_ID }),
    );

    expect(deps.confirmingQuestionStore.resolve).not.toHaveBeenCalled();
    expect(deps.logger.info).toHaveBeenCalledWith(
      'ignoring reaction on an already-resolved confirming question',
      expect.objectContaining({ outcome: 'yes' }),
    );
    // `dispatchConfirmingQuestionOutcome` returned `true` (a real match, just already resolved) —
    // `dispatchBriefApproval` must never run, even though the reactor is Alex and the reaction is
    // 👍, since this message already unambiguously belongs to a confirming question.
    expect(deps.briefStore.getByMessage).not.toHaveBeenCalled();
  });
});

// BUILD_PLAN 6.1d's own 👍-on-a-Brief dispatch — reached only once `dispatchConfirmingQuestionOutcome`
// has confirmed a `thumbsup` reaction's message genuinely isn't a confirming question.
describe('handleReactionAdded — brief-approval dispatch (BUILD_PLAN 6.1d)', () => {
  function makeDepsWithNoMatchingConfirmingQuestion(
    overrides: Parameters<typeof makeDeps>[0] = {},
  ) {
    return makeDeps({
      confirmingQuestionStore: makeConfirmingQuestionStore({
        getByMessage: vi
          .fn<ConfirmingQuestionStore['getByMessage']>()
          .mockResolvedValue({ ok: true, question: null }),
      }),
      ...overrides,
    });
  }

  it('does not look up a ticket brief at all for a non-Alex reactor', async () => {
    const deps = makeDepsWithNoMatchingConfirmingQuestion();

    await handleReactionAdded(
      deps,
      makeReaction({ reactionName: 'thumbsup', userId: 'U_SOME_OTHER_HUMAN' }),
    );

    expect(deps.briefStore.getByMessage).not.toHaveBeenCalled();
    expect(deps.approveBriefAndTransitionToPlan).not.toHaveBeenCalled();
  });

  it('takes no action when Alex reacts but the message is not a brief', async () => {
    const deps = makeDepsWithNoMatchingConfirmingQuestion({
      briefStore: makeBriefStore({
        getByMessage: vi
          .fn<BriefStore['getByMessage']>()
          .mockResolvedValue({ ok: true, brief: null }),
      }),
    });

    await handleReactionAdded(
      deps,
      makeReaction({ reactionName: 'thumbsup', userId: ALEX_SLACK_USER_ID }),
    );

    expect(deps.briefStore.getByMessage).toHaveBeenCalledWith({
      channelId: 'C123',
      messageTs: '1700000000.000100',
    });
    expect(deps.approveBriefAndTransitionToPlan).not.toHaveBeenCalled();
  });

  it('a thumbsdown never reaches brief approval, even when no confirming question matches — proving the questionOutcome === "yes" gate', async () => {
    const deps = makeDepsWithNoMatchingConfirmingQuestion();

    await handleReactionAdded(
      deps,
      makeReaction({
        reactionName: 'thumbsdown',
        userId: ALEX_SLACK_USER_ID,
      }),
    );

    expect(deps.briefStore.getByMessage).not.toHaveBeenCalled();
    expect(deps.approveBriefAndTransitionToPlan).not.toHaveBeenCalled();
  });

  it('calls approveBriefAndTransitionToPlan with the ticketId/projectKey/claimedBy when Alex reacts 👍 to a real brief message', async () => {
    const deps = makeDepsWithNoMatchingConfirmingQuestion();

    await handleReactionAdded(
      deps,
      makeReaction({
        reactionName: 'thumbsup',
        userId: ALEX_SLACK_USER_ID,
        channelId: 'C0B88H0JUA3',
        messageTs: '1700000300.000100',
      }),
    );

    expect(deps.briefStore.getByMessage).toHaveBeenCalledWith({
      channelId: 'C0B88H0JUA3',
      messageTs: '1700000300.000100',
    });
    expect(deps.approveBriefAndTransitionToPlan).toHaveBeenCalledWith({
      ticketId: makeBrief().ticketId,
      projectKey: 'chief-clancy',
      claimedBy: 'sarah',
    });
    expect(deps.logger.info).toHaveBeenCalledWith(
      'brief approved via reaction, ticket transitioned to plan',
      { ticketId: makeBrief().ticketId },
    );
  });

  it('logs an error, without throwing, when the ticket-brief lookup fails', async () => {
    const deps = makeDepsWithNoMatchingConfirmingQuestion({
      briefStore: makeBriefStore({
        getByMessage: vi.fn<BriefStore['getByMessage']>().mockResolvedValue({
          ok: false,
          error: { kind: 'unknown', cause: new Error('connection reset') },
        }),
      }),
    });

    await expect(
      handleReactionAdded(
        deps,
        makeReaction({ reactionName: 'thumbsup', userId: ALEX_SLACK_USER_ID }),
      ),
    ).resolves.toBeUndefined();

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to look up ticket brief',
      { errorMessage: 'Error: connection reset' },
    );
    expect(deps.approveBriefAndTransitionToPlan).not.toHaveBeenCalled();
  });

  it('logs info (not error) when the transition is ignored because the ticket already moved on', async () => {
    const deps = makeDepsWithNoMatchingConfirmingQuestion({
      approveBriefAndTransitionToPlan: makeApproveBriefAndTransitionToPlan({
        ok: false,
        error: { kind: 'unavailable' },
      }),
    });

    await handleReactionAdded(
      deps,
      makeReaction({ reactionName: 'thumbsup', userId: ALEX_SLACK_USER_ID }),
    );

    expect(deps.logger.info).toHaveBeenCalledWith(
      'ignoring brief-approval reaction — ticket already transitioned',
      { ticketId: makeBrief().ticketId },
    );
    expect(deps.logger.error).not.toHaveBeenCalled();
  });

  it('logs info (not error) when the claim is lost to another persona process racing the same reaction event', async () => {
    const deps = makeDepsWithNoMatchingConfirmingQuestion({
      approveBriefAndTransitionToPlan: makeApproveBriefAndTransitionToPlan({
        ok: false,
        error: {
          kind: 'claim-failed',
          claimError: { kind: 'unavailable' },
        },
      }),
    });

    await handleReactionAdded(
      deps,
      makeReaction({ reactionName: 'thumbsup', userId: ALEX_SLACK_USER_ID }),
    );

    expect(deps.logger.info).toHaveBeenCalledWith(
      'ignoring brief-approval reaction — another process already claimed this ticket',
      { ticketId: makeBrief().ticketId },
    );
    expect(deps.logger.error).not.toHaveBeenCalled();
  });

  it('logs an error when the claim fails for a real (non-race) reason', async () => {
    const deps = makeDepsWithNoMatchingConfirmingQuestion({
      approveBriefAndTransitionToPlan: makeApproveBriefAndTransitionToPlan({
        ok: false,
        error: {
          kind: 'claim-failed',
          claimError: { kind: 'unknown', cause: new Error('connection reset') },
        },
      }),
    });

    await handleReactionAdded(
      deps,
      makeReaction({ reactionName: 'thumbsup', userId: ALEX_SLACK_USER_ID }),
    );

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to claim ticket for reaction-triggered brief approval',
      { ticketId: makeBrief().ticketId, errorKind: 'unknown' },
    );
  });

  it("logs info (not error) — silent fail-closed, per Alex's confirmed scope decision — when Plan is at its WIP limit", async () => {
    const deps = makeDepsWithNoMatchingConfirmingQuestion({
      approveBriefAndTransitionToPlan: makeApproveBriefAndTransitionToPlan({
        ok: false,
        error: { kind: 'wip-limit-blocked', reason: 'at-limit' },
      }),
    });

    await handleReactionAdded(
      deps,
      makeReaction({ reactionName: 'thumbsup', userId: ALEX_SLACK_USER_ID }),
    );

    expect(deps.logger.info).toHaveBeenCalledWith(
      'brief-approval reaction blocked by plan wip limit, ticket stays in brief',
      { ticketId: makeBrief().ticketId },
    );
    expect(deps.logger.error).not.toHaveBeenCalled();
    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
  });

  it('logs an error for any other/unexpected transition failure kind', async () => {
    const deps = makeDepsWithNoMatchingConfirmingQuestion({
      approveBriefAndTransitionToPlan: makeApproveBriefAndTransitionToPlan({
        ok: false,
        error: { kind: 'validation-failed', issues: 'bad row' },
      }),
    });

    await handleReactionAdded(
      deps,
      makeReaction({ reactionName: 'thumbsup', userId: ALEX_SLACK_USER_ID }),
    );

    expect(deps.logger.error).toHaveBeenCalledWith(
      'unexpected error transitioning brief to plan via reaction',
      { ticketId: makeBrief().ticketId, errorKind: 'validation-failed' },
    );
  });
});

describe('createReactionHandler', () => {
  it('returns a handler that dispatches a reaction against the bound deps, same as calling handleReactionAdded directly', async () => {
    const deps = makeDeps();
    const handler = createReactionHandler(deps);

    await handler(makeReaction({ reactionName: 'white_check_mark' }));

    expect(deps.commitDraftAsTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: makeDraft().id,
        ticket: expect.objectContaining({ status: 'Brief' }) as unknown,
      }),
    );
  });
});
