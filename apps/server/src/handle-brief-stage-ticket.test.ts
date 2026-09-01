import type { CapStore } from './check-cost-cap.js';
import type { BriefStageDeps } from './handle-brief-stage-ticket.js';
import type { Ticket } from '@moe/core';

import { describe, expect, it, vi } from 'vitest';

import { TEAM_CHANNEL_ID } from '@moe/core';

import { handleBriefStageTicket } from './handle-brief-stage-ticket.js';

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    projectKey: 'chief-clancy',
    title: 'Export CLI drops rows over 10k',
    status: 'Brief',
    severity: 'Medium',
    classOfService: 'Standard',
    createdAt: new Date('2026-07-18T09:00:00.000Z'),
    updatedAt: new Date('2026-07-18T09:00:00.000Z'),
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
        vi.fn().mockResolvedValue({ ok: true, ts: '1700000000.000200' }),
    },
    reactions: { add: vi.fn().mockResolvedValue({ ok: true }) },
  };
}

function makeAnthropicClient(
  parsedOutput:
    | { readonly summary: string; readonly scope: readonly string[] }
    | (() => never) = {
    summary: 'The CLI silently drops rows over 10k on export.',
    scope: ['Reproduce the truncation', 'Fix the export pagination'],
  },
) {
  return {
    messages: {
      parse:
        typeof parsedOutput === 'function'
          ? vi.fn(parsedOutput)
          : vi.fn().mockResolvedValue({
              parsed_output: parsedOutput,
              usage: { input_tokens: 27, output_tokens: 90 },
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
          personaId: 'sarah',
          month: '2026-07',
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
          personaId: 'sarah',
          month: '2026-07',
          highestThresholdAlerted: 50,
          updatedAt: new Date('2026-07-17T09:00:00.000Z'),
        },
      }),
  };
}

function makeDeps(
  overrides: Partial<{
    readonly briefStore: BriefStageDeps['briefStore'];
    readonly issueLinkStore: BriefStageDeps['issueLinkStore'];
    readonly anthropicClient: ReturnType<typeof makeAnthropicClient>;
    readonly slackClient: ReturnType<typeof makeSlackClient>;
    readonly capStore: CapStore;
    readonly githubClient: {
      readonly rest: {
        readonly issues: { readonly get: ReturnType<typeof vi.fn> };
      };
    };
  }> = {},
) {
  return {
    personaId: 'sarah',
    logger: makeLogger(),
    anthropicClient: overrides.anthropicClient ?? makeAnthropicClient(),
    slackClient: overrides.slackClient ?? makeSlackClient(),
    githubClient: overrides.githubClient ?? {
      rest: { issues: { get: vi.fn() } },
    },
    githubRepo: { owner: 'Pushedskydiver', name: 'chief-clancy' },
    costStore: {
      recordUsage: vi.fn().mockResolvedValue({
        ok: true,
        usage: {
          personaId: 'sarah',
          day: '2026-07-18',
          inputTokens: 27,
          outputTokens: 90,
          costUsdMicros: 900,
          updatedAt: new Date('2026-07-18T09:00:00.000Z'),
        },
      }),
    },
    capStore: overrides.capStore ?? makeCapStore(),
    costCapConfig: {
      monthlyCapUsdMicros: 100_000_000,
      alertSlackUserId: 'U0ALEX',
    },
    briefStore: overrides.briefStore ?? {
      getByTicket: vi.fn().mockResolvedValue({ ok: true, brief: null }),
      create: vi.fn().mockResolvedValue({
        ok: true,
        brief: {
          ticketId: '00000000-0000-0000-0000-000000000001',
          channelId: TEAM_CHANNEL_ID,
          messageTs: '1700000000.000200',
          createdAt: new Date('2026-07-18T09:00:00.000Z'),
        },
      }),
    },
    issueLinkStore: overrides.issueLinkStore ?? {
      getByTicket: vi.fn().mockResolvedValue({ ok: true, link: null }),
    },
  };
}

