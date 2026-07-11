// Imports the package's own BUILT output (../dist), not ../src — Node's native TypeScript
// execution doesn't perform NodeNext-style `.js`→`.ts` resolution for local relative imports (only
// works once the `.js` file genuinely exists on disk), so this consumes `@moe/core` the same way
// an external package would. Requires `pnpm build` to have run first — the `migrate` script does
// that automatically.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPool, runMigrations } from '../dist/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'migrations',
);
const pool = createPool(connectionString);

const result = await runMigrations(pool, migrationsDir);
await pool.end();

if (!result.ok) {
  console.error(`Migration failed: ${result.error.file}`, result.error.cause);
  process.exit(1);
}

console.log(
  result.applied.length > 0
    ? `Applied: ${result.applied.join(', ')}`
    : 'Already up to date, nothing to apply.',
);
