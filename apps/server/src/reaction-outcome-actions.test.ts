import type { HandlerDeps } from './handle-inbound-message.js';
import type { PendingConfirmingQuestion, PendingTicketDraft } from '@moe/core';

import { describe, expect, it, vi } from 'vitest';

import {
  commitTicketDraft,
  draftFromConfirmingQuestion,
  logConfirmingQuestionAsNo,
  parkTicketDraftToBacklog,
  regenerateTicketDraft,
} from './reaction-outcome-actions.js';

type TicketStore = HandlerDeps['ticketStore'];
type DraftStore = HandlerDeps['draftStore'];
type CapStore = HandlerDeps['capStore'];
type CostStore = HandlerDeps['costStore'];
type ConfirmingQuestionStore = HandlerDeps['confirmingQuestionStore'];
type ReviewQueueStore = HandlerDeps['reviewQueueStore'];

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

function makeAnthropicClient(
  draftResponse:
    { readonly title: string; readonly body: string } | (() => never),
) {
  return {
    messages: {
      parse:
        typeof draftResponse === 'function'
          ? vi.fn(draftResponse)
          : vi.fn().mockResolvedValue({
              parsed_output: draftResponse,
              usage: { input_tokens: 120, output_tokens: 40 },
            }),
    },
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
      .mockResolvedValue({ ok: true, draft: null }),
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

function makeQuestion(
  overrides: Partial<PendingConfirmingQuestion> = {},
): PendingConfirmingQuestion {
  return {
    id: '8fa85f64-5717-4562-b3fc-2c963f66afab',
    personaId: 'sarah',
    channelId: 'C123',
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

function makeConfirmingQuestionStore(
  overrides: Partial<ConfirmingQuestionStore> = {},
): ConfirmingQuestionStore {
  return {
    create: vi.fn<ConfirmingQuestionStore['create']>(),
    getByMessage: vi.fn<ConfirmingQuestionStore['getByMessage']>(),
    resolve: vi.fn<ConfirmingQuestionStore['resolve']>().mockResolvedValue({
      ok: true,
      question: { ...makeQuestion(), resolvedAt: new Date() },
    }),
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
    readonly anthropicClient: ReturnType<typeof makeAnthropicClient>;
    readonly ticketStore: TicketStore;
    readonly draftStore: DraftStore;
    readonly costStore: CostStore;
    readonly capStore: CapStore;
    readonly logger: ReturnType<typeof makeLogger>;
    readonly confirmingQuestionStore: ConfirmingQuestionStore;
    readonly reviewQueueStore: ReviewQueueStore;
  }> = {},
) {
  return {
    anthropicClient: makeAnthropicClient({
      title: 'Regenerated title',
      body: 'Regenerated body.',
    }),
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
    ...overrides,
  };
}

describe('commitTicketDraft (✅)', () => {
  it('atomically resolves the draft, then creates a real Brief ticket', async () => {
    const deps = makeDeps();
    const draft = makeDraft();

    await commitTicketDraft(deps, draft);

    expect(deps.draftStore.resolve).toHaveBeenCalledWith(draft.id);
    expect(deps.ticketStore.create).toHaveBeenCalledWith({
      projectKey: 'chief-clancy',
      title: draft.draftTitle,
      status: 'Brief',
      severity: 'Medium',
    });
    expect(deps.logger.info).toHaveBeenCalledWith(
      'committed ticket draft',
      expect.objectContaining({ draftId: draft.id, status: 'Brief' }),
    );
  });

  it("commits the claim's own title, not the caller's possibly-stale copy — a concurrent 🔁 regeneration racing this claim must not commit its old content", async () => {
    const staleDraft = makeDraft({
      draftTitle: 'Stale title before regeneration',
    });
    const deps = makeDeps({
      draftStore: makeDraftStore({
        resolve: vi.fn<DraftStore['resolve']>().mockResolvedValue({
          ok: true,
          draft: {
            ...makeDraft({ draftTitle: 'Fresh title after regeneration' }),
            resolvedAt: new Date(),
          },
        }),
      }),
    });

    await commitTicketDraft(deps, staleDraft);

    expect(deps.ticketStore.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Fresh title after regeneration' }),
    );
  });

  it('logs and does not create a ticket when the draft is already resolved (double-processing guard)', async () => {
    const deps = makeDeps({
      draftStore: makeDraftStore({
        resolve: vi
          .fn<DraftStore['resolve']>()
          .mockResolvedValue({ ok: false, error: { kind: 'unavailable' } }),
      }),
    });

    await commitTicketDraft(deps, makeDraft());

    expect(deps.ticketStore.create).not.toHaveBeenCalled();
    expect(deps.logger.info).toHaveBeenCalledWith(
      'ticket draft already resolved — ignoring reaction',
      expect.objectContaining({ draftId: makeDraft().id }),
    );
  });

  it('logs an error, without throwing, when ticket creation fails after a successful claim', async () => {
    const deps = makeDeps({
      ticketStore: makeTicketStore({
        create: vi.fn<TicketStore['create']>().mockResolvedValue({
          ok: false,
          error: { kind: 'unknown', cause: new Error('connection reset') },
        }),
      }),
    });

    await expect(commitTicketDraft(deps, makeDraft())).resolves.toBeUndefined();

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to create ticket from draft',
      { message: 'Error: connection reset' },
    );
  });
});

describe('parkTicketDraftToBacklog (📦)', () => {
  it('atomically resolves the draft, then creates a real Backlog ticket', async () => {
    const deps = makeDeps();
    const draft = makeDraft();

    await parkTicketDraftToBacklog(deps, draft);

    expect(deps.draftStore.resolve).toHaveBeenCalledWith(draft.id);
    expect(deps.ticketStore.create).toHaveBeenCalledWith({
      projectKey: 'chief-clancy',
      title: draft.draftTitle,
      status: 'Backlog',
      severity: 'Medium',
    });
  });
});

describe('regenerateTicketDraft (🔁)', () => {
  it('recomposes from the original source message and updates the draft content in place, with its own cost accounting', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T09:00:00.000Z'));
    try {
      const deps = makeDeps();
      const draft = makeDraft();

      await regenerateTicketDraft(deps, draft);

      expect(deps.anthropicClient.messages.parse).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: draft.sourceMessageText }],
        }),
      );
      expect(deps.draftStore.updateContent).toHaveBeenCalledWith(draft.id, {
        draftTitle: 'Regenerated title',
        draftBody: 'Regenerated body.',
      });
      // 120 input * $2/MTok + 40 output * $10/MTok (introductory Sonnet-5 pricing) = 640 micros.
      expect(deps.costStore.recordUsage).toHaveBeenCalledWith(
        expect.objectContaining({ costUsdMicros: 640 }),
      );
      expect(deps.draftStore.resolve).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips regeneration when the monthly cost cap is reached', async () => {
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

    await regenerateTicketDraft(deps, makeDraft());

    expect(deps.anthropicClient.messages.parse).not.toHaveBeenCalled();
    expect(deps.draftStore.updateContent).not.toHaveBeenCalled();
    expect(deps.logger.info).toHaveBeenCalledWith(
      'skipping ticket-draft regeneration — monthly cost cap reached',
      expect.objectContaining({ draftId: makeDraft().id }),
    );
  });

  it('logs an error and records no cost when recomposing the draft fails', async () => {
    const deps = makeDeps({
      anthropicClient: makeAnthropicClient(() => {
        throw new Error('rate limited');
      }),
    });

    await regenerateTicketDraft(deps, makeDraft());

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to regenerate ticket draft',
      { message: 'rate limited' },
    );
    expect(deps.costStore.recordUsage).not.toHaveBeenCalled();
    expect(deps.draftStore.updateContent).not.toHaveBeenCalled();
  });

  it('logs an error, without throwing, when persisting the regenerated content fails', async () => {
    const deps = makeDeps({
      draftStore: makeDraftStore({
        updateContent: vi.fn<DraftStore['updateContent']>().mockResolvedValue({
          ok: false,
          error: { kind: 'unknown', cause: new Error('connection reset') },
        }),
      }),
    });

    await expect(
      regenerateTicketDraft(deps, makeDraft()),
    ).resolves.toBeUndefined();

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to persist regenerated ticket draft',
      { message: 'Error: connection reset' },
    );
  });
});

