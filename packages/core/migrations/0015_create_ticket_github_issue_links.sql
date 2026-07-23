CREATE TABLE ticket_github_issue_links (
  ticket_id UUID PRIMARY KEY REFERENCES tickets (id),
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  issue_number INTEGER,
  issue_url TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX ticket_github_issue_links_issue_idx ON ticket_github_issue_links (
  repo_owner, repo_name, issue_number
) WHERE issue_number IS NOT NULL;
