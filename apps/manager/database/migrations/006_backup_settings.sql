INSERT INTO server_settings (key, value)
VALUES ('backup_interval_hours', '24'::jsonb)
ON CONFLICT (key) DO NOTHING;
