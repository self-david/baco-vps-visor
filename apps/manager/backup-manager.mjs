import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { spawn } from "node:child_process";
import {
  chmod,
  mkdtemp,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  unlink,
} from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

const magic = Buffer.from("VPSMGRBK1\0", "ascii");
const ivLength = 12;
const tagLength = 16;
const backupIdPattern = /^\d{13}-[a-f0-9]{24}$/;
const backupFilePattern = /^vps-manager-db-(\d{13}-[a-f0-9]{24})\.vpsbackup$/;
const retentionDays = 7;

function assertBackupId(id) {
  if (typeof id !== "string" || !backupIdPattern.test(id)) {
    throw new Error("The requested backup identifier is invalid.");
  }
}

async function loadKey(keyFile) {
  const contents = (await readFile(keyFile, "utf8")).trim();
  if (!/^[a-f0-9]{64}$/i.test(contents)) {
    throw new Error("The backup encryption secret must contain 32 bytes encoded as hex.");
  }
  return Buffer.from(contents, "hex");
}

function databaseEnvironment(environment, password) {
  return {
    ...environment,
    PGPASSWORD: password,
    PGHOST: environment.DATABASE_HOST ?? "postgres",
    PGPORT: environment.DATABASE_PORT ?? "5432",
    PGUSER: environment.DATABASE_USER ?? "vps_manager",
    PGDATABASE: environment.DATABASE_NAME ?? "vps_manager",
  };
}

function runCommand(command, args, environment, spawnCommand) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(command, args, {
      env: environment,
      stdio: ["ignore", "ignore", "pipe"],
    });
    const errors = [];
    let errorLength = 0;
    child.stderr.on("data", (chunk) => {
      if (errorLength >= 4096) return;
      const remaining = 4096 - errorLength;
      const retained = chunk.subarray(0, remaining);
      errors.push(retained);
      errorLength += retained.length;
    });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const details = Buffer.concat(errors).toString("utf8").trim();
      reject(new Error(
        `${command} failed${signal ? ` (${signal})` : ` with code ${code}`}${details ? `: ${details}` : "."}`,
      ));
    });
  });
}