describe('draftFromConfirmingQuestion (👍)', () => {
  it('checks the cost cap, atomically claims the confirming question, then composes and posts a real ticket draft threaded on the original source message', async () => {
    const deps = makeDeps();
    const question = makeQuestion();

    await draftFromConfirmingQuestion(deps, question);

    expect(deps.confirmingQuestionStore.resolve).toHaveBeenCalledWith(
      question.id,
    );
    expect(deps.anthropicClient.messages.parse).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: question.sourceMessageText }],
      }),
    );
    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: question.channelId,
        thread_ts: question.sourceMessageTs,
      }),
    );
    expect(deps.draftStore.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: question.channelId,
        sourceMessageText: question.sourceMessageText,
      }),
    );
  });

  it('skips drafting, without claiming the confirming question, when the monthly cost cap is reached', async () => {
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

    await draftFromConfirmingQuestion(deps, makeQuestion());

    expect(deps.confirmingQuestionStore.resolve).not.toHaveBeenCalled();
    expect(deps.anthropicClient.messages.parse).not.toHaveBeenCalled();
  });

  it('ignores an already-resolved confirming question (double-processing guard)', async () => {
    const question = makeQuestion();
    const deps = makeDeps({
      confirmingQuestionStore: makeConfirmingQuestionStore({
        resolve: vi
          .fn<ConfirmingQuestionStore['resolve']>()
          .mockResolvedValue({ ok: false, error: { kind: 'unavailable' } }),
      }),
    });

    await draftFromConfirmingQuestion(deps, question);

    expect(deps.anthropicClient.messages.parse).not.toHaveBeenCalled();
    expect(deps.logger.info).toHaveBeenCalledWith(
      'confirming question already resolved — ignoring reaction',
      expect.objectContaining({ questionId: question.id }),
    );
  });

  // Known, accepted gap (DA review, chunk 3.4b-ii, see this function's own TSDoc) — a downstream
  // composition failure after a successful claim leaves the question permanently resolved with no
  // fallback. Pinned here as an explicit regression test, not left as only a documented trade-off,
  // so a future fix (or an accidental behavior change) has to touch this test deliberately.
  it('leaves the confirming question resolved with no review-queue fallback when composition fails after a successful claim (known gap, not a regression)', async () => {
    const deps = makeDeps({
      anthropicClient: {
        messages: {
          parse: vi.fn().mockRejectedValue(new Error('rate limited')),
        },
      },
    });

    await draftFromConfirmingQuestion(deps, makeQuestion());

    expect(deps.confirmingQuestionStore.resolve).toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to compose ticket draft',
      { message: 'rate limited' },
    );
    expect(deps.reviewQueueStore.create).not.toHaveBeenCalled();
  });
});

