import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { evaluateContainerMetricAlerts } from "./metric-alerts.mjs";
import { evaluateOperationalAlerts } from "./operational-alerts.mjs";
import { createTaskStore } from "./service-task-store.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(root, "database", "migrations");
const databasePassword = (await readFile(
  process.env.DATABASE_PASSWORD_FILE ?? "/run/secrets/postgres_password",
  "utf8",
)).trim();

if (!databasePassword) {
  throw new Error("The PostgreSQL password secret is empty.");
}

let pool;
let taskStore;
let databaseReady = false;

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function initDatabase() {
  pool = new pg.Pool({
    host: process.env.DATABASE_HOST ?? "postgres",
    port: Number(process.env.DATABASE_PORT ?? 5432),
    user: process.env.DATABASE_USER ?? "vps_manager",
    database: process.env.DATABASE_NAME ?? "vps_manager",
    password: databasePassword,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  taskStore = createTaskStore({ pool, insertAuditEvent });
  pool.on("error", (error) => {
    databaseReady = false;
    console.error("PostgreSQL pool error:", error.message);
  });

  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      await applyMigrations();
      databaseReady = true;
      console.log("PostgreSQL is ready.");
      return;
    } catch (error) {
      databaseReady = false;
      console.error(
        `Waiting for PostgreSQL (${attempt}):`,
        error instanceof Error ? error.message : "unknown error",
      );
      await sleep(Math.min(2000 * attempt, 15_000));
    }
  }
}

async function applyMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const files = (await readdir(migrationsDir))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    for (const file of files) {
      const applied = await client.query("SELECT 1 FROM schema_migrations WHERE id = $1", [file]);
      if (applied.rowCount > 0) continue;

      const sql = await readFile(join(migrationsDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
  }
}

export async function getDatabaseStatus() {
  if (!pool) {
    return { connected: false };
  }

  try {
    const result = await pool.query("SELECT current_database() AS name");
    const migrations = await pool.query("SELECT id FROM schema_migrations ORDER BY id");
    databaseReady = true;
    return {
      connected: true,
      name: result.rows[0].name,
      migrations: migrations.rows.map((row) => row.id),
    };
  } catch {
    databaseReady = false;
    return { connected: false };
  }
}

export async function getMetricsSamplingIntervalMinutes() {
  const result = await pool.query(
    "SELECT value FROM server_settings WHERE key = $1",
    ["metrics_sampling_interval_minutes"],
  );
  const intervalMinutes = result.rows[0]?.value;
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440) {
    throw new Error("The metrics sampling interval in PostgreSQL is invalid.");
  }
  return intervalMinutes;
}

