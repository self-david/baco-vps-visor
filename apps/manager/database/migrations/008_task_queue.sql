ALTER TABLE tasks
  ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN lease_token UUID,
  ADD COLUMN lease_expires_at TIMESTAMPTZ;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_attempts_valid CHECK (
    attempts >= 0 AND max_attempts BETWEEN 1 AND 10 AND attempts <= max_attempts
  );

CREATE INDEX tasks_queue_idx
  ON tasks (next_attempt_at, created_at, id)
  WHERE status IN ('pending', 'in_progress');
