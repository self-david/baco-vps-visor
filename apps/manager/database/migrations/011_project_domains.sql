CREATE TABLE project_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider = 'cloudflare'),
  zone_name TEXT NOT NULL CHECK (char_length(zone_name) BETWEEN 1 AND 253),
  zone_id TEXT NOT NULL CHECK (char_length(zone_id) BETWEEN 1 AND 64),
  hostname TEXT NOT NULL CHECK (char_length(hostname) BETWEEN 1 AND 253),
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
  port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
  proxied BOOLEAN NOT NULL DEFAULT false,
  dns_record_id TEXT NOT NULL CHECK (char_length(dns_record_id) BETWEEN 1 AND 64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX project_domains_hostname_lower_key ON project_domains (lower(hostname));
CREATE INDEX project_domains_project_id_idx ON project_domains (project_id);