export async function updateMetricsSamplingIntervalMinutes(intervalMinutes) {
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440) {
    throw new RangeError("The sampling interval must be between 1 and 1440 minutes.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO server_settings (key, value)
       VALUES ($1, to_jsonb($2::integer))
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = now()`,
      ["metrics_sampling_interval_minutes", intervalMinutes],
    );
    await insertAuditEvent(client, {
      action: "metrics.sampling_interval.updated",
      resourceType: "setting",
      resourceId: "metrics_sampling_interval_minutes",
      details: { intervalMinutes },
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return intervalMinutes;
}

async function insertAuditEvent(client, {
  action,
  actor = "admin",
  resourceType,
  resourceId,
  details = {},
}) {
  if (typeof action !== "string" || action.length < 1 || action.length > 120
    || typeof actor !== "string" || actor.length > 120
    || typeof resourceType !== "string" || resourceType.length < 1 || resourceType.length > 120
    || typeof resourceId !== "string" || resourceId.length < 1 || resourceId.length > 240
    || !details || typeof details !== "object" || Array.isArray(details)) {
    throw new TypeError("Audit event fields are invalid.");
  }
  await client.query(
    `INSERT INTO audit_logs (action, actor, resource_type, resource_id, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [action, actor, resourceType, resourceId, JSON.stringify(details)],
  );
}

export async function recordAuditEvent(event) {
  await insertAuditEvent(pool, event);
}

export async function recordGiteaWebhookDelivery({ deliveryId, event, repository, ref, commitSha }) {
  return taskStore.recordGiteaWebhookDelivery({ deliveryId, event, repository, ref, commitSha });
}

export async function recordGithubWebhookDelivery({ deliveryId, event, repository, ref, commitSha }) {
  return taskStore.recordGithubWebhookDelivery({ deliveryId, event, repository, ref, commitSha });
}

export async function saveGithubInstallation({ installationId, accountLogin, accountType }) {
  const result = await pool.query(`
    INSERT INTO github_installations (installation_id, account_login, account_type)
    VALUES ($1, $2, $3)
    ON CONFLICT (installation_id) DO UPDATE
    SET account_login = EXCLUDED.account_login,
        account_type = EXCLUDED.account_type,
        updated_at = now()
    RETURNING installation_id, account_login, account_type
  `, [installationId, accountLogin, accountType]);
  return {
    installationId: Number(result.rows[0].installation_id),
    accountLogin: result.rows[0].account_login,
    accountType: result.rows[0].account_type,
  };
}

export async function getGithubInstallations() {
  const result = await pool.query(`
    SELECT installation_id, account_login, account_type
    FROM github_installations
    ORDER BY lower(account_login), installation_id
  `);
  return result.rows.map((row) => ({
    installationId: Number(row.installation_id),
    accountLogin: row.account_login,
    accountType: row.account_type,
  }));
}

export async function deleteGithubInstallation(installationId) {
  const result = await pool.query(
    "DELETE FROM github_installations WHERE installation_id = $1 RETURNING installation_id",
    [installationId],
  );
  return result.rowCount > 0;
}

function mapProject(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    repository: row.repository,
    productionBranch: row.production_branch,
    githubInstallationId: row.github_installation_id === null ? null : Number(row.github_installation_id),
    sourceType: row.source_type,
    deploymentType: row.deployment_type,
    buildStrategy: row.build_strategy,
    buildContext: row.build_context,
    dockerfilePath: row.dockerfile_path,
    buildCommand: row.build_command,
    buildOutputDirectory: row.build_output_directory,
    internalPort: row.internal_port,
    autoDeploy: row.auto_deploy,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getProjects() {
  const result = await pool.query(`
    SELECT id, name, description, repository, production_branch, source_type, github_installation_id, deployment_type, build_strategy,
      build_context, dockerfile_path, build_command, build_output_directory, internal_port, auto_deploy, created_at, updated_at
    FROM projects
    ORDER BY lower(name), id
  `);
  return result.rows.map(mapProject);
}

export async function getProject(id) {
  const result = await pool.query(`
    SELECT id, name, description, repository, production_branch, source_type, github_installation_id, deployment_type, build_strategy,
      build_context, dockerfile_path, build_command, build_output_directory, internal_port, auto_deploy, created_at, updated_at
    FROM projects
    WHERE id = $1
  `, [id]);
  return result.rows[0] ? mapProject(result.rows[0]) : null;
}

export async function createProject(project) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`
      INSERT INTO projects (
        name, description, repository, production_branch, source_type, github_installation_id, deployment_type, build_strategy,
        build_context, dockerfile_path, build_command, build_output_directory, internal_port, auto_deploy
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, name, description, repository, production_branch, source_type, github_installation_id, deployment_type, build_strategy,
        build_context, dockerfile_path, build_command, build_output_directory, internal_port, auto_deploy, created_at, updated_at
    `, [
      project.name,
      project.description,
      project.repository,
      project.productionBranch,
      project.sourceType,
      project.githubInstallationId,
      project.deploymentType,
      project.buildStrategy,
      project.buildContext,
      project.dockerfilePath,
      project.buildCommand,
      project.buildOutputDirectory,
      project.internalPort,
      project.autoDeploy,
    ]);
    const created = mapProject(result.rows[0]);
    await insertAuditEvent(client, {
      action: "project.created",
      resourceType: "project",
      resourceId: created.id,
      details: { name: created.name, repository: created.repository, productionBranch: created.productionBranch },
    });
    await client.query("COMMIT");
    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateProject(id, project) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`
      UPDATE projects
      SET name = $2, description = $3, repository = $4, production_branch = $5,
          source_type = $6, github_installation_id = $7, deployment_type = $8, build_strategy = $9, build_context = $10,
          dockerfile_path = $11, build_command = $12, build_output_directory = $13,
          internal_port = $14, auto_deploy = $15, updated_at = now()
      WHERE id = $1
      RETURNING id, name, description, repository, production_branch, source_type, github_installation_id, deployment_type, build_strategy,
        build_context, dockerfile_path, build_command, build_output_directory, internal_port, auto_deploy, created_at, updated_at
    `, [
      id,
      project.name,
      project.description,
      project.repository,
      project.productionBranch,
      project.sourceType,
      project.githubInstallationId,
      project.deploymentType,
      project.buildStrategy,
      project.buildContext,
      project.dockerfilePath,
      project.buildCommand,
      project.buildOutputDirectory,
      project.internalPort,
      project.autoDeploy,
    ]);
    if (result.rowCount === 0) {
      await client.query("COMMIT");
      return null;
    }
    const updated = mapProject(result.rows[0]);
    await insertAuditEvent(client, {
      action: "project.updated",
      resourceType: "project",
      resourceId: updated.id,
      details: { name: updated.name, repository: updated.repository, productionBranch: updated.productionBranch },
    });
    await client.query("COMMIT");
    return updated;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordProjectUploadSource(projectId, sourceDigest, sizeBytes) {
  const result = await pool.query(`
    INSERT INTO project_source_uploads (project_id, source_digest, size_bytes)
    VALUES ($1, $2, $3)
    ON CONFLICT (project_id, source_digest) DO UPDATE
    SET size_bytes = EXCLUDED.size_bytes
    RETURNING project_id, source_digest, size_bytes, created_at
  `, [projectId, sourceDigest, sizeBytes]);
  return {
    projectId: result.rows[0].project_id,
    sourceDigest: result.rows[0].source_digest,
    sizeBytes: Number(result.rows[0].size_bytes),
    createdAt: result.rows[0].created_at.toISOString(),
  };
}

