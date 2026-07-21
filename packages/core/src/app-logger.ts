/**
 * The structured-logger shape every `*SdkLoggerAdapter` (`docs/CONVENTIONS.md`'s External API
 * Integration Patterns) routes an SDK's own logging through, so it lands in this app's real
 * structured JSON logging and `apps/server/src/redact-secrets.ts`'s key-based redaction instead
 * of bypassing both via an SDK's own default console logger. Promoted here from seven identical
 * local definitions across `packages/slack` (three, including `socket-mode-listener.ts`'s own
 * `ListenerLogger`), `packages/agents` (two), and `packages/github` (two), plus
 * `apps/server/src/logger.ts`'s own `Logger` type — eight in all — once a third sibling package
 * needed the same shape, the same promote-at-2+-consumers trigger
 * `packages/core/src/core-hours/cached.ts`'s own doc comment anticipated (paraphrasing: the day a
 * second integration needs the same shape) for its own promotion. `apps/server`'s `Logger` keeps
 * its name (referenced throughout that package) but is now aliased to this shape rather than
 * redefining it — the other seven were removed outright.
 */
export type AppLogger = {
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
