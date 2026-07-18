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
  createPendingTicketDraft,
  getPendingTicketDraftByMessage,
  resolvePendingTicketDraft,
  updatePendingTicketDraftContent,
} from './pending-ticket-drafts-repository.js';

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'migrations',
);

function newDraftInput() {
  return {
    personaId: 'sarah',
    channelId: 'C123',
    messageTs: '1700000000.000100',
    sourceMessageText: 'the CLI hangs on large repos, can someone take a look',
    draftTitle: 'CLI hangs on large repos',
    draftBody: 'The CLI hangs when run against large repos.',
  };
}

describe('pending ticket drafts repository', () => {
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

  it('creates a pending draft, unresolved by default', async () => {
    const result = await createPendingTicketDraft(db, newDraftInput());

    expect(result).toEqual({
      ok: true,
      draft: expect.objectContaining({
        ...newDraftInput(),
        resolvedAt: null,
      }) as unknown,
    });
  });

  it('rejects a blank draft title without writing a row to the database', async () => {
    const result = await createPendingTicketDraft(db, {
      ...newDraftInput(),
      draftTitle: '   ',
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: 'validation-failed', issues: expect.any(String) },
    });
    const all = await db
      .selectFrom('pendingTicketDrafts')
      .selectAll()
      .execute();
    expect(all).toHaveLength(0);
  });

  it('reads back a created draft by (channelId, messageTs)', async () => {
    const created = await createPendingTicketDraft(db, newDraftInput());
    if (!created.ok) throw new Error('setup failed');

    const result = await getPendingTicketDraftByMessage(db, {
      channelId: newDraftInput().channelId,
      messageTs: newDraftInput().messageTs,
    });

    expect(result).toEqual({ ok: true, draft: created.draft });
  });

  it('returns a null draft for a (channelId, messageTs) pair that does not exist', async () => {
    const result = await getPendingTicketDraftByMessage(db, {
      channelId: 'C_UNKNOWN',
      messageTs: '0000000000.000000',
    });

    expect(result).toEqual({ ok: true, draft: null });
  });

  it('atomically resolves an unresolved draft', async () => {
    const created = await createPendingTicketDraft(db, newDraftInput());
    if (!created.ok) throw new Error('setup failed');

    const result = await resolvePendingTicketDraft(db, created.draft.id);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.resolvedAt).not.toBeNull();
    }
  });

  it('fails to resolve a draft that is already resolved (double-processing guard)', async () => {
    const created = await createPendingTicketDraft(db, newDraftInput());
    if (!created.ok) throw new Error('setup failed');
    await resolvePendingTicketDraft(db, created.draft.id);

    const result = await resolvePendingTicketDraft(db, created.draft.id);

    expect(result).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });

  it('fails to resolve a draft that does not exist', async () => {
    const result = await resolvePendingTicketDraft(
      db,
      '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    );

    expect(result).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });

  it('updates a draft’s content in place, leaving it unresolved (the 🔁 redo path)', async () => {
    const created = await createPendingTicketDraft(db, newDraftInput());
    if (!created.ok) throw new Error('setup failed');

    const result = await updatePendingTicketDraftContent(db, created.draft.id, {
      draftTitle: 'CLI hangs on very large monorepos specifically',
      draftBody:
        'Regenerated: the CLI hangs only on monorepos above a certain size.',
    });

    expect(result).toEqual({
      ok: true,
      draft: expect.objectContaining({
        id: created.draft.id,
        draftTitle: 'CLI hangs on very large monorepos specifically',
        draftBody:
          'Regenerated: the CLI hangs only on monorepos above a certain size.',
        resolvedAt: null,
      }) as unknown,
    });
  });

  it('can update content on an already-resolved draft too — the redo path is not gated by the same claim resolvePendingTicketDraft uses', async () => {
    const created = await createPendingTicketDraft(db, newDraftInput());
    if (!created.ok) throw new Error('setup failed');
    await resolvePendingTicketDraft(db, created.draft.id);

    const result = await updatePendingTicketDraftContent(db, created.draft.id, {
      draftTitle: 'Updated title',
      draftBody: 'Updated body.',
    });

    expect(result.ok).toBe(true);
  });
});
