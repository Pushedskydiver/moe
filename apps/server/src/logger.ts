import type { AppLogger } from '@moe/core';

import { redactSecrets } from './redact-secrets.js';

type LogFields = Readonly<Record<string, unknown>>;

// apps/server keeps its own name for this app's canonical concrete logger implementation (the
// type createLogger() actually returns, referenced throughout this package) rather than renaming
// every call site to the more generic cross-package AppLogger — same shape, aliased not
// redefined, so there's a single source of truth for the shape itself.
export type Logger = AppLogger;

type CreateLoggerOpts = {
  readonly secretKeys: readonly string[];
};

type WriteLineOpts = {
  readonly level: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly fields: LogFields | undefined;
  readonly secretKeys: readonly string[];
};

function writeLine(opts: WriteLineOpts): void {
  // redactSecrets is a structural unknown -> unknown transform; the input was LogFields, so the
  // shape is preserved and this cast is safe.
  const redactedFields = redactSecrets(
    opts.fields ?? {},
    opts.secretKeys,
  ) as LogFields;
  // Caller fields spread first so a field literally named level/message/timestamp can never
  // clobber the log line's own metadata — the literal fields below always win.
  const line = {
    ...redactedFields,
    level: opts.level,
    message: opts.message,
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(line));
}

/**
 * Structured (JSON-lines) logger. Every field payload is passed through `redactSecrets` before
 * serialization, so a caller can log a whole config object without hand-picking safe fields —
 * `secretKeys` is the single place that decides what never reaches stdout.
 *
 * **Never name a fields-object key `message`, `level`, or `timestamp`.** `writeLine`'s own spread
 * order deliberately lets the log line's own metadata win over a caller field with the same
 * name (`never lets a caller field named level/message/timestamp override the real ones`, this
 * file's own test) — a real, confirmed bug class: 44 call sites — 41 in this package, plus 3 in
 * `packages/slack`'s `socket-mode-listener.ts` (any consumer wired to this logger via `AppLogger`,
 * not just this package) — once used `message: someErrorDetail` for their own error-detail field,
 * silently discarding it on every single log line, undetected until BUILD_PLAN 4.2 caught it via a
 * live run. Use `errorMessage` (the fix applied everywhere this recurred) or any other
 * non-reserved name instead.
 */
export function createLogger(opts: CreateLoggerOpts): Logger {
  return {
    info: (message, fields) =>
      writeLine({
        level: 'info',
        message,
        fields,
        secretKeys: opts.secretKeys,
      }),
    warn: (message, fields) =>
      writeLine({
        level: 'warn',
        message,
        fields,
        secretKeys: opts.secretKeys,
      }),
    error: (message, fields) =>
      writeLine({
        level: 'error',
        message,
        fields,
        secretKeys: opts.secretKeys,
      }),
  };
}
