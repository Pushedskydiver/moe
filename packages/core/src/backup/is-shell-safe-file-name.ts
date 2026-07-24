const SHELL_SAFE_FILE_NAME = /^[A-Za-z0-9._-]+$/;

/**
 * `buildPgRestoreCommand`'s input is embedded directly into a shell command string run inside a
 * container — this is the boundary check that must run before any externally-supplied file name
 * (e.g. an operator's `BACKUP_FILE_PATH`) reaches it. `.`/`..` are excluded even though both match
 * the character class, since neither is a meaningful dump file name.
 */
export function isShellSafeFileName(name: string): boolean {
  return SHELL_SAFE_FILE_NAME.test(name) && name !== '.' && name !== '..';
}
