ALTER TABLE projects
  ALTER COLUMN repository DROP NOT NULL,
  DROP CONSTRAINT projects_repository_key,
  ADD COLUMN source_type TEXT NOT NULL DEFAULT 'legacy'
    CHECK (source_type IN ('legacy', 'github', 'upload')),
  ADD COLUMN build_strategy TEXT NOT NULL DEFAULT 'dockerfile'
    CHECK (build_strategy IN ('dockerfile', 'railpack')),
  ADD COLUMN build_context TEXT NOT NULL DEFAULT '.'
    CHECK (char_length(build_context) BETWEEN 1 AND 255),
  ADD COLUMN dockerfile_path TEXT NOT NULL DEFAULT 'Dockerfile'
    CHECK (char_length(dockerfile_path) BETWEEN 1 AND 255),
  ADD COLUMN internal_port INTEGER NOT NULL DEFAULT 3000
    CHECK (internal_port BETWEEN 1 AND 65535),
  ADD COLUMN auto_deploy BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX projects_repository_key
  ON projects (repository)
  WHERE repository IS NOT NULL;

CREATE TABLE github_installations (
  installation_id BIGINT PRIMARY KEY CHECK (installation_id > 0),
  account_login TEXT NOT NULL CHECK (char_length(account_login) BETWEEN 1 AND 255),
  account_type TEXT NOT NULL CHECK (account_type IN ('User', 'Organization')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE projects
  ADD COLUMN github_installation_id BIGINT REFERENCES github_installations (installation_id) ON DELETE RESTRICT,
  ADD CONSTRAINT projects_github_installation_required
    CHECK (source_type <> 'github' OR github_installation_id IS NOT NULL);

CREATE TABLE github_webhook_deliveries (
  delivery_id UUID PRIMARY KEY,
  event TEXT NOT NULL CHECK (event = 'push'),
  repository TEXT NOT NULL,
  ref TEXT NOT NULL,
  commit_sha TEXT NOT NULL CHECK (commit_sha ~ '^[a-f0-9]{40}$'),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX github_webhook_deliveries_received_at_idx
  ON github_webhook_deliveries (received_at DESC);

CREATE TABLE project_source_uploads (
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  source_digest TEXT NOT NULL CHECK (source_digest ~ '^[a-f0-9]{64}$'),
  size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 33554432),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, source_digest)
);
