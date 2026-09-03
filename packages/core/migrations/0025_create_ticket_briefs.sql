CREATE TABLE ticket_briefs (
  ticket_id UUID PRIMARY KEY REFERENCES tickets (id),
  channel_id TEXT NOT NULL,
  message_ts TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
