import type { Logger } from './logger.js';
import type { StartSlackListenerFn } from './start-slack-listener.js';
import type { PersonaConfig } from '@moe/agents';
import type { Server } from 'node:http';

import { createServer } from 'node:http';

import { parseAnthropicConfig, parsePersonaConfig } from '@moe/agents';

import { createHealthHandler } from './health-handler.js';
import { createLogger } from './logger.js';
import { resolvePort } from './resolve-port.js';
import { startSlackListener } from './start-slack-listener.js';

// PersonaConfig's/AnthropicConfig's own camelCase field names only — not the raw
// MOE_SLACK_BOT_TOKEN / etc. env var names they're parsed from. No call site logs raw `env`
// today; extend this list first if one ever does, or a raw env dump would bypass redaction
// entirely.
const SECRET_KEYS = [
  'slackBotToken',
  'slackSigningSecret',
  'slackAppToken',
  'apiKey',
];

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
 * Boot sequence for BUILD_PLAN 2.2/2.3/2.4a: load + validate persona and Anthropic config from
 * env, start the health-check HTTP server, connect to Slack over Socket Mode and reply to every
 * inbound message with a single-turn, stateless LLM-generated reply in the placeholder voice. A
 * Slack connection failure only exits the process when it's unrecoverable per
 * isUnrecoverableStartError (permanent misconfiguration — the SDK's own auto-reconnect already
 * handles transient failures); see start-slack-listener.ts. Returns `undefined` on invalid config
 * after logging (redacted) and exiting, so a caller never mistakes a failed boot for a running
 * server.
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

  const parsedAnthropic = parseAnthropicConfig(env);
  if (!parsedAnthropic.ok) {
    logger.error('invalid anthropic config', {
      issues: parsedAnthropic.error.issues,
    });
    exit(1);
    return undefined;
  }

  const server = startServer(parsed.config, logger, resolvePort(env));
  // A listening HTTP server keeps the event loop alive on its own, so a bare `exit(1)` (which only
  // sets process.exitCode, deliberately not force-terminating — see the comment above) would never
  // actually take effect while the server is up. Closing it first is what lets the process really
  // exit, so an unrecoverable Slack failure actually restarts under Fly's supervisor instead of
  // sitting "healthy" per /health forever. Verified live: without this, a Docker container with an
  // invalid app token kept running indefinitely despite exit(1) firing.
  const exitAndCloseServer = (code: number): void => {
    server.close();
    exit(code);
  };
  server.on('error', (error) => {
    logger.error('server error', { message: error.message });
    exitAndCloseServer(1);
  });
  startSlack(
    { config: parsed.config, anthropicApiKey: parsedAnthropic.config.apiKey },
    logger,
    exitAndCloseServer,
  );
  return server;
}
