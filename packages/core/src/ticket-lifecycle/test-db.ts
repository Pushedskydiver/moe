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
    // `ticket_plans` (BUILD_PLAN 6.1c) references `tickets` via foreign key, same reasoning as
    // `ticket_github_issue_links`/`ticket_briefs` above — every `beforeEach` re-runs migrations
    // inside one transaction, and `schema_migrations` is itself in this drop list, so a new table
    // left off this list survives a reset while migration history doesn't: the next test's
    // `beforeEach` then hits `CREATE TABLE ticket_plans` against a table that already exists,
    // rolling back the whole migration transaction and surfacing as a confusing, unrelated-looking
    // "relation tickets does not exist" failure in some other test file entirely (BUILD_PLAN.md's
    // own chunk-3.4c narrative names this exact recurring gap class).
    'DROP TABLE IF EXISTS ticket_github_issue_links, ticket_briefs, ticket_plans, tickets, schema_migrations, conversation_turns, persona_cost_daily, persona_cost_alerts, pending_ticket_drafts, review_queue, pending_confirming_questions, sweep_state, github_issue_triage',
  );
}
