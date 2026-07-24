import { CONTAINER_BACKUP_DIR } from './backup-constants.js';

/**
 * `--clean --if-exists` drops existing objects in the target database before recreating them —
 * this is destructive to whatever the target connection string points at. Unlike `pg_dump`,
 * `pg_restore` refuses to run without an explicit `-d`/`--dbname` ("one of -d/--dbname and -f/
 * --file must be specified") — it can't infer a live-database target from `PGDATABASE` alone the
 * way `pg_dump`'s own default source-connection resolution does. `--dbname="$PGDATABASE"` supplies
 * only the database *name* (not a secret) as a literal shell-variable reference in this command
 * string; host/port/user/password still come from the container's own `PG*` env vars, so the
 * actual credential never appears in any argv. `inputFileName` must already be shell-safe
 * (verified by the caller — see `isShellSafeFileName`, never trusted as pre-sanitized just
 * because it looks like a file name) since it's embedded directly into this command string.
 */
export function buildPgRestoreCommand(inputFileName: string): string {
  return `pg_restore --clean --if-exists --no-owner --no-acl --dbname="$PGDATABASE" ${CONTAINER_BACKUP_DIR}/${inputFileName}`;
}
