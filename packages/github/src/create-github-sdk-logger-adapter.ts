import type { AppLogger } from '@moe/core';

type OctokitLog = {
  readonly debug: (message: string, additionalInfo?: unknown) => void;
  readonly info: (message: string, additionalInfo?: unknown) => void;
  readonly warn: (message: string, additionalInfo?: unknown) => void;
  readonly error: (message: string, additionalInfo?: unknown) => void;
};

const REDACTED_MARKER = '[REDACTED]';

// Matches GitHub's own token prefixes (personal-access, OAuth, user-to-server, server-to-server/
// installation, refresh, and fine-grained PAT — https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github#githubs-token-formats).
// Unlike `privateKey` (known at client-construction time, so it's in `secretValues` below), the
// installation access token this client actually sends on every request is minted per-call and
// never passed in explicitly — this pattern is what catches it wherever it appears in a log line.
const GITHUB_TOKEN_PATTERN =
  /\bgh[a-z]_[A-Za-z0-9]+\b|\bgithub_pat_[A-Za-z0-9_]+\b/g;

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
 * Value-based redaction, not key-based — Octokit's own log lines are free-text, so
 * `apps/server/src/redact-secrets.ts`'s key-name matching can't reach them. Mirrors
 * packages/slack/src/create-sdk-logger-adapter.ts's approach for the same reason.
 */
function redactValue(value: unknown, secretValues: readonly string[]): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const staticRedacted = redactSecretValues(value, secretValues);
  return staticRedacted.replace(GITHUB_TOKEN_PATTERN, REDACTED_MARKER);
}

function toFields(
  additionalInfo: unknown,
  secretValues: readonly string[],
): Readonly<Record<string, unknown>> {
  if (additionalInfo === undefined) {
    return {};
  }
  const detail =
    additionalInfo instanceof Error ? additionalInfo.message : additionalInfo;
  return { details: [redactValue(detail, secretValues)] };
}

/**
 * Adapts our structured logger to Octokit's own `log` client option
 * (`octokit.log.debug/info/warn/error(message[, additionalInfo])`). Without this, Octokit falls
 * back to its own default logger (`warn`/`error` go to `console.warn`/`console.error`; `debug`/
 * `info` are silent no-ops), bypassing redactSecrets entirely for the two levels that do reach
 * console — same gap `create-sdk-logger-adapter.ts` closes for the Slack SDK. `secretValues` are
 * scrubbed from every logged string on top of routing through the structured logger, since
 * Octokit's own log messages are free-text and can't be redacted by key name alone. Debug is
 * silenced here too (too noisy for production, and the least-audited part of this dependency).
 */
export function createGithubSdkLoggerAdapter(
  logger: AppLogger,
  secretValues: readonly string[],
): OctokitLog {
  return {
    debug: () => undefined,
    info: (message, additionalInfo) =>
      logger.info(
        String(redactValue(message, secretValues)),
        toFields(additionalInfo, secretValues),
      ),
    warn: (message, additionalInfo) =>
      logger.warn(
        String(redactValue(message, secretValues)),
        toFields(additionalInfo, secretValues),
      ),
    error: (message, additionalInfo) =>
      logger.error(
        String(redactValue(message, secretValues)),
        toFields(additionalInfo, secretValues),
      ),
  };
}
