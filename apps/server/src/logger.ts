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
