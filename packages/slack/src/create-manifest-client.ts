import type { AppLogger } from '@moe/core';

import { WebClient } from '@slack/web-api';

import { createSdkLoggerAdapter } from './create-sdk-logger-adapter.js';

/**
 * Single builder for the Web API client authenticated with an app configuration token — the only
 * auth `apps.manifest.*` accepts, distinct from a bot/app token and obtained manually from
 * api.slack.com/apps (docs.slack.dev/authentication/tokens; verified live 2026-07-24, no scopes
 * required). Never construct a manifest-authenticated `WebClient` elsewhere.
 */
export function createManifestClient(
  configToken: string,
  logger: AppLogger,
): WebClient {
  return new WebClient(configToken, {
    logger: createSdkLoggerAdapter(logger, [configToken]),
  });
}
