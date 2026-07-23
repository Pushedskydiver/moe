-- Backfills every existing row as 'Standard' — accepted as a known limitation, not a data-
-- correctness guarantee: any real ticket that would genuinely qualify as 'Expedite' (per
-- docs/decisions/BOARD-AND-CAPACITY-MODEL.md — #moe-incidents-sourced or severity: 'Critical')
-- cannot be retroactively distinguished from this default and stays 'Standard' until a human
-- edits it. Every new ticket going forward supplies this column explicitly at insert
-- (tickets-repository.ts's createTicket) — this DEFAULT exists solely for the backfill above,
-- same shape as migration 0013's origin column on pending_ticket_drafts.
ALTER TABLE tickets
  ADD COLUMN class_of_service TEXT NOT NULL DEFAULT 'Standard'
    CHECK (class_of_service IN ('Standard', 'Expedite'));
