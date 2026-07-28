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
  markPendingTicketDraftPosted,
  resolvePendingTicketDraft,
  updatePendingTicketDraftContent,
} from './pending-ticket-drafts-repository.js';

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'migrations',
);

const POSTED_MESSAGE_TS = '1700000099.000100';

function newDraftInput() {
  return {
    personaId: 'sarah',
    channelId: 'C123',
    sourceMessageTs: '1700000000.000100',
    sourceMessageText: 'the CLI hangs on large repos, can someone take a look',
    draftTitle: 'CLI hangs on large repos',
    draftBody: 'The CLI hangs when run against large repos.',
    origin: 'high-band' as const,
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

  it('creates a pending draft, unresolved and with no messageTs yet — the claim precedes the Slack post (BUILD_PLAN 5.2b)', async () => {
    const result = await createPendingTicketDraft(db, newDraftInput());

    expect(result).toEqual({
      ok: true,
      draft: expect.objectContaining({
        ...newDraftInput(),
        messageTs: null,
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

  it('reads back a created draft by (channelId, messageTs) once the post-succeeded mark has filled messageTs in', async () => {
    const created = await createPendingTicketDraft(db, newDraftInput());
    if (!created.ok) throw new Error('setup failed');
    const posted = await markPendingTicketDraftPosted(
      db,
      created.draft.id,
      POSTED_MESSAGE_TS,
    );
    if (!posted.ok) throw new Error('setup failed');

    const result = await getPendingTicketDraftByMessage(db, {
      personaId: newDraftInput().personaId,
      channelId: newDraftInput().channelId,
      messageTs: POSTED_MESSAGE_TS,
    });

    expect(result).toEqual({ ok: true, draft: posted.draft });
  });

  it('returns a null draft for a (channelId, messageTs) pair that does not exist', async () => {
    const result = await getPendingTicketDraftByMessage(db, {
      personaId: 'sarah',
      channelId: 'C_UNKNOWN',
      messageTs: '0000000000.000000',
    });

    expect(result).toEqual({ ok: true, draft: null });
  });

  it("does not return another persona's draft — reaction dispatch must not cross personas (DA review, BUILD_PLAN 5.2a)", async () => {
    // Without this scoping, every persona in a shared channel resolves every other persona's
    // drafts. The self-inflicted case is the sharp one: `seedReactionLegend` adds 📦/🔁/✅ to the
    // draft it just posted, and those are real `reaction_added` events carrying the *posting*
    // persona's bot id. A sibling process's self-filter compares against its OWN bot id, does not
    // match, and dispatches 📦 as though a human had parked it — so a draft parks itself to
    // Backlog before any human sees it, defeating VISION §5.2's "visible, reversible draft".
    const created = await createPendingTicketDraft(db, newDraftInput());
    if (!created.ok) throw new Error('setup failed');
    await markPendingTicketDraftPosted(db, created.draft.id, POSTED_MESSAGE_TS);

    const result = await getPendingTicketDraftByMessage(db, {
      personaId: 'marcus',
      channelId: newDraftInput().channelId,
      messageTs: POSTED_MESSAGE_TS,
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

  it('increments redo_count each time content is updated (BUILD_PLAN 3.6)', async () => {
    const created = await createPendingTicketDraft(db, newDraftInput());
    if (!created.ok) throw new Error('setup failed');

    await updatePendingTicketDraftContent(db, created.draft.id, {
      draftTitle: 'First redo title',
      draftBody: 'First redo body.',
    });
    const { rows: afterFirst } = await pool.query<{ redo_count: number }>(
      'SELECT redo_count FROM pending_ticket_drafts WHERE id = $1',
      [created.draft.id],
    );
    expect(afterFirst[0]?.redo_count).toBe(1);

    await updatePendingTicketDraftContent(db, created.draft.id, {
      draftTitle: 'Second redo title',
      draftBody: 'Second redo body.',
    });
    const { rows: afterSecond } = await pool.query<{ redo_count: number }>(
      'SELECT redo_count FROM pending_ticket_drafts WHERE id = $1',
      [created.draft.id],
    );
    expect(afterSecond[0]?.redo_count).toBe(2);
  });

  it('rejects a second claim for the same (channelId, sourceMessageTs) pair via the UNIQUE constraint (BUILD_PLAN 5.2b)', async () => {
    const first = await createPendingTicketDraft(db, newDraftInput());
    expect(first.ok).toBe(true);

    const second = await createPendingTicketDraft(db, newDraftInput());

    expect(second).toEqual({
      ok: false,
      error: { kind: 'unknown', cause: expect.anything() as unknown },
    });
  });

  it('fills in messageTs on a claimed draft once the Slack post succeeds (BUILD_PLAN 5.2b)', async () => {
    const created = await createPendingTicketDraft(db, newDraftInput());
    if (!created.ok) throw new Error('setup failed');

    const result = await markPendingTicketDraftPosted(
      db,
      created.draft.id,
      POSTED_MESSAGE_TS,
    );

    expect(result).toEqual({
      ok: true,
      draft: expect.objectContaining({
        id: created.draft.id,
        messageTs: POSTED_MESSAGE_TS,
      }) as unknown,
    });
  });

  it('fails to mark a draft posted a second time (double-fire/retry guard, BUILD_PLAN 5.2b)', async () => {
    const created = await createPendingTicketDraft(db, newDraftInput());
    if (!created.ok) throw new Error('setup failed');
    await markPendingTicketDraftPosted(db, created.draft.id, POSTED_MESSAGE_TS);

    const result = await markPendingTicketDraftPosted(
      db,
      created.draft.id,
      '1700000199.000200',
    );

    expect(result).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });

  it('fails to mark posted a draft that does not exist (BUILD_PLAN 5.2b)', async () => {
    const result = await markPendingTicketDraftPosted(
      db,
      '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      POSTED_MESSAGE_TS,
    );

    expect(result).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });
});
