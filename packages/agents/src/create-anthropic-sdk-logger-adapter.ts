import type { AppLogger } from '@moe/core';

// Structural match for @anthropic-ai/sdk's own Logger type (internal/utils/log.d.ts):
// `{error, warn, info, debug}`, each `(message: string, ...rest: unknown[]) => void`.
type AnthropicSdkLogger = {
  readonly error: (message: string, ...rest: readonly unknown[]) => void;
  readonly warn: (message: string, ...rest: readonly unknown[]) => void;
  readonly info: (message: string, ...rest: readonly unknown[]) => void;
  readonly debug: (message: string, ...rest: readonly unknown[]) => void;
};

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
 * Value-based redaction, not key-based: the SDK's log arguments are positional and free-text, so
 * `apps/server/src/redact-secrets.ts`'s key-name matching can't reach them — this scrubs any
 * occurrence of a known secret token wherever it appears in a string, regardless of shape.
 */
function redactValue(value: unknown, secretValues: readonly string[]): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  return redactSecretValues(value, secretValues);
}

function toFields(
  rest: readonly unknown[],
  secretValues: readonly string[],
): Readonly<Record<string, unknown>> {
  const details = rest
    .map((item) => (item instanceof Error ? item.message : item))
    .map((item) => redactValue(item, secretValues));
  return details.length > 0 ? { details } : {};
}

/**
 * Adapts our structured logger to @anthropic-ai/sdk's `Logger` interface. Without this, the SDK
 * defaults to `globalThis.console` (verified against the installed package — `client.js`'s own
 * `logger` option default) — bypassing this app's structured JSON logging and `redactSecrets`
 * entirely, the same routing gap `createSdkLoggerAdapter` in `@moe/slack` already closes for the
 * Slack SDKs. Note this isn't closing an active unredacted-API-key leak on the SDK's main request/
 * response logging path specifically — the SDK's own default logger already redacts known auth
 * headers (`x-api-key`, `authorization`, `cookie`) there — but any free-text or positional log
 * argument outside that one path isn't covered by the SDK's own redaction, which is what
 * `secretValues` closes here. `secretValues` are scrubbed from every logged string on top of
 * routing through the structured logger, since the SDK's own log messages are free-text and can't
 * be redacted by key name alone. Debug is silenced (too noisy for production, and the
 * least-audited part of this dependency).
 */
export function createAnthropicSdkLoggerAdapter(
  logger: AppLogger,
  secretValues: readonly string[],
): AnthropicSdkLogger {
  return {
    debug: () => undefined,
    info: (message, ...rest) =>
      logger.info(
        String(redactValue(message, secretValues)),
        toFields(rest, secretValues),
      ),
    warn: (message, ...rest) =>
      logger.warn(
        String(redactValue(message, secretValues)),
        toFields(rest, secretValues),
      ),
    error: (message, ...rest) =>
      logger.error(
        String(redactValue(message, secretValues)),
        toFields(rest, secretValues),
      ),
  };
}
