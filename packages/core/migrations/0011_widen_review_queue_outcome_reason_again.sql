ALTER TABLE review_queue
  DROP CONSTRAINT review_queue_outcome_reason_check,
  ADD CONSTRAINT review_queue_outcome_reason_check
    CHECK (outcome_reason IN ('low-confidence', 'mid-no', 'mid-silence', 'mid-yes-failed'));
