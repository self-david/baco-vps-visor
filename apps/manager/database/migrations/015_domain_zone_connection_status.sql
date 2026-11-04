ALTER TABLE domain_zones
  ALTER COLUMN zone_id DROP NOT NULL,
  ADD COLUMN connection_status TEXT NOT NULL DEFAULT 'connected'
    CHECK (connection_status IN ('connecting', 'connected', 'failed')),
  ADD COLUMN connection_error TEXT,
  ADD COLUMN last_checked_at TIMESTAMPTZ;

UPDATE domain_zones
SET last_checked_at = updated_at;
