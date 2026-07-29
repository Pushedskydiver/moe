import { z } from 'zod';

import { isNotBlank } from '../is-not-blank.js';

const nonBlankStringSchema = z
  .string()
  .min(1)
  .refine(isNotBlank, 'must not be blank');

/**
 * VISION §5.2's "nothing is silently eaten" backstop (BUILD_PLAN 3.4c) — an append-only log row
 * for a message that didn't become a real ticket draft, listed for a human by BUILD_PLAN 3.5's own
 * `review-queue-sweep` script. `outcomeReason` records why the row exists: `'low-confidence'` is
 * chunk 3.4c's own write (a Stage 1 score below the Low threshold, `../confidence-band.ts`);
 * `'mid-no'` is BUILD_PLAN 3.4b-ii's own write, when a Mid-band confirming question's 👎 reaction
 * resolves it to "no" (`apps/server`'s `logConfirmingQuestionAsNo`); `'mid-silence'` is BUILD_PLAN
 * 3.5's own write (`apps/server`'s `logStaleQuestionsAsSilent`), once an unanswered confirming
 * question passes a 24-hour threshold; `'mid-yes-failed'` is the claim-then-act fallback fix's own
 * write (`apps/server`'s `draftFromConfirmingQuestion`), when a 👍 answer's downstream draft
 * composition/posting/persistence fails after the confirming question was already claimed. Migration
 * `0009_widen_review_queue_outcome_reason.sql` replaced chunk 3.4c's original single placeholder
 * value, `'mid-no-response'`, with `'mid-no'`/`'mid-silence'` — "no" and "silence"/timeout stay
 * separately identifiable for 3.5's own human-eyeballing sweep, per that chunk's own DA-review-
 * flagged question. Migration `0011_widen_review_queue_outcome_reason_again.sql` added
 * `'mid-yes-failed'` on top of those two, additively (not a replacement, unlike `0009`'s own
 * change). Unlike `pending-ticket-draft.ts`'s sibling table,
 * this one has no resolved/claimed state — a review-queue row is a plain log entry, not a
 * workflow object a reaction can act on.
 *
 * `'high-band-off-hours'` and `'mid-band-off-hours'` are BUILD_PLAN 3.9's own writes
 * (`apps/server`'s `logAmbientIntakeToReviewQueue`, reached from `composeAndPostDraft` and
 * `composeAndPostConfirmingQuestion`), added by migration
 * `0019_widen_review_queue_outcome_reason_off_hours.sql`: an **ambient** message classified High or
 * Mid outside the 2.7a operating-rhythm window, which until 3.9 was dropped with nothing persisted
 * and no scheduler to pick it up. Named for the cause rather than `'…-deferred'` deliberately —
 * nothing is deferred until BUILD_PLAN 3.9's own step (2) builds a timer, and "deferring" is the
 * exact word that chunk exists to stop the codebase using for a drop. **Ambient only:** the DM path
 * never consults the rhythm guard (2.7a settled DM replies as reactive; 3.7 extended that to
 * DM-triggered drafts), so a DM produces its draft or question at any hour and never writes either
 * value.
 *
 * `'high-band-cost-cap'`/`'mid-band-cost-cap'` and
 * `'high-band-appropriateness-check-failed'`/`'mid-band-appropriateness-check-failed'` are
 * BUILD_PLAN 3.10's own writes, added by migration
 * `0022_widen_review_queue_outcome_reason_guard_chain.sql`, closing the ambient guard chain's two
 * other silent-loss exits 3.9 deliberately left open: a cost-cap halt inside
 * `evaluateCostAndRhythmGuard` (the guard-level check that can fire mid-turn, after the classifier
 * output already exists — not the earlier per-turn short-circuit inside
 * `classifyMessageForIntake`, which has no classifier output yet and so writes nothing here), and
 * the situational-appropriateness gate failing CLOSED on an infrastructure blip
 * (`evaluateSituationalAppropriatenessGuard`'s `'evaluation-failed'` reason — an Anthropic error,
 * timeout, or unparseable response, not a genuine `appropriate: false` verdict). **Deliberately
 * no value for a genuine `appropriate: false` verdict itself**: Alex settled (`AskUserQuestion`,
 * 2026-07-28) that a considered decision the message shouldn't be acted on is not silent data
 * loss, and stays silent rather than adding queue noise for every settled judgement call.
 *
 * `'classification-failed'` is BUILD_PLAN 3.11's own write, added by migration
 * `0023_review_queue_classification_failure.sql` — the *other* branch inside
 * `classifyMessageForIntake` that returns without a usable score: not the cost-cap short-circuit
 * named above (which genuinely has nothing to write), but the Stage 1 classifier call itself
 * erroring, timing out, or returning an unparseable response, the identical infrastructure-blip
 * shape 3.10 already made durable one guard downstream. **Deliberately not band-prefixed** — no
 * band was ever determined, since the classifier never produced a score at all — matching
 * `'low-confidence'`'s own bare naming, the only other value written before a band exists.
 * `confidence` is `null` on this row alone: there is no honest non-null score to put there (Alex
 * confirmed via `AskUserQuestion`, 2026-07-29 — a sentinel like `0` would collide with a real low
 * score). `reasoning` stays non-null and carries the real Anthropic error message, not a
 * placeholder.
 */
export const reviewQueueEntrySchema = z
  .object({
    id: z.uuid(),
    personaId: nonBlankStringSchema,
    channelId: nonBlankStringSchema,
    messageTs: nonBlankStringSchema,
    sourceMessageText: nonBlankStringSchema,
    // Nullable only for the 'classification-failed' row (BUILD_PLAN 3.11) — every other
    // outcomeReason still requires a real 0-100 score, enforced below by the cross-field `.refine`,
    // not left as a type-level-only guarantee (5.2b's own DA-review lesson: a plain `.nullable()`
    // here would let a `null` confidence silently pass validation on any other outcomeReason too).
    confidence: z.number().int().min(0).max(100).nullable(),
    reasoning: nonBlankStringSchema,
    outcomeReason: z.enum([
      'low-confidence',
      'mid-no',
      'mid-silence',
      'mid-yes-failed',
      'high-band-off-hours',
      'mid-band-off-hours',
      'high-band-cost-cap',
      'mid-band-cost-cap',
      'high-band-appropriateness-check-failed',
      'mid-band-appropriateness-check-failed',
      'classification-failed',
    ]),
    createdAt: z.date(),
  })
  .refine(
    (entry) =>
      (entry.outcomeReason === 'classification-failed') ===
      (entry.confidence === null),
    {
      message:
        "confidence must be null if and only if outcomeReason is 'classification-failed'",
    },
  );

export type ReviewQueueEntry = z.infer<typeof reviewQueueEntrySchema>;
