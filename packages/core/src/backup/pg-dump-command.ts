import { CONTAINER_BACKUP_DIR } from './backup-constants.js';

/**
 * Reads the connection string from the container's own `$CONN` shell variable rather than a
 * `--dbname` flag value, so the secret never appears in `docker`'s own argv (host-visible via
 * `ps`) — only inside the short-lived container's process table via shell expansion.
 * `outputFileName` must already be shell-safe (caller-generated, never external input) since it's
 * embedded directly into this command string.
 */
export function buildPgDumpCommand(outputFileName: string): string {
  return `pg_dump --format=custom --no-owner --no-acl --dbname="$CONN" --file=${CONTAINER_BACKUP_DIR}/${outputFileName}`;
}
