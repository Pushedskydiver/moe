import type { Database } from '../schema.js';

import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

/**
 * Long-running-process pool, not Neon's serverless/HTTP driver — every moe persona is an
 * always-on process, not an edge function, so a normal TCP pool is the right fit (Neon's own
 * docs recommend this for long-running servers). Point `connectionString` at Neon's *pooled*
 * (`-pooler`) hostname in production — `docs/OPERATIONS.md` §Deploying the persona fleet makes
 * that a required deploy step rather than the advice-only note it was until BUILD_PLAN 5.2.
 *
 * `max` was re-derived at 5.2, when N stopped being 1. A 0.25 CU Neon compute allows 104 direct
 * connections with 7 reserved for its superuser (verified against Neon's own connection-pooling
 * docs, 2026-07-25), so 97 are usable: the previous `max: 10` across the 8-persona roster came to
 * 80, 82% of that budget, with no headroom for a rolling restart holding an old and a new pool
 * open at once. At 5 the fleet sits at 40. The pooled endpoint accepts up to 10,000 client
 * connections, so this only binds if a deploy accidentally uses the direct hostname — which is
 * exactly the case the number is chosen to survive.
 */
export function createPool(connectionString: string): Pool {
  const pool = new Pool({ connectionString, max: 5 });
  pool.on('error', (error: unknown) => {
    // An idle client can be dropped without warning (e.g. Neon scale-to-zero) — an unhandled
    // 'error' event here would crash the whole process, not just fail the next query.
    console.error('Unexpected pg pool error', error);
  });
  return pool;
}

export function createDb(pool: Pool): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
    plugins: [new CamelCasePlugin()],
  });
}
