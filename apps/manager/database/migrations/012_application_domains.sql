ALTER TABLE project_domains
  ALTER COLUMN project_id DROP NOT NULL,
  ADD COLUMN application_id TEXT;

ALTER TABLE project_domains
  ADD CONSTRAINT project_domains_target_check CHECK (
    (project_id IS NOT NULL AND application_id IS NULL)
    OR (project_id IS NULL AND application_id = 'n8n')
  );

CREATE INDEX project_domains_application_id_idx ON project_domains (application_id);
CREATE UNIQUE INDEX project_domains_application_id_unique_idx
  ON project_domains (application_id)
  WHERE application_id IS NOT NULL;
