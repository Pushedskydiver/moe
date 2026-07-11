CREATE TABLE tickets (
  id UUID PRIMARY KEY,
  project_key TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('Backlog', 'Brief', 'Plan', 'Build', 'Review', 'Done', 'Cancelled')
  ),
  severity TEXT NOT NULL CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT updated_at_not_before_created_at CHECK (updated_at >= created_at)
);

CREATE INDEX tickets_project_key_idx ON tickets (project_key);
