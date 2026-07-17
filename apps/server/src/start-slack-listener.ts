import type { Logger } from './logger.js';
import type { PersonaConfig } from '@moe/agents';
import type { Database } from '@moe/core';
import type { Kysely } from 'kysely';

import { createAnthropicClient } from '@moe/agents';
import { appendTurn, getRecentTurns } from '@moe/core';
import {
  createSocketModeClient,
  createSocketModeListener,
  createWebClient,
  isUnrecoverableStartError,
} from '@moe/slack';

import { createInboundMessageHandler } from './handle-inbound-message.js';
import { makeRootCandidateBuffer } from './root-candidate-buffer.js';
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
};

export type StartSlackListenerFn = (
  deps: StartSlackListenerDeps,
  logger: Logger,
  exit: (code: number) => void,
) => void;

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
  const { config, anthropicApiKey, db } = deps;
  const webClient = createWebClient(config.slackBotToken, logger);
  const socketModeClient = createSocketModeClient(config.slackAppToken, logger);
  const anthropicClient = createAnthropicClient(anthropicApiKey, logger);
  const historyStore = {
    getRecentTurns: (
      scope: Parameters<typeof getRecentTurns>[1],
      limit: number,
    ) => getRecentTurns(db, scope, limit),
    appendTurn: (input: Parameters<typeof appendTurn>[1]) =>
      appendTurn(db, input),
  };
  const listener = createSocketModeListener(socketModeClient, {
    onMessage: createInboundMessageHandler({
      anthropicClient,
      slackClient: webClient,
      logger,
      historyStore,
      personaId: config.id,
      threadQueue: makeThreadQueue(),
      rootCandidateBuffer: makeRootCandidateBuffer(),
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
