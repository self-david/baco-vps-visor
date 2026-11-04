CREATE TABLE application_catalog (
  id TEXT PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9-]{0,62}$'),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  category TEXT NOT NULL CHECK (char_length(category) BETWEEN 1 AND 100),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  version TEXT NOT NULL CHECK (char_length(version) BETWEEN 1 AND 100),
  enabled BOOLEAN NOT NULL DEFAULT true,
  configuration_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  service_manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE application_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id TEXT NOT NULL REFERENCES application_catalog (id) ON DELETE RESTRICT,
  server_node_id TEXT NOT NULL CHECK (char_length(server_node_id) BETWEEN 25 AND 64),
  server_hostname TEXT NOT NULL CHECK (char_length(server_hostname) BETWEEN 1 AND 255),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'configured'
    CHECK (status IN ('configured', 'installing', 'installed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT application_instances_server_key UNIQUE (application_id, server_node_id)
);

CREATE INDEX application_instances_application_updated_idx
  ON application_instances (application_id, updated_at DESC);
CREATE UNIQUE INDEX application_instances_supabase_api_domain_key
  ON application_instances (lower(configuration->>'apiDomain'))
  WHERE application_id = 'supabase' AND configuration ? 'apiDomain';
CREATE UNIQUE INDEX application_instances_supabase_studio_domain_key
  ON application_instances (lower(configuration->>'studioDomain'))
  WHERE application_id = 'supabase' AND configuration ? 'studioDomain';

INSERT INTO application_catalog (
  id, name, category, description, version, configuration_schema, service_manifest
) VALUES (
  'gitea',
  'Gitea',
  'Control de versiones',
  'Servidor Git privado para alojar repositorios y conectar proyectos.',
  '1.25.3',
  '{"managedBy":"legacy-installer","domains":["git.<manager-domain>"],"ports":{"ssh":2222,"http":3000},"storage":[{"name":"vps-manager-gitea-data","target":"/data"}]}'::jsonb,
  '{"services":{"gitea":{"image":"gitea/gitea:1.25.3","replicas":1,"network":"vps-manager-proxy","healthcheck":"agent-managed"}}}'::jsonb
), (
  'n8n',
  'n8n',
  'Automatización',
  'Automatiza flujos de trabajo con una instancia privada y persistente.',
  '2.46.4',
  '{"managedBy":"legacy-installer","domain":{"required":true,"port":5678},"storage":[{"name":"vps-manager-n8n-data","target":"/home/node/.n8n"}],"secrets":["N8N_ENCRYPTION_KEY"]}'::jsonb,
  '{"services":{"n8n":{"image":"n8nio/n8n:2.46.4","replicas":1,"network":"vps-manager-proxy","healthcheck":"agent-managed"}}}'::jsonb
), (
  'postgresql',
  'PostgreSQL',
  'Base de datos',
  'Base de datos relacional privada para aplicaciones desplegadas en Swarm.',
  '17.11-alpine3.24',
  '{"managedBy":"legacy-installer","ports":{"internal":5432},"storage":[{"name":"vps-manager-postgresql-data","target":"/var/lib/postgresql/data"}],"secrets":["POSTGRES_PASSWORD"]}'::jsonb,
  '{"services":{"postgresql":{"image":"postgres:17.11-alpine3.24","replicas":1,"network":"vps-manager-proxy","healthcheck":"pg_isready"}}}'::jsonb
), (
  'supabase',
  'Supabase',
  'Backend e infraestructura',
  'Plataforma self-hosted completa con base de datos, API, autenticación, almacenamiento, funciones y Studio.',
  '2026.10',
  '{
    "fields":[
      {"key":"apiDomain","label":"Dominio de API","type":"hostname","required":true},
      {"key":"studioDomain","label":"Dominio de Studio","type":"hostname","required":true},
      {"key":"siteUrl","label":"URL pública de la aplicación","type":"url","required":true},
      {"key":"additionalRedirectUrls","label":"URLs adicionales de redirección","type":"url-list","default":[]},
      {"key":"organizationName","label":"Organización inicial","type":"text","default":"Default Organization"},
      {"key":"projectName","label":"Proyecto inicial","type":"text","default":"Default Project"},
      {"key":"disableSignup","label":"Deshabilitar registros","type":"boolean","default":true},
      {"key":"enableEmailSignup","label":"Habilitar registro por email","type":"boolean","default":true},
      {"key":"enableEmailAutoconfirm","label":"Confirmar email automáticamente","type":"boolean","default":false},
      {"key":"enableAnonymousUsers","label":"Habilitar usuarios anónimos","type":"boolean","default":false},
      {"key":"jwtExpirySeconds","label":"Duración JWT en segundos","type":"integer","minimum":300,"maximum":604800,"default":3600},
      {"key":"maxRows","label":"Máximo de filas por consulta REST","type":"integer","minimum":1,"maximum":10000,"default":1000},
      {"key":"storageFileSizeLimitBytes","label":"Límite de archivo en bytes","type":"integer","minimum":1048576,"maximum":5368709120,"default":52428800},
      {"key":"storageRegion","label":"Región de almacenamiento","type":"text","default":"local"},
      {"key":"enableImageTransformation","label":"Transformación de imágenes","type":"boolean","default":true},
      {"key":"functionsVerifyJwt","label":"Verificar JWT en Edge Functions","type":"boolean","default":true},
      {"key":"smtp","label":"Configuración SMTP","type":"optional-object","secretFields":["password"],"default":null},
      {"key":"oauthProviders","label":"Proveedores OAuth","type":"optional-object","secretFields":["clientSecret"],"default":{}},
      {"key":"resourceLimits","label":"Límites de CPU y memoria por servicio","type":"resource-map","default":{"db":{"cpus":2,"memoryMb":4096},"studio":{"cpus":1,"memoryMb":1024},"api-gw":{"cpus":1,"memoryMb":512},"auth":{"cpus":0.5,"memoryMb":512},"rest":{"cpus":0.5,"memoryMb":512},"realtime":{"cpus":1,"memoryMb":1024},"storage":{"cpus":1,"memoryMb":1024},"imgproxy":{"cpus":0.5,"memoryMb":512},"meta":{"cpus":0.25,"memoryMb":256},"functions":{"cpus":1,"memoryMb":2048},"supavisor":{"cpus":1,"memoryMb":1024}}},
      {"key":"persistentVolumes","label":"Volúmenes persistentes","type":"managed-volume-map","default":{"db":"/var/lib/postgresql/data","storage":"/var/lib/storage","functions":"/home/deno/functions","snippets":"/app/snippets","dbConfig":"/etc/postgresql-custom","denoCache":"/root/.cache/deno"}},
      {"key":"healthChecks","label":"Comprobaciones de salud","type":"healthcheck-map","default":{"db":"pg_isready","auth":"GET /health","rest":"postgrest --ready","storage":"GET /status","api-gw":"TCP 8000","studio":"GET /api/platform/profile","functions":"TCP 9000"}},
      {"key":"secrets","label":"Secretos generados por instalación","type":"generated-secret-list","values":["POSTGRES_PASSWORD","JWT_SECRET","ANON_KEY","SERVICE_ROLE_KEY","DASHBOARD_PASSWORD","SECRET_KEY_BASE","VAULT_ENC_KEY","PG_META_CRYPTO_KEY","REALTIME_DB_ENC_KEY","S3_PROTOCOL_ACCESS_KEY_ID","S3_PROTOCOL_ACCESS_KEY_SECRET"]}
    ],
    "defaults":{"additionalRedirectUrls":[],"organizationName":"Default Organization","projectName":"Default Project","disableSignup":true,"enableEmailSignup":true,"enableEmailAutoconfirm":false,"enableAnonymousUsers":false,"jwtExpirySeconds":3600,"maxRows":1000,"storageFileSizeLimitBytes":52428800,"storageRegion":"local","enableImageTransformation":true,"functionsVerifyJwt":true,"resourceLimits":{"db":{"cpus":2,"memoryMb":4096},"studio":{"cpus":1,"memoryMb":1024},"api-gw":{"cpus":1,"memoryMb":512},"auth":{"cpus":0.5,"memoryMb":512},"rest":{"cpus":0.5,"memoryMb":512},"realtime":{"cpus":1,"memoryMb":1024},"storage":{"cpus":1,"memoryMb":1024},"imgproxy":{"cpus":0.5,"memoryMb":512},"meta":{"cpus":0.25,"memoryMb":256},"functions":{"cpus":1,"memoryMb":2048},"supavisor":{"cpus":1,"memoryMb":1024}}},
    "domains":[{"key":"apiDomain","service":"api-gw","port":8000,"https":true},{"key":"studioDomain","service":"studio","port":3000,"https":true}],
    "network":{"name":"vps-manager-proxy","type":"overlay"},
    "placement":{"replicasPerServer":1,"allServicesOnSelectedServer":true},
    "storagePolicy":"local-managed-volumes",
    "secretPolicy":"docker-swarm-secrets"
  }'::jsonb,
  '{
    "services":{
      "studio":{"image":"supabase/studio:2026.10.12-sha-3699278","port":3000,"domainField":"studioDomain"},
      "api-gw":{"image":"envoyproxy/envoy:v1.39.1","port":8000,"domainField":"apiDomain"},
      "auth":{"image":"supabase/gotrue:v2.197.0","port":9999},
      "rest":{"image":"postgrest/postgrest:v14.18","port":3000},
      "realtime":{"image":"supabase/realtime:v2.143.3","port":4000},
      "storage":{"image":"supabase/storage-api:v1.81.0","port":5000},
      "imgproxy":{"image":"darthsim/imgproxy:v3.31.4","port":5001},
      "meta":{"image":"supabase/postgres-meta:v0.100.0","port":8080},
      "functions":{"image":"supabase/edge-runtime:v1.77.4","port":9000},
      "db":{"image":"supabase/postgres:17.6.1.136","port":5432},
      "supavisor":{"image":"supabase/supavisor:2.9.13","port":6543}
    },
    "privatePorts":[5432,6543,9999,3000,4000,5000,5001,8080,9000],
    "publicRoutes":{"apiDomain":{"service":"api-gw","port":8000},"studioDomain":{"service":"studio","port":3000}},
    "requiredNetworks":["vps-manager-proxy"],
    "persistentTargets":["/var/lib/postgresql/data","/var/lib/storage","/home/deno/functions","/app/snippets","/etc/postgresql-custom","/root/.cache/deno"],
    "deploymentMode":"swarm-stack"
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;
