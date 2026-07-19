import type { Database } from '../schema.js';
import type { Kysely } from 'kysely';
import type { Pool } from 'pg';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb } from '../ticket-lifecycle/db.js';
import { runMigrations } from '../ticket-lifecycle/migrate.js';
import { getTestPool, resetDatabase } from '../ticket-lifecycle/test-db.js';
import {
  getSweepState,
  recordSweepCompleted,
} from './sweep-state-repository.js';

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'migrations',
);

describe('sweep state repository', () => {
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

  it('returns a null state for a persona that has never swept', async () => {
    const result = await getSweepState(db, 'sarah');

    expect(result).toEqual({ ok: true, state: null });
  });

  it('rejects a blank personaId without writing a row to the database', async () => {
    const result = await recordSweepCompleted(db, {
      personaId: '   ',
      sweptAt: new Date('2026-07-19T09:00:00.000Z'),
    });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'validation-failed',
        issues: expect.any(String) as string,
      },
    });
    const { rows } = await pool.query('SELECT * FROM sweep_state');
    expect(rows).toHaveLength(0);
  });

  it('records a first sweep as a new row', async () => {
    const sweptAt = new Date('2026-07-19T09:00:00.000Z');

    const created = await recordSweepCompleted(db, {
      personaId: 'sarah',
      sweptAt,
    });

    expect(created).toEqual({
      ok: true,
      state: { personaId: 'sarah', lastSweptAt: sweptAt },
    });

    const read = await getSweepState(db, 'sarah');
    expect(read).toEqual({
      ok: true,
      state: { personaId: 'sarah', lastSweptAt: sweptAt },
    });
  });

  it('overwrites the existing row on a second sweep for the same persona, not a second row', async () => {
    await recordSweepCompleted(db, {
      personaId: 'sarah',
      sweptAt: new Date('2026-07-19T09:00:00.000Z'),
    });
    const secondSweptAt = new Date('2026-07-20T09:00:00.000Z');

    const updated = await recordSweepCompleted(db, {
      personaId: 'sarah',
      sweptAt: secondSweptAt,
    });

    expect(updated).toEqual({
      ok: true,
      state: { personaId: 'sarah', lastSweptAt: secondSweptAt },
    });

    const { rows } = await pool.query(
      'SELECT * FROM sweep_state WHERE persona_id = $1',
      ['sarah'],
    );
    expect(rows).toHaveLength(1);
  });

  it('keeps a different persona as a separate row', async () => {
    await recordSweepCompleted(db, {
      personaId: 'sarah',
      sweptAt: new Date('2026-07-19T09:00:00.000Z'),
    });
    await recordSweepCompleted(db, {
      personaId: 'marcus',
      sweptAt: new Date('2026-07-19T10:00:00.000Z'),
    });

    const sarah = await getSweepState(db, 'sarah');
    const marcus = await getSweepState(db, 'marcus');

    expect(sarah.ok && sarah.state?.personaId).toBe('sarah');
    expect(marcus.ok && marcus.state?.personaId).toBe('marcus');
  });
});
