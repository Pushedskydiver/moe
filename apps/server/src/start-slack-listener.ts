import type { Logger } from './logger.js';
import type { CostCapConfig, PersonaConfig } from '@moe/agents';
import type { ChannelScopeConfig, Database } from '@moe/core';
import type { Kysely } from 'kysely';

import { createAnthropicClient } from '@moe/agents';
import {
  appendTurn,
  claimAlertThreshold,
  createBankHolidaysCache,
  createPendingTicketDraft,
  createReviewQueueEntry,
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
  fetchBotUserId,
  isUnrecoverableStartError,
} from '@moe/slack';

import { createInboundMessageHandler } from './handle-inbound-message.js';
import { createReactionHandler } from './handle-reaction-added.js';
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
      create: (input: Parameters<typeof createPendingTicketDraft>[1]) =>
        createPendingTicketDraft(db, input),
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
    reviewQueueStore: {
      create: (input: Parameters<typeof createReviewQueueEntry>[1]) =>
        createReviewQueueEntry(db, input),
    },
  };
}

// Everything `wireAndStartListener` needs to construct the two message/reaction handlers and the
// listener itself — bundled into one object (not more params) to stay under eslint's
// `max-params: 3`, same reasoning `StartSlackListenerDeps` itself already documents. `botUserId`/
// `logger`/`exit` join the rest here (rather than as their own params) for the same reason.
type ListenerContext = {
  readonly config: PersonaConfig;
  readonly socketModeClient: ReturnType<typeof createSocketModeClient>;
  readonly webClient: ReturnType<typeof createWebClient>;
  readonly anthropicClient: ReturnType<typeof createAnthropicClient>;
  readonly costCapConfig: CostCapConfig;
  readonly channelScopeConfig: ChannelScopeConfig;
  readonly bankHolidaysCache: ReturnType<typeof createBankHolidaysCache>;
  readonly botUserId: string;
  readonly logger: Logger;
  readonly exit: (code: number) => void;
} & ReturnType<typeof createStores>;

// Extracted from `startSlackListener` purely to stay under eslint's `max-lines-per-function`
// (`docs/CONVENTIONS.md` §Code Style) — constructs the reply/reaction-outcome handlers and the
// real Socket Mode listener around a now-known `botUserId`, then connects.
function wireAndStartListener(ctx: ListenerContext): void {
  const listener = createSocketModeListener(ctx.socketModeClient, {
    onMessage: createInboundMessageHandler({
      anthropicClient: ctx.anthropicClient,
      slackClient: ctx.webClient,
      logger: ctx.logger,
      historyStore: ctx.historyStore,
      costStore: ctx.costStore,
      capStore: ctx.capStore,
      costCapConfig: ctx.costCapConfig,
      personaId: ctx.config.id,
      threadQueue: makeThreadQueue(),
      channelScopeConfig: ctx.channelScopeConfig,
      bankHolidaysCache: ctx.bankHolidaysCache,
      ticketStore: ctx.ticketStore,
      draftStore: ctx.draftStore,
      reviewQueueStore: ctx.reviewQueueStore,
    }),
    onReactionAdded: createReactionHandler({
      anthropicClient: ctx.anthropicClient,
      slackClient: ctx.webClient,
      logger: ctx.logger,
      ticketStore: ctx.ticketStore,
      draftStore: ctx.draftStore,
      costStore: ctx.costStore,
      capStore: ctx.capStore,
      costCapConfig: ctx.costCapConfig,
      personaId: ctx.config.id,
    }),
    botUserId: ctx.botUserId,
    logger: ctx.logger,
  });

  listener.start().catch((error: unknown) => {
    ctx.logger.error('failed to start slack socket mode listener', {
      message: error instanceof Error ? error.message : String(error),
    });
    if (isUnrecoverableStartError(error)) {
      ctx.exit(1);
    }
  });
}

/**
 * Real Slack + Anthropic wiring — constructs all three SDK clients, fetches this persona's own bot
 * user id (`fetchBotUserId`, BUILD_PLAN 3.4a-iii — needed by `@moe/slack`'s
 * `handleSocketModeReactionEvent` to filter out this persona's own `reactions.add` calls before
 * they'd otherwise misdispatch as a real reaction-outcome), then wires the reply and
 * reaction-outcome handlers and connects (`wireAndStartListener`). An unrecoverable start failure
 * (permanent misconfiguration — bad token, revoked auth — per isUnrecoverableStartError, or a
 * failed `auth.test` call, the same class of failure) exits the process so the platform's restart
 * supervisor takes over, rather than sitting "healthy" per /health while never able to receive a
 * Slack message again. A recoverable/transient Socket Mode failure just logs — the SDK's own
 * auto-reconnect already handles those.
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
  const stores = createStores(db);
  // Constructed once here, not per-message — amortizes the 24h-TTL bank-holidays cache
  // (BUILD_PLAN 2.7a) across the whole process lifetime, same reasoning as `makeThreadQueue()`
  // inside `wireAndStartListener`.
  const bankHolidaysCache = createBankHolidaysCache();

  fetchBotUserId(webClient)
    .then((botUserIdResult) => {
      if (!botUserIdResult.ok) {
        logger.error('failed to fetch bot user id via auth.test', {
          message: botUserIdResult.error.message,
        });
        exit(1);
        return;
      }

      wireAndStartListener({
        config,
        socketModeClient,
        webClient,
        anthropicClient,
        costCapConfig,
        channelScopeConfig,
        bankHolidaysCache,
        botUserId: botUserIdResult.botUserId,
        logger,
        exit,
        ...stores,
      });
    })
    .catch((error: unknown) => {
      // Covers a synchronous throw anywhere in the `.then()` wiring above, not just
      // `fetchBotUserId` itself (which never rejects — see its own try/catch) — `exit(1)` is the
      // right call either way, since nothing in the wiring above is expected to throw for a
      // reason a restart would fix.
      logger.error('failed to start slack socket mode listener', {
        message: error instanceof Error ? error.message : String(error),
      });
      exit(1);
    });
};
