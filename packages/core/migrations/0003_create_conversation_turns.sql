CREATE TABLE conversation_turns (
  id UUID PRIMARY KEY,
  persona_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  thread_key TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX conversation_turns_lookup_idx ON conversation_turns (
  persona_id, channel_id, thread_key, created_at
);
