ALTER TABLE ticket_plans
  ADD CONSTRAINT ticket_plans_channel_message_unique UNIQUE (channel_id, message_ts);
