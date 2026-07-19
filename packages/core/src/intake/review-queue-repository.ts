import type { Database } from '../schema.js';
import type { ReviewQueueEntry } from './review-queue-entry.js';
import type { Kysely } from 'kysely';

import { reviewQueueEntrySchema } from './review-queue-entry.js';

export type NewReviewQueueEntry = Pick<
  ReviewQueueEntry,
  | 'personaId'
  | 'channelId'
  | 'messageTs'
  | 'sourceMessageText'
  | 'confidence'
  | 'reasoning'
  | 'outcomeReason'
>;

export type ReviewQueueRepositoryError =
  | { readonly kind: 'validation-failed'; readonly issues: string }
  | { readonly kind: 'unknown'; readonly cause: unknown };

export type ReviewQueueEntryResult =
  | { readonly ok: true; readonly entry: ReviewQueueEntry }
  | { readonly ok: false; readonly error: ReviewQueueRepositoryError };

function parseReviewQueueRow(row: unknown): ReviewQueueEntryResult {
  const parsed = reviewQueueEntrySchema.safeParse(row);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: 'validation-failed', issues: parsed.error.message },
    };
  }
  return { ok: true, entry: parsed.data };
}

/**
 * Persists a "nothing is silently eaten" backstop row (`docs/VISION.md` §5.2, BUILD_PLAN 3.4c) —
 * a plain append-only log entry, unlike `pending-ticket-drafts-repository.ts`'s `create` (no
 * resolved/claimed state, no uniqueness constraint on `(channelId, messageTs)`, since a
 * review-queue row is never looked up or claimed by a later reaction). Validates the full
 * candidate row through `reviewQueueEntrySchema` before writing, so an invalid input never reaches
 * the database.
 */
export async function createReviewQueueEntry(
  db: Kysely<Database>,
  input: NewReviewQueueEntry,
): Promise<ReviewQueueEntryResult> {
  const candidate = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: new Date(),
  };

  const validated = parseReviewQueueRow(candidate);
  if (!validated.ok) return validated;

  try {
    const insert = db.insertInto('reviewQueue').values(candidate);
    const row = await insert.returningAll().executeTakeFirstOrThrow();
    return parseReviewQueueRow(row);
  } catch (cause) {
    return { ok: false, error: { kind: 'unknown', cause } };
  }
}
