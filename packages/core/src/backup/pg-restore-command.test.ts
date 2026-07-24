import { describe, expect, it } from 'vitest';

import { buildPgRestoreCommand } from './pg-restore-command.js';

describe('buildPgRestoreCommand', () => {
  it('reads the target connection string from $CONN and restores from the given file under the container backup dir', () => {
    const result = buildPgRestoreCommand('moe-backup-test.dump');
    expect(result).toBe(
      'pg_restore --clean --if-exists --no-owner --no-acl --dbname="$CONN" /backups/moe-backup-test.dump',
    );
  });
});
