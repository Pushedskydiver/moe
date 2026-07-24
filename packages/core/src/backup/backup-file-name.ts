/**
 * Replaces every `:` and `.` in the ISO timestamp with `-` (keeping only the `.dump` extension's
 * own dot) so the result is safe to embed directly in a shell command string — no quoting needed.
 */
export function generateBackupFileName(timestamp: Date): string {
  const safeStamp = timestamp.toISOString().replaceAll(/[:.]/g, '-');
  return `moe-backup-${safeStamp}.dump`;
}
