import type { Database } from '../schema.js';
import type { ConversationTurn } from './conversation-turn.js';
import type { Kysely } from 'kysely';

import { conversationTurnSchema } from './conversation-turn.js';

export type NewConversationTurn = Pick<
  ConversationTurn,
  'personaId' | 'channelId' | 'threadKey' | 'role' | 'content'
>;

export type ConversationTurnRepositoryError =
  | { readonly kind: 'validation-failed'; readonly issues: string }
  | { readonly kind: 'unknown'; readonly cause: unknown };

export type ConversationTurnResult =
  | { readonly ok: true; readonly turn: ConversationTurn }
  | { readonly ok: false; readonly error: ConversationTurnRepositoryError };

export type ConversationTurnListResult =
  | { readonly ok: true; readonly turns: readonly ConversationTurn[] }
  | { readonly ok: false; readonly error: ConversationTurnRepositoryError };

function parseConversationTurnRow(row: unknown): ConversationTurnResult {
  const parsed = conversationTurnSchema.safeParse(row);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: 'validation-failed', issues: parsed.error.message },
    };
  }
  return { ok: true, turn: parsed.data };
}

function isFailedTurnResult(
  result: ConversationTurnResult,
): result is Extract<ConversationTurnResult, { readonly ok: false }> {
  return !result.ok;
}

function isOkTurnResult(
  result: ConversationTurnResult,
): result is Extract<ConversationTurnResult, { readonly ok: true }> {
  return result.ok;
}

/**
 * Inserts a new conversation turn. `id` and `createdAt` are server-generated. Validates the full
 * candidate row through `conversationTurnSchema` before writing, so an invalid input never reaches
 * the database.
 */
export async function appendTurn(
  db: Kysely<Database>,
  input: NewConversationTurn,
): Promise<ConversationTurnResult> {
  const candidate = {
    id: crypto.randomUUID(),
    personaId: input.personaId,
    channelId: input.channelId,
    threadKey: input.threadKey,
    role: input.role,
    content: input.content,
    createdAt: new Date(),
  };

  const validated = parseConversationTurnRow(candidate);
  if (!validated.ok) return validated;

  try {
    const insert = db.insertInto('conversationTurns').values(candidate);
    const row = await insert.returningAll().executeTakeFirstOrThrow();
    return parseConversationTurnRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * Returns up to `limit` of the most recent turns for `(personaId, channelId, threadKey)`, in
 * ascending (oldest-first) chronological order — the order the Anthropic `messages[]` array needs.
 * An unfamiliar thread returns an empty list, not an error.
 */
export async function getRecentTurns(
  db: Kysely<Database>,
  scope: {
    readonly personaId: string;
    readonly channelId: string;
    readonly threadKey: string;
  },
  limit: number,
): Promise<ConversationTurnListResult> {
  try {
    const query = db
      .selectFrom('conversationTurns')
      .selectAll()
      .where('personaId', '=', scope.personaId)
      .where('channelId', '=', scope.channelId)
      .where('threadKey', '=', scope.threadKey)
      .orderBy('createdAt', 'desc')
      .limit(limit);
    const rows = await query.execute();

    const parsedRows = rows.map((row) => parseConversationTurnRow(row));
    const failure = parsedRows.find((parsed) => isFailedTurnResult(parsed));
    if (failure) return failure;

    return {
      ok: true,
      turns: parsedRows
        .filter((parsed) => isOkTurnResult(parsed))
        .map((parsed) => parsed.turn)
        .reverse(),
    };
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
