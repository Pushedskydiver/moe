export type PgConnectionEnv = {
  readonly PGHOST: string;
  readonly PGPORT: string;
  readonly PGUSER: string;
  readonly PGPASSWORD: string;
  readonly PGDATABASE: string;
  readonly PGSSLMODE?: string;
};

/**
 * Splits a connection string into discrete `PG*` env vars rather than handing `pg_dump`/
 * `pg_restore` the whole URI via `--dbname` — a `--dbname` value is expanded by the container's
 * shell and reaches the `pg_dump`/`pg_restore` process's own argv (visible via `docker top`),
 * while these individual vars are libpq's own documented env-var mechanism and never appear in
 * any process's command-line arguments.
 */
export function parsePgEnvFromConnectionString(
  connectionString: string,
): PgConnectionEnv {
  const url = new URL(connectionString);
  const sslmode = url.searchParams.get('sslmode');

  return {
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')),
    ...(sslmode ? { PGSSLMODE: sslmode } : {}),
  };
}
