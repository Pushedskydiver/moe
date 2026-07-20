ALTER TABLE pending_ticket_drafts
  ADD COLUMN redo_count INTEGER NOT NULL DEFAULT 0;
