ALTER TABLE projects
  DROP CONSTRAINT projects_deployment_type_check,
  ADD CONSTRAINT projects_deployment_type_check
    CHECK (deployment_type IN ('static', 'dynamic', 'build')),
  ADD COLUMN build_command TEXT NOT NULL DEFAULT 'npm run build',
  ADD COLUMN build_output_directory TEXT NOT NULL DEFAULT 'dist';
