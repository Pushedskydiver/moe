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
  formatEnvFileContents,
  generateBackupFileName,
  isValidConnectionString,
  parsePgEnvFromConnectionString,
} from '../dist/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}
if (!isValidConnectionString(connectionString)) {
  console.error('DATABASE_URL is not a valid connection string.');
  process.exit(1);
}

const outputDir =
  process.env.BACKUP_OUTPUT_DIR ??
  join(dirname(fileURLToPath(import.meta.url)), '..', '.backups');
mkdirSync(outputDir, { recursive: true });

const fileName = generateBackupFileName(new Date());
const envDir = mkdtempSync(join(tmpdir(), 'moe-backup-'));
const envFilePath = join(envDir, 'env');
writeFileSync(
  envFilePath,
  formatEnvFileContents(parsePgEnvFromConnectionString(connectionString)),
  { mode: 0o600 },
);

// Cleanup must run no matter how the docker invocation ends — the env file holds the plaintext
// connection-derived credentials. try/finally covers a thrown/rejected error; the signal handlers
// cover an operator Ctrl-C or an external kill during the (potentially long) dump.
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
    volumeHostDir: outputDir,
    shellCommand: buildPgDumpCommand(fileName),
  });

  const exitCode = await runDockerCommand(dockerCommand);
  if (exitCode !== 0) {
    console.error(`pg_dump failed (exit code ${exitCode}).`);
    process.exitCode = exitCode;
  } else {
    console.log(`Backup written: ${join(outputDir, fileName)}`);
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