export async function getLatestProjectUploadSource(projectId) {
  const result = await pool.query(`
    SELECT project_id, source_digest, size_bytes, created_at
    FROM project_source_uploads
    WHERE project_id = $1
    ORDER BY created_at DESC, source_digest DESC
    LIMIT 1
  `, [projectId]);
  const row = result.rows[0];
  return row ? {
    projectId: row.project_id,
    sourceDigest: row.source_digest,
    sizeBytes: Number(row.size_bytes),
    createdAt: row.created_at.toISOString(),
  } : null;
}

export async function getProjectUploadSource(projectId, sourceDigest) {
  const result = await pool.query(`
    SELECT project_id, source_digest, size_bytes, created_at
    FROM project_source_uploads
    WHERE project_id = $1 AND source_digest = $2
  `, [projectId, sourceDigest]);
  const row = result.rows[0];
  return row ? {
    projectId: row.project_id,
    sourceDigest: row.source_digest,
    sizeBytes: Number(row.size_bytes),
    createdAt: row.created_at.toISOString(),
  } : null;
}

function mapProjectDomain(row) {
  return {
    id: row.id,
    provider: row.provider,
    zone: row.zone_name,
    domainZoneId: row.domain_zone_id,
    zoneId: row.zone_id,
    hostname: row.hostname,
    projectId: row.project_id,
    applicationId: row.application_id,
    port: row.port,
    proxied: row.proxied,
    dnsRecordId: row.dns_record_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapDomainZone(row) {
  return {
    id: row.id,
    provider: row.provider,
    zone: row.zone_name,
    zoneId: row.zone_id,
    credentialId: row.credential_id,
    proxied: row.proxied,
    connectionStatus: row.connection_status,
    connectionError: row.connection_error,
    lastCheckedAt: row.last_checked_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getDomainZones() {
  const result = await pool.query(`
    SELECT id, provider, zone_name, zone_id, credential_id, proxied,
           connection_status, connection_error, last_checked_at, created_at, updated_at
    FROM domain_zones
    ORDER BY lower(zone_name), id
  `);
  return result.rows.map(mapDomainZone);
}

export async function getDomainZone(id) {
  const result = await pool.query(`
    SELECT id, provider, zone_name, zone_id, credential_id, proxied,
           connection_status, connection_error, last_checked_at, created_at, updated_at
    FROM domain_zones
    WHERE id = $1
  `, [id]);
  return result.rows[0] ? mapDomainZone(result.rows[0]) : null;
}

export async function getDomainZoneByName(zone) {
  const result = await pool.query(`
    SELECT id, provider, zone_name, zone_id, credential_id, proxied,
           connection_status, connection_error, last_checked_at, created_at, updated_at
    FROM domain_zones
    WHERE lower(zone_name) = lower($1)
  `, [zone]);
  return result.rows[0] ? mapDomainZone(result.rows[0]) : null;
}

export async function saveDomainZone(domainZone) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`
      INSERT INTO domain_zones (
        id, provider, zone_name, zone_id, credential_id, proxied,
        connection_status, connection_error, last_checked_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        CASE WHEN $7 = 'connecting' THEN NULL ELSE now() END
      )
      ON CONFLICT (id) DO UPDATE
      SET zone_id = EXCLUDED.zone_id,
          credential_id = EXCLUDED.credential_id,
          proxied = EXCLUDED.proxied,
          connection_status = EXCLUDED.connection_status,
          connection_error = EXCLUDED.connection_error,
          last_checked_at = CASE
            WHEN EXCLUDED.connection_status = 'connecting'
              THEN domain_zones.last_checked_at
            ELSE now()
          END,
          updated_at = now()
      RETURNING id, provider, zone_name, zone_id, credential_id, proxied,
                connection_status, connection_error, last_checked_at, created_at, updated_at
    `, [
      domainZone.id,
      domainZone.provider,
      domainZone.zone,
      domainZone.zoneId,
      domainZone.credentialId,
      domainZone.proxied,
      domainZone.connectionStatus,
      domainZone.connectionError ?? null,
    ]);
    await insertAuditEvent(client, {
      action: domainZone.connectionStatus === "connected"
        ? "domain.zone.saved"
        : `domain.zone.connection_${domainZone.connectionStatus}`,
      resourceType: "domain_zone",
      resourceId: domainZone.id,
      details: {
        zone: domainZone.zone,
        provider: domainZone.provider,
        ...(domainZone.connectionError ? { error: domainZone.connectionError } : {}),
      },
    });
    await client.query("COMMIT");
    return mapDomainZone(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteDomainZone(id) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`
      DELETE FROM domain_zones
      WHERE id = $1
      RETURNING id, zone_name, credential_id
    `, [id]);
    if (result.rowCount > 0) {
      await insertAuditEvent(client, {
        action: "domain.zone.deleted",
        resourceType: "domain_zone",
        resourceId: result.rows[0].id,
        details: { zone: result.rows[0].zone_name },
      });
    }
    await client.query("COMMIT");
    return result.rows[0]
      ? { id: result.rows[0].id, zone: result.rows[0].zone_name, credentialId: result.rows[0].credential_id }
      : null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getProjectDomains() {
  const result = await pool.query(`
    SELECT id, provider, zone_name, domain_zone_id, hostname, project_id, application_id, port, proxied,
      dns_record_id, created_at, updated_at
    FROM project_domains
    ORDER BY lower(hostname), id
  `);
  return result.rows.map(mapProjectDomain);
}

export async function getProjectDomain(id) {
  const result = await pool.query(`
    SELECT id, provider, zone_name, domain_zone_id, hostname, project_id, application_id, port, proxied,
      dns_record_id, created_at, updated_at
    FROM project_domains
    WHERE id = $1
  `, [id]);
  return result.rows[0] ? mapProjectDomain(result.rows[0]) : null;
}

export async function saveProjectDomain(domain) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`
      INSERT INTO project_domains (
        id, provider, zone_name, domain_zone_id, zone_id, hostname, project_id, application_id, port, proxied,
        dns_record_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE
      SET provider = EXCLUDED.provider,
          zone_name = EXCLUDED.zone_name,
          domain_zone_id = EXCLUDED.domain_zone_id,
          zone_id = EXCLUDED.zone_id,
          hostname = EXCLUDED.hostname,
          project_id = EXCLUDED.project_id,
          application_id = EXCLUDED.application_id,
          port = EXCLUDED.port,
          proxied = EXCLUDED.proxied,
          dns_record_id = EXCLUDED.dns_record_id,
          updated_at = now()
      RETURNING id, provider, zone_name, domain_zone_id, hostname, project_id, application_id, port, proxied,
        dns_record_id, created_at, updated_at
    `, [
      domain.id,
      domain.provider,
      domain.zone,
      domain.domainZoneId,
      domain.zoneId,
      domain.hostname,
      domain.projectId ?? null,
      domain.applicationId ?? null,
      domain.port,
      domain.proxied,
      domain.dnsRecordId,
    ]);
    await insertAuditEvent(client, {
      action: domain.applicationId ? "application.domain.saved" : "project.domain.saved",
      resourceType: "domain",
      resourceId: domain.id,
      details: {
        hostname: domain.hostname,
        ...(domain.projectId ? { projectId: domain.projectId } : {}),
        ...(domain.applicationId ? { applicationId: domain.applicationId } : {}),
        provider: domain.provider,
      },
    });
    await client.query("COMMIT");
    return mapProjectDomain(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteProjectDomain(id) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`
      DELETE FROM project_domains
      WHERE id = $1
      RETURNING id, hostname, project_id, application_id
    `, [id]);
    if (result.rowCount > 0) {
      await insertAuditEvent(client, {
        action: result.rows[0].application_id ? "application.domain.deleted" : "project.domain.deleted",
        resourceType: "domain",
        resourceId: result.rows[0].id,
        details: {
          hostname: result.rows[0].hostname,
          ...(result.rows[0].project_id ? { projectId: result.rows[0].project_id } : {}),
          ...(result.rows[0].application_id ? { applicationId: result.rows[0].application_id } : {}),
        },
      });
    }
    await client.query("COMMIT");
    return result.rowCount > 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getIngressIp() {
  const result = await pool.query(
    "SELECT value FROM server_settings WHERE key = $1",
    ["domains_ingress_ipv4"],
  );
  const value = result.rows[0]?.value;
  return typeof value === "string" ? value : null;
}

export async function setIngressIp(ip) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      INSERT INTO server_settings (key, value)
      VALUES ($1, to_jsonb($2::text))
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = now()
    `, ["domains_ingress_ipv4", ip]);
    await insertAuditEvent(client, {
      action: "domains.ingress_ip.updated",
      resourceType: "setting",
      resourceId: "domains_ingress_ipv4",
      details: { ipv4: ip },
    });
    await client.query("COMMIT");
    return ip;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getCloudflareTunnelSettings() {
  const result = await pool.query(
    "SELECT value FROM server_settings WHERE key = $1",
    ["cloudflare_tunnel"],
  );
  const value = result.rows[0]?.value;
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export async function saveCloudflareTunnelSettings(settings) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      INSERT INTO server_settings (key, value)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = now()
    `, ["cloudflare_tunnel", JSON.stringify(settings)]);
    await insertAuditEvent(client, {
      action: "domains.cloudflare_tunnel.configured",
      resourceType: "setting",
      resourceId: "cloudflare_tunnel",
      details: { accountId: settings.accountId, tunnelId: settings.tunnelId, name: settings.name },
    });
    await client.query("COMMIT");
    return settings;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteProject(id) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`project.build:${id}`]);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`project.deployment:${id}`]);
    const activeTask = await client.query(
      `SELECT id FROM tasks
       WHERE type IN ('project.build', 'project.deploy', 'project.undeploy', 'project.push-deploy')
         AND payload->>'projectId' = $1
         AND status IN ('pending', 'in_progress')
       LIMIT 1
       FOR UPDATE`,
      [id],
    );
    if (activeTask.rowCount > 0) {
      const error = new Error("No se puede eliminar el proyecto mientras hay una tarea de proyecto en curso.");
      error.code = "PROJECT_TASK_IN_PROGRESS";
      throw error;
    }
    const result = await client.query(`
      DELETE FROM projects
      WHERE id = $1
      RETURNING id, name, repository
    `, [id]);
    if (result.rowCount === 0) {
      await client.query("COMMIT");
      return false;
    }
    const deleted = result.rows[0];
    await insertAuditEvent(client, {
      action: "project.deleted",
      resourceType: "project",
      resourceId: deleted.id,
      details: { name: deleted.name, repository: deleted.repository },
    });
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getRecentAuditEvents() {
  const result = await pool.query(`
    SELECT id, action, actor, resource_type, resource_id, details, created_at
    FROM audit_logs
    ORDER BY created_at DESC, id DESC
    LIMIT 100
  `);
  return result.rows.map((row) => ({
    id: row.id,
    action: row.action,
    actor: row.actor,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    details: row.details,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function createTask(task) {
  return taskStore.createTask(task);
}

export async function createServiceRestartTask(task) {
  return createTask({
    id: task.id,
    type: "service.restart",
    payload: { serviceId: task.serviceId, serviceName: task.serviceName },
  });
}

export async function createServiceScaleTask(task) {
  return createTask({
    id: task.id,
    type: "service.scale",
    payload: {
      serviceId: task.serviceId,
      serviceName: task.serviceName,
      desiredReplicas: task.desiredReplicas,
      originalReplicas: task.originalReplicas,
    },
  });
}

export async function createContainerOperationTask(task) {
  return createTask({
    id: task.id,
    type: "container.operation",
    payload: {
      serviceId: task.serviceId,
      serviceName: task.serviceName,
      containerId: task.containerId,
      containerName: task.containerName,
      action: task.action,
    },
  });
}

export async function createGiteaInstallTask(task) {
  return createTask({
    id: task.id,
    type: "application.gitea.install",
    payload: { domain: task.domain },
  });
}

export async function createN8nInstallTask(task) {
  return createTask({
    id: task.id,
    type: "application.n8n.install",
    payload: { domain: task.domain },
    maxAttempts: 1,
  });
}

export async function createPostgresqlInstallTask(task) {
  return createTask({
    id: task.id,
    type: "application.postgresql.install",
    payload: {},
    maxAttempts: 1,
  });
}

function mapApplicationCatalog(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    version: row.version,
    enabled: row.enabled,
    configurationSchema: row.configuration_schema,
    serviceManifest: row.service_manifest,
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapApplicationInstance(row) {
  return {
    id: row.id,
    applicationId: row.application_id,
    serverNodeId: row.server_node_id,
    serverHostname: row.server_hostname,
    name: row.name,
    configuration: row.configuration,
    status: row.status,
    serviceId: row.service_id,
    deploymentTaskId: row.deployment_task_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getApplicationCatalog() {
  const result = await pool.query(`
    SELECT id, name, category, description, version, enabled, configuration_schema,
      service_manifest, updated_at
    FROM application_catalog
    WHERE enabled = true
    ORDER BY category, name
  `);
  return result.rows.map(mapApplicationCatalog);
}

export async function getApplicationInstances(applicationId) {
  const result = await pool.query(`
    SELECT id, application_id, server_node_id, server_hostname, name,
      configuration, status, service_id, deployment_task_id, created_at, updated_at
    FROM application_instances
    WHERE $1::text IS NULL OR application_id = $1
    ORDER BY server_hostname, id
  `, [applicationId]);
  return result.rows.map(mapApplicationInstance);
}

export async function createManualApplication({ application, instance, task }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const catalog = await client.query(`
      INSERT INTO application_catalog (
        id, name, category, description, version, enabled, configuration_schema, service_manifest
      )
      VALUES ($1, $2, $3, $4, $5, true, $6::jsonb, $7::jsonb)
      RETURNING id, name, category, description, version, enabled,
        configuration_schema, service_manifest, updated_at
    `, [
      application.id,
      application.name,
      application.category,
      application.description,
      application.version,
      JSON.stringify({
        environment: application.environment,
        secretNames: Object.keys(instance.secretValues).sort(),
      }),
      JSON.stringify({
        manual: true,
        image: application.image,
        port: application.port,
        volumeTarget: application.volumeTarget || null,
        domain: instance.domain,
      }),
    ]);
    const savedInstance = await client.query(`
      INSERT INTO application_instances (
        id, application_id, server_node_id, server_hostname, name,
        configuration, status, deployment_task_id
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'installing', $7)
      RETURNING id, application_id, server_node_id, server_hostname, name,
        configuration, status, service_id, deployment_task_id, created_at, updated_at
    `, [
      instance.id,
      application.id,
      instance.serverNodeId,
      instance.serverHostname,
      application.name,
      JSON.stringify({
        domain: instance.domain,
        port: application.port,
        volumeTarget: application.volumeTarget || null,
        environment: instance.environmentValues,
        secretNames: Object.keys(instance.secretValues).sort(),
      }),
      task.id,
    ]);
    await client.query("COMMIT");
    return {
      application: mapApplicationCatalog(catalog.rows[0]),
      instance: mapApplicationInstance(savedInstance.rows[0]),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateManualApplicationDeployment(instanceId, taskId, { status, serviceId = null }) {
  const result = await pool.query(`
    UPDATE application_instances
    SET status = $3, service_id = $4, updated_at = now()
    WHERE id = $1 AND deployment_task_id = $2
    RETURNING id
  `, [instanceId, taskId, status, serviceId]);
  return result.rowCount === 1;
}

export async function createManualApplicationDeployTask(task) {
  return createTask({
    id: task.id,
    type: "application.custom.deploy",
    payload: {
      instanceId: task.instanceId,
      applicationId: task.applicationId,
      applicationName: task.applicationName,
    },
    maxAttempts: 1,
  });
}

export async function saveApplicationInstanceConfiguration(instance) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (instance.applicationId === "supabase") {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["application.supabase.domains"]);
      const conflictingDomain = await client.query(`
        SELECT id FROM application_instances
        WHERE application_id = 'supabase'
          AND server_node_id <> $1
          AND (
            lower(configuration->>'apiDomain') = ANY($2::text[])
            OR lower(configuration->>'studioDomain') = ANY($2::text[])
          )
        LIMIT 1
      `, [
        instance.serverNodeId,
        [instance.configuration.apiDomain, instance.configuration.studioDomain].map((domain) => domain.toLowerCase()),
      ]);
      if (conflictingDomain.rowCount > 0) {
        const conflict = new Error("One of the requested Supabase domains is already assigned.");
        conflict.code = "APPLICATION_DOMAIN_CONFLICT";
        throw conflict;
      }
    }
    const result = await client.query(`
      INSERT INTO application_instances (
        application_id, server_node_id, server_hostname, name, configuration, status
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, 'configured')
      ON CONFLICT (application_id, server_node_id) DO UPDATE
      SET server_hostname = EXCLUDED.server_hostname,
          name = EXCLUDED.name,
          configuration = EXCLUDED.configuration,
          status = CASE
            WHEN application_instances.status = 'installed' THEN 'installed'
            ELSE 'configured'
          END,
          updated_at = now()
      RETURNING id, application_id, server_node_id, server_hostname, name,
        configuration, status, created_at, updated_at
    `, [
      instance.applicationId,
      instance.serverNodeId,
      instance.serverHostname,
      instance.name,
      JSON.stringify(instance.configuration),
    ]);
    const saved = mapApplicationInstance(result.rows[0]);
    await insertAuditEvent(client, {
      action: "application.instance.configuration.saved",
      resourceType: "application_instance",
      resourceId: saved.id,
      details: {
        applicationId: saved.applicationId,
        serverNodeId: saved.serverNodeId,
        serverHostname: saved.serverHostname,
        name: saved.name,
      },
    });
    await client.query("COMMIT");
    return saved;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createRegistryConfigureTask(task) {
  return createTask({
    id: task.id,
    type: "registry.configure",
    payload: { domain: task.domain, username: task.username },
    maxAttempts: 1,
  });
}

export async function createCloudflareTunnelConfigureTask(task) {
  return createTask({
    id: task.id,
    type: "cloudflare.tunnel.configure",
    payload: { tunnelId: task.tunnelId, tunnelName: task.tunnelName },
    maxAttempts: 1,
  });
}

export async function createSwarmNodeEnrollTask(task) {
  return createTask({
    id: task.id,
    type: "swarm.node.enroll",
    payload: {
      address: task.address,
      sshUser: task.sshUser,
      sshPort: task.sshPort,
      hostFingerprint: task.hostFingerprint,
      privateCidr: task.privateCidr,
      managerAddress: task.managerAddress,
      role: task.role,
    },
    maxAttempts: 1,
  });
}

export async function createProjectBuildTask(task) {
  const sourceType = task.sourceType ?? "github";
  return createTask({
    id: task.id,
    type: "project.build",
    payload: {
      projectId: task.projectId,
      projectName: task.projectName,
      sourceType,
      ...(sourceType === "github"
        ? { repository: task.repository, branch: task.branch }
        : { sourceDigest: task.sourceDigest }),
      ...(task.commitSha ? { commitSha: task.commitSha } : {}),
    },
    maxAttempts: 1,
  });
}

export async function createProjectDeployTask(task) {
  return createTask({
    id: task.id,
    type: "project.deploy",
    payload: {
      projectId: task.projectId,
      projectName: task.projectName,
      commitSha: task.commitSha,
    },
    maxAttempts: 1,
  });
}

export async function createProjectUndeployTask(task) {
  return createTask({
    id: task.id,
    type: "project.undeploy",
    payload: {
      projectId: task.projectId,
      projectName: task.projectName,
    },
    maxAttempts: 1,
  });
}

export async function getLatestProjectBuilds(projectIds) {
  return taskStore.getLatestProjectBuilds(projectIds);
}

export async function getRecentProjectDeployments(projectIds) {
  return taskStore.getRecentProjectDeployments(projectIds);
}

export async function claimNextTask(workerId, leaseSeconds) {
  return taskStore.claimNextTask(workerId, leaseSeconds);
}

export async function renewTaskLease(id, workerId, leaseSeconds) {
  return taskStore.renewTaskLease(id, workerId, leaseSeconds);
}

export async function completeTask(id, workerId, result) {
  return taskStore.completeTask(id, workerId, result);
}

export async function failTask(id, workerId, message, retryable) {
  return taskStore.failTask(id, workerId, message, retryable);
}

export async function getRecentTasks(limit = 50) {
  return taskStore.listRecentTasks(limit);
}

export async function getTaskById(id) {
  return taskStore.getTaskById(id);
}

export async function getLatestTaskByType(type) {
  return taskStore.getLatestTaskByType(type);
}

export async function getBackupIntervalHours() {
  const result = await pool.query(
    "SELECT value FROM server_settings WHERE key = $1",
    ["backup_interval_hours"],
  );
  const intervalHours = result.rows[0]?.value;
  if (!Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 168) {
    throw new Error("The backup interval in PostgreSQL is invalid.");
  }
  return intervalHours;
}

export async function updateBackupIntervalHours(intervalHours) {
  if (!Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 168) {
    throw new RangeError("The backup interval must be between 1 and 168 hours.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO server_settings (key, value)
       VALUES ($1, to_jsonb($2::integer))
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = now()`,
      ["backup_interval_hours", intervalHours],
    );
    await insertAuditEvent(client, {
      action: "backup.schedule.updated",
      resourceType: "setting",
      resourceId: "backup_interval_hours",
      details: { intervalHours },
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return intervalHours;
}

export async function getMetricAlertThresholds() {
  const result = await pool.query(
    "SELECT value FROM server_settings WHERE key = $1",
    ["metrics_alert_thresholds"],
  );
  const thresholds = result.rows[0]?.value;
  if (!Number.isInteger(thresholds?.cpuPercent)
    || thresholds.cpuPercent < 1
    || thresholds.cpuPercent > 10000
    || !Number.isInteger(thresholds?.memoryPercent)
    || thresholds.memoryPercent < 1
    || thresholds.memoryPercent > 100
    || !Number.isInteger(thresholds?.diskFreePercent)
    || thresholds.diskFreePercent < 1
    || thresholds.diskFreePercent > 99
    || !Number.isInteger(thresholds?.restartCount)
    || thresholds.restartCount < 1
    || thresholds.restartCount > 100
    || !Number.isInteger(thresholds?.restartWindowMinutes)
    || thresholds.restartWindowMinutes < 5
    || thresholds.restartWindowMinutes > 1440
    || !Number.isInteger(thresholds?.certificateWarningDays)
    || thresholds.certificateWarningDays < 1
    || thresholds.certificateWarningDays > 90
    || !Number.isInteger(thresholds?.httpTimeoutSeconds)
    || thresholds.httpTimeoutSeconds < 1
    || thresholds.httpTimeoutSeconds > 30) {
    throw new Error("The metric alert thresholds in PostgreSQL are invalid.");
  }
  return thresholds;
}

export async function updateMetricAlertThresholds(thresholds) {
  if (!Number.isInteger(thresholds.cpuPercent)
    || thresholds.cpuPercent < 1
    || thresholds.cpuPercent > 10000
    || !Number.isInteger(thresholds.memoryPercent)
    || thresholds.memoryPercent < 1
    || thresholds.memoryPercent > 100
    || !Number.isInteger(thresholds.diskFreePercent)
    || thresholds.diskFreePercent < 1
    || thresholds.diskFreePercent > 99
    || !Number.isInteger(thresholds.restartCount)
    || thresholds.restartCount < 1
    || thresholds.restartCount > 100
    || !Number.isInteger(thresholds.restartWindowMinutes)
    || thresholds.restartWindowMinutes < 5
    || thresholds.restartWindowMinutes > 1440
    || !Number.isInteger(thresholds.certificateWarningDays)
    || thresholds.certificateWarningDays < 1
    || thresholds.certificateWarningDays > 90
    || !Number.isInteger(thresholds.httpTimeoutSeconds)
    || thresholds.httpTimeoutSeconds < 1
    || thresholds.httpTimeoutSeconds > 30) {
    throw new RangeError("Metric alert thresholds are outside the allowed range.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO server_settings (key, value)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = now()`,
      ["metrics_alert_thresholds", JSON.stringify(thresholds)],
    );
    await insertAuditEvent(client, {
      action: "metrics.alert_thresholds.updated",
      resourceType: "setting",
      resourceId: "metrics_alert_thresholds",
      details: thresholds,
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return thresholds;
}

export async function saveContainerRestartSamples(samples) {
  const client = await pool.connect();
  const sampledAt = new Date();
  try {
    await client.query("BEGIN");
    for (let offset = 0; offset < samples.length; offset += 300) {
      const batch = samples.slice(offset, offset + 300);
      const values = [];
      const placeholders = batch.map((sample, index) => {
        const base = index * 5;
        values.push(sampledAt, sample.id, sample.name, sample.group, sample.restartCount);
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
      });
      await client.query(
        `INSERT INTO container_restart_samples
          (sampled_at, container_id, container_name, group_name, restart_count)
         VALUES ${placeholders.join(", ")}
         ON CONFLICT (sampled_at, container_id) DO NOTHING`,
        values,
      );
    }
    await client.query(
      "DELETE FROM container_restart_samples WHERE sampled_at < now() - INTERVAL '7 days'",
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function saveContainerMetrics(metrics) {
  const client = await pool.connect();
  const sampledAt = new Date();
  try {
    await client.query("BEGIN");
    for (let offset = 0; offset < metrics.length; offset += 200) {
      const batch = metrics.slice(offset, offset + 200);
      const values = [];
      const placeholders = batch.map((metric, index) => {
        const base = index * 7;
        values.push(
          sampledAt,
          metric.id,
          metric.name,
          metric.group,
          metric.cpuPercent,
          metric.memoryUsageBytes,
          metric.memoryLimitBytes,
        );
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
      });
      await client.query(
        `INSERT INTO container_metrics
          (sampled_at, container_id, container_name, group_name, cpu_percent, memory_usage_bytes, memory_limit_bytes)
         VALUES ${placeholders.join(", ")}
         ON CONFLICT (sampled_at, container_id) DO NOTHING`,
        values,
      );
    }
    await client.query("DELETE FROM container_metrics WHERE sampled_at < now() - INTERVAL '7 days'");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getContainerMetricsHistory() {
  const result = await pool.query(`
    SELECT
      sampled_at,
      group_name,
      SUM(cpu_percent)::double precision AS cpu_percent,
      SUM(memory_usage_bytes)::bigint AS memory_usage_bytes
    FROM container_metrics
    WHERE sampled_at >= now() - INTERVAL '24 hours'
    GROUP BY sampled_at, group_name
    ORDER BY sampled_at, group_name
  `);
  return result.rows.map((row) => ({
    sampledAt: row.sampled_at.toISOString(),
    group: row.group_name,
    cpuPercent: Number(row.cpu_percent),
    memoryUsageBytes: Number(row.memory_usage_bytes),
  }));
}

export async function getContainerMetricAlerts() {
  const [thresholds, intervalMinutes] = await Promise.all([
    getMetricAlertThresholds(),
    getMetricsSamplingIntervalMinutes(),
  ]);
  const freshnessMinutes = Math.min(7 * 24 * 60, intervalMinutes * 3);
  const result = await pool.query(`
    SELECT container_id, container_name, group_name, sampled_at,
      cpu_percent, memory_usage_bytes, memory_limit_bytes
    FROM (
      SELECT container_id, container_name, group_name, sampled_at,
        cpu_percent, memory_usage_bytes, memory_limit_bytes,
        ROW_NUMBER() OVER (PARTITION BY container_id ORDER BY sampled_at DESC) AS sample_number
      FROM container_metrics
      WHERE sampled_at >= now() - ($1::double precision * INTERVAL '1 minute')
    ) recent
    WHERE sample_number <= 2
    ORDER BY container_id, sampled_at DESC
  `, [freshnessMinutes]);
  return evaluateContainerMetricAlerts(result.rows, thresholds);
}

async function getContainerRestartAlerts(thresholds) {
  const intervalMinutes = await getMetricsSamplingIntervalMinutes();
  const lookbackMinutes = Math.min(7 * 24 * 60, thresholds.restartWindowMinutes + intervalMinutes);
  const result = await pool.query(`
    WITH recent AS (
      SELECT sampled_at, container_id, container_name, restart_count,
        LAG(restart_count) OVER (PARTITION BY container_id ORDER BY sampled_at) AS previous_count
      FROM container_restart_samples
      WHERE sampled_at >= now() - ($1::double precision * INTERVAL '1 minute')
    )
    SELECT container_id, container_name, group_name,
      SUM(GREATEST(restart_count - previous_count, 0))::integer AS restart_count,
      MAX(sampled_at) AS sampled_at
    FROM recent
    WHERE sampled_at >= now() - ($2::double precision * INTERVAL '1 minute')
      AND previous_count IS NOT NULL
    GROUP BY container_id, container_name, group_name
    HAVING SUM(GREATEST(restart_count - previous_count, 0)) >= $3
    ORDER BY container_name
  `, [lookbackMinutes, thresholds.restartWindowMinutes, thresholds.restartCount]);
  return result.rows.map((row) => ({
    id: row.container_id,
    name: row.container_name,
    group: row.group_name,
    restartCount: Number(row.restart_count),
  }));
}

export async function getOperationalAlerts(disk, services) {
  const thresholds = await getMetricAlertThresholds();
  const restarts = await getContainerRestartAlerts(thresholds);
  return evaluateOperationalAlerts({ disk, services, restarts, thresholds });
}
