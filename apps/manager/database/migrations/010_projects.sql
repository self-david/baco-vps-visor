CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  repository TEXT NOT NULL,
  production_branch TEXT NOT NULL CHECK (char_length(production_branch) BETWEEN 1 AND 255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT projects_repository_key UNIQUE (repository)
);

CREATE UNIQUE INDEX projects_name_lower_key ON projects (lower(name));
CREATE INDEX projects_updated_at_idx ON projects (updated_at DESC);
