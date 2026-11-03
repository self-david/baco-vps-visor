ALTER TABLE tasks
  ADD COLUMN started_at TIMESTAMPTZ,
  ADD COLUMN completed_at TIMESTAMPTZ;

CREATE INDEX tasks_type_created_at_idx ON tasks (type, created_at DESC);
