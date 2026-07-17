import type { Pool } from 'pg';

import { createPool } from './db.js';

/**
 * Real-database test helper (docs/TESTING.md: "prefer a real test database where practical").
 * Requires `DATABASE_URL` — fails loudly rather than silently skipping, so a missing local
 * Postgres shows up as a clear test failure, not quietly-passing suites.
 */
export function getTestPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set — tests in ticket-lifecycle/ need a real Postgres to run against. ' +
        'Point it at a local/dev database, e.g. postgres://postgres:password@localhost:5432/moe_dev',
    );
  }
  return createPool(connectionString);
}

export async function resetDatabase(pool: Pool): Promise<void> {
  await pool.query(
    'DROP TABLE IF EXISTS tickets, schema_migrations, conversation_turns, persona_cost_daily, persona_cost_alerts',
  );
}
