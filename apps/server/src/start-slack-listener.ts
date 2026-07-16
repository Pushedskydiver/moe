import type { Logger } from './logger.js';
import type { PersonaConfig } from '@moe/agents';

import { createAnthropicClient } from '@moe/agents';
import {
  createSocketModeClient,
  createSocketModeListener,
  createWebClient,
  isUnrecoverableStartError,
} from '@moe/slack';

import { createInboundMessageHandler } from './handle-inbound-message.js';

// Bundled into one object, not two extra params, to stay under eslint's max-params: 3 — the
// Anthropic API key is a single shared account credential, not per-persona (unlike the Slack
// tokens on `config`), matching `parseAnthropicConfig`'s own separate-from-`PersonaConfig` split.
type StartSlackListenerDeps = {
  readonly config: PersonaConfig;
  readonly anthropicApiKey: string;
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
  const { config, anthropicApiKey } = deps;
  const webClient = createWebClient(config.slackBotToken, logger);
  const socketModeClient = createSocketModeClient(config.slackAppToken, logger);
  const anthropicClient = createAnthropicClient(anthropicApiKey, logger);
  const listener = createSocketModeListener(socketModeClient, {
    onMessage: createInboundMessageHandler(anthropicClient, webClient, logger),
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
