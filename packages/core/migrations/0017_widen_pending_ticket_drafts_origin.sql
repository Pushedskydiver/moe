-- BUILD_PLAN 3.7 — a DM can now produce a High-band ticket draft, which needs its own origin
-- rather than reusing 'high-band': `getDraftOutcomeCounts` filters to 'high-band' only, and
-- VISION §5.4's ignored/rejected-draft rate measures the *ambient* classifier's calibration.
-- A DM is settled by §5.3 as already unambiguous, so it is a systematically higher-propensity
-- population; folding it in would skew that rate exactly as mixing Mid-band-confirmed drafts did
-- (DA review, chunk 3.6). Purely additive — no existing row can be a DM draft, since no DM has
-- ever reached the cascade before this chunk, so unlike 0013 there is no backfill ambiguity here.
--
-- Constraint name verified against the real database before writing this DROP, not guessed:
-- 0013 added the CHECK inline on ADD COLUMN, so Postgres auto-named it
-- `pending_ticket_drafts_origin_check`. Same DROP-then-ADD shape as 0009/0011.
ALTER TABLE pending_ticket_drafts
  DROP CONSTRAINT pending_ticket_drafts_origin_check,
  ADD CONSTRAINT pending_ticket_drafts_origin_check
    CHECK (origin IN ('high-band', 'mid-band-confirmed', 'high-band-dm'));
