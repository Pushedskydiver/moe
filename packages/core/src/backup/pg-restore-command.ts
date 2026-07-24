import { CONTAINER_BACKUP_DIR } from './backup-constants.js';

/**
 * `--clean --if-exists` drops existing objects in the target database before recreating them —
 * this is destructive to whatever the target connection string points at. Reads the target from
 * `$CONN` for the same argv-exposure reason as `buildPgDumpCommand`. `inputFileName` must already
 * be shell-safe (caller-generated, never external input).
 */
export function buildPgRestoreCommand(inputFileName: string): string {
  return `pg_restore --clean --if-exists --no-owner --no-acl --dbname="$CONN" ${CONTAINER_BACKUP_DIR}/${inputFileName}`;
}
