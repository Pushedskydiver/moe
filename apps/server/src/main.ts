import type { Logger } from './logger.js';
import type { StartSlackListenerFn } from './start-slack-listener.js';
import type { PersonaConfig } from '@moe/agents';
import type { Server } from 'node:http';

import { createServer } from 'node:http';

import { parseAnthropicConfig, parsePersonaConfig } from '@moe/agents';
import { createDb, createPool, parseDatabaseConfig } from '@moe/core';

import { createHealthHandler } from './health-handler.js';
import { createLogger } from './logger.js';
import { resolvePort } from './resolve-port.js';
import { startSlackListener } from './start-slack-listener.js';

// PersonaConfig's/AnthropicConfig's/DatabaseConfig's own camelCase field names only — not the raw
// MOE_SLACK_BOT_TOKEN / etc. env var names they're parsed from. No call site logs raw `env`
// today; extend this list first if one ever does, or a raw env dump would bypass redaction
// entirely.
const SECRET_KEYS = [
  'slackBotToken',
  'slackSigningSecret',
  'slackAppToken',
  'apiKey',
  'connectionString',
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

type BootConfig = {
  readonly persona: PersonaConfig;
  readonly anthropicApiKey: string;
  readonly databaseConnectionString: string;
};

/** Parses+validates all three env-boundary configs, logging (redacted) and returning `undefined` on the first invalid one. */
function parseBootConfig(
  env: Readonly<Record<string, string | undefined>>,
  logger: Logger,
): BootConfig | undefined {
  const parsed = parsePersonaConfig(env);
  if (!parsed.ok) {
    logger.error('invalid persona config', { issues: parsed.error.issues });
    return undefined;
  }

  const parsedAnthropic = parseAnthropicConfig(env);
  if (!parsedAnthropic.ok) {
    logger.error('invalid anthropic config', {
      issues: parsedAnthropic.error.issues,
    });
    return undefined;
  }

  const parsedDatabase = parseDatabaseConfig(env);
  if (!parsedDatabase.ok) {
    logger.error('invalid database config', {
      issues: parsedDatabase.error.issues,
    });
    return undefined;
  }

  return {
    persona: parsed.config,
    anthropicApiKey: parsedAnthropic.config.apiKey,
    databaseConnectionString: parsedDatabase.config.connectionString,
  };
}

/**
 * Boot sequence for BUILD_PLAN 2.2/2.3/2.4a/2.4b: load + validate persona, Anthropic, and database
 * config from env, start the health-check HTTP server, open the shared Postgres pool (migrations
 * are a separate manual pre-deploy step — `pnpm --filter @moe/core migrate` — this boot sequence
 * never runs them), connect to Slack over Socket Mode and reply to every inbound message with an
 * LLM-generated reply in the placeholder voice, thread-scoped per `resolve-thread-key.ts`. A
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
  const config = parseBootConfig(env, logger);
  if (config === undefined) {
    exit(1);
    return undefined;
  }

  const server = startServer(config.persona, logger, resolvePort(env));
  const db = createDb(createPool(config.databaseConnectionString));
  // A listening HTTP server (and, equally, an open pg.Pool with any client that's ever run a
  // query — verified against node-postgres's own docs: its sockets aren't unref'd, so an open
  // pool keeps the event loop alive same as a listening server) keeps the event loop alive on its
  // own, so a bare `exit(1)` (which only sets process.exitCode, deliberately not
  // force-terminating — see the comment above) would never actually take effect while either is
  // still open. Closing both is what lets the process really exit, so an unrecoverable Slack
  // failure actually restarts under Fly's supervisor instead of sitting "healthy" per /health
  // forever. Verified live for the HTTP-server half: without closing it, a Docker container with
  // an invalid app token kept running indefinitely despite exit(1) firing.
  const exitAndCloseServer = (code: number): void => {
    server.close();
    db.destroy().catch((error: unknown) => {
      logger.error('failed to close database pool', {
        message: error instanceof Error ? error.message : String(error),
      });
    });
    exit(code);
  };
  server.on('error', (error) => {
    logger.error('server error', { message: error.message });
    exitAndCloseServer(1);
  });
  startSlack(
    { config: config.persona, anthropicApiKey: config.anthropicApiKey, db },
    logger,
    exitAndCloseServer,
  );
  return server;
}
