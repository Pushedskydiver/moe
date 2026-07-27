-- BUILD_PLAN 3.9 — an ambient channel message classified High or Mid outside the 2.7a
-- operating-rhythm window was silently and permanently lost: `composeAndPostDraft` and
-- `composeAndPostConfirmingQuestion` both bare-`return` when the rhythm guard blocks them,
-- nothing is persisted, and `apps/server` has no scheduler to pick anything up. These two values
-- give that message the same durable review-queue row the Low band has always had, so VISION
-- §5.2's "nothing is silently eaten" holds at every band rather than only the lowest one.
--
-- Two values, not one: the digest groups by `outcome_reason` precisely so a human can tell causes
-- apart at a glance (BUILD_PLAN 3.5), and "a draft was never composed" and "a question was never
-- asked" call for different responses. Alex settled the two-value split on 2026-07-27.
--
-- Deliberately NOT named '…-deferred', which is the word BUILD_PLAN 3.9's suggested
-- `'high-band-deferred'` reached for. Nothing is deferred: step (1) writes a row that no timer
-- ever picks up, and genuine deferral is explicitly step (2), gated on chunk 7.2a or 6.1a-i. This
-- chunk exists because the codebase said "deferring" and meant "dropping"; baking that same word
-- into a permanent CHECK constraint, a Zod enum and a digest label would re-tell the lie in three
-- more places. These names describe the cause, matching every existing value ('low-confidence',
-- 'mid-no', 'mid-silence', 'mid-yes-failed').
--
-- Constraint name verified against the real database before writing this DROP, not guessed:
-- `SELECT conname FROM pg_constraint WHERE conrelid='review_queue'::regclass AND contype='c'`
-- returned `review_queue_outcome_reason_check` — 0007 declared the CHECK inline on the column, so
-- Postgres auto-named it. Same DROP-then-ADD shape as 0009/0011/0017. Purely additive: no existing
-- row can carry either value, since nothing has ever written one.
--
-- Ships together with the Zod enum in `src/intake/review-queue-entry.ts`, and the two are not
-- independently rollback-safe in the read direction: `listReviewQueueEntriesSince` returns the
-- first row that fails to parse as the result for the WHOLE list, so a database holding these
-- values read by a build whose enum lacks them fails the entire sweep digest, not just one row.
ALTER TABLE review_queue
  DROP CONSTRAINT review_queue_outcome_reason_check,
  ADD CONSTRAINT review_queue_outcome_reason_check
    CHECK (outcome_reason IN (
      'low-confidence',
      'mid-no',
      'mid-silence',
      'mid-yes-failed',
      'high-band-off-hours',
      'mid-band-off-hours'
    ));
