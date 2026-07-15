import type { Logger } from './logger.js';
import type { PersonaConfig } from '@moe/agents';

import {
  createSocketModeClient,
  createSocketModeListener,
  createWebClient,
  isUnrecoverableStartError,
} from '@moe/slack';

import { createInboundMessageHandler } from './handle-inbound-message.js';

export type StartSlackListenerFn = (
  config: PersonaConfig,
  logger: Logger,
  exit: (code: number) => void,
) => void;

/**
 * Real Slack wiring — constructs both SDK clients, wires the ack handler, connects. An
 * unrecoverable start failure (permanent misconfiguration — bad token, revoked auth — per
 * isUnrecoverableStartError) exits the process so the platform's restart supervisor takes over,
 * rather than sitting "healthy" per /health while never able to receive a Slack message again. A
 * recoverable/transient failure just logs — the SDK's own auto-reconnect already handles those.
 */
export const startSlackListener: StartSlackListenerFn = (
  config,
  logger,
  exit,
) => {
  const webClient = createWebClient(config.slackBotToken, logger);
  const socketModeClient = createSocketModeClient(config.slackAppToken, logger);
  const listener = createSocketModeListener(socketModeClient, {
    onMessage: createInboundMessageHandler(webClient, logger),
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
