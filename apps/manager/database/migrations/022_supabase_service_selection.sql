UPDATE application_catalog
SET version = '2026.11',
    configuration_schema = jsonb_set(
      jsonb_set(
        configuration_schema,
        '{fields}',
        (
          SELECT jsonb_agg(
            CASE
              WHEN field->>'key' = 'resourceLimits' THEN jsonb_set(
                field,
                '{default}',
                COALESCE(field->'default', '{}'::jsonb)
                  || '{"analytics":{"cpus":1,"memoryMb":1024},"vector":{"cpus":0.5,"memoryMb":512}}'::jsonb
              )
              ELSE field
            END
          )
          FROM jsonb_array_elements(configuration_schema->'fields') AS fields(field)
        ) || '[
          {"key":"enabledServices","label":"Servicios Supabase habilitados","type":"service-selection","default":["db","studio","api-gw","auth","rest","realtime","storage","imgproxy","meta","functions","supavisor","analytics","vector"]},
          {"key":"exposeDatabasePorts","label":"Publicar puertos de PostgreSQL y Supavisor","type":"boolean","default":true}
        ]'::jsonb
      ),
      '{defaults}',
      (configuration_schema->'defaults')
        || jsonb_build_object(
          'enabledServices',
          '["db","studio","api-gw","auth","rest","realtime","storage","imgproxy","meta","functions","supavisor","analytics","vector"]'::jsonb,
          'exposeDatabasePorts',
          true,
          'resourceLimits',
          COALESCE(configuration_schema#>'{defaults,resourceLimits}', '{}'::jsonb)
            || '{"analytics":{"cpus":1,"memoryMb":1024},"vector":{"cpus":0.5,"memoryMb":512}}'::jsonb
        )
    ),
    service_manifest = service_manifest || jsonb_build_object(
      'services',
      service_manifest->'services' || '{
        "studio":{"image":"supabase/studio:2026.11.02-sha-a05e7ec","port":3000,"domainField":"studioDomain"},
        "api-gw":{"image":"envoyproxy/envoy:v1.39.6","port":8000,"domainField":"apiDomain"},
        "realtime":{"image":"supabase/realtime:v2.148.3","port":4000},
        "storage":{"image":"supabase/storage-api:v1.89.12","port":5000},
        "imgproxy":{"image":"darthsim/imgproxy:v4.0.21","port":5001},
        "functions":{"image":"supabase/edge-runtime:v1.77.9","port":9000},
        "analytics":{"image":"supabase/logflare:1.50.15","port":4000,"optional":true},
        "vector":{"image":"timberio/vector:0.53.0-alpine","port":9001,"optional":true}
      }'::jsonb,
      'selection',
      '{
        "required":["db","studio","api-gw","auth","rest","meta"],
        "dependencies":{"vector":["analytics"]}
      }'::jsonb,
      'privatePorts',
      '[9999,3000,4000,5000,5001,8000,8080,9000]'::jsonb,
      'publicPorts',
      '[5432,6543]'::jsonb,
      'conditionalPorts',
      '{"exposeDatabasePorts":[5432,6543]}'::jsonb
    )
WHERE id = 'supabase';
