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

/** Single builder for the authenticated Web API client — never construct WebClient elsewhere. */
export function createWebClient(botToken: string): WebClient {
  return new WebClient(botToken);
}

/**
 * Single builder for the Socket Mode client — never construct SocketModeClient elsewhere. Routes
 * the SDK's own internal logging through the given logger (see createSdkLoggerAdapter) so it
 * can't bypass redaction via the SDK's separate default console logger.
 */
export function createSocketModeClient(
  appToken: string,
  logger: AppLogger,
): SocketModeClient {
  return new SocketModeClient({
    appToken,
    logger: createSdkLoggerAdapter(logger),
  });
}
