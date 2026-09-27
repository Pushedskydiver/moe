import type { Pool } from 'pg';

import { parse } from 'pg-connection-string';

import { createPool } from './db.js';

const LOCAL_TEST_HOSTS = new Set(['localhost', '127.0.0.1']);

const NON_LOCAL_DATABASE_URL_MESSAGE =
  "DATABASE_URL must point at a local Postgres (host localhost or 127.0.0.1) — getTestPool() refuses any other host because resetDatabase() drops moe's tables on it. The URL is not shown here because it may contain a password.";

// `pg` resolves its connection string with `pg-connection-string`'s own `parse`, where a
// non-empty `?host=` query param overrides the URL's authority host — so this checks the host
// `parse` returns, not `new URL(...).hostname`. An empty host is refused too: `pg` would fall
// back to `PGHOST`. Returns `null` on anything `parse` throws on, which the guard refuses like
// any other non-local host, so the caller never handles a third outcome.
function parseHost(connectionString: string): string | null {
  try {
    return parse(connectionString).host;
  } catch {
    return null;
  }
}

function isLocalTestDatabaseUrl(connectionString: string): boolean {
  const host = parseHost(connectionString);
  return host !== null && LOCAL_TEST_HOSTS.has(host);
}

/**
 * Real-database test helper (docs/TESTING.md: "prefer a real test database where practical").
 * Requires `DATABASE_URL` — fails loudly rather than silently skipping, so a missing local
 * Postgres shows up as a clear test failure, not quietly-passing suites. Refuses any
 * `DATABASE_URL` whose host, as `pg-connection-string` parses it, isn't exactly `localhost` or
 * `127.0.0.1`, because `resetDatabase()` drops moe's tables on whatever database this pool
 * points at.
 */
export function getTestPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set — tests in ticket-lifecycle/ need a real Postgres to run against. ' +
        'Point it at a local/dev database, e.g. postgres://postgres:password@localhost:5432/moe_dev',
    );
  }
  if (!isLocalTestDatabaseUrl(connectionString)) {
    throw new Error(NON_LOCAL_DATABASE_URL_MESSAGE);
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
    // `ticket_plans` (BUILD_PLAN 6.1c) references `tickets` via foreign key — the exact same
    // mechanism as `ticket_github_issue_links` above, not a different one: omitting a dependent
    // table from this list doesn't let it "survive" while its neighbors drop — Postgres DDL is
    // transactional per-statement, so leaving `ticket_plans` off would make the *whole* multi-table
    // `DROP TABLE` statement fail (a dangling FK reference on `tickets`), and nothing in the
    // statement drops, `schema_migrations` included (verified directly against a real Postgres
    // instance, same as the `ticket_github_issue_links` case above). That failure then propagates
    // out of `resetDatabase` into whatever `afterEach` called it, and every test after that point
    // runs against a database `resetDatabase` never actually reset (BUILD_PLAN.md's own chunk-3.4c
    // narrative names this exact recurring "new table left off this hardcoded list" gap class in
    // general terms, without itself describing the specific atomic-failure mechanism above).
    'DROP TABLE IF EXISTS ticket_github_issue_links, ticket_briefs, ticket_plans, tickets, schema_migrations, conversation_turns, persona_cost_daily, persona_cost_alerts, pending_ticket_drafts, review_queue, pending_confirming_questions, sweep_state, github_issue_triage',
  );
}