export function createBackupManager({
  directory = process.env.BACKUP_DIRECTORY ?? "/var/backups/vps-manager",
  keyFile = process.env.BACKUP_KEY_FILE ?? "/run/secrets/backup_key",
  databasePasswordFile = process.env.DATABASE_PASSWORD_FILE ?? "/run/secrets/postgres_password",
  environment = process.env,
  spawnCommand = spawn,
  now = () => new Date(),
  randomBytesFunction = randomBytes,
} = {}) {
  let operationRunning = false;

  async function ensureDirectory() {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
  }

  async function withOperation(operation) {
    if (operationRunning) throw new Error("Another backup operation is already running.");
    operationRunning = true;
    try {
      return await operation();
    } finally {
      operationRunning = false;
    }
  }

  async function list() {
    await ensureDirectory();
    const files = await readdir(directory, { withFileTypes: true });
    const backups = [];
    for (const file of files) {
      const match = file.name.match(backupFilePattern);
      if (!match || !file.isFile()) continue;
      const path = join(directory, file.name);
      const details = await stat(path);
      backups.push({
        id: match[1],
        createdAt: new Date(Number(match[1].slice(0, 13))).toISOString(),
        sizeBytes: details.size,
      });
    }
    return backups.sort((left, right) => right.id.localeCompare(left.id));
  }

  async function prune() {
    const cutoff = now().getTime() - retentionDays * 24 * 60 * 60 * 1000;
    const files = await readdir(directory, { withFileTypes: true });
    for (const file of files) {
      const match = file.name.match(backupFilePattern);
      if (!match || !file.isFile()) continue;
      if (Number(match[1].slice(0, 13)) < cutoff) {
        await unlink(join(directory, file.name));
      }
    }
  }

  async function create() {
    return withOperation(async () => {
      await ensureDirectory();
      const [key, databasePassword] = await Promise.all([
        loadKey(keyFile),
        readFile(databasePasswordFile, "utf8"),
      ]);
      if (!databasePassword.trim()) throw new Error("The PostgreSQL password secret is empty.");

      const timestamp = now().getTime();
      const id = `${timestamp}-${randomBytesFunction(12).toString("hex")}`;
      const filePath = join(directory, `vps-manager-db-${id}.vpsbackup`);
      const temporaryPath = `${filePath}.partial`;
      const iv = randomBytesFunction(ivLength);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const output = createWriteStream(temporaryPath, { flags: "wx", mode: 0o600 });
      output.write(Buffer.concat([magic, iv]));
      let completed = false;

      try {
        const child = spawnCommand("pg_dump", [
          "--format=custom",
          "--no-owner",
          "--no-acl",
          `--host=${environment.DATABASE_HOST ?? "postgres"}`,
          `--port=${environment.DATABASE_PORT ?? "5432"}`,
          `--username=${environment.DATABASE_USER ?? "vps_manager"}`,
          `--dbname=${environment.DATABASE_NAME ?? "vps_manager"}`,
        ], {
          env: databaseEnvironment(environment, databasePassword.trim()),
          stdio: ["ignore", "pipe", "pipe"],
        });
        const errors = [];
        let errorLength = 0;
        child.stderr.on("data", (chunk) => {
          if (errorLength >= 4096) return;
          const retained = chunk.subarray(0, 4096 - errorLength);
          errors.push(retained);
          errorLength += retained.length;
        });
        const childResult = new Promise((resolve, reject) => {
          child.once("error", reject);
          child.once("close", (code, signal) => {
            if (code === 0) {
              resolve();
              return;
            }
            const details = Buffer.concat(errors).toString("utf8").trim();
            reject(new Error(
              `pg_dump failed${signal ? ` (${signal})` : ` with code ${code}`}${details ? `: ${details}` : "."}`,
            ));
          });
        });
        await Promise.all([pipeline(child.stdout, cipher, output), childResult]);
        const handle = await open(temporaryPath, "a");
        try {
          await handle.write(cipher.getAuthTag());
          await handle.sync();
        } finally {
          await handle.close();
        }
        await rename(temporaryPath, filePath);
        completed = true;
        await prune();
        const details = await stat(filePath);
        return {
          id,
          createdAt: new Date(timestamp).toISOString(),
          sizeBytes: details.size,
        };
      } finally {
        if (!completed) {
          output.destroy();
          await rm(temporaryPath, { force: true });
        }
      }
    });
  }

  async function restore(id) {
    assertBackupId(id);
    return withOperation(async () => {
      await ensureDirectory();
      const [key, databasePassword] = await Promise.all([
        loadKey(keyFile),
        readFile(databasePasswordFile, "utf8"),
      ]);
      if (!databasePassword.trim()) throw new Error("The PostgreSQL password secret is empty.");
      const filePath = join(directory, `vps-manager-db-${id}.vpsbackup`);
      const details = await stat(filePath);
      const headerLength = magic.length + ivLength;
      if (!details.isFile() || details.size < headerLength + tagLength + 1) {
        throw new Error("The selected backup is missing or invalid.");
      }
      const handle = await open(filePath, "r");
      const header = Buffer.alloc(headerLength);
      const tag = Buffer.alloc(tagLength);
      try {
        await handle.read(header, 0, header.length, 0);
        await handle.read(tag, 0, tag.length, details.size - tagLength);
      } finally {
        await handle.close();
      }
      if (!header.subarray(0, magic.length).equals(magic)) {
        throw new Error("The selected backup has an unsupported or invalid format.");
      }

      const temporaryDirectory = await mkdtemp(join(tmpdir(), "vps-manager-restore-"));
      const dumpPath = join(temporaryDirectory, "database.dump");
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        header.subarray(magic.length),
      );
      decipher.setAuthTag(tag);
      try {
        await pipeline(
          createReadStream(filePath, {
            start: headerLength,
            end: details.size - tagLength - 1,
          }),
          decipher,
          createWriteStream(dumpPath, { flags: "wx", mode: 0o600 }),
        );
        await runCommand("pg_restore", [
          "--clean",
          "--if-exists",
          "--no-owner",
          "--no-acl",
          "--exit-on-error",
          "--single-transaction",
          `--host=${environment.DATABASE_HOST ?? "postgres"}`,
          `--port=${environment.DATABASE_PORT ?? "5432"}`,
          `--username=${environment.DATABASE_USER ?? "vps_manager"}`,
          `--dbname=${environment.DATABASE_NAME ?? "vps_manager"}`,
          dumpPath,
        ], databaseEnvironment(environment, databasePassword.trim()), spawnCommand);
      } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
      return { id, restoredAt: now().toISOString() };
    });
  }

  return {
    list,
    create,
    restore,
    retentionDays,
  };
}
