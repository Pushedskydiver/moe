-- BUILD_PLAN 3.10 — the ambient guard chain's two remaining silent losses, after 3.9 closed the
-- operating-rhythm one. An ambient High- or Mid-band message can still be dropped with nothing
-- persisted at two other guard exits: a cost-cap halt inside `evaluateCostAndRhythmGuard` (the
-- guard-level check, not the earlier per-turn short-circuit inside `classifyMessageForIntake`,
-- which has no classifier output yet to write), and the situational-appropriateness gate failing
-- CLOSED on an infrastructure blip (an Anthropic error, timeout, or unparseable response —
-- `evaluateSituationalAppropriatenessGuard`'s `'evaluation-failed'` reason). These four values give
-- both exits, on both bands, the same durable review-queue row 3.9 already gave the rhythm guard.
--
-- Four values, not two: matching 3.9's own two-values-per-guard split, the digest groups by
-- `outcome_reason` so a human can tell causes apart, and each of "cost cap", "draft never
-- composed", "question never asked" calls for a different response from Alex.
--
-- Deliberately NOT a fifth/sixth value for the appropriateness gate's OTHER `return false` branch
-- (a genuine `appropriate: false` verdict). Alex settled (`AskUserQuestion`, 2026-07-28): that
-- branch is a considered decision that the message should not be acted on, not silent data loss —
-- logging it too would add queue noise for a settled judgement call, not the genuine ambiguity the
-- queue exists for. Only the infra-blip case gets a row.
--
-- Constraint name verified against the real database before writing this DROP, not guessed:
-- `SELECT conname FROM pg_constraint WHERE conrelid='review_queue'::regclass AND contype='c'`
-- returned `review_queue_outcome_reason_check` (same name 0019 already confirmed; 0007's inline
-- CHECK was auto-named, 0009/0011/0019 have each since re-added it explicitly under that name).
-- Same DROP-then-ADD shape as 0009/0011/0017/0019. Purely additive: no existing row can carry any
-- of these four values, since nothing has ever written one.
--
-- Ships together with the Zod enum in `src/intake/review-queue-entry.ts`, and the two are not
-- independently rollback-safe in the read direction, for the same reason 0019's own comment
-- documents: `listReviewQueueEntriesSince` returns the first row that fails to parse as the result
-- for the WHOLE list, so a database holding these values read by a build whose enum lacks them
-- fails the entire sweep digest, not just one row.
ALTER TABLE review_queue
  DROP CONSTRAINT review_queue_outcome_reason_check,
  ADD CONSTRAINT review_queue_outcome_reason_check
    CHECK (outcome_reason IN (
      'low-confidence',
      'mid-no',
      'mid-silence',
      'mid-yes-failed',
      'high-band-off-hours',
      'mid-band-off-hours',
      'high-band-cost-cap',
      'mid-band-cost-cap',
      'high-band-appropriateness-check-failed',
      'mid-band-appropriateness-check-failed'
    ));
