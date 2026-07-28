-- BUILD_PLAN 5.2b — defence-in-depth for 5.2a's single-listener fix. The old claim key,
-- UNIQUE (channel_id, message_ts), never arbitrated anything: message_ts is the *posted* message's
-- own ts, which does not exist until after the Slack post already happened, and is distinct per
-- persona in any case. The real claim key every process can compute identically, before any Slack
-- call, is the *source* message's own (channel_id, ts) — the same natural key
-- pending_confirming_questions (migration 0008) already carries as source_message_ts, just not yet
-- as its own claim key (see migration 0021, same session).
--
-- message_ts becomes nullable: the app now inserts the claim row before posting to Slack, so
-- message_ts is genuinely unknown at insert time and is filled in by a second, resolve-style UPDATE
-- once the post succeeds. Checked directly against production before writing this (not assumed):
-- one existing pending_ticket_drafts row, with no source_message_ts recoverable for it (this column
-- never existed before), so source_message_ts is added nullable rather than NOT NULL — the app's own
-- create function requires it on every new row via Zod, the same "DB tolerates legacy sparseness,
-- app enforces going forward" split migration 0013's origin-column DEFAULT already established.
--
-- Constraint name verified against the real database before writing this DROP, not guessed: the
-- table's original CREATE TABLE left the UNIQUE unnamed, so Postgres auto-named it
-- pending_ticket_drafts_channel_id_message_ts_key.
ALTER TABLE pending_ticket_drafts
  ADD COLUMN source_message_ts TEXT,
  ALTER COLUMN message_ts DROP NOT NULL,
  DROP CONSTRAINT pending_ticket_drafts_channel_id_message_ts_key,
  ADD UNIQUE (channel_id, source_message_ts);
