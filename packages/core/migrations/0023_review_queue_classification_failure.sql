-- BUILD_PLAN 3.11 — classifyMessageForIntake's own classification-failure silent loss, found by
-- 3.10's own DA review one guard step upstream of what that chunk closed. The Stage 1 classifier
-- call itself erroring, timing out, or returning an unparseable response drops an ambient message
-- with nothing persisted, the identical infrastructure-blip shape 3.10 already made durable one
-- guard downstream (the situational-appropriateness gate's own `'evaluation-failed'` branch).
--
-- Two changes, both required for the new write path:
--
-- 1. `confidence` widened to nullable. A classification failure has no real 0-100 score to write —
--    the classifier never produced one — so there is no honest non-null value to put here. Alex
--    settled (`AskUserQuestion`, 2026-07-29) that NULL is more honest than a sentinel (0 collides
--    with a real low score; an out-of-range sentinel like -1 still needs this same column widened
--    to accept it, so it buys nothing over NULL while being less self-documenting). `reasoning`
--    stays NOT NULL — the real Anthropic error message is genuine, useful content, not a
--    placeholder, so there is no equivalent honesty problem for that column.
--
-- 2. `outcome_reason` widened with `'classification-failed'` — deliberately NOT band-prefixed
--    (unlike 3.10's four `'{high,mid}-band-...'` values): at this point in the cascade the
--    classifier never ran to completion, so no band was ever determined. Matches `'low-confidence'`'s
--    own bare naming, the only other value written before a band exists.
--
-- Constraint name verified against the real database before writing this DROP, not guessed:
-- `SELECT conname FROM pg_constraint WHERE conrelid='review_queue'::regclass AND contype='c'`
-- returned `review_queue_outcome_reason_check` (same name 0019/0022 already confirmed). Same
-- DROP-then-ADD shape as 0009/0011/0017/0019/0022. Purely additive on the outcome_reason side: no
-- existing row can carry the new value, since nothing has ever written one. The confidence widen
-- is additive too — DROP NOT NULL never invalidates an existing non-null value.
ALTER TABLE review_queue
  ALTER COLUMN confidence DROP NOT NULL;

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
      'classification-failed'
    ));

-- DA review, this chunk: `reviewQueueEntrySchema`'s own cross-field `.refine` enforces the
-- confidence/outcome_reason "iff" invariant at the Zod layer, but `createReviewQueueEntry` is not
-- the only theoretically possible writer of this table (a future raw insert/backfill/migration
-- script would bypass it entirely) — the identical "one-layer-only guarantee" gap 5.2b's own DA
-- review found for `sourceMessageTs`, one level further down the stack. This table already has
-- real precedent for a cross-column CHECK (`0001_create_tickets_table.sql`'s
-- `updated_at_not_before_created_at`), so mirroring it here rather than trusting the app layer
-- alone.
ALTER TABLE review_queue
  ADD CONSTRAINT confidence_null_iff_classification_failed
    CHECK ((confidence IS NULL) = (outcome_reason = 'classification-failed'));
