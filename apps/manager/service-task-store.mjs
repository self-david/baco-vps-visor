import { randomUUID } from "node:crypto";
import { validateSwarmNodeRequest } from "./swarm-node-manager.mjs";

const taskTypePattern = /^[a-z][a-z0-9._-]{0,99}$/;
const serviceIdPattern = /^[a-z0-9]{25,64}$/i;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const defaultMaxAttempts = 5;

function mapTask(row, { includePayload = false } = {}) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    ...(includePayload ? { payload: row.payload } : {}),
    ...(row.type === "service.restart"
      ? { serviceId: row.payload.serviceId, serviceName: row.payload.serviceName }
      : {}),
    ...(row.type === "service.scale"
      ? {
        serviceId: row.payload.serviceId,
        serviceName: row.payload.serviceName,
        desiredReplicas: row.payload.desiredReplicas,
        originalReplicas: row.payload.originalReplicas,
      }
      : {}),
    ...(row.type === "container.operation"
      ? {
        serviceId: row.payload.serviceId,
        serviceName: row.payload.serviceName,
        containerId: row.payload.containerId,
        containerName: row.payload.containerName,
        containerAction: row.payload.action,
      }
      : {}),
    ...(row.type === "application.gitea.install" ? { domain: row.payload.domain } : {}),
    ...(row.type === "application.n8n.install" ? { domain: row.payload.domain } : {}),
    ...(row.type === "application.custom.deploy"
      ? {
        applicationId: row.payload.applicationId,
        applicationName: row.payload.applicationName,
      }
      : {}),
    ...(row.type === "registry.configure"
      ? { domain: row.payload.domain, username: row.payload.username }
      : {}),
    ...(row.type === "swarm.node.enroll"
      ? {
        nodeAddress: row.payload.address,
        nodeRole: row.payload.role,
      }
      : {}),
    ...(row.type === "project.build"
      ? {
        projectId: row.payload.projectId,
        projectName: row.payload.projectName,
        repository: row.payload.repository,
        branch: row.payload.branch,
      }
      : {}),
    ...(row.type === "project.push-deploy"
      ? {
        projectId: row.payload.projectId,
        projectName: row.payload.projectName,
        repository: row.payload.repository,
        branch: row.payload.branch,
        commitSha: row.payload.commitSha,
      }
      : {}),
    ...(row.type === "project.deploy" || row.type === "project.undeploy"
      || row.type === "project.push-deploy"
      ? {
        projectId: row.payload.projectId,
        projectName: row.payload.projectName,
        ...(row.type === "project.deploy" || row.type === "project.push-deploy"
          ? { commitSha: row.payload.commitSha }
          : {}),
      }
      : {}),
    result: typeof row.result?.message === "string"
      ? {
        message: row.result.message,
        ...(row.type === "application.gitea.install" && row.result.credentialsAvailable === true
          ? {
            url: row.result.url,
            credentialsAvailable: true,
          }
          : {}),
        ...(row.type === "application.n8n.install" && typeof row.result.url === "string"
          ? { url: row.result.url }
          : {}),
        ...(row.type === "application.postgresql.install" && row.result.credentialsAvailable === true
          ? { credentialsAvailable: true }
          : {}),
        ...(row.type === "application.custom.deploy" && typeof row.result.serviceId === "string"
          ? { serviceId: row.result.serviceId }
          : {}),
        ...(row.type === "project.build" && typeof row.result.image === "string"
          ? {
            image: row.result.image,
            commitSha: row.result.commitSha,
            branch: row.result.branch,
          }
          : {}),
        ...(row.type === "project.push-deploy" && typeof row.result.image === "string"
          ? {
            image: row.result.image,
            commitSha: row.result.commitSha,
            serviceId: row.result.serviceId,
          }
          : {}),
        ...(row.type === "project.deploy" && typeof row.result.image === "string"
          ? {
            image: row.result.image,
            commitSha: row.result.commitSha,
            serviceId: row.result.serviceId,
          }
          : {}),
        ...(row.type === "registry.configure" && typeof row.result.domain === "string"
          ? { domain: row.result.domain }
          : {}),
        ...(row.type === "swarm.node.enroll" && typeof row.result.nodeId === "string"
          ? { nodeId: row.result.nodeId, nodeAddress: row.result.nodeAddress }
          : {}),
      }
      : null,
    error: row.error,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    nextAttemptAt: row.next_attempt_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    startedAt: row.started_at?.toISOString() ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
  };
}

