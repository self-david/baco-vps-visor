ALTER TABLE projects
  ADD COLUMN deployment_type TEXT NOT NULL DEFAULT 'dynamic'
    CHECK (deployment_type IN ('static', 'dynamic'));
