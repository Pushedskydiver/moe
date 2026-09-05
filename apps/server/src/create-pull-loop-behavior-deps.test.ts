import type { CostCapConfig, PersonaConfig } from '@moe/agents';
import type * as AgentsModule from '@moe/agents';
import type { Database } from '@moe/core';
import type * as CoreModule from '@moe/core';
import type { GithubConfig } from '@moe/github';
import type * as GithubModule from '@moe/github';
import type * as SlackModule from '@moe/slack';
import type { Kysely } from 'kysely';

import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAnthropicClient: vi.fn(),
  createWebClient: vi.fn(),
  createGithubClient: vi.fn(),
  getTicketBrief: vi.fn(),
  createTicketBrief: vi.fn(),
  getTicketPlan: vi.fn(),
  createTicketPlan: vi.fn(),
  getTicketGithubIssueLink: vi.fn(),
  findNextUnconvertedGithubIssueTriageEntry: vi.fn(),
  createTicketFromTriageEntry: vi.fn(),
  getPersonaCostForMonth: vi.fn(),
  getAlertState: vi.fn(),
  claimAlertThreshold: vi.fn(),
  recordUsage: vi.fn(),
}));

vi.mock('@moe/agents', async (importOriginal) => {
  const actual = await importOriginal<typeof AgentsModule>();
  return { ...actual, createAnthropicClient: mocks.createAnthropicClient };
});
vi.mock('@moe/slack', async (importOriginal) => {
  const actual = await importOriginal<typeof SlackModule>();
  return { ...actual, createWebClient: mocks.createWebClient };
});
vi.mock('@moe/github', async (importOriginal) => {
  const actual = await importOriginal<typeof GithubModule>();
  return { ...actual, createGithubClient: mocks.createGithubClient };
});
vi.mock('@moe/core', async (importOriginal) => {
  const actual = await importOriginal<typeof CoreModule>();
  return {
    ...actual,
    getTicketBrief: mocks.getTicketBrief,
    createTicketBrief: mocks.createTicketBrief,
    getTicketPlan: mocks.getTicketPlan,
    createTicketPlan: mocks.createTicketPlan,
    getTicketGithubIssueLink: mocks.getTicketGithubIssueLink,
    findNextUnconvertedGithubIssueTriageEntry:
      mocks.findNextUnconvertedGithubIssueTriageEntry,
    createTicketFromTriageEntry: mocks.createTicketFromTriageEntry,
    getPersonaCostForMonth: mocks.getPersonaCostForMonth,
    getAlertState: mocks.getAlertState,
    claimAlertThreshold: mocks.claimAlertThreshold,
    recordUsage: mocks.recordUsage,
  };
});

const { createPullLoopBehaviorDeps } =
  await import('./create-pull-loop-behavior-deps.js');

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const CONFIG: PersonaConfig = {
  id: 'sarah',
  slackBotToken: 'fake-bot-token',
  slackSigningSecret: 'fake-signing-secret',
  slackAppToken: 'fake-app-token',
};

const COST_CAP_CONFIG: CostCapConfig = {
  monthlyCapUsdMicros: 100_000_000,
  alertSlackUserId: 'U0ALEX',
};

const GITHUB_CONFIG: GithubConfig = {
  appId: '123',
  privateKey: 'fake-private-key',
  installationId: 456,
  repo: { owner: 'Pushedskydiver', name: 'chief-clancy' },
};

function opts() {
  return {
    config: CONFIG,
    db: {} as Kysely<Database>, // opaque — every bound closure below is mocked
    logger: makeLogger(),
    anthropicApiKey: 'sk-ant-fake-key',
    costCapConfig: COST_CAP_CONFIG,
    github: GITHUB_CONFIG,
  };
}

