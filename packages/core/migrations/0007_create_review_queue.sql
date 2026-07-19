CREATE TABLE review_queue (
  id UUID PRIMARY KEY,
  persona_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_ts TEXT NOT NULL,
  source_message_text TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  reasoning TEXT NOT NULL,
  outcome_reason TEXT NOT NULL CHECK (
    outcome_reason IN ('low-confidence', 'mid-no-response')
  ),
  created_at TIMESTAMPTZ NOT NULL
);
