-- BUILD_PLAN 3.7 — records which surface a confirming question was asked on, so its 👍 outcome
-- can post the resulting ticket draft the same way the question itself was posted. Alex settled at
-- 3.7 that a DM-triggered draft or question lands top-level in the DM rather than threaded on the
-- source message; without this column `draftFromConfirmingQuestion` has no way to know, and a
-- DM-originated Mid→👍 draft would thread onto an older message while the question it answers sat
-- top-level.
--
-- Backfilled 'channel', which is exactly correct rather than merely convenient: no DM reached the
-- cascade before this chunk, so every pre-existing row is channel-originated by construction. This
-- is the same clean-backfill situation as 0017, and unlike 0013, whose own backfill carried a
-- documented ambiguity.
ALTER TABLE pending_confirming_questions
  ADD COLUMN source_surface TEXT NOT NULL DEFAULT 'channel'
    CHECK (source_surface IN ('channel', 'dm'));
