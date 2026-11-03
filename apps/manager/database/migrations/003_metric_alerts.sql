INSERT INTO server_settings (key, value)
VALUES ('metrics_alert_thresholds', '{"cpuPercent":90,"memoryPercent":90}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE INDEX container_metrics_container_sampled_at_idx
  ON container_metrics (container_id, sampled_at DESC);
