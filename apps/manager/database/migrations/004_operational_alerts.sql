UPDATE server_settings
SET value = value || '{"diskFreePercent":10,"restartCount":3,"restartWindowMinutes":60}'::jsonb,
    updated_at = now()
WHERE key = 'metrics_alert_thresholds';

CREATE TABLE container_restart_samples (
  sampled_at TIMESTAMPTZ NOT NULL,
  container_id TEXT NOT NULL,
  container_name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  restart_count INTEGER NOT NULL CHECK (restart_count >= 0),
  PRIMARY KEY (sampled_at, container_id)
);

CREATE INDEX container_restart_samples_container_sampled_at_idx
  ON container_restart_samples (container_id, sampled_at);
