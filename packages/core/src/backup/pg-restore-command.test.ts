import { describe, expect, it } from 'vitest';

import { buildPgRestoreCommand } from './pg-restore-command.js';

describe('buildPgRestoreCommand', () => {
  it('restores from the given file under the container backup dir, targeting $PGDATABASE by name (not a secret) rather than a --dbname URI', () => {
    const result = buildPgRestoreCommand('moe-backup-test.dump');
    expect(result).toBe(
      'pg_restore --clean --if-exists --no-owner --no-acl --dbname="$PGDATABASE" /backups/moe-backup-test.dump',
    );
  });
});
