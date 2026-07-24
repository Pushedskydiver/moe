import { describe, expect, it } from 'vitest';

import { buildPgDumpCommand } from './pg-dump-command.js';

describe('buildPgDumpCommand', () => {
  it('writes to the given file under the container backup dir, with no --dbname argument', () => {
    const result = buildPgDumpCommand('moe-backup-test.dump');
    expect(result).toBe(
      'pg_dump --format=custom --no-owner --no-acl --file=/backups/moe-backup-test.dump',
    );
  });
});
