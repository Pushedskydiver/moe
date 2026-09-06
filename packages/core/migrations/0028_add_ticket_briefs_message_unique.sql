ALTER TABLE ticket_briefs
  ADD CONSTRAINT ticket_briefs_channel_message_unique UNIQUE (channel_id, message_ts);
