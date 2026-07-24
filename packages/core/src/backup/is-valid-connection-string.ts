/**
 * Boundary check for an operator-supplied `DATABASE_URL` — `parsePgEnvFromConnectionString` and
 * `redactConnectionStringForDisplay` both construct `new URL(...)` internally with no guard of
 * their own, so a malformed value must be caught here, before either is called, rather than
 * surfacing as an uncaught `TypeError` instead of a clean error message.
 */
export function isValidConnectionString(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
