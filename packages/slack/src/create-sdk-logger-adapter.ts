import type { Logger as SdkLogger } from '@slack/logger';

import { LogLevel } from '@slack/logger';

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

function toMessage(msg: readonly unknown[]): string {
  return msg.length > 0 ? String(msg[0]) : '';
}

function toFields(msg: readonly unknown[]): Readonly<Record<string, unknown>> {
  const details = msg
    .slice(1)
    .map((item) => (item instanceof Error ? item.message : item));
  return details.length > 0 ? { details } : {};
}

/**
 * Adapts our structured logger to @slack/logger's interface. Without this, `SocketModeClient`
 * falls back to its own default `ConsoleLogger`, which writes raw, unredacted lines straight to
 * stdout/stderr — bypassing redactSecrets entirely. Debug is silenced (too noisy for production,
 * and the SDK's own debug traces are the least-audited part of this dependency).
 */
export function createSdkLoggerAdapter(logger: AppLogger): SdkLogger {
  return {
    debug: () => undefined,
    info: (...msg) => logger.info(toMessage(msg), toFields(msg)),
    warn: (...msg) => logger.warn(toMessage(msg), toFields(msg)),
    error: (...msg) => logger.error(toMessage(msg), toFields(msg)),
    setLevel: () => undefined,
    getLevel: () => LogLevel.INFO,
    setName: () => undefined,
  };
}
