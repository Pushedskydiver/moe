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

const REDACTED_MARKER = '[REDACTED]';

/**
 * Value-based redaction, not key-based: the SDK's log arguments are positional and free-text
 * (`...msg: any[]`), so redactSecrets' key-name matching can't reach them — this scrubs any
 * occurrence of a known secret token wherever it appears in a string, regardless of shape.
 */
function redactValue(value: unknown, secretValues: readonly string[]): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  return secretValues.reduce(
    (redacted, secret) =>
      secret.length > 0
        ? redacted.split(secret).join(REDACTED_MARKER)
        : redacted,
    value,
  );
}

function toMessage(
  msg: readonly unknown[],
  secretValues: readonly string[],
): string {
  return msg.length > 0
    ? String(redactValue(String(msg[0]), secretValues))
    : '';
}

function toFields(
  msg: readonly unknown[],
  secretValues: readonly string[],
): Readonly<Record<string, unknown>> {
  const details = msg
    .slice(1)
    .map((item) => (item instanceof Error ? item.message : item))
    .map((item) => redactValue(item, secretValues));
  return details.length > 0 ? { details } : {};
}

/**
 * Adapts our structured logger to @slack/logger's interface. Without this, the SDK falls back to
 * its own default `ConsoleLogger`, which writes raw, unredacted lines straight to stdout/stderr —
 * bypassing redactSecrets entirely (confirmed live via a Docker smoke test). `secretValues` are
 * scrubbed from every logged string on top of routing through the structured logger, since the
 * SDK's own log messages are free-text and can't be redacted by key name alone. Debug is silenced
 * (too noisy for production, and the least-audited part of this dependency).
 */
export function createSdkLoggerAdapter(
  logger: AppLogger,
  secretValues: readonly string[],
): SdkLogger {
  return {
    debug: () => undefined,
    info: (...msg) =>
      logger.info(toMessage(msg, secretValues), toFields(msg, secretValues)),
    warn: (...msg) =>
      logger.warn(toMessage(msg, secretValues), toFields(msg, secretValues)),
    error: (...msg) =>
      logger.error(toMessage(msg, secretValues), toFields(msg, secretValues)),
    setLevel: () => undefined,
    getLevel: () => LogLevel.INFO,
    setName: () => undefined,
  };
}
