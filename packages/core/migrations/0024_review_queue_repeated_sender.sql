-- BUILD_PLAN 5.3a — the squeaky-wheel guard (`evaluateSenderFrequencyGuard`,
-- apps/server/src/standing-proactive-guards.ts). A repeated High/Mid-band trigger from the same
-- sender in the same channel within a 15-minute cooldown window is suppressed rather than acted
-- on — same "nothing silently eaten" treatment as every other guard-chain exit (BUILD_PLAN
-- 3.9/3.10/3.11), so it needs its own `outcome_reason` values to log to instead of dropping the
-- message. Band-prefixed like 3.10's four values (`'{high,mid}-band-...'`), not bare like
-- `'low-confidence'`/`'classification-failed'` — the band is already known by the time this guard
-- runs (it sits downstream of Stage 1 classification, same position as the cost-and-rhythm and
-- situational-appropriateness guards it runs alongside).
--
-- Constraint name verified against the real database before writing this DROP, not guessed:
-- `SELECT conname FROM pg_constraint WHERE conrelid='review_queue'::regclass AND contype='c'`
-- returned `review_queue_outcome_reason_check` (same name 0019/0022/0023 already confirmed). Same
-- DROP-then-ADD shape as 0009/0011/0017/0019/0022/0023. Purely additive: no existing row can carry
-- either new value, since nothing has ever written one.
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
      'mid-band-appropriateness-check-failed',
      'classification-failed',
      'high-band-repeated-sender',
      'mid-band-repeated-sender'
    ));
