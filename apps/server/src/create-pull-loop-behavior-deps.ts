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
  createTicketPlan,
  findNextUnconvertedGithubIssueTriageEntry,
  getAlertState,
  getPersonaCostForMonth,
  getTicketBrief,
  getTicketGithubIssueLink,
  getTicketPlan,
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

// BUILD_PLAN 6.1c's own live-fleet check found this empirically, reproducibly (3/3 ticks): a real
// Plan-stage `composePlan` call, richer than Brief's (a 4-field structured judgment call, 4096
// `max_tokens`), genuinely didn't complete within `createAnthropicClient`'s 20s default — the
// exact same failure mode that function's own TSDoc already documents having hit once before, for
// a different reason (`record-persona-replay.ts`'s own manual recording script). That default is
// tuned for VISION §6.4's live-chat-reply latency target; a pull-loop work step is never a live
// chat reply a human is waiting on synchronously — it already tolerates a 60s-default tick
// interval, so there's no reason to inherit the aggressive chat-turn timeout here. Same value the
// recording script already independently settled on for the identical "not a live reply" reason.
const PULL_LOOP_ANTHROPIC_TIMEOUT_MS = 120_000;

// Extracted purely to keep `createPullLoopBehaviorDeps` under eslint's `max-lines-per-function`
// once the timeout override above pushed the inline call over the ceiling — same "extract for
// clarity/to satisfy the lint threshold" precedent `handle-brief-stage-ticket.ts`'s own
// `resolveIssueBody`/`postBriefAndPersistPointer` already use, not a behavior change.
function buildPullLoopAnthropicClient(
  apiKey: string,
  logger: Logger,
): ReturnType<typeof createAnthropicClient> {
  return createAnthropicClient(apiKey, logger, PULL_LOOP_ANTHROPIC_TIMEOUT_MS);
}

/**
 * BUILD_PLAN 6.1b's own composition root for pull-loop behaviors — renamed at 6.1c (was
 * `createSarahPullLoopBehaviorDeps`) once Marcus became a second real handler: this is no longer
 * Sarah-specific, it's the shared composition root for any persona with a real pull-loop handler.
 * Constructs the Anthropic/Slack/Octokit(GitHub) clients via the existing single builders
 * (`createAnthropicClient`, `createWebClient`, `createGithubClient` — reused, not reimplemented)
 * *and* binds every closure (`briefStore`, `planStore`, `issueLinkStore`, `triageStore`, the
 * cost-cap stores) over one shared `db` handle, producing a single `PullLoopBehaviorDeps` value
 * that satisfies every real behavior factory (`createBriefStageWorkStep`,
 * `createConvertNextTriageEntryPreTickStep`, `createPlanStageWorkStep`, and both `needsWork`
 * checks). Takes on a bit more than `start-slack-listener.ts`'s own `createStores` does — that
 * precedent only binds store closures over `db`, leaving SDK-client construction to its own caller
 * (`startSlackListener`) — since `startPersonaPullLoop` (`main.ts`) has no other natural place to
 * split that work the way `startSlackListener` does.
 */
export function createPullLoopBehaviorDeps(opts: {
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
    anthropicClient: buildPullLoopAnthropicClient(anthropicApiKey, logger),
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
    planStore: {
      getByTicket: (ticketId: string) => getTicketPlan(db, ticketId),
      create: (input: Parameters<typeof createTicketPlan>[1]) =>
        createTicketPlan(db, input),
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