describe('logConfirmingQuestionAsNo (👎)', () => {
  it('atomically claims the confirming question, then logs a real review_queue row carrying confidence/reasoning through', async () => {
    const deps = makeDeps();
    const question = makeQuestion();

    await logConfirmingQuestionAsNo(deps, question);

    expect(deps.confirmingQuestionStore.resolve).toHaveBeenCalledWith(
      question.id,
    );
    expect(deps.reviewQueueStore.create).toHaveBeenCalledWith({
      personaId: 'sarah',
      channelId: question.channelId,
      messageTs: question.sourceMessageTs,
      sourceMessageText: question.sourceMessageText,
      confidence: question.confidence,
      reasoning: question.reasoning,
      outcomeReason: 'mid-no',
    });
    expect(deps.logger.info).toHaveBeenCalledWith(
      'logged Mid-band "no" answer to review queue',
      expect.objectContaining({ questionId: question.id }),
    );
  });

  it('ignores an already-resolved confirming question (double-processing guard)', async () => {
    const question = makeQuestion();
    const deps = makeDeps({
      confirmingQuestionStore: makeConfirmingQuestionStore({
        resolve: vi
          .fn<ConfirmingQuestionStore['resolve']>()
          .mockResolvedValue({ ok: false, error: { kind: 'unavailable' } }),
      }),
    });

    await logConfirmingQuestionAsNo(deps, question);

    expect(deps.reviewQueueStore.create).not.toHaveBeenCalled();
    expect(deps.logger.info).toHaveBeenCalledWith(
      'confirming question already resolved — ignoring reaction',
      expect.objectContaining({ questionId: question.id }),
    );
  });

  it('logs an error, without throwing, when persisting the review-queue row fails after a successful claim', async () => {
    const deps = makeDeps({
      reviewQueueStore: makeReviewQueueStore({
        create: vi.fn<ReviewQueueStore['create']>().mockResolvedValue({
          ok: false,
          error: { kind: 'unknown', cause: new Error('connection reset') },
        }),
      }),
    });

    await expect(
      logConfirmingQuestionAsNo(deps, makeQuestion()),
    ).resolves.toBeUndefined();

    expect(deps.logger.error).toHaveBeenCalledWith(
      'failed to log Mid-band "no" answer to review queue',
      expect.objectContaining({ message: 'Error: connection reset' }),
    );
  });
});
