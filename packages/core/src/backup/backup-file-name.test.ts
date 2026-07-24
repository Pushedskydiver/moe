import { describe, expect, it } from 'vitest';

import { generateBackupFileName } from './backup-file-name.js';

describe('generateBackupFileName', () => {
  it('produces a shell-safe file name (no colons, no dots except the extension) from a timestamp', () => {
    const result = generateBackupFileName(new Date('2026-07-24T03:15:07.123Z'));
    expect(result).toBe('moe-backup-2026-07-24T03-15-07-123Z.dump');
  });
});
