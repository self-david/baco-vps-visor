UPDATE server_settings
SET value = value || '{"certificateWarningDays":14,"httpTimeoutSeconds":5}'::jsonb,
    updated_at = now()
WHERE key = 'metrics_alert_thresholds';
