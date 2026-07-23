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
    // `ticket_github_issue_links` references `tickets` via foreign key — a real bug once existed
    // here where this list omitted it entirely: Postgres only errors on a dependent table missing
    // from the same multi-table `DROP TABLE` statement, not on the two tables' relative order
    // within it (verified directly against a real Postgres instance) — omitting it left `tickets`
    // undroppable, so this whole statement silently failed and every test in this suite went red
    // on the very next run. Both tables just need to appear somewhere in the same statement; no
    // `CASCADE` needed once that's true.
    'DROP TABLE IF EXISTS ticket_github_issue_links, tickets, schema_migrations, conversation_turns, persona_cost_daily, persona_cost_alerts, pending_ticket_drafts, review_queue, pending_confirming_questions, sweep_state, github_issue_triage',
  );
}
