import type { Database } from '../schema.js';
import type { Kysely } from 'kysely';
import type { Pool } from 'pg';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb } from '../ticket-lifecycle/db.js';
import { runMigrations } from '../ticket-lifecycle/migrate.js';
import { getTestPool, resetDatabase } from '../ticket-lifecycle/test-db.js';
import { appendTurn, getRecentTurns } from './conversation-turns-repository.js';

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'migrations',
);

function newTurnInput() {
  return {
    personaId: 'sarah',
    channelId: 'C123',
    threadKey: 'dm',
    role: 'user' as const,
    content: 'what did I just ask you?',
  };
}

describe('conversation turns repository', () => {
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

  it('appends a turn and returns it validated through conversationTurnSchema', async () => {
    const result = await appendTurn(db, newTurnInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.turn.personaId).toBe('sarah');
    expect(result.turn.channelId).toBe('C123');
    expect(result.turn.threadKey).toBe('dm');
    expect(result.turn.role).toBe('user');
    expect(result.turn.content).toBe('what did I just ask you?');
  });

  it('rejects a blank content string without writing a row to the database', async () => {
    const result = await appendTurn(db, { ...newTurnInput(), content: '  ' });

    expect(result.ok).toBe(false);
    const { rows } = await pool.query('SELECT * FROM conversation_turns');
    expect(rows).toHaveLength(0);
  });

  it('returns an empty list for a thread with no turns yet', async () => {
    const result = await getRecentTurns(
      db,
      { personaId: 'sarah', channelId: 'C123', threadKey: 'dm' },
      20,
    );
    expect(result).toEqual({ ok: true, turns: [] });
  });

  it('returns turns in ascending (oldest-first) chronological order', async () => {
    await appendTurn(db, { ...newTurnInput(), content: 'first message' });
    await appendTurn(db, {
      ...newTurnInput(),
      role: 'assistant',
      content: 'first reply',
    });
    await appendTurn(db, { ...newTurnInput(), content: 'second message' });

    const result = await getRecentTurns(
      db,
      { personaId: 'sarah', channelId: 'C123', threadKey: 'dm' },
      20,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.turns.map((turn) => turn.content)).toEqual([
      'first message',
      'first reply',
      'second message',
    ]);
  });

  it('caps the result at limit, keeping only the most recent turns', async () => {
    await appendTurn(db, { ...newTurnInput(), content: 'oldest' });
    await appendTurn(db, { ...newTurnInput(), content: 'middle' });
    await appendTurn(db, { ...newTurnInput(), content: 'newest' });

    const result = await getRecentTurns(
      db,
      { personaId: 'sarah', channelId: 'C123', threadKey: 'dm' },
      2,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.turns.map((turn) => turn.content)).toEqual([
      'middle',
      'newest',
    ]);
  });

  it('scopes turns to the exact (personaId, channelId, threadKey) triple', async () => {
    await appendTurn(db, { ...newTurnInput(), content: 'in scope' });
    await appendTurn(db, {
      ...newTurnInput(),
      channelId: 'C999',
      content: 'different channel',
    });
    await appendTurn(db, {
      ...newTurnInput(),
      threadKey: 'T1',
      content: 'different thread',
    });
    await appendTurn(db, {
      ...newTurnInput(),
      personaId: 'marcus',
      content: 'different persona',
    });

    const result = await getRecentTurns(
      db,
      { personaId: 'sarah', channelId: 'C123', threadKey: 'dm' },
      20,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.turns.map((turn) => turn.content)).toEqual(['in scope']);
  });
});
