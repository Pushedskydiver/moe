// Imports the package's own BUILT output (../dist), matching migrate.ts's own precedent — see
// that file's comment for why Node-native TS execution requires this.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import {
  buildDockerRunCommand,
  buildPgRestoreCommand,
  formatEnvFileContents,
  isShellSafeFileName,
  parsePgEnvFromConnectionString,
  redactConnectionStringForDisplay,
} from '../dist/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set — this must be the RESTORE TARGET.');
  process.exit(1);
}

// Parsed once, up front — before printing the confirmation prompt or creating any temp file —
// so every failure mode of a malformed DATABASE_URL is caught here with a clean message, never as
// an uncaught exception reached only after the operator has already confirmed the destructive
// action (redactConnectionStringForDisplay below reuses this same, now-known-parseable string).
const envResult = parsePgEnvFromConnectionString(connectionString);
if (!envResult.ok) {
  console.error(`DATABASE_URL is invalid: ${envResult.error.message}`);
  process.exit(1);
}

const backupFilePath = process.env.BACKUP_FILE_PATH;
if (!backupFilePath) {
  console.error('BACKUP_FILE_PATH is not set (host path to a .dump file).');
  process.exit(1);
}

// buildPgRestoreCommand embeds this directly into a shell command string — an operator-supplied
// BACKUP_FILE_PATH is external input and must be checked before it ever reaches that boundary.
const fileName = basename(backupFilePath);
if (!isShellSafeFileName(fileName)) {
  console.error(
    `BACKUP_FILE_PATH's file name contains characters that aren't safe to use here: ${fileName}`,
  );
  process.exit(1);
}

// pg_restore runs with --clean --if-exists: it DROPS existing objects at DATABASE_URL before
// recreating them from the dump. The confirmation phrase is the target's own redacted connection
// string (not a static phrase) — the operator has to actually look at what they're about to
// destroy, and a confirmation copy-pasted for a *different* database won't match this one.
const redactedTarget = redactConnectionStringForDisplay(connectionString);
if (process.env.CONFIRM_RESTORE_TARGET !== redactedTarget) {
  console.error(
    `This will DROP existing objects in the database at ${redactedTarget} and replace them ` +
      `with the contents of ${backupFilePath}. If that's really what you want, re-run with ` +
      `CONFIRM_RESTORE_TARGET=${redactedTarget}`,
  );
  process.exit(1);
}

const envDir = mkdtempSync(join(tmpdir(), 'moe-restore-'));
const envFilePath = join(envDir, 'env');
writeFileSync(envFilePath, formatEnvFileContents(envResult.env), {
  mode: 0o600,
});

// Cleanup must run no matter how the docker invocation ends — see backup.ts's own identical
// comment on this same pattern.
let cleanedUp = false;
function cleanup(): void {
  if (cleanedUp) return;
  cleanedUp = true;
  rmSync(envDir, { recursive: true, force: true });
}
process.on('SIGINT', () => {
  cleanup();
  process.exit(1);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(1);
});

try {
  const dockerCommand = buildDockerRunCommand({
    envFilePath,
    volumeHostDir: dirname(backupFilePath),
    shellCommand: buildPgRestoreCommand(fileName),
    readOnly: true,
  });

  const exitCode = await runDockerCommand(dockerCommand);
  if (exitCode !== 0) {
    console.error(`pg_restore failed (exit code ${exitCode}).`);
    process.exitCode = exitCode;
  } else {
    console.log(`Restore complete from: ${backupFilePath}`);
  }
} finally {
  cleanup();
}

function runDockerCommand(command: {
  command: string;
  args: readonly string[];
}): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command.command, [...command.args], {
      stdio: 'inherit',
    });
    child.on('error', (error) => {
      console.error(`Failed to run docker: ${error.message}`);
      resolve(1);
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}