function validateTask({ id, type, payload, maxAttempts }) {
  if (typeof id !== "string" || !uuidPattern.test(id)
    || typeof type !== "string" || !taskTypePattern.test(type)
    || !payload || typeof payload !== "object" || Array.isArray(payload)
    || !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
    throw new TypeError("Task fields are invalid.");
  }
  if (type === "service.restart"
    && (typeof payload.serviceId !== "string" || !serviceIdPattern.test(payload.serviceId)
      || typeof payload.serviceName !== "string" || payload.serviceName.length < 1 || payload.serviceName.length > 255)) {
    throw new TypeError("Service restart task fields are invalid.");
  }
  if (type === "service.scale"
    && (typeof payload.serviceId !== "string" || !serviceIdPattern.test(payload.serviceId)
      || typeof payload.serviceName !== "string" || payload.serviceName.length < 1 || payload.serviceName.length > 255
      || !Number.isInteger(payload.desiredReplicas) || payload.desiredReplicas < 1 || payload.desiredReplicas > 100
      || !Number.isInteger(payload.originalReplicas) || payload.originalReplicas < 0 || payload.originalReplicas > 10000)) {
    throw new TypeError("Service scale task fields are invalid.");
  }
  if (type === "container.operation"
    && (Object.keys(payload).sort().join(",")
      !== ["action", "containerId", "containerName", "serviceId", "serviceName"].sort().join(",")
      || typeof payload.serviceId !== "string" || !serviceIdPattern.test(payload.serviceId)
      || typeof payload.serviceName !== "string" || payload.serviceName.length < 1 || payload.serviceName.length > 255
      || typeof payload.containerId !== "string" || !/^[a-f0-9]{12,64}$/i.test(payload.containerId)
      || typeof payload.containerName !== "string" || payload.containerName.length < 1 || payload.containerName.length > 255
      || !["stop", "restart"].includes(payload.action))) {
    throw new TypeError("Container operation task fields are invalid.");
  }
  if (type === "application.gitea.install"
    && (Object.keys(payload).length !== 1
      || typeof payload.domain !== "string"
      || (payload.domain !== "localhost"
        && (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(payload.domain)
          || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(payload.domain))))) {
    throw new TypeError("Gitea application installation task fields are invalid.");
  }
  if (type === "application.n8n.install"
    && (Object.keys(payload).length !== 1
      || typeof payload.domain !== "string"
      || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(payload.domain)
      || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(payload.domain))) {
    throw new TypeError("n8n application installation task fields are invalid.");
  }
  if (type === "application.postgresql.install" && Object.keys(payload).length !== 0) {
    throw new TypeError("PostgreSQL application installation task fields are invalid.");
  }
  if (type === "application.custom.deploy"
    && (Object.keys(payload).sort().join(",") !== ["applicationId", "applicationName", "instanceId"].sort().join(",")
      || typeof payload.applicationId !== "string"
      || !/^[a-z][a-z0-9-]{0,62}$/.test(payload.applicationId)
      || typeof payload.instanceId !== "string" || !uuidPattern.test(payload.instanceId)
      || typeof payload.applicationName !== "string"
      || payload.applicationName.trim() !== payload.applicationName
      || payload.applicationName.length < 1 || payload.applicationName.length > 100)) {
    throw new TypeError("Manual application deployment task fields are invalid.");
  }
  if (type === "registry.configure"
    && (Object.keys(payload).sort().join(",") !== ["domain", "username"].sort().join(",")
      || typeof payload.domain !== "string"
      || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(payload.domain)
      || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(payload.domain)
      || typeof payload.username !== "string" || !/^[A-Za-z0-9._-]{1,64}$/.test(payload.username))) {
    throw new TypeError("Private registry configuration task fields are invalid.");
  }
  if (type === "project.build"
    && (Object.keys(payload).sort().join(",") !== ["branch", "projectId", "projectName", "repository"].sort().join(",")
      || typeof payload.projectId !== "string" || !uuidPattern.test(payload.projectId)
      || typeof payload.projectName !== "string" || payload.projectName.length < 1 || payload.projectName.length > 100
      || typeof payload.repository !== "string"
      || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(payload.repository)
      || typeof payload.branch !== "string" || payload.branch.length < 1 || payload.branch.length > 255
      || /[\u0000-\u001f\u007f]/.test(payload.branch))) {
    throw new TypeError("Project image build task fields are invalid.");
  }
  if (type === "project.push-deploy"
    && (Object.keys(payload).sort().join(",")
      !== ["branch", "commitSha", "projectId", "projectName", "repository"].sort().join(",")
      || typeof payload.projectId !== "string" || !uuidPattern.test(payload.projectId)
      || typeof payload.projectName !== "string" || payload.projectName.length < 1 || payload.projectName.length > 100
      || typeof payload.repository !== "string"
      || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(payload.repository)
      || typeof payload.branch !== "string" || payload.branch.length < 1 || payload.branch.length > 255
      || /[\u0000-\u001f\u007f]/.test(payload.branch)
      || typeof payload.commitSha !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(payload.commitSha))) {
    throw new TypeError("Project push deployment task fields are invalid.");
  }
  if (type === "project.deploy"
    && (Object.keys(payload).sort().join(",") !== ["commitSha", "projectId", "projectName"].sort().join(",")
      || typeof payload.projectId !== "string" || !uuidPattern.test(payload.projectId)
      || typeof payload.projectName !== "string" || payload.projectName.length < 1 || payload.projectName.length > 100
      || typeof payload.commitSha !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(payload.commitSha))) {
    throw new TypeError("Project deployment task fields are invalid.");
  }
  if (type === "project.undeploy"
    && (Object.keys(payload).sort().join(",") !== ["projectId", "projectName"].sort().join(",")
      || typeof payload.projectId !== "string" || !uuidPattern.test(payload.projectId)
      || typeof payload.projectName !== "string" || payload.projectName.length < 1 || payload.projectName.length > 100)) {
    throw new TypeError("Project removal task fields are invalid.");
  }
  if (type === "swarm.node.enroll") {
    try {
      const validated = validateSwarmNodeRequest(payload);
      if (Object.keys(payload).length !== Object.keys(validated).length) {
        throw new TypeError("Swarm node enrollment task fields are invalid.");
      }
    } catch (error) {
      throw new TypeError("Swarm node enrollment task fields are invalid.", { cause: error });
    }
  }
}

