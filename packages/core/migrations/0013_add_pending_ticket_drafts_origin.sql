-- Backfills every existing row as 'high-band' — accepted as a known limitation, not a data-
-- correctness guarantee: any real Mid-band-confirmed draft rows already in the table before this
-- migration (BUILD_PLAN 3.4b-ii's own 👍 outcome has been live since this session) cannot be
-- retroactively distinguished and will be misclassified as High-band. Given moe's own current
-- scale (single early-adopter deployment, low volume), this is judged an acceptable one-time
-- historical-data caveat rather than a blocker.
ALTER TABLE pending_ticket_drafts
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'high-band'
    CHECK (origin IN ('high-band', 'mid-band-confirmed'));
