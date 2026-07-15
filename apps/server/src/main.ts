import type { Logger } from './logger.js';
import type { PersonaConfig } from '@moe/agents';
import type { Server } from 'node:http';

import { createServer } from 'node:http';

import { parsePersonaConfig } from '@moe/agents';

import { createHealthHandler } from './health-handler.js';
import { createLogger } from './logger.js';
import { resolvePort } from './resolve-port.js';

const SECRET_KEYS = ['slackBotToken', 'slackSigningSecret'];

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
 * Boot sequence for BUILD_PLAN 2.2: load + validate persona config from env, start the
 * health-check HTTP server. Deliberately "connects nothing" beyond that — Slack/GitHub wiring
 * are later chunks. Returns `undefined` on invalid config after logging (redacted) and exiting,
 * so a caller never mistakes a failed boot for a running server.
 */
export function main(
  env: Readonly<Record<string, string | undefined>> = process.env,
  exit: (code: number) => void = (code) => process.exit(code),
): Server | undefined {
  const logger = createLogger({ secretKeys: SECRET_KEYS });
  const parsed = parsePersonaConfig(env);

  if (!parsed.ok) {
    logger.error('invalid persona config', { issues: parsed.error.issues });
    exit(1);
    return undefined;
  }

  return startServer(parsed.config, logger, resolvePort(env));
}
