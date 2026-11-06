CREATE TABLE application_instance_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_instance_id UUID NOT NULL REFERENCES application_instances (id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider = 'cloudflare'),
  zone_name TEXT NOT NULL CHECK (char_length(zone_name) BETWEEN 1 AND 253),
  domain_zone_id UUID NOT NULL REFERENCES domain_zones (id) ON DELETE RESTRICT,
  zone_id TEXT NOT NULL CHECK (char_length(zone_id) BETWEEN 1 AND 64),
  hostname TEXT NOT NULL CHECK (char_length(hostname) BETWEEN 1 AND 253),
  port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
  proxied BOOLEAN NOT NULL DEFAULT false,
  dns_record_id TEXT NOT NULL CHECK (char_length(dns_record_id) BETWEEN 1 AND 64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT application_instance_domains_instance_hostname_key
    UNIQUE (application_instance_id, hostname)
);

CREATE UNIQUE INDEX application_instance_domains_hostname_lower_key
  ON application_instance_domains (lower(hostname));