describe('createPullLoopBehaviorDeps (renamed from createSarahPullLoopBehaviorDeps at BUILD_PLAN 6.1c)', () => {
  it('constructs the anthropic/slack/github clients via the shared single builders', () => {
    const built = opts();

    createPullLoopBehaviorDeps(built);

    expect(mocks.createAnthropicClient).toHaveBeenCalledWith(
      built.anthropicApiKey,
      built.logger,
      120_000,
    );
    expect(mocks.createWebClient).toHaveBeenCalledWith(
      built.config.slackBotToken,
      built.logger,
    );
    expect(mocks.createGithubClient).toHaveBeenCalledWith(
      built.github,
      built.logger,
    );
  });

  it('carries personaId, githubRepo, and costCapConfig straight through', () => {
    const built = opts();

    const deps = createPullLoopBehaviorDeps(built);

    expect(deps.personaId).toBe('sarah');
    expect(deps.githubRepo).toEqual(GITHUB_CONFIG.repo);
    expect(deps.costCapConfig).toBe(COST_CAP_CONFIG);
  });

  it('binds briefStore to the real ticket-briefs repository functions over the shared db', async () => {
    const built = opts();
    mocks.getTicketBrief.mockResolvedValue({ ok: true, brief: null });
    mocks.createTicketBrief.mockResolvedValue({
      ok: true,
      brief: {
        ticketId: 'x',
        channelId: 'C1',
        messageTs: '1',
        summary: 'x',
        scope: ['y'],
        createdAt: new Date(),
      },
    });
    const deps = createPullLoopBehaviorDeps(built);

    await deps.briefStore.getByTicket('ticket-1');
    await deps.briefStore.create({
      ticketId: 'ticket-1',
      channelId: 'C1',
      messageTs: '1700000000.0001',
      summary: 'The CLI silently drops rows over 10k.',
      scope: ['Reproduce the truncation'],
    });

    expect(mocks.getTicketBrief).toHaveBeenCalledWith(built.db, 'ticket-1');
    expect(mocks.createTicketBrief).toHaveBeenCalledWith(built.db, {
      ticketId: 'ticket-1',
      channelId: 'C1',
      messageTs: '1700000000.0001',
      summary: 'The CLI silently drops rows over 10k.',
      scope: ['Reproduce the truncation'],
    });
  });

  it('binds planStore to the real ticket-plans repository functions over the shared db', async () => {
    const built = opts();
    mocks.getTicketPlan.mockResolvedValue({ ok: true, plan: null });
    mocks.createTicketPlan.mockResolvedValue({
      ok: true,
      plan: {
        ticketId: 'x',
        channelId: 'C1',
        messageTs: '1',
        createdAt: new Date(),
      },
    });
    const deps = createPullLoopBehaviorDeps(built);

    await deps.planStore.getByTicket('ticket-1');
    await deps.planStore.create({
      ticketId: 'ticket-1',
      channelId: 'C1',
      messageTs: '1700000000.0002',
    });

    expect(mocks.getTicketPlan).toHaveBeenCalledWith(built.db, 'ticket-1');
    expect(mocks.createTicketPlan).toHaveBeenCalledWith(built.db, {
      ticketId: 'ticket-1',
      channelId: 'C1',
      messageTs: '1700000000.0002',
    });
  });

  it('binds issueLinkStore to the real ticket-github-issue-link lookup over the shared db', async () => {
    const built = opts();
    mocks.getTicketGithubIssueLink.mockResolvedValue({ ok: true, link: null });
    const deps = createPullLoopBehaviorDeps(built);

    await deps.issueLinkStore.getByTicket('ticket-1');

    expect(mocks.getTicketGithubIssueLink).toHaveBeenCalledWith(
      built.db,
      'ticket-1',
    );
  });

  it('binds triageStore.findNextUnconverted/convert to the real repository functions over the shared db', async () => {
    const built = opts();
    mocks.findNextUnconvertedGithubIssueTriageEntry.mockResolvedValue({
      ok: true,
      entry: null,
    });
    mocks.createTicketFromTriageEntry.mockResolvedValue({ ok: true });
    const deps = createPullLoopBehaviorDeps(built);
    const entry = {
      repoOwner: 'Pushedskydiver',
      repoName: 'chief-clancy',
      issueNumber: 477,
      title: 'x',
      url: 'https://x',
      state: 'open' as const,
      githubUpdatedAt: new Date(),
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    };

    await deps.triageStore.findNextUnconverted();
    await deps.triageStore.convert(entry);

    expect(
      mocks.findNextUnconvertedGithubIssueTriageEntry,
    ).toHaveBeenCalledWith(built.db);
    expect(mocks.createTicketFromTriageEntry).toHaveBeenCalledWith(
      built.db,
      entry,
      { severity: 'Medium', classOfService: 'Standard' },
    );
  });

  it('binds capStore/costStore to the real cost-cap/cost-usage repository functions over the shared db', async () => {
    const built = opts();
    mocks.getPersonaCostForMonth.mockResolvedValue({
      ok: true,
      total: {
        personaId: 'sarah',
        month: '2026-07',
        inputTokens: 0,
        outputTokens: 0,
        costUsdMicros: 0,
      },
    });
    mocks.getAlertState.mockResolvedValue({ ok: true, alert: null });
    mocks.claimAlertThreshold.mockResolvedValue({ ok: true });
    mocks.recordUsage.mockResolvedValue({ ok: true });
    const deps = createPullLoopBehaviorDeps(built);

    await deps.capStore.getMonthlyCost({
      personaId: 'sarah',
      month: '2026-07',
    });
    await deps.capStore.getAlertState({ personaId: 'sarah', month: '2026-07' });
    await deps.capStore.claimAlertThreshold({
      personaId: 'sarah',
      month: '2026-07',
      threshold: 50,
    });
    await deps.costStore.recordUsage({
      personaId: 'sarah',
      day: '2026-07-18',
      inputTokens: 1,
      outputTokens: 1,
      costUsdMicros: 1,
    });

    expect(mocks.getPersonaCostForMonth).toHaveBeenCalledWith(built.db, {
      personaId: 'sarah',
      month: '2026-07',
    });
    expect(mocks.getAlertState).toHaveBeenCalledWith(built.db, {
      personaId: 'sarah',
      month: '2026-07',
    });
    expect(mocks.claimAlertThreshold).toHaveBeenCalledWith(built.db, {
      personaId: 'sarah',
      month: '2026-07',
      threshold: 50,
    });
    expect(mocks.recordUsage).toHaveBeenCalledWith(built.db, {
      personaId: 'sarah',
      day: '2026-07-18',
      inputTokens: 1,
      outputTokens: 1,
      costUsdMicros: 1,
    });
  });
});
