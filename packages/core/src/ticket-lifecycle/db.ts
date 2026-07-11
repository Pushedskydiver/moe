import type { Database } from './schema.js';

import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

/**
 * Long-running-process pool, not Neon's serverless/HTTP driver — every moe persona is an
 * always-on process, not an edge function, so a normal TCP pool is the right fit (Neon's own
 * docs recommend this for long-running servers). Point `connectionString` at Neon's *pooled*
 * (`-pooler`) hostname in production; keep `max` modest since N persona machines each hold their
 * own pool against one shared instance.
 */
export function createPool(connectionString: string): Pool {
  const pool = new Pool({ connectionString, max: 10 });
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
