import type { Logger } from './logger.js';
import type { CostCapConfig, PersonaConfig } from '@moe/agents';
import type { ChannelScopeConfig, Database } from '@moe/core';
import type { Kysely } from 'kysely';

import { createAnthropicClient } from '@moe/agents';
import {
  appendTurn,
  claimAlertThreshold,
  createBankHolidaysCache,
  createTicket,
  getAlertState,
  getPendingTicketDraftByMessage,
  getPersonaCostForMonth,
  getRecentTurns,
  recordUsage,
  resolvePendingTicketDraft,
  updatePendingTicketDraftContent,
} from '@moe/core';
import {
  createSocketModeClient,
  createSocketModeListener,
  createWebClient,
  isUnrecoverableStartError,
} from '@moe/slack';

import { createInboundMessageHandler } from './handle-inbound-message.js';
import { makeThreadQueue } from './thread-queue.js';

// Bundled into one object, not two extra params, to stay under eslint's max-params: 3 — the
// Anthropic API key is a single shared account credential, not per-persona (unlike the Slack
// tokens on `config`), matching `parseAnthropicConfig`'s own separate-from-`PersonaConfig` split.
// `db` follows the same reasoning: one shared Postgres instance across every persona process
// (`docs/decisions/TOPOLOGY-AND-DATABASE.md`), constructed once in `main.ts`, not per-persona.
export type StartSlackListenerDeps = {
  readonly config: PersonaConfig;
  readonly anthropicApiKey: string;
  readonly db: Kysely<Database>;
  readonly costCapConfig: CostCapConfig;
  readonly channelScopeConfig: ChannelScopeConfig;
};

export type StartSlackListenerFn = (
  deps: StartSlackListenerDeps,
  logger: Logger,
  exit: (code: number) => void,
) => void;

// Pre-binds every `@moe/core` repository function to one shared `db` handle — extracted from
// `startSlackListener` itself purely to stay under eslint's `max-lines-per-function`; composition
// code like this extracts aggressively (`docs/CONVENTIONS.md` §Code Style).
function createStores(db: Kysely<Database>) {
  return {
    historyStore: {
      getRecentTurns: (
        scope: Parameters<typeof getRecentTurns>[1],
        limit: number,
      ) => getRecentTurns(db, scope, limit),
      appendTurn: (input: Parameters<typeof appendTurn>[1]) =>
        appendTurn(db, input),
    },
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
    ticketStore: {
      create: (input: Parameters<typeof createTicket>[1]) =>
        createTicket(db, input),
    },
    draftStore: {
      getByMessage: (
        scope: Parameters<typeof getPendingTicketDraftByMessage>[1],
      ) => getPendingTicketDraftByMessage(db, scope),
      resolve: (id: Parameters<typeof resolvePendingTicketDraft>[1]) =>
        resolvePendingTicketDraft(db, id),
      updateContent: (
        id: Parameters<typeof updatePendingTicketDraftContent>[1],
        content: Parameters<typeof updatePendingTicketDraftContent>[2],
      ) => updatePendingTicketDraftContent(db, id, content),
    },
  };
}

/**
 * Real Slack + Anthropic wiring — constructs all three SDK clients, wires the reply handler,
 * connects. An unrecoverable start failure (permanent misconfiguration — bad token, revoked auth —
 * per isUnrecoverableStartError) exits the process so the platform's restart supervisor takes
 * over, rather than sitting "healthy" per /health while never able to receive a Slack message
 * again. A recoverable/transient failure just logs — the SDK's own auto-reconnect already handles
 * those.
 */
export const startSlackListener: StartSlackListenerFn = (
  deps,
  logger,
  exit,
) => {
  const { config, anthropicApiKey, db, costCapConfig, channelScopeConfig } =
    deps;
  const webClient = createWebClient(config.slackBotToken, logger);
  const socketModeClient = createSocketModeClient(config.slackAppToken, logger);
  const anthropicClient = createAnthropicClient(anthropicApiKey, logger);
  const { historyStore, costStore, capStore, ticketStore, draftStore } =
    createStores(db);
  // Constructed once here, not per-message — amortizes the 24h-TTL bank-holidays cache
  // (BUILD_PLAN 2.7a) across the whole process lifetime, same reasoning as `makeThreadQueue()`
  // just below.
  const bankHolidaysCache = createBankHolidaysCache();
  const listener = createSocketModeListener(socketModeClient, {
    onMessage: createInboundMessageHandler({
      anthropicClient,
      slackClient: webClient,
      logger,
      historyStore,
      costStore,
      capStore,
      costCapConfig,
      personaId: config.id,
      threadQueue: makeThreadQueue(),
      channelScopeConfig,
      bankHolidaysCache,
      ticketStore,
      draftStore,
    }),
    logger,
  });

  listener.start().catch((error: unknown) => {
    logger.error('failed to start slack socket mode listener', {
      message: error instanceof Error ? error.message : String(error),
    });
    if (isUnrecoverableStartError(error)) {
      exit(1);
    }
  });
};
