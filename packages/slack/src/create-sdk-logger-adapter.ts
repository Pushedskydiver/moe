import type { AppLogger } from '@moe/core';
import type { Logger as SdkLogger } from '@slack/logger';

import { LogLevel } from '@slack/logger';

const REDACTED_MARKER = '[REDACTED]';

// Recurses one secret at a time (destructure head/rest, base case, recurse) rather than
// `.reduce()`, per `docs/CONVENTIONS.md`'s ban — mirrors this codebase's own established pattern
// for sequential-by-design work over a short list (e.g. `apps/server/src/check-cost-cap.ts`'s
// `sendCostAlerts`, `packages/core/src/ticket-lifecycle/migrate.ts`'s `applyPending`).
function redactSecretValues(
  value: string,
  secretValues: readonly string[],
): string {
  const [secret, ...rest] = secretValues;
  if (secret === undefined) {
    return value;
  }

  const redacted =
    secret.length > 0 ? value.split(secret).join(REDACTED_MARKER) : value;
  return redactSecretValues(redacted, rest);
}

/**
 * Value-based redaction, not key-based: the SDK's log arguments are positional and free-text
 * (`...msg: any[]`), so `apps/server/src/redact-secrets.ts`'s key-name matching can't reach
 * them — this scrubs any occurrence of a known secret token wherever it appears in a string,
 * regardless of shape.
 */
function redactValue(value: unknown, secretValues: readonly string[]): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  return redactSecretValues(value, secretValues);
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
 * bypassing `apps/server/src/redact-secrets.ts`'s `redactSecrets` entirely (confirmed live via a
 * Docker smoke test). `secretValues` are scrubbed from every logged string on top of routing
 * through the structured logger, since the SDK's own log messages are free-text and can't be
 * redacted by key name alone. Debug is silenced (too noisy for production, and the least-audited
 * part of this dependency).
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
