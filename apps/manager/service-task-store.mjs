const taskType = "service.restart";
const serviceIdPattern = /^[a-f0-9]{25,64}$/i;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const stateMapping = {
  running: "in_progress",
  succeeded: "completed",
  failed: "failed",
};

function mapTask(row) {
  return {
    id: row.id,
    type: taskType,
    status: row.status,
    serviceId: row.payload.serviceId,
    serviceName: row.payload.serviceName,
    result: row.result,
    error: row.error,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    startedAt: row.started_at?.toISOString() ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
  };
}

export function createServiceTaskStore({ pool, insertAuditEvent }) {
  if (!pool || typeof pool.connect !== "function" || typeof pool.query !== "function"
    || typeof insertAuditEvent !== "function") {
    throw new TypeError("The service task store requires a PostgreSQL pool and audit writer.");
  }

  async function createRestartTask({ id, serviceId, serviceName }) {
    if (typeof id !== "string" || !uuidPattern.test(id)
      || typeof serviceId !== "string" || !serviceIdPattern.test(serviceId)
      || typeof serviceName !== "string" || serviceName.length < 1 || serviceName.length > 255) {
      throw new TypeError("Service restart task fields are invalid.");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO tasks (id, type, status, payload)
         VALUES ($1, '${taskType}', 'pending', $2::jsonb)`,
        [id, JSON.stringify({ serviceId, serviceName })],
      );
      await insertAuditEvent(client, {
        action: "service.restart.requested",
        resourceType: "service",
        resourceId: serviceId,
        details: { serviceName, taskId: id },
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function updateRestartTask(id, state, message) {
    if (typeof id !== "string" || !uuidPattern.test(id)
      || !Object.hasOwn(stateMapping, state)
      || typeof message !== "string" || message.length > 500) {
      throw new TypeError("Service restart task status is invalid.");
    }
    const status = stateMapping[state];
    await pool.query(
      `UPDATE tasks
       SET status = $2,
           result = CASE WHEN $2 = 'completed' THEN $3::jsonb ELSE result END,
           error = CASE WHEN $2 = 'failed' THEN $4 ELSE NULL END,
           started_at = CASE WHEN $2 = 'in_progress' THEN COALESCE(started_at, now()) ELSE started_at END,
           completed_at = CASE WHEN $2 IN ('completed', 'failed') THEN COALESCE(completed_at, now()) ELSE completed_at END,
           updated_at = now()
       WHERE id = $1 AND type = '${taskType}' AND status NOT IN ('completed', 'failed')`,
      [
        id,
        status,
        JSON.stringify({ message }),
        state === "failed" ? message : null,
      ],
    );
  }

  async function listRecentRestartTasks(limit = 50) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new RangeError("The task history limit must be between 1 and 100.");
    }
    const result = await pool.query(
      `SELECT id, status, payload, result, error, created_at, updated_at, started_at, completed_at
       FROM tasks
       WHERE type = '${taskType}'
       ORDER BY created_at DESC, id DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map(mapTask);
  }

  return { createRestartTask, updateRestartTask, listRecentRestartTasks };
}