describe('handleBriefStageTicket', () => {
  it('skips a ticket that already has a brief, without any LLM call, cost-cap check, or Slack post', async () => {
    const getByTicket = vi.fn().mockResolvedValue({
      ok: true,
      brief: {
        ticketId: '00000000-0000-0000-0000-000000000001',
        channelId: TEAM_CHANNEL_ID,
        messageTs: '1700000000.000100',
        createdAt: new Date('2026-07-18T09:00:00.000Z'),
      },
    });
    const capStore = makeCapStore();
    const deps = makeDeps({
      briefStore: {
        getByTicket,
        create: vi.fn(),
      },
      capStore,
    });

    await handleBriefStageTicket(deps as never, makeTicket());

    expect(getByTicket).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
    );
    expect(capStore.getMonthlyCost).not.toHaveBeenCalled();
    expect(deps.anthropicClient.messages.parse).not.toHaveBeenCalled();
    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
    expect(deps.briefStore.create).not.toHaveBeenCalled();
  });

  it('skips a ticket when the cost cap is halted, without any LLM call or brief post', async () => {
    const capStore = makeCapStore({
      getMonthlyCost: vi.fn<CapStore['getMonthlyCost']>().mockResolvedValue({
        ok: true,
        total: {
          personaId: 'sarah',
          month: '2026-07',
          inputTokens: 0,
          outputTokens: 0,
          costUsdMicros: 200_000_000,
        },
      }),
      // Already alerted at the 100% rung — `evaluateCostCap` reports no *newly* crossed
      // threshold, so `checkCostCapAndAlert` never calls `postMessage` itself to DM Alex; the
      // only remaining `postMessage` call this test can observe is the brief post this ticket's
      // own halted path must never make.
      getAlertState: vi.fn<CapStore['getAlertState']>().mockResolvedValue({
        ok: true,
        alert: {
          personaId: 'sarah',
          month: '2026-07',
          highestThresholdAlerted: 100,
          updatedAt: new Date('2026-07-17T09:00:00.000Z'),
        },
      }),
    });
    const deps = makeDeps({ capStore });

    await handleBriefStageTicket(deps as never, makeTicket());

    expect(deps.anthropicClient.messages.parse).not.toHaveBeenCalled();
    expect(deps.slackClient.chat.postMessage).not.toHaveBeenCalled();
    expect(deps.briefStore.create).not.toHaveBeenCalled();
  });

  it('composes a title-only brief when the ticket has no linked github issue', async () => {
    const issueLinkStore = {
      getByTicket: vi.fn().mockResolvedValue({ ok: true, link: null }),
    };
    const deps = makeDeps({ issueLinkStore });

    await handleBriefStageTicket(deps as never, makeTicket());

    expect(issueLinkStore.getByTicket).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
    );
    const call = deps.anthropicClient.messages.parse.mock.calls[0]?.[0] as {
      messages: ReadonlyArray<{ readonly content: string }>;
    };
    expect(call.messages[0]?.content).not.toContain('\n\n');
    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledTimes(1);
  });

  it('composes a title+body brief when the ticket has a resolved github issue link', async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        number: 477,
        title: 'Export CLI drops rows over 10k',
        body: 'Full description fetched from GitHub.',
      },
    });
    const issueLinkStore = {
      getByTicket: vi.fn().mockResolvedValue({
        ok: true,
        link: {
          ticketId: '00000000-0000-0000-0000-000000000001',
          repoOwner: 'Pushedskydiver',
          repoName: 'chief-clancy',
          issueNumber: 477,
          issueUrl: 'https://github.com/Pushedskydiver/chief-clancy/issues/477',
          resolvedAt: new Date('2026-07-18T08:00:00.000Z'),
          createdAt: new Date('2026-07-18T08:00:00.000Z'),
        },
      }),
    };
    const deps = makeDeps({
      issueLinkStore,
      githubClient: { rest: { issues: { get } } },
    });

    await handleBriefStageTicket(deps as never, makeTicket());

    expect(get).toHaveBeenCalledWith({
      owner: 'Pushedskydiver',
      repo: 'chief-clancy',
      issue_number: 477,
    });
    const call = deps.anthropicClient.messages.parse.mock.calls[0]?.[0] as {
      messages: ReadonlyArray<{ readonly content: string }>;
    };
    expect(call.messages[0]?.content).toContain(
      'Full description fetched from GitHub.',
    );
  });

  it('falls back to title-only composition when the github issue body fetch fails', async () => {
    const get = vi.fn().mockRejectedValue(new Error('rate limited'));
    const issueLinkStore = {
      getByTicket: vi.fn().mockResolvedValue({
        ok: true,
        link: {
          ticketId: '00000000-0000-0000-0000-000000000001',
          repoOwner: 'Pushedskydiver',
          repoName: 'chief-clancy',
          issueNumber: 477,
          issueUrl: 'https://github.com/Pushedskydiver/chief-clancy/issues/477',
          resolvedAt: new Date('2026-07-18T08:00:00.000Z'),
          createdAt: new Date('2026-07-18T08:00:00.000Z'),
        },
      }),
    };
    const deps = makeDeps({
      issueLinkStore,
      githubClient: { rest: { issues: { get } } },
    });

    await handleBriefStageTicket(deps as never, makeTicket());

    expect(deps.logger.warn).toHaveBeenCalled();
    expect(deps.slackClient.chat.postMessage).toHaveBeenCalledTimes(1);
    const call = deps.anthropicClient.messages.parse.mock.calls[0]?.[0] as {
      messages: ReadonlyArray<{ readonly content: string }>;
    };
    expect(call.messages[0]?.content).not.toContain('\n\n');
  });

  it('persists the brief pointer with the real posted message ts on a successful post', async () => {
    const create = vi.fn().mockResolvedValue({
      ok: true,
      brief: {
        ticketId: '00000000-0000-0000-0000-000000000001',
        channelId: TEAM_CHANNEL_ID,
        messageTs: '1700000000.000200',
        createdAt: new Date('2026-07-18T09:00:00.000Z'),
      },
    });
    const deps = makeDeps({
      briefStore: {
        getByTicket: vi.fn().mockResolvedValue({ ok: true, brief: null }),
        create,
      },
      slackClient: makeSlackClient({
        postMessage: vi
          .fn()
          .mockResolvedValue({ ok: true, ts: '1700000000.000200' }),
      }),
    });

    await handleBriefStageTicket(deps as never, makeTicket());

    expect(create).toHaveBeenCalledWith({
      ticketId: '00000000-0000-0000-0000-000000000001',
      channelId: TEAM_CHANNEL_ID,
      messageTs: '1700000000.000200',
    });
  });

  it('posts the brief to #moe-team with the composed summary and scope formatted as bullets', async () => {
    const postMessage = vi
      .fn()
      .mockResolvedValue({ ok: true, ts: '1700000000.000200' });
    const deps = makeDeps({ slackClient: makeSlackClient({ postMessage }) });

    await handleBriefStageTicket(deps as never, makeTicket());

    expect(postMessage).toHaveBeenCalledWith({
      channel: TEAM_CHANNEL_ID,
      text:
        '📝 *Brief: Export CLI drops rows over 10k*\n' +
        'The CLI silently drops rows over 10k on export.\n\n' +
        '• Reproduce the truncation\n' +
        '• Fix the export pagination',
    });
  });

  it('does not persist a pointer when the Slack post fails', async () => {
    const create = vi.fn();
    const deps = makeDeps({
      briefStore: {
        getByTicket: vi.fn().mockResolvedValue({ ok: true, brief: null }),
        create,
      },
      slackClient: makeSlackClient({
        postMessage: vi
          .fn()
          .mockResolvedValue({ ok: false, error: 'channel_not_found' }),
      }),
    });

    await handleBriefStageTicket(deps as never, makeTicket());

    expect(create).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalled();
  });

  it('logs but does not throw when persisting the pointer fails after a successful post', async () => {
    const create = vi.fn().mockResolvedValue({
      ok: false,
      error: { kind: 'unknown', cause: new Error('connection reset') },
    });
    const deps = makeDeps({
      briefStore: {
        getByTicket: vi.fn().mockResolvedValue({ ok: true, brief: null }),
        create,
      },
    });

    await expect(
      handleBriefStageTicket(deps as never, makeTicket()),
    ).resolves.toBeUndefined();

    expect(create).toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalled();
  });
});
