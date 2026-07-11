import type { Pool, PoolClient } from 'pg';

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Arbitrary fixed key for `pg_advisory_xact_lock` — a transaction-scoped lock, not a session-scoped
 * one, so it works safely through Neon's pooled (PgBouncer transaction-mode) connection string:
 * the lock is held for exactly the one transaction below, which is the unit transaction-mode
 * pooling preserves. This means migrations don't need a separate direct/unpooled connection, and
 * N persona machines can all attempt migrations on boot safely — whichever gets there first holds
 * the lock for the whole batch; the rest block, then see nothing pending and no-op.
 */
const MIGRATIONS_LOCK_ID = 84_213_001;

export type MigrateResult =
  | { readonly ok: true; readonly applied: readonly string[] }
  | {
      readonly ok: false;
      readonly error:
        | {
            readonly kind: 'migration-failed';
            readonly file: string;
            readonly cause: unknown;
          }
        | { readonly kind: 'unknown'; readonly cause: unknown };
    };

async function applyPending(
  client: PoolClient,
  migrationsDir: string,
  files: readonly string[],
): Promise<MigrateResult> {
  const [file, ...rest] = files;
  if (!file) return { ok: true, applied: [] };

  try {
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [
      file,
    ]);
  } catch (cause) {
    return { ok: false, error: { kind: 'migration-failed', file, cause } };
  }

  const restResult = await applyPending(client, migrationsDir, rest);
  return restResult.ok
    ? { ok: true, applied: [file, ...restResult.applied] }
    : restResult;
}

/**
 * Applies every `.sql` file in `migrationsDir` not yet recorded in `schema_migrations`, in
 * filename order, as ONE transaction — either the whole pending batch commits, or none of it
 * does. A later migration failing rolls back earlier ones in the same run too; this keeps the
 * schema always in a fully-migrated-or-untouched state, never partially migrated.
 */
export async function runMigrations(
  pool: Pool,
  migrationsDir: string,
): Promise<MigrateResult> {
  const client = await pool.connect();
  try {
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [
        MIGRATIONS_LOCK_ID,
      ]);
      await client.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
           id TEXT PRIMARY KEY,
           applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`,
      );

      const appliedResult = await client.query<{ id: string }>(
        'SELECT id FROM schema_migrations',
      );
      const applied = new Set(appliedResult.rows.map((row) => row.id));

      const allFiles = await readdir(migrationsDir);
      const pendingFiles = allFiles
        .filter((file) => file.endsWith('.sql') && !applied.has(file))
        .sort();

      const result = await applyPending(client, migrationsDir, pendingFiles);
      if (!result.ok) {
        await client.query('ROLLBACK');
        return result;
      }

      await client.query('COMMIT');
      return result;
    } catch (cause) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // The connection is likely unusable (e.g. it dropped mid-transaction) — there's
        // nothing more to roll back; fall through and report the original failure below.
      }
      return { ok: false, error: { kind: 'unknown', cause } };
    }
  } finally {
    client.release();
  }
}
