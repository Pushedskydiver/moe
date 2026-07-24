// Imports the package's own BUILT output (../dist), matching migrate.ts's own precedent — see
// that file's comment for why Node-native TS execution requires this.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildDockerRunCommand,
  buildPgDumpCommand,
  generateBackupFileName,
} from '../dist/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const outputDir =
  process.env.BACKUP_OUTPUT_DIR ??
  join(dirname(fileURLToPath(import.meta.url)), '..', '.backups');
mkdirSync(outputDir, { recursive: true });

const fileName = generateBackupFileName(new Date());
const envDir = mkdtempSync(join(tmpdir(), 'moe-backup-'));
const envFilePath = join(envDir, 'env');
writeFileSync(envFilePath, `CONN=${connectionString}\n`, { mode: 0o600 });

const dockerCommand = buildDockerRunCommand({
  envFilePath,
  volumeHostDir: outputDir,
  shellCommand: buildPgDumpCommand(fileName),
});

const exitCode = await runDockerCommand(dockerCommand);
// Cleanup must happen before process.exit() below — process.exit() does not run pending code
// after it, so deleting the temp env file (it holds the plaintext connection string) has to come
// first on every path, success or failure.
rmSync(envDir, { recursive: true, force: true });

if (exitCode !== 0) {
  console.error(`pg_dump failed (exit code ${exitCode}).`);
  process.exit(exitCode);
}

console.log(`Backup written: ${join(outputDir, fileName)}`);

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
