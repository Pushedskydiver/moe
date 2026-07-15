import { redactSecrets } from './redact-secrets.js';

type LogFields = Readonly<Record<string, unknown>>;

export type Logger = {
  readonly info: (message: string, fields?: LogFields) => void;
  readonly warn: (message: string, fields?: LogFields) => void;
  readonly error: (message: string, fields?: LogFields) => void;
};

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
  const redactedFields = redactSecrets(opts.fields ?? {}, opts.secretKeys);
  const line = {
    level: opts.level,
    message: opts.message,
    timestamp: new Date().toISOString(),
    ...(redactedFields as LogFields),
  };
  console.log(JSON.stringify(line));
}

/**
 * Structured (JSON-lines) logger. Every field payload is passed through `redactSecrets` before
 * serialization, so a caller can log a whole config object without hand-picking safe fields —
 * `secretKeys` is the single place that decides what never reaches stdout.
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
