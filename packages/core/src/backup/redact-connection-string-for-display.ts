/**
 * Strips the password so the result is safe to print to a terminal, while keeping host/user/
 * database/query visible — enough for an operator to actually verify a destructive command's
 * target before confirming it, which a bare env-var name (`DATABASE_URL`) in a warning message
 * cannot provide.
 */
export function redactConnectionStringForDisplay(
  connectionString: string,
): string {
  const url = new URL(connectionString);
  return `${url.protocol}//${url.username}@${url.host}${url.pathname}${url.search}`;
}
