import { describe, expect, it } from 'vitest';

import { buildDockerRunCommand } from './docker-run-command.js';

describe('buildDockerRunCommand', () => {
  it('builds a docker argv wrapping the given shell command, with the secret only reachable via --env-file', () => {
    const result = buildDockerRunCommand({
      envFilePath: '/tmp/moe-backup-env-123',
      volumeHostDir: '/Users/alex/moe/.backups',
      shellCommand: 'pg_dump --dbname="$CONN" --file=/backups/x.dump',
    });

    expect(result).toEqual({
      command: 'docker',
      args: [
        'run',
        '--rm',
        '--env-file',
        '/tmp/moe-backup-env-123',
        '-v',
        '/Users/alex/moe/.backups:/backups',
        'postgres:18-alpine',
        'sh',
        '-c',
        'pg_dump --dbname="$CONN" --file=/backups/x.dump',
      ],
    });
  });

  it('mounts the volume read-only when readOnly is true', () => {
    const result = buildDockerRunCommand({
      envFilePath: '/tmp/moe-restore-env-123',
      volumeHostDir: '/Users/alex/moe/.backups',
      shellCommand: 'pg_restore --dbname="$CONN" /backups/x.dump',
      readOnly: true,
    });

    expect(result.args).toContain('/Users/alex/moe/.backups:/backups:ro');
  });
});
