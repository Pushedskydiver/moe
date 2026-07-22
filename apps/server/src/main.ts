import type { Logger } from './logger.js';
import type { StartSlackListenerFn } from './start-slack-listener.js';
import type { CostCapConfig, PersonaConfig } from '@moe/agents';
import type { ChannelScopeConfig } from '@moe/core';
import type { GithubConfig } from '@moe/github';
import type { Server } from 'node:http';

import { createServer } from 'node:http';

import {
  parseAnthropicConfig,
  parseChannelScopeConfig,
  parseCostCapConfig,
  parsePersonaConfig,
} from '@moe/agents';
import { createDb, createPool, parseDatabaseConfig } from '@moe/core';
import { parseGithubConfig, validateGithubCredentials } from '@moe/github';

import { createHealthHandler } from './health-handler.js';
import { createLogger } from './logger.js';
import { resolvePort } from './resolve-port.js';
import { startSlackListener } from './start-slack-listener.js';

// PersonaConfig's/AnthropicConfig's/DatabaseConfig's/GithubConfig's own camelCase field names
// only — not the raw MOE_SLACK_BOT_TOKEN / etc. env var names they're parsed from. No call site
// logs raw `env` today; extend this list first if one ever does, or a raw env dump would bypass
// redaction entirely.
const SECRET_KEYS = [
  'slackBotToken',
  'slackSigningSecret',
  'slackAppToken',
  'apiKey',
  'connectionString',
  'privateKey',
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
  readonly costCap: CostCapConfig;
  readonly channelScope: ChannelScopeConfig;
  readonly github: GithubConfig;
};

type EnvParseResult<T> =
  | { readonly ok: true; readonly config: T }
  | {
      readonly ok: false;
      readonly error: { readonly issues: readonly string[] };
    };

// Collapses the six-times-repeated "parse, log+bail on failure" shape below — extracted purely to
// keep `parseBootConfig` under eslint's `max-lines-per-function` once a sixth (GitHub) config
// joined persona/Anthropic/database/cost-cap/channel-scope. `label` feeds directly into the
// existing `invalid ${label} config` log-message shape every call site below already used.
function parseOrLog<T>(
  result: EnvParseResult<T>,
  label: string,
  logger: Logger,
): T | undefined {
  if (!result.ok) {
    logger.error(`invalid ${label} config`, { issues: result.error.issues });
    return undefined;
  }
  return result.config;
}

/** Parses+validates all six env-boundary configs, logging (redacted) and returning `undefined` on the first invalid one. */
function parseBootConfig(
  env: Readonly<Record<string, string | undefined>>,
  logger: Logger,
): BootConfig | undefined {
  const persona = parseOrLog(parsePersonaConfig(env), 'persona', logger);
  if (persona === undefined) return undefined;

  const anthropic = parseOrLog(parseAnthropicConfig(env), 'anthropic', logger);
  if (anthropic === undefined) return undefined;

  const database = parseOrLog(parseDatabaseConfig(env), 'database', logger);
  if (database === undefined) return undefined;

  const costCap = parseOrLog(parseCostCapConfig(env), 'cost cap', logger);
  if (costCap === undefined) return undefined;

  const channelScope = parseOrLog(
    parseChannelScopeConfig(env),
    'channel scope',
    logger,
  );
  if (channelScope === undefined) return undefined;

  const github = parseOrLog(parseGithubConfig(env), 'github', logger);
  if (github === undefined) return undefined;

  return {
    persona,
    anthropicApiKey: anthropic.apiKey,
    databaseConnectionString: database.connectionString,
    costCap,
    channelScope,
    github,
  };
}

// BUILD_PLAN 4.1's boot-time key-validation guard (the v2 outage lesson — a truncated/empty
// secret previously took the live service down, `docs/GIT.md`'s deploy-safety note). Runs
// fire-and-forget alongside `startSlack` (called right after this in `main`) rather than blocking
// it — mirrors `start-slack-listener.ts`'s own `fetchBotUserId`/`auth.test` boot-time credential
// check, which the HTTP health server also doesn't wait on. Extracted purely to keep `main` under
// eslint's `max-lines-per-function`.
function validateGithubAndLog(
  githubConfig: GithubConfig,
  logger: Logger,
  exitAndCloseServer: (code: number) => void,
): void {
  validateGithubCredentials(githubConfig)
    .then((result) => {
      if (!result.ok) {
        logger.error('invalid github app credentials', {
          errorMessage: result.error.message,
        });
        exitAndCloseServer(1);
        return;
      }
      logger.info('github app credentials validated');
    })
    .catch((error: unknown) => {
      logger.error('failed to validate github app credentials', {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      exitAndCloseServer(1);
    });
}

/**
 * Boot sequence for BUILD_PLAN 2.2/2.3/2.4a/2.4b/3.3/4.1: load + validate persona, Anthropic,
 * database, cost-cap, channel-scope, and GitHub config from env, start the health-check HTTP
 * server, open the shared Postgres pool (migrations are a separate manual pre-deploy step —
 * `pnpm --filter @moe/core migrate` — this boot sequence never runs them), connect to Slack over
 * Socket Mode. A DM gets a full LLM-generated reply in the placeholder voice, thread-scoped per
 * `resolve-thread-key.ts`; an ambient channel/group message is classified and logged instead
 * (BUILD_PLAN 3.3 — see `handle-inbound-message.ts`). A Slack connection failure only exits the
 * process when it's unrecoverable per isUnrecoverableStartError (permanent misconfiguration — the
 * SDK's own auto-reconnect already handles transient failures); see start-slack-listener.ts. The
 * GitHub App credential check (`validateGithubAndLog`, BUILD_PLAN 4.1's boot-time key-validation
 * guard) runs the same way — fire-and-forget, exiting on an unrecoverable failure rather than
 * blocking startup. Returns `undefined` on invalid config after logging (redacted) and exiting,
 * so a caller never mistakes a failed boot for a running server.
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
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    });
    exit(code);
  };
  server.on('error', (error) => {
    logger.error('server error', { errorMessage: error.message });
    exitAndCloseServer(1);
  });
  validateGithubAndLog(config.github, logger, exitAndCloseServer);
  startSlack(
    {
      config: config.persona,
      anthropicApiKey: config.anthropicApiKey,
      db,
      costCapConfig: config.costCap,
      channelScopeConfig: config.channelScope,
    },
    logger,
    exitAndCloseServer,
  );
  return server;
}
