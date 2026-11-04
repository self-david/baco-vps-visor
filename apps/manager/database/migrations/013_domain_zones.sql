CREATE TABLE domain_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider = 'cloudflare'),
  zone_name TEXT NOT NULL CHECK (char_length(zone_name) BETWEEN 1 AND 253),
  zone_id TEXT NOT NULL CHECK (char_length(zone_id) BETWEEN 1 AND 64),
  credential_id UUID NOT NULL,
  proxied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX domain_zones_zone_name_lower_key ON domain_zones (lower(zone_name));
CREATE UNIQUE INDEX domain_zones_zone_id_key ON domain_zones (zone_id);

INSERT INTO domain_zones (provider, zone_name, zone_id, credential_id)
SELECT DISTINCT ON (lower(zone_name)) provider, lower(zone_name), zone_id, id
FROM project_domains
ORDER BY lower(zone_name), id;

ALTER TABLE project_domains
  ADD COLUMN domain_zone_id UUID;

UPDATE project_domains AS domains
SET domain_zone_id = zones.id
FROM domain_zones AS zones
WHERE lower(domains.zone_name) = lower(zones.zone_name);

ALTER TABLE project_domains
  ALTER COLUMN domain_zone_id SET NOT NULL,
  ADD CONSTRAINT project_domains_domain_zone_id_fkey
    FOREIGN KEY (domain_zone_id) REFERENCES domain_zones (id) ON DELETE RESTRICT;

CREATE INDEX project_domains_domain_zone_id_idx ON project_domains (domain_zone_id);
