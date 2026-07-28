-- BUILD_PLAN 5.2b — same claim-first defence-in-depth as migration 0020, applied to
-- pending_confirming_questions. This table already carries source_message_ts (migration 0008), just
-- not as its claim key, and it is already NOT NULL on every row (unlike pending_ticket_drafts,
-- confirming questions have always required a source message) — checked directly against
-- production: zero existing rows, so no backfill question at all here.
--
-- message_ts becomes nullable for the same reason as 0020: the app now inserts the claim row keyed
-- on source_message_ts before posting to Slack, and fills in message_ts via a resolve-style UPDATE
-- once the post succeeds.
--
-- Constraint name verified against the real database before writing this DROP, not guessed: the
-- table's original CREATE TABLE left the UNIQUE unnamed, so Postgres auto-named it
-- pending_confirming_questions_channel_id_message_ts_key.
ALTER TABLE pending_confirming_questions
  ALTER COLUMN message_ts DROP NOT NULL,
  DROP CONSTRAINT pending_confirming_questions_channel_id_message_ts_key,
  ADD UNIQUE (channel_id, source_message_ts);