export function createTaskStore({ pool, insertAuditEvent }) {
  if (!pool || typeof pool.connect !== "function" || typeof pool.query !== "function"
    || typeof insertAuditEvent !== "function") {
    throw new TypeError("The service task store requires a PostgreSQL pool and audit writer.");
  }

  async function createTask({ id, type, payload, maxAttempts = defaultMaxAttempts }) {
    validateTask({ id, type, payload, maxAttempts });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (type === "application.gitea.install"
        || type === "application.n8n.install"
        || type === "application.postgresql.install") {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [type]);
        const activeTask = await client.query(
          `SELECT id FROM tasks
           WHERE type = $1 AND status IN ('pending', 'in_progress')
           LIMIT 1`,
          [type],
        );
        if (activeTask.rowCount > 0) {
          const error = new Error("Ya hay una instalación de Gitea en curso.");
          error.code = "APPLICATION_TASK_IN_PROGRESS";
          throw error;
        }
      }
      if (type === "registry.configure") {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["registry.configure"]);
        const activeTask = await client.query(
          `SELECT id FROM tasks
           WHERE type = $1 AND status IN ('pending', 'in_progress')
           LIMIT 1`,
          [type],
        );
        if (activeTask.rowCount > 0) {
          const error = new Error("Ya hay una configuración del registro en curso.");
          error.code = "REGISTRY_CONFIGURATION_IN_PROGRESS";
          throw error;
        }
      }
      if (type === "swarm.node.enroll") {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["swarm.node.enroll"]);
        const activeTask = await client.query(
          `SELECT id FROM tasks
           WHERE type = $1 AND status IN ('pending', 'in_progress')
           LIMIT 1`,
          [type],
        );
        if (activeTask.rowCount > 0) {
          const error = new Error("Ya hay un alta de nodo Swarm en curso.");
          error.code = "SWARM_NODE_ENROLLMENT_IN_PROGRESS";
          throw error;
        }
      }
      if (type === "project.build" || type === "project.push-deploy") {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`project.build:${payload.projectId}`]);
        const activeTask = await client.query(
          `SELECT id FROM tasks
           WHERE type IN ('project.build', 'project.push-deploy')
             AND payload->>'projectId' = $1
             AND status IN ('pending', 'in_progress')
           LIMIT 1`,
          [payload.projectId],
        );
        if (activeTask.rowCount > 0) {
          const error = new Error("Ya hay una construcción en curso para este proyecto.");
          error.code = "PROJECT_BUILD_IN_PROGRESS";
          throw error;
        }
      }
      if (type === "project.deploy" || type === "project.undeploy" || type === "project.push-deploy") {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`project.deployment:${payload.projectId}`]);
        const activeTask = await client.query(
          `SELECT id FROM tasks
           WHERE type IN ('project.deploy', 'project.undeploy', 'project.push-deploy')
             AND payload->>'projectId' = $1
             AND status IN ('pending', 'in_progress')
           LIMIT 1`,
          [payload.projectId],
        );
        if (activeTask.rowCount > 0) {
          const error = new Error("Ya hay una operación de despliegue en curso para este proyecto.");
          error.code = "PROJECT_DEPLOYMENT_IN_PROGRESS";
          throw error;
        }
      }
      if (type === "project.build" || type === "project.deploy" || type === "project.undeploy"
        || type === "project.push-deploy") {
        const project = await client.query("SELECT id FROM projects WHERE id = $1 FOR KEY SHARE", [payload.projectId]);
        if (project.rowCount === 0) {
          const error = new Error("No se encontró el proyecto.");
          error.code = "PROJECT_NOT_FOUND";
          throw error;
        }
      }
      await client.query(
        `INSERT INTO tasks (id, type, status, payload, max_attempts)
         VALUES ($1, $2, 'pending', $3::jsonb, $4)`,
        [id, type, JSON.stringify(payload), maxAttempts],
      );
      await insertAuditEvent(client, {
        action: `${type}.requested`,
        resourceType: type.startsWith("service.") ? "service"
          : type.startsWith("project.") ? "project"
            : type === "swarm.node.enroll" ? "node"
              : "task",
        resourceId: type.startsWith("service.") ? payload.serviceId
          : type.startsWith("project.") ? payload.projectId
            : id,
        details: type.startsWith("service.")
          ? {
            serviceName: payload.serviceName,
            taskId: id,
            ...(type === "service.scale"
              ? {
                originalReplicas: payload.originalReplicas,
                desiredReplicas: payload.desiredReplicas,
              }
              : {}),
          }
          : type.startsWith("project.")
            ? {
              taskId: id,
              projectName: payload.projectName,
              ...(type === "project.build" ? { repository: payload.repository, branch: payload.branch } : {}),
              ...(type === "project.deploy" ? { commitSha: payload.commitSha } : {}),
              ...(type === "project.push-deploy"
                ? { repository: payload.repository, branch: payload.branch, commitSha: payload.commitSha }
                : {}),
            }
          : type === "swarm.node.enroll"
            ? {
              taskId: id,
              address: payload.address,
              role: payload.role,
            }
          : { type },
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function recordGiteaWebhookDelivery({ deliveryId, event, repository, ref, commitSha } = {}) {
    if (typeof deliveryId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(deliveryId)
      || event !== "push"
      || typeof repository !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(repository)
      || typeof ref !== "string" || !/^refs\/(?:heads|tags)\/[^\\\u0000-\u001f\u007f]+$/.test(ref)
      || typeof commitSha !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(commitSha)) {
      throw new TypeError("Gitea webhook delivery fields are invalid.");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(`
        INSERT INTO gitea_webhook_deliveries (delivery_id, event, repository, ref, commit_sha)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (delivery_id) DO NOTHING
        RETURNING delivery_id
      `, [deliveryId, event, repository, ref, commitSha]);
      if (inserted.rowCount !== 1) {
        await client.query("COMMIT");
        return false;
      }

      const branch = ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : null;
      const projects = branch
        ? await client.query(`
          SELECT id, name
          FROM projects
          WHERE repository = $1 AND production_branch = $2
          ORDER BY id
        `, [repository, branch])
        : { rows: [] };
      for (const candidate of projects.rows) {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`project.build:${candidate.id}`]);
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`project.deployment:${candidate.id}`]);
        const currentProject = await client.query(`
          SELECT id, name FROM projects
          WHERE id = $1 AND repository = $2 AND production_branch = $3
          FOR KEY SHARE
        `, [candidate.id, repository, branch]);
        if (currentProject.rowCount === 0) continue;
        const project = currentProject.rows[0];
        const id = randomUUID();
        const payload = { projectId: project.id, projectName: project.name, repository, branch, commitSha };
        validateTask({ id, type: "project.push-deploy", payload, maxAttempts: defaultMaxAttempts });
        await client.query(
          `INSERT INTO tasks (id, type, status, payload, max_attempts)
           VALUES ($1, 'project.push-deploy', 'pending', $2::jsonb, $3)`,
          [id, JSON.stringify(payload), defaultMaxAttempts],
        );
        await insertAuditEvent(client, {
          action: "project.push-deploy.requested",
          resourceType: "project",
          resourceId: project.id,
          details: { taskId: id, projectName: project.name, repository, branch, commitSha },
        });
      }
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function claimNextTask(workerId, leaseSeconds = 60) {
    if (!uuidPattern.test(workerId) || !Number.isInteger(leaseSeconds) || leaseSeconds < 5 || leaseSeconds > 300) {
      throw new TypeError("Task worker lease fields are invalid.");
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const exhausted = await client.query(
        `UPDATE tasks
         SET status = 'failed', error = 'La tarea agotó sus intentos durante una interrupción.',
             completed_at = now(), updated_at = now(),
             lease_token = NULL, lease_expires_at = NULL
         WHERE status = 'in_progress' AND lease_expires_at <= now() AND attempts >= max_attempts
         RETURNING id, type, attempts, max_attempts`,
      );
      for (const task of exhausted.rows) {
        await insertAuditEvent(client, {
          action: `${task.type}.failed`,
          resourceType: "task",
          resourceId: task.id,
          details: {
            error: "La tarea agotó sus intentos durante una interrupción.",
            attempts: task.attempts,
            maxAttempts: task.max_attempts,
          },
        });
      }
      const result = await client.query(
        `WITH next_task AS (
           SELECT id
           FROM tasks
           WHERE (status = 'pending' AND next_attempt_at <= now() AND attempts < max_attempts)
              OR (status = 'in_progress' AND lease_expires_at <= now() AND attempts < max_attempts)
           ORDER BY created_at, id
           FOR UPDATE SKIP LOCKED
           LIMIT 1
         )
         UPDATE tasks AS task
         SET status = 'in_progress',
             attempts = task.attempts + 1,
             started_at = COALESCE(task.started_at, now()),
             updated_at = now(),
             lease_token = $1,
             lease_expires_at = now() + ($2 * INTERVAL '1 second')
         FROM next_task
         WHERE task.id = next_task.id
         RETURNING task.id, task.type, task.status, task.payload, task.result, task.error,
           task.attempts, task.max_attempts, task.next_attempt_at, task.created_at,
           task.updated_at, task.started_at, task.completed_at`,
        [workerId, leaseSeconds],
      );
      await client.query("COMMIT");
      return result.rows[0] ? mapTask(result.rows[0], { includePayload: true }) : null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function renewTaskLease(id, workerId, leaseSeconds = 60) {
    const result = await pool.query(
      `UPDATE tasks
       SET lease_expires_at = now() + ($3 * INTERVAL '1 second'), updated_at = now()
       WHERE id = $1 AND status = 'in_progress' AND lease_token = $2`,
      [id, workerId, leaseSeconds],
    );
    return result.rowCount === 1;
  }

  async function completeTask(id, workerId, result) {
    if (!uuidPattern.test(id) || !uuidPattern.test(workerId)
      || !result || typeof result !== "object" || Array.isArray(result)) {
      throw new TypeError("Task completion fields are invalid.");
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query(
        `UPDATE tasks
         SET status = 'completed', result = $3::jsonb, error = NULL,
             completed_at = now(), updated_at = now(), next_attempt_at = now(),
             lease_token = NULL, lease_expires_at = NULL
         WHERE id = $1 AND status = 'in_progress' AND lease_token = $2
         RETURNING type`,
        [id, workerId, JSON.stringify(result)],
      );
      if (updated.rowCount === 1) {
        await insertAuditEvent(client, {
          action: `${updated.rows[0].type}.completed`,
          resourceType: "task",
          resourceId: id,
          details: {},
        });
      }
      await client.query("COMMIT");
      return updated.rowCount === 1;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function failTask(id, workerId, message, retryable = true) {
    if (!uuidPattern.test(id) || !uuidPattern.test(workerId)
      || typeof message !== "string" || message.length < 1 || message.length > 500
      || typeof retryable !== "boolean") {
      throw new TypeError("Task failure fields are invalid.");
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query(
        `UPDATE tasks
         SET status = CASE WHEN $3 AND attempts < max_attempts THEN 'pending' ELSE 'failed' END,
             error = $4,
             completed_at = CASE WHEN $3 AND attempts < max_attempts THEN NULL ELSE now() END,
             next_attempt_at = CASE
               WHEN $3 AND attempts < max_attempts
               THEN now() + LEAST(30, POWER(2, GREATEST(attempts - 1, 0)))::double precision * INTERVAL '1 second'
               ELSE now()
             END,
             lease_token = NULL, lease_expires_at = NULL, updated_at = now()
         WHERE id = $1 AND status = 'in_progress' AND lease_token = $2
         RETURNING type, status, attempts, max_attempts`,
        [id, workerId, retryable, message],
      );
      if (updated.rowCount === 1 && updated.rows[0].status === "failed") {
        await insertAuditEvent(client, {
          action: `${updated.rows[0].type}.failed`,
          resourceType: "task",
          resourceId: id,
          details: {
            error: message,
            attempts: updated.rows[0].attempts,
            maxAttempts: updated.rows[0].max_attempts,
          },
        });
      }
      await client.query("COMMIT");
      return updated.rows[0] ?? null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function listRecentTasks(limit = 50) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new RangeError("The task history limit must be between 1 and 100.");
    }
    const result = await pool.query(
      `SELECT id, type, status, payload, result, error, attempts, max_attempts, next_attempt_at,
         created_at, updated_at, started_at, completed_at
       FROM tasks
       ORDER BY created_at DESC, id DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => mapTask(row));
  }

  async function getTaskById(id) {
    if (typeof id !== "string" || !uuidPattern.test(id)) {
      throw new TypeError("The task identifier is invalid.");
    }
    const result = await pool.query(
      `SELECT id, type, status, payload, result, error, attempts, max_attempts, next_attempt_at,
         created_at, updated_at, started_at, completed_at
       FROM tasks WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? mapTask(result.rows[0]) : null;
  }

  async function getLatestTaskByType(type) {
    if (typeof type !== "string" || !taskTypePattern.test(type)) {
      throw new TypeError("The task type is invalid.");
    }
    const result = await pool.query(
      `SELECT id, type, status, payload, result, error, attempts, max_attempts, next_attempt_at,
         created_at, updated_at, started_at, completed_at
       FROM tasks WHERE type = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
      [type],
    );
    return result.rows[0] ? mapTask(result.rows[0]) : null;
  }

  async function getLatestProjectBuilds(projectIds) {
    if (!Array.isArray(projectIds) || projectIds.some((id) => typeof id !== "string" || !uuidPattern.test(id))) {
      throw new TypeError("The project identifiers are invalid.");
    }
    if (projectIds.length === 0) return [];
    const result = await pool.query(
      `SELECT DISTINCT ON (payload->>'projectId')
         id, type, status, payload, result, error, attempts, max_attempts, next_attempt_at,
         created_at, updated_at, started_at, completed_at
       FROM tasks
       WHERE type IN ('project.build', 'project.push-deploy')
         AND status = 'completed'
         AND payload->>'projectId' = ANY($1::text[])
         AND result->>'image' IS NOT NULL
         AND result->>'commitSha' IS NOT NULL
       ORDER BY payload->>'projectId', completed_at DESC, created_at DESC, id DESC`,
      [projectIds],
    );
    return result.rows.map((row) => mapTask(row));
  }

  async function getRecentProjectDeployments(projectIds) {
    if (!Array.isArray(projectIds) || projectIds.some((id) => typeof id !== "string" || !uuidPattern.test(id))) {
      throw new TypeError("The project identifiers are invalid.");
    }
    if (projectIds.length === 0) return [];
    const result = await pool.query(
      `SELECT DISTINCT ON (payload->>'projectId', result->>'commitSha')
         id, type, status, payload, result, error, attempts, max_attempts, next_attempt_at,
         created_at, updated_at, started_at, completed_at
       FROM tasks
       WHERE type IN ('project.deploy', 'project.push-deploy')
         AND status = 'completed'
         AND payload->>'projectId' = ANY($1::text[])
         AND result->>'image' IS NOT NULL
         AND result->>'commitSha' IS NOT NULL
       ORDER BY payload->>'projectId', result->>'commitSha', completed_at DESC, created_at DESC, id DESC`,
      [projectIds],
    );
    return result.rows.map((row) => mapTask(row));
  }

  return {
    createTask,
    claimNextTask,
    renewTaskLease,
    completeTask,
    failTask,
    listRecentTasks,
    getTaskById,
    getLatestTaskByType,
    getLatestProjectBuilds,
    getRecentProjectDeployments,
    recordGiteaWebhookDelivery,
  };
}
