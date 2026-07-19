import type { Database } from '../schema.js';
import type { PendingConfirmingQuestion } from './pending-confirming-question.js';
import type { PendingConfirmingQuestionClaimError } from './pending-confirming-questions-repository.js';
import type { ReviewQueueEntry } from './review-queue-entry.js';
import type { ReviewQueueRepositoryError } from './review-queue-repository.js';
import type { Kysely } from 'kysely';

import { resolvePendingConfirmingQuestion } from './pending-confirming-questions-repository.js';
import { createReviewQueueEntry } from './review-queue-repository.js';

export type ResolveConfirmingQuestionAndLogError =
  | {
      readonly step: 'claim';
      readonly error: PendingConfirmingQuestionClaimError;
    }
  | { readonly step: 'log'; readonly error: ReviewQueueRepositoryError };

export type ResolveConfirmingQuestionAndLogResult =
  | {
      readonly ok: true;
      readonly question: PendingConfirmingQuestion;
      readonly entry: ReviewQueueEntry;
    }
  | {
      readonly ok: false;
      readonly error: ResolveConfirmingQuestionAndLogError;
    };

// Same rollback-forcing role as `commit-ticket-draft.ts`'s own `RollbackWithError` — see that
// file's comment for why a throw is the only way to trigger a Kysely rollback here, and why it
// never escapes this function's own Result-shaped public contract.
class RollbackWithError extends Error {
  constructor(readonly failure: ResolveConfirmingQuestionAndLogError) {
    super('rollback: review-queue log failed');
  }
}

/**
 * Atomically claims a Mid-band confirming question and logs its outcome to `review_queue` in one
 * transaction — the shared primitive behind BUILD_PLAN 3.4b-ii's `logConfirmingQuestionAsNo`
 * (`outcomeReason: 'mid-no'`) and 3.5's `logStaleQuestionsAsSilent` (`'mid-silence'`), which had
 * identical claim-then-act shapes before this fix. Closes the same failure-recovery gap
 * `commit-ticket-draft.ts`'s `createTicketFromDraft` closes for the ✅/📦 outcomes, for the same
 * reason: if the `review_queue` write fails after the claim wins, the whole transaction rolls
 * back, leaving the question unresolved and eligible for a future reaction or sweep run to
 * retry — rather than permanently burning the claim with nothing to show for it. Deliberately left
 * at Kysely's default (READ COMMITTED) isolation level, not upgraded, for the identical
 * EvalPlanQual reasoning `createTicketFromDraft`'s own TSDoc documents (`claim.ts`'s own TSDoc is
 * the source). Builds the `review_queue` row from the CLAIMED question's own
 * `channelId`/`sourceMessageTs`/`sourceMessageText`/`confidence`/`reasoning` — the same fields
 * both call sites already read off the claimed row today, now centralized here.
 */
export async function resolveConfirmingQuestionAndLog(
  db: Kysely<Database>,
  input: {
    readonly questionId: string;
    readonly personaId: string;
    readonly outcomeReason: 'mid-no' | 'mid-silence';
  },
): Promise<ResolveConfirmingQuestionAndLogResult> {
  try {
    return await db.transaction().execute(async (trx) => {
      const claimed = await resolvePendingConfirmingQuestion(
        trx,
        input.questionId,
      );
      if (!claimed.ok) {
        return { ok: false, error: { step: 'claim', error: claimed.error } };
      }

      const logged = await createReviewQueueEntry(trx, {
        personaId: input.personaId,
        channelId: claimed.question.channelId,
        messageTs: claimed.question.sourceMessageTs,
        sourceMessageText: claimed.question.sourceMessageText,
        confidence: claimed.question.confidence,
        reasoning: claimed.question.reasoning,
        outcomeReason: input.outcomeReason,
      });
      if (!logged.ok) {
        throw new RollbackWithError({ step: 'log', error: logged.error });
      }

      return { ok: true, question: claimed.question, entry: logged.entry };
    });
  } catch (cause) {
    if (cause instanceof RollbackWithError) {
      return { ok: false, error: cause.failure };
    }
    return {
      ok: false,
      error: { step: 'log', error: { kind: 'unknown', cause } },
    };
  }
}
