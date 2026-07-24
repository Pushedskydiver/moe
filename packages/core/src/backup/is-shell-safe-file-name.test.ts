import { describe, expect, it } from 'vitest';

import { isShellSafeFileName } from './is-shell-safe-file-name.js';

describe('isShellSafeFileName', () => {
  it('accepts a normal dump file name', () => {
    expect(
      isShellSafeFileName('moe-backup-2026-07-24T02-38-48-565Z.dump'),
    ).toBe(true);
  });

  it('rejects a name containing a shell command separator', () => {
    expect(isShellSafeFileName('backup.dump; rm -rf /')).toBe(false);
  });

  it('rejects a name containing command substitution syntax', () => {
    expect(isShellSafeFileName('backup$(whoami).dump')).toBe(false);
  });

  it('rejects a name containing a pipe', () => {
    expect(isShellSafeFileName('backup.dump|cat')).toBe(false);
  });

  it('rejects an empty name', () => {
    expect(isShellSafeFileName('')).toBe(false);
  });

  it('rejects the "." and ".." path segments', () => {
    expect(isShellSafeFileName('.')).toBe(false);
    expect(isShellSafeFileName('..')).toBe(false);
  });
});
