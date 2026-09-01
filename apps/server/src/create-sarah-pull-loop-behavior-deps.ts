import type { Logger } from './logger.js';
import type { PullLoopBehaviorDeps } from './resolve-pull-loop-behaviors.js';
import type { CostCapConfig, PersonaConfig } from '@moe/agents';
import type { Database } from '@moe/core';
import type { GithubConfig } from '@moe/github';
import type { Kysely } from 'kysely';

import { createAnthropicClient } from '@moe/agents';
import {
  claimAlertThreshold,
  createTicketBrief,
  createTicketFromTriageEntry,
  findNextUnconvertedGithubIssueTriageEntry,
  getAlertState,
  getPersonaCostForMonth,
  getTicketBrief,
  getTicketGithubIssueLink,
  recordUsage,
} from '@moe/core';
import { createGithubClient } from '@moe/github';
import { createWebClient } from '@moe/slack';

// Deterministic, non-LLM-set defaults for a triage-converted ticket — same values
// `reaction-outcome-actions.ts`'s own `commitAsTicket` uses for a chat-drafted one (plain
// literals, not imported constants: no `DEFAULT_CLASS_OF_SERVICE` constant exists anywhere, and
// `eslint.config.ts`'s `boundaries/dependencies` rule wouldn't let `packages/core` import an
// `apps/server` constant regardless — see `create-ticket-from-triage-entry.ts`'s own TSDoc).
const TRIAGE_TICKET_DEFAULTS = {
  severity: 'Medium',
  classOfService: 'Standard',
} as const;

/**
 * BUILD_PLAN 6.1b's own composition root for Sarah's pull-loop behaviors — constructs the
 * Anthropic/Slack/Octokit(GitHub) clients via the existing single builders (`createAnthropicClient`,
 * `createWebClient`, `createGithubClient` — reused, not reimplemented) *and* binds every closure
 * (`briefStore`, `issueLinkStore`, `triageStore`, the cost-cap stores) over one shared `db`
 * handle, producing a single `PullLoopBehaviorDeps` value that satisfies both
 * `createBriefStageWorkStep` and `createConvertNextTriageEntryPreTickStep`. Takes on a bit more
 * than `start-slack-listener.ts`'s own `createStores` does — that precedent only binds store
 * closures over `db`, leaving SDK-client construction to its own caller (`startSlackListener`) —
 * since `startPersonaPullLoop` (`main.ts`) has no other natural place to split that work the way
 * `startSlackListener` does.
 */
export function createSarahPullLoopBehaviorDeps(opts: {
  readonly config: PersonaConfig;
  readonly db: Kysely<Database>;
  readonly logger: Logger;
  readonly anthropicApiKey: string;
  readonly costCapConfig: CostCapConfig;
  readonly github: GithubConfig;
}): PullLoopBehaviorDeps {
  const { config, db, logger, anthropicApiKey, costCapConfig, github } = opts;

  return {
    personaId: config.id,
    logger,
    anthropicClient: createAnthropicClient(anthropicApiKey, logger),
    slackClient: createWebClient(config.slackBotToken, logger),
    githubClient: createGithubClient(github, logger),
    githubRepo: github.repo,
    costStore: {
      recordUsage: (input: Parameters<typeof recordUsage>[1]) =>
        recordUsage(db, input),
    },
    capStore: {
      getMonthlyCost: (scope: Parameters<typeof getPersonaCostForMonth>[1]) =>
        getPersonaCostForMonth(db, scope),
      getAlertState: (scope: Parameters<typeof getAlertState>[1]) =>
        getAlertState(db, scope),
      claimAlertThreshold: (input: Parameters<typeof claimAlertThreshold>[1]) =>
        claimAlertThreshold(db, input),
    },
    costCapConfig,
    briefStore: {
      getByTicket: (ticketId: string) => getTicketBrief(db, ticketId),
      create: (input: Parameters<typeof createTicketBrief>[1]) =>
        createTicketBrief(db, input),
    },
    issueLinkStore: {
      getByTicket: (ticketId: string) => getTicketGithubIssueLink(db, ticketId),
    },
    triageStore: {
      findNextUnconverted: () => findNextUnconvertedGithubIssueTriageEntry(db),
      convert: (entry: Parameters<typeof createTicketFromTriageEntry>[1]) =>
        createTicketFromTriageEntry(db, entry, TRIAGE_TICKET_DEFAULTS),
    },
  };
}
