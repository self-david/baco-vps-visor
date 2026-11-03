import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { evaluateContainerMetricAlerts } from "./metric-alerts.mjs";
import { evaluateOperationalAlerts } from "./operational-alerts.mjs";

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
