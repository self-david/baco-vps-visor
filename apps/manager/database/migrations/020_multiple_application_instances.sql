ALTER TABLE application_instances
  DROP CONSTRAINT application_instances_server_key;

CREATE UNIQUE INDEX application_instances_supabase_server_key
  ON application_instances (application_id, server_node_id)
  WHERE application_id = 'supabase';
