// Imports the package's own BUILT output (../dist), matching migrate.ts's own precedent — see
// that file's comment for why Node-native TS execution requires this.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import { buildDockerRunCommand, buildPgRestoreCommand } from '../dist/index.js';

const CONFIRMATION_PHRASE = 'yes-drop-existing-data';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set — this must be the RESTORE TARGET.');
  process.exit(1);
}

const backupFilePath = process.env.BACKUP_FILE_PATH;
if (!backupFilePath) {
  console.error('BACKUP_FILE_PATH is not set (host path to a .dump file).');
  process.exit(1);
}

// pg_restore runs with --clean --if-exists: it DROPS existing objects at DATABASE_URL before
// recreating them from the dump. This confirmation exists to catch a copy-pasted wrong
// connection string before it destroys real data, not to gate a scenario that can't happen.
if (process.env.CONFIRM_RESTORE_TARGET !== CONFIRMATION_PHRASE) {
  console.error(
    `This will DROP existing objects in the database at DATABASE_URL and replace them with ` +
      `the contents of ${backupFilePath}. If that's really what you want, re-run with ` +
      `CONFIRM_RESTORE_TARGET=${CONFIRMATION_PHRASE}.`,
  );
  process.exit(1);
}

const envDir = mkdtempSync(join(tmpdir(), 'moe-restore-'));
const envFilePath = join(envDir, 'env');
writeFileSync(envFilePath, `CONN=${connectionString}\n`, { mode: 0o600 });

const dockerCommand = buildDockerRunCommand({
  envFilePath,
  volumeHostDir: dirname(backupFilePath),
  shellCommand: buildPgRestoreCommand(basename(backupFilePath)),
  readOnly: true,
});

const exitCode = await runDockerCommand(dockerCommand);
// Cleanup must happen before process.exit() below — see backup.ts's own identical comment.
rmSync(envDir, { recursive: true, force: true });

if (exitCode !== 0) {
  console.error(`pg_restore failed (exit code ${exitCode}).`);
  process.exit(exitCode);
}

console.log(`Restore complete from: ${backupFilePath}`);

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
