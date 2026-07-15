import { SocketModeClient } from '@slack/socket-mode';
import { WebClient } from '@slack/web-api';

import { createSdkLoggerAdapter } from './create-sdk-logger-adapter.js';

type AppLogger = {
  readonly info: (
    message: string,
    fields?: Readonly<Record<string, unknown>>,
  ) => void;
  readonly warn: (
    message: string,
    fields?: Readonly<Record<string, unknown>>,
  ) => void;
  readonly error: (
    message: string,
    fields?: Readonly<Record<string, unknown>>,
  ) => void;
};

/**
 * Single builder for the authenticated Web API client — never construct WebClient elsewhere.
 * Routes the SDK's own internal logging through the given logger (see createSdkLoggerAdapter) so
 * it can't bypass redaction via the SDK's separate default console logger — confirmed this was a
 * real, live gap via a Docker smoke test before this parameter was added.
 */
export function createWebClient(
  botToken: string,
  logger: AppLogger,
): WebClient {
  return new WebClient(botToken, {
    logger: createSdkLoggerAdapter(logger, [botToken]),
  });
}

/**
 * Single builder for the Socket Mode client — never construct SocketModeClient elsewhere. Same
 * logger wiring as createWebClient; this also covers the internal WebClient SocketModeClient
 * constructs for itself (used for `apps.connections.open`), since it's constructed with the same
 * `logger` option passed here.
 */
export function createSocketModeClient(
  appToken: string,
  logger: AppLogger,
): SocketModeClient {
  return new SocketModeClient({
    appToken,
    logger: createSdkLoggerAdapter(logger, [appToken]),
  });
}
