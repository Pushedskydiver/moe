import type { Logger } from './logger.js';
import type { PersonaConfig } from '@moe/agents';
import type { Server } from 'node:http';

import { createServer } from 'node:http';

import { parsePersonaConfig } from '@moe/agents';
import {
  createSocketModeClient,
  createSocketModeListener,
  createWebClient,
} from '@moe/slack';

import { createInboundMessageHandler } from './handle-inbound-message.js';
import { createHealthHandler } from './health-handler.js';
import { createLogger } from './logger.js';
import { resolvePort } from './resolve-port.js';

type StartSlackListenerFn = (config: PersonaConfig, logger: Logger) => void;

/** Real Slack wiring — constructs both SDK clients, wires the ack handler, connects. */
function startSlackListener(config: PersonaConfig, logger: Logger): void {
  const webClient = createWebClient(config.slackBotToken);
  const socketModeClient = createSocketModeClient(config.slackAppToken, logger);
  const listener = createSocketModeListener(socketModeClient, {
    onMessage: createInboundMessageHandler(webClient, logger),
    logger,
  });

  listener.start().catch((error: unknown) => {
    logger.error('failed to start slack socket mode listener', {
      message: error instanceof Error ? error.message : String(error),
    });
  });
}

// PersonaConfig's own camelCase field names only — not the raw MOE_SLACK_BOT_TOKEN / etc. env var
// names it's parsed from. No call site logs raw `env` today; extend this list first if one ever
// does, or a raw env dump would bypass redaction entirely.
const SECRET_KEYS = ['slackBotToken', 'slackSigningSecret', 'slackAppToken'];

function startServer(
  config: PersonaConfig,
  logger: Logger,
  port: number,
): Server {
  const server = createServer(createHealthHandler(config));
  server.listen(port, () => {
    logger.info('server started', { personaId: config.id, port });
  });
  return server;
}

/**
 * Boot sequence for BUILD_PLAN 2.2/2.3: load + validate persona config from env, start the
 * health-check HTTP server, connect to Slack over Socket Mode and reply to every inbound message
 * with a hardcoded acknowledgment (no LLM yet). A Slack connection failure is logged, not fatal —
 * the SDK auto-reconnects on its own for transient issues, and treating the very first connection
 * attempt differently from a later one isn't a distinction with evidence behind it yet. Returns
 * `undefined` on invalid config after logging (redacted) and exiting, so a caller never mistakes a
 * failed boot for a running server.
 */
export function main(
  env: Readonly<Record<string, string | undefined>> = process.env,
  // Sets the eventual exit code rather than force-terminating: process.exit() can truncate a
  // pending stdout write (verified — a burst of output can be silently dropped when stdout is a
  // pipe), so the process exits naturally once the event loop drains and the log line has flushed.
  exit: (code: number) => void = (code) => {
    // process.exitCode is Node's own documented mechanism for a graceful exit; no immutable equivalent exists.
    // eslint-disable-next-line functional/immutable-data
    process.exitCode = code;
  },
  startSlack: StartSlackListenerFn = startSlackListener,
): Server | undefined {
  const logger = createLogger({ secretKeys: SECRET_KEYS });
  const parsed = parsePersonaConfig(env);

  if (!parsed.ok) {
    logger.error('invalid persona config', { issues: parsed.error.issues });
    exit(1);
    return undefined;
  }

  const server = startServer(parsed.config, logger, resolvePort(env));
  server.on('error', (error) => {
    logger.error('server error', { message: error.message });
    exit(1);
  });
  startSlack(parsed.config, logger);
  return server;
}
