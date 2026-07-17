CREATE TABLE persona_cost_alerts (
  persona_id TEXT NOT NULL,
  month TEXT NOT NULL,
  highest_threshold_alerted INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (persona_id, month)
);
