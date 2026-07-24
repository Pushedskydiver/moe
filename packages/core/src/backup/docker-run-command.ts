import { BACKUP_IMAGE, CONTAINER_BACKUP_DIR } from './backup-constants.js';

export type DockerRunCommandInput = {
  readonly envFilePath: string;
  readonly volumeHostDir: string;
  readonly shellCommand: string;
  readonly readOnly?: boolean;
};

export type DockerRunCommand = {
  readonly command: 'docker';
  readonly args: readonly string[];
};

/**
 * `--env-file` (a path, not a value) keeps the connection-derived `PG*` credentials out of
 * `docker`'s own argv — they reach `pg_dump`/`pg_restore` as env vars (libpq's own documented
 * mechanism), never as a shell-expanded command-line argument. `BACKUP_IMAGE` provides a
 * version-matched pg_dump/pg_restore source with no separate local Postgres client install
 * required — see that constant's own comment for why its version is pinned independently of
 * CI's own `postgres:17-alpine` stand-in.
 */
export function buildDockerRunCommand(
  input: DockerRunCommandInput,
): DockerRunCommand {
  const volumeSpec = input.readOnly
    ? `${input.volumeHostDir}:${CONTAINER_BACKUP_DIR}:ro`
    : `${input.volumeHostDir}:${CONTAINER_BACKUP_DIR}`;

  return {
    command: 'docker',
    args: [
      'run',
      '--rm',
      '--env-file',
      input.envFilePath,
      '-v',
      volumeSpec,
      BACKUP_IMAGE,
      'sh',
      '-c',
      input.shellCommand,
    ],
  };
}
