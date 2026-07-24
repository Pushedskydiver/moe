import { CONTAINER_BACKUP_DIR } from './backup-constants.js';

/**
 * No `--dbname`/`-h`/`-U` flags — the target is supplied entirely via the container's own
 * `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` env vars (libpq's documented mechanism),
 * so the connection string never appears in any process's argv, unlike a `--dbname=<uri>` value
 * (which the container's shell would expand into `pg_dump`'s own command-line arguments, visible
 * via `docker top`). `outputFileName` must already be shell-safe (caller-generated, never
 * external input) since it's embedded directly into this command string.
 */
export function buildPgDumpCommand(outputFileName: string): string {
  return `pg_dump --format=custom --no-owner --no-acl --file=${CONTAINER_BACKUP_DIR}/${outputFileName}`;
}
