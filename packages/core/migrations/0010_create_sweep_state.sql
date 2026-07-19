CREATE TABLE sweep_state (
  persona_id TEXT PRIMARY KEY,
  last_swept_at TIMESTAMPTZ NOT NULL
);
