CREATE TABLE container_metrics (
  sampled_at TIMESTAMPTZ NOT NULL,
  container_id TEXT NOT NULL,
  container_name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  cpu_percent DOUBLE PRECISION NOT NULL CHECK (cpu_percent >= 0),
  memory_usage_bytes BIGINT NOT NULL CHECK (memory_usage_bytes >= 0),
  memory_limit_bytes BIGINT NOT NULL CHECK (memory_limit_bytes >= 0),
  PRIMARY KEY (sampled_at, container_id)
);

CREATE INDEX container_metrics_sampled_at_group_idx
  ON container_metrics (sampled_at, group_name);

INSERT INTO server_settings (key, value)
VALUES ('metrics_sampling_interval_minutes', '15'::jsonb)
ON CONFLICT (key) DO NOTHING;
