import type { Database } from '../schema.js';
import type { Kysely } from 'kysely';
import type { Pool } from 'pg';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { recordUsage } from '../cost-usage/cost-usage-repository.js';
import { createDb } from '../ticket-lifecycle/db.js';
import { runMigrations } from '../ticket-lifecycle/migrate.js';
import { getTestPool, resetDatabase } from '../ticket-lifecycle/test-db.js';
import {
  getAlertState,
  getPersonaCostForMonth,
  recordAlertThreshold,
} from './cost-cap-repository.js';

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

describe('cost-cap repository', () => {
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

  describe('getPersonaCostForMonth', () => {
    it('returns a zero total for a persona/month with no recorded usage yet', async () => {
      const result = await getPersonaCostForMonth(db, {
        personaId: 'sarah',
        month: '2026-07',
      });

      expect(result).toEqual({
        ok: true,
        total: {
          personaId: 'sarah',
          month: '2026-07',
          inputTokens: 0,
          outputTokens: 0,
          costUsdMicros: 0,
        },
      });
    });

    it('sums usage across every day in the month', async () => {
      await recordUsage(db, usageInput({ day: '2026-07-01' }));
      await recordUsage(
        db,
        usageInput({
          day: '2026-07-17',
          inputTokens: 80,
          outputTokens: 200,
          costUsdMicros: 2_160,
        }),
      );
      await recordUsage(
        db,
        usageInput({
          day: '2026-07-31',
          inputTokens: 10,
          outputTokens: 20,
          costUsdMicros: 240,
        }),
      );

      const result = await getPersonaCostForMonth(db, {
        personaId: 'sarah',
        month: '2026-07',
      });

      expect(result).toEqual({
        ok: true,
        total: {
          personaId: 'sarah',
          month: '2026-07',
          inputTokens: 210,
          outputTokens: 560,
          costUsdMicros: 6_040,
        },
      });
    });

    it('excludes days from a different month', async () => {
      await recordUsage(db, usageInput({ day: '2026-06-30' }));
      await recordUsage(db, usageInput({ day: '2026-08-01' }));

      const result = await getPersonaCostForMonth(db, {
        personaId: 'sarah',
        month: '2026-07',
      });

      expect(result).toEqual({
        ok: true,
        total: {
          personaId: 'sarah',
          month: '2026-07',
          inputTokens: 0,
          outputTokens: 0,
          costUsdMicros: 0,
        },
      });
    });

    it('excludes a different persona', async () => {
      await recordUsage(
        db,
        usageInput({ personaId: 'marcus', day: '2026-07-17' }),
      );

      const result = await getPersonaCostForMonth(db, {
        personaId: 'sarah',
        month: '2026-07',
      });

      expect(result.ok && result.total.costUsdMicros).toBe(0);
    });
  });

  describe('getAlertState / recordAlertThreshold', () => {
    it('returns a null alert state for a persona/month with no alerts recorded yet', async () => {
      const result = await getAlertState(db, {
        personaId: 'sarah',
        month: '2026-07',
      });

      expect(result).toEqual({ ok: true, alert: null });
    });

    it('records a first threshold crossing as a new row', async () => {
      const result = await recordAlertThreshold(db, {
        personaId: 'sarah',
        month: '2026-07',
        threshold: 50,
      });

      expect(result).toEqual({
        ok: true,
        alert: expect.objectContaining({
          personaId: 'sarah',
          month: '2026-07',
          highestThresholdAlerted: 50,
        }),
      });
    });

    it('advances the watermark when a higher threshold is recorded', async () => {
      await recordAlertThreshold(db, {
        personaId: 'sarah',
        month: '2026-07',
        threshold: 50,
      });
      const second = await recordAlertThreshold(db, {
        personaId: 'sarah',
        month: '2026-07',
        threshold: 80,
      });

      expect(second.ok && second.alert.highestThresholdAlerted).toBe(80);
    });

    it('never regresses the watermark when an out-of-order lower threshold is recorded', async () => {
      await recordAlertThreshold(db, {
        personaId: 'sarah',
        month: '2026-07',
        threshold: 80,
      });
      const second = await recordAlertThreshold(db, {
        personaId: 'sarah',
        month: '2026-07',
        threshold: 50,
      });

      expect(second.ok && second.alert.highestThresholdAlerted).toBe(80);
    });

    it('keeps a different month for the same persona as a separate row', async () => {
      await recordAlertThreshold(db, {
        personaId: 'sarah',
        month: '2026-07',
        threshold: 100,
      });

      const nextMonth = await getAlertState(db, {
        personaId: 'sarah',
        month: '2026-08',
      });

      expect(nextMonth).toEqual({ ok: true, alert: null });
    });
  });
});
