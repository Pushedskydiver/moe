CREATE TABLE pending_confirming_questions (
  id UUID PRIMARY KEY,
  persona_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_ts TEXT NOT NULL,
  source_message_ts TEXT NOT NULL,
  source_message_text TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  reasoning TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (channel_id, message_ts)
);
