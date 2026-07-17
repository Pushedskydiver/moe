import type { Database } from '../schema.js';
import type { Kysely } from 'kysely';
import type { Pool } from 'pg';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb } from '../ticket-lifecycle/db.js';
import { runMigrations } from '../ticket-lifecycle/migrate.js';
import { getTestPool, resetDatabase } from '../ticket-lifecycle/test-db.js';
import { getPersonaCostForDay, recordUsage } from './cost-usage-repository.js';

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'migrations',
);

function usageInput(
  overrides: Partial<Parameters<typeof recordUsage>[1]> = {},
) {
  return {
    personaId: 'sarah',
    day: '2026-07-17',
    inputTokens: 120,
    outputTokens: 340,
    costUsdMicros: 3_640,
    ...overrides,
  };
}

describe('cost-usage repository', () => {
  let pool: Pool;
  let db: Kysely<Database>;

  beforeEach(async () => {
    pool = getTestPool();
    await runMigrations(pool, migrationsDir);
    db = createDb(pool);
  });

  afterEach(async () => {
    await db.destroy();
    const cleanupPool = getTestPool();
    await resetDatabase(cleanupPool);
    await cleanupPool.end();
  });

  it('records a first-ever turn for a persona/day as a new row', async () => {
    const result = await recordUsage(db, usageInput());

    expect(result).toEqual({
      ok: true,
      usage: expect.objectContaining({
        personaId: 'sarah',
        day: '2026-07-17',
        inputTokens: 120,
        outputTokens: 340,
        costUsdMicros: 3_640,
      }),
    });
  });

  it('accumulates a second call for the same persona/day instead of overwriting it', async () => {
    await recordUsage(db, usageInput());
    const second = await recordUsage(
      db,
      usageInput({ inputTokens: 80, outputTokens: 200, costUsdMicros: 2_160 }),
    );

    expect(second).toEqual({
      ok: true,
      usage: expect.objectContaining({
        personaId: 'sarah',
        day: '2026-07-17',
        inputTokens: 200,
        outputTokens: 540,
        costUsdMicros: 5_800,
      }),
    });
  });

  it('accumulates correctly even when two calls for the same persona/day race concurrently', async () => {
    await Promise.all([
      recordUsage(db, usageInput()),
      recordUsage(
        db,
        usageInput({
          inputTokens: 80,
          outputTokens: 200,
          costUsdMicros: 2_160,
        }),
      ),
    ]);

    const result = await getPersonaCostForDay(db, {
      personaId: 'sarah',
      day: '2026-07-17',
    });

    expect(result.ok && result.usage).toEqual(
      expect.objectContaining({
        inputTokens: 200,
        outputTokens: 540,
        costUsdMicros: 5_800,
      }),
    );
  });

  it('keeps a different day for the same persona as a separate row', async () => {
    await recordUsage(db, usageInput({ day: '2026-07-17' }));
    await recordUsage(db, usageInput({ day: '2026-07-18', inputTokens: 50 }));

    const day1 = await getPersonaCostForDay(db, {
      personaId: 'sarah',
      day: '2026-07-17',
    });
    const day2 = await getPersonaCostForDay(db, {
      personaId: 'sarah',
      day: '2026-07-18',
    });

    expect(day1.ok && day1.usage?.inputTokens).toBe(120);
    expect(day2.ok && day2.usage?.inputTokens).toBe(50);
  });

  it('keeps a different persona on the same day as a separate row', async () => {
    await recordUsage(db, usageInput({ personaId: 'sarah' }));
    await recordUsage(db, usageInput({ personaId: 'marcus', inputTokens: 50 }));

    const sarah = await getPersonaCostForDay(db, {
      personaId: 'sarah',
      day: '2026-07-17',
    });
    const marcus = await getPersonaCostForDay(db, {
      personaId: 'marcus',
      day: '2026-07-17',
    });

    expect(sarah.ok && sarah.usage?.inputTokens).toBe(120);
    expect(marcus.ok && marcus.usage?.inputTokens).toBe(50);
  });

  it('returns a null usage for a persona/day with no recorded turns yet', async () => {
    const result = await getPersonaCostForDay(db, {
      personaId: 'sarah',
      day: '2026-07-17',
    });

    expect(result).toEqual({ ok: true, usage: null });
  });
});
