const DEFAULT_PORT = 8080;

/**
 * Resolves the HTTP port from env, treating `PORT=0` (OS-assigned port, used in tests) as valid
 * rather than falling back — a plain `Number(env.PORT) || DEFAULT_PORT` would silently turn `0`
 * into the default.
 */
export function resolvePort(
  env: Readonly<Record<string, string | undefined>>,
): number {
  const parsed = Number(env.PORT);
  return env.PORT !== undefined && !Number.isNaN(parsed)
    ? parsed
    : DEFAULT_PORT;
}
