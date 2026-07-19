import type { Database } from '../schema.js';
import type { PendingConfirmingQuestion } from './pending-confirming-question.js';
import type { Kysely } from 'kysely';

import { pendingConfirmingQuestionSchema } from './pending-confirming-question.js';

export type NewPendingConfirmingQuestion = Pick<
  PendingConfirmingQuestion,
  | 'personaId'
  | 'channelId'
  | 'messageTs'
  | 'sourceMessageTs'
  | 'sourceMessageText'
  | 'confidence'
  | 'reasoning'
>;

export type PendingConfirmingQuestionRepositoryError =
  | { readonly kind: 'validation-failed'; readonly issues: string }
  | { readonly kind: 'unknown'; readonly cause: unknown };

export type PendingConfirmingQuestionResult =
  | { readonly ok: true; readonly question: PendingConfirmingQuestion }
  | {
      readonly ok: false;
      readonly error: PendingConfirmingQuestionRepositoryError;
    };

export type PendingConfirmingQuestionOrNullResult =
  | { readonly ok: true; readonly question: PendingConfirmingQuestion | null }
  | {
      readonly ok: false;
      readonly error: PendingConfirmingQuestionRepositoryError;
    };

export type PendingConfirmingQuestionListResult =
  | {
      readonly ok: true;
      readonly questions: readonly PendingConfirmingQuestion[];
    }
  | {
      readonly ok: false;
      readonly error: PendingConfirmingQuestionRepositoryError;
    };

// Same reasoning as `pending-ticket-drafts-repository.ts`'s own `PendingTicketDraftClaimError` —
// `'unavailable'` is specific to `resolvePendingConfirmingQuestion`'s atomic-claim semantics (the
// conditional update legitimately matching zero rows — already resolved, or no such question — not
// a failure), scoped to its own result type rather than widening the general repository error.
export type PendingConfirmingQuestionClaimError =
  PendingConfirmingQuestionRepositoryError | { readonly kind: 'unavailable' };

export type PendingConfirmingQuestionClaimResult =
  | { readonly ok: true; readonly question: PendingConfirmingQuestion }
  | {
      readonly ok: false;
      readonly error: PendingConfirmingQuestionClaimError;
    };

function parseQuestionRow(row: unknown): PendingConfirmingQuestionResult {
  const parsed = pendingConfirmingQuestionSchema.safeParse(row);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: 'validation-failed', issues: parsed.error.message },
    };
  }
  return { ok: true, question: parsed.data };
}

function isFailedQuestionResult(
  result: PendingConfirmingQuestionResult,
): result is Extract<PendingConfirmingQuestionResult, { readonly ok: false }> {
  return !result.ok;
}

function isOkQuestionResult(
  result: PendingConfirmingQuestionResult,
): result is Extract<PendingConfirmingQuestionResult, { readonly ok: true }> {
  return result.ok;
}

/**
 * Persists a Mid-band confirming question (BUILD_PLAN 3.4b-i) as the "parent-message state" a
 * later 👍/👎 reaction traces back to — mirrors `createPendingTicketDraft`'s own shape exactly,
 * validating the full candidate row through `pendingConfirmingQuestionSchema` before writing.
 */
export async function createPendingConfirmingQuestion(
  db: Kysely<Database>,
  input: NewPendingConfirmingQuestion,
): Promise<PendingConfirmingQuestionResult> {
  const candidate = {
    id: crypto.randomUUID(),
    ...input,
    resolvedAt: null,
    createdAt: new Date(),
  };

  const validated = parseQuestionRow(candidate);
  if (!validated.ok) return validated;

  try {
    const insert = db
      .insertInto('pendingConfirmingQuestions')
      .values(candidate);
    const row = await insert.returningAll().executeTakeFirstOrThrow();
    return parseQuestionRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * Looks up the pending confirming question a real Slack message's `(channelId, messageTs)`
 * corresponds to — the lookup a real reaction-event handler needs (BUILD_PLAN 3.4b-ii) before it
 * can dispatch a 👍/👎 outcome. Returns a null question, not an error, when no confirming question
 * was ever posted for that message — mirrors `getPendingTicketDraftByMessage` exactly.
 */
export async function getPendingConfirmingQuestionByMessage(
  db: Kysely<Database>,
  scope: { readonly channelId: string; readonly messageTs: string },
): Promise<PendingConfirmingQuestionOrNullResult> {
  try {
    const row = await db
      .selectFrom('pendingConfirmingQuestions')
      .selectAll()
      .where('channelId', '=', scope.channelId)
      .where('messageTs', '=', scope.messageTs)
      .executeTakeFirst();

    if (!row) return { ok: true, question: null };
    return parseQuestionRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * Atomically claims a pending confirming question for a terminal 👍/👎 outcome (BUILD_PLAN
 * 3.4b-ii) — same `UPDATE ... WHERE resolvedAt IS NULL` compare-and-set shape as
 * `resolvePendingTicketDraft`, guarding against a genuine double-fired reaction resolving the same
 * question twice.
 */
export async function resolvePendingConfirmingQuestion(
  db: Kysely<Database>,
  id: string,
): Promise<PendingConfirmingQuestionClaimResult> {
  try {
    const row = await db
      .updateTable('pendingConfirmingQuestions')
      .set({ resolvedAt: new Date() })
      .where('id', '=', id)
      .where('resolvedAt', 'is', null)
      .returningAll()
      .executeTakeFirst();

    if (!row) return { ok: false, error: { kind: 'unavailable' } };
    return parseQuestionRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}

/**
 * Lists a persona's still-unresolved confirming questions created before `olderThan` (BUILD_PLAN
 * 3.5's own `review-queue-sweep` script) — the "no answer within some window" case the sweep
 * treats as silence, VISION §5.2's Mid-band "silence" outcome finally getting a real writer.
 * `resolvedAt IS NULL` excludes anything a real 👍/👎 has already claimed, same predicate
 * `resolvePendingConfirmingQuestion`'s own CAS uses — the sweep's own caller still re-claims each
 * match via that same function before logging it as silent, so a real answer racing the sweep
 * always wins.
 */
export async function findStaleUnresolvedConfirmingQuestions(
  db: Kysely<Database>,
  scope: { readonly personaId: string; readonly olderThan: Date },
): Promise<PendingConfirmingQuestionListResult> {
  try {
    const rows = await db
      .selectFrom('pendingConfirmingQuestions')
      .selectAll()
      .where('personaId', '=', scope.personaId)
      .where('resolvedAt', 'is', null)
      .where('createdAt', '<', scope.olderThan)
      .orderBy('createdAt', 'asc')
      .execute();

    const parsedRows = rows.map((row) => parseQuestionRow(row));
    const failure = parsedRows.find((parsed) => isFailedQuestionResult(parsed));
    if (failure) return failure;

    return {
      ok: true,
      questions: parsedRows
        .filter((parsed) => isOkQuestionResult(parsed))
        .map((parsed) => parsed.question),
    };
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
