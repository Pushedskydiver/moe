import { sql } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';

import { createDb } from './db.js';
import { getTestPool } from './test-db.js';

describe('createDb', () => {
  const pool = getTestPool();
  const db = createDb(pool);

  afterAll(async () => {
    await db.destroy();
  });

  it('runs a real query against Postgres', async () => {
    const result = await sql<{ answer: number }>`SELECT 1 AS answer`.execute(
      db,
    );
    expect(result.rows[0]?.answer).toBe(1);
  });
});
