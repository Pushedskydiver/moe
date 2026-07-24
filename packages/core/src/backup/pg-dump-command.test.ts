import { describe, expect, it } from 'vitest';

import { buildPgDumpCommand } from './pg-dump-command.js';

describe('buildPgDumpCommand', () => {
  it('reads the connection string from $CONN and writes to the given file under the container backup dir', () => {
    const result = buildPgDumpCommand('moe-backup-test.dump');
    expect(result).toBe(
      'pg_dump --format=custom --no-owner --no-acl --dbname="$CONN" --file=/backups/moe-backup-test.dump',
    );
  });
});
