import type { Database } from '../schema.js';
import type { Kysely } from 'kysely';
import type { Pool } from 'pg';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb } from '../ticket-lifecycle/db.js';
import { runMigrations } from '../ticket-lifecycle/migrate.js';
import { getTestPool, resetDatabase } from '../ticket-lifecycle/test-db.js';
import { createTicketFromDraft } from './commit-ticket-draft.js';
import { createPendingTicketDraft } from './pending-ticket-drafts-repository.js';

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
    sourceMessageText: 'the export CLI drops rows over 10k',
    draftTitle: 'Export CLI drops rows over 10k',
    draftBody: 'Users report the CSV export truncates past 10,000 rows.',
    origin: 'high-band' as const,
  };
}

describe('createTicketFromDraft', () => {
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

  it('claims the draft and creates a ticket from the CLAIMED row, not a caller-supplied title', async () => {
    const created = await createPendingTicketDraft(db, newDraftInput());
    if (!created.ok) throw new Error('setup failed');

    const result = await createTicketFromDraft(db, {
      draftId: created.draft.id,
      ticket: {
        projectKey: 'chief-clancy',
        status: 'Brief',
        severity: 'Medium',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.id).toBe(created.draft.id);
    expect(result.draft.resolvedAt).not.toBeNull();
    expect(result.ticket.title).toBe(newDraftInput().draftTitle);
    expect(result.ticket.projectKey).toBe('chief-clancy');
    expect(result.ticket.status).toBe('Brief');
    expect(result.ticket.severity).toBe('Medium');

    const { rows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [
      result.ticket.id,
    ]);
    expect(rows).toHaveLength(1);
  });

  it('returns a claim-step error and creates no ticket when the draft is already resolved', async () => {
    const created = await createPendingTicketDraft(db, newDraftInput());
    if (!created.ok) throw new Error('setup failed');
    const first = await createTicketFromDraft(db, {
      draftId: created.draft.id,
      ticket: {
        projectKey: 'chief-clancy',
        status: 'Brief',
        severity: 'Medium',
      },
    });
    if (!first.ok) throw new Error('setup failed');

    const second = await createTicketFromDraft(db, {
      draftId: created.draft.id,
      ticket: {
        projectKey: 'chief-clancy',
        status: 'Backlog',
        severity: 'Medium',
      },
    });

    expect(second).toEqual({
      ok: false,
      error: { step: 'claim', error: { kind: 'unavailable' } },
    });
    const { rows } = await pool.query('SELECT * FROM tickets');
    expect(rows).toHaveLength(1);
  });

  it('rolls back the claim when ticket creation fails, leaving the draft available for retry', async () => {
    const created = await createPendingTicketDraft(db, newDraftInput());
    if (!created.ok) throw new Error('setup failed');

    const result = await createTicketFromDraft(db, {
      draftId: created.draft.id,
      // A blank `projectKey` fails `ticketSchema`'s own non-blank validation inside
      // `createTicket`, forcing the transaction's rollback path without needing to simulate a
      // real connection failure.
      ticket: { projectKey: '', status: 'Brief', severity: 'Medium' },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.step).toBe('create-ticket');

    const { rows: ticketRows } = await pool.query('SELECT * FROM tickets');
    expect(ticketRows).toHaveLength(0);
    const { rows: draftRows } = await pool.query(
      'SELECT resolved_at FROM pending_ticket_drafts WHERE id = $1',
      [created.draft.id],
    );
    expect(draftRows[0]?.resolved_at).toBeNull();
  });
});
