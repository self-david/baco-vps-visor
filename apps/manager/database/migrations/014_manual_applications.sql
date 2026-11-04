ALTER TABLE application_instances
  ADD COLUMN service_id TEXT,
  ADD COLUMN deployment_task_id UUID;

ALTER TABLE application_instances
  ADD CONSTRAINT application_instances_service_id_check
  CHECK (service_id IS NULL OR service_id ~ '^[A-Za-z0-9]{25,64}$');

CREATE UNIQUE INDEX application_instances_manual_domain_key
  ON application_instances (lower(configuration->>'domain'))
  WHERE configuration ? 'domain';
