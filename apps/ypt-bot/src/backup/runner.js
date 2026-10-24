import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger.js";
import { assertConfig, resolveConfig } from "./config.js";
import { buildObjectName, selectExpiredObjects } from "./retention.js";

const MAX_CAPTURED_OUTPUT = 5 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const DELETE_BATCH_SIZE = 100;
const LIST_PAGE_SIZE = 100;

/**
 * Spawns a command and captures bounded stdout/stderr.
 * @param {string} command
 * @param {string[]} args
 * @param {{ env?: NodeJS.ProcessEnv, timeoutMs?: number }} [options]
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
export function runCommand(command, args, options = {}) {
   return new Promise((resolvePromise, reject) => {
      const child = spawn(command, args, {
         env: options.env || process.env,
         stdio: ["ignore", "pipe", "pipe"],
         timeout: options.timeoutMs || 30 * 60 * 1000,
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const append = (current, chunk) => {
         const next = current + chunk.toString();
         return next.length > MAX_CAPTURED_OUTPUT
            ? next.slice(-MAX_CAPTURED_OUTPUT)
            : next;
      };

      child.stdout.on("data", (chunk) => {
         stdout = append(stdout, chunk);
      });
      child.stderr.on("data", (chunk) => {
         stderr = append(stderr, chunk);
      });

      child.once("error", (error) => {
         if (settled) return;
         settled = true;
         reject(error);
      });

      child.once("close", (code, signal) => {
         if (settled) return;
         settled = true;
         if (code === 0) {
            resolvePromise({ stdout, stderr });
            return;
         }
         const detail = stderr.trim().slice(-2000);
         const outcome = signal
            ? `was terminated by ${signal}`
            : `exited with code ${code}`;
         reject(
            new Error(`${command} ${outcome}${detail ? `: ${detail}` : ""}`)
         );
      });
   });
}

/**
 * Extracts the major version from `pg_dump --version` / `pg_restore --version`.
 * @param {string} output
 * @returns {number|null}
 */
export function pgClientMajor(output) {
   const text = String(output || "");
   const match =
      text.match(/PostgreSQL\)\s+(\d+)/i) || text.match(/(\d+)\.\d+/);
   return match ? Number(match[1]) : null;
}

/**
 * Converts `SHOW server_version_num` (e.g. 170004) into a major version.
 * @param {string|number} value
 * @returns {number|null}
 */
export function serverMajorFromVersionNum(value) {
   const parsed = Number(String(value || "").trim());
   if (!Number.isFinite(parsed) || parsed <= 0) return null;
   return Math.floor(parsed / 10000);
}

export function createBucketClient(config) {
   const client = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: {
         persistSession: false,
         autoRefreshToken: false,
      },
   });
   const bucket = client.storage.from(config.bucket);

   return {
      getBucket: () => client.storage.getBucket(config.bucket),
      list: (prefix, options) => bucket.list(prefix, options),
      upload: (path, body, options) => bucket.upload(path, body, options),
      remove: (paths) => bucket.remove(paths),
   };
}

async function listObjects(bucket, prefix, options = {}) {
   const { data, error } = await bucket.list(prefix, options);
   if (error) {
      throw new Error(`Storage list failed: ${error.message}`);
   }
   return Array.isArray(data) ? data : [];
}

export async function listAllObjects(bucket, prefix) {
   const objects = [];

   for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
      const page = await listObjects(bucket, prefix, {
         limit: LIST_PAGE_SIZE,
         offset,
      });
      objects.push(...page);
      if (page.length < LIST_PAGE_SIZE) break;
   }

   return objects;
}

async function findObject(bucket, prefix, filename) {
   const objects = await listObjects(bucket, prefix, {
      limit: LIST_PAGE_SIZE,
      search: filename,
   });
   return objects.find((object) => object.name === filename) || null;
}

function isDuplicateError(error) {
   if (!error) return false;
   if (Number(error.statusCode) === 409) return true;
   return /already exists|duplicate/i.test(error.message || "");
}

function execOrExplain(exec, binary, args, options) {
   return exec(binary, args, options).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      throw new Error(
         `Cannot run "${binary}": ${error.message}. ` +
            "Install postgresql-client-<server-major> (see apps/ypt-bot/Dockerfile)."
      );
   });
}

async function preflight({ config, bucket, exec, log }) {
   const dumpVersion = await execOrExplain(exec, config.pgDump, ["--version"]);
   const clientMajor = pgClientMajor(dumpVersion.stdout);
   if (!clientMajor) {
      throw new Error(
         `Could not determine the ${config.pgDump} major version. Check PG_DUMP_BIN.`
      );
   }

   const restoreVersion = await execOrExplain(exec, config.pgRestore, [
      "--version",
   ]);
   const restoreMajor = pgClientMajor(restoreVersion.stdout);
   if (restoreMajor && restoreMajor < clientMajor) {
      log.warn("backup_pg_restore_older_than_pg_dump", {
         restoreMajor,
         clientMajor,
      });
   }

   const pgPasswordEnv = {
      ...process.env,
      PGPASSWORD: config.connection.password,
   };
   const versionRow = await execOrExplain(
      exec,
      config.pgPsql,
      [
         "-h",
         config.connection.host,
         "-p",
         config.connection.port,
         "-U",
         config.connection.user,
         "-d",
         config.connection.database,
         "-tAc",
         "SHOW server_version_num;",
      ],
      { env: pgPasswordEnv }
   );
   const serverMajor = serverMajorFromVersionNum(versionRow.stdout);
   if (!serverMajor) {
      throw new Error(
         "Could not determine the PostgreSQL server major version"
      );
   }

   if (clientMajor < serverMajor) {
      throw new Error(
         `pg_dump ${clientMajor} cannot dump PostgreSQL ${serverMajor}. ` +
            `Install postgresql-client-${serverMajor} (see apps/ypt-bot/Dockerfile).`
      );
   }

   const { error } = await bucket.getBucket();
   if (error) {
      throw new Error(
         `Backup bucket "${config.bucket}" is not reachable: ${error.message}`
      );
   }

   log.info("backup_preflight_ok", {
      clientMajor,
      serverMajor,
      bucket: config.bucket,
      prefix: config.prefix,
   });
}

async function pruneOldBackups({ bucket, config, now, log }) {
   const objects = await listAllObjects(bucket, config.prefix);
   const expired = selectExpiredObjects(
      objects,
      now,
      config.retentionDays,
      config.prefix
   );

   let removed = 0;
   for (let index = 0; index < expired.length; index += DELETE_BATCH_SIZE) {
      const batch = expired.slice(index, index + DELETE_BATCH_SIZE);
      const { error } = await bucket.remove(batch);
      if (error) {
         log.warn("backup_prune_failed", {
            error: error.message,
            batchSize: batch.length,
         });
         continue;
      }
      removed += batch.length;
   }

   log.info("backup_pruned", { count: removed });
   return removed;
}

/**
 * Creates, verifies, uploads and prunes a single PostgreSQL backup.
 * @param {object} [options]
 * @param {Date|string|number} [options.now]
 * @param {boolean} [options.manual]
 * @param {object} [options.log]
 * @param {Function} [options.exec]
 * @param {object} [options.bucket]
 * @param {object} [options.config]
 * @returns {Promise<object>}
 */
export async function runDatabaseBackup(options = {}) {
   const startedAt = Date.now();
   const log =
      options.log || logger.child({ runId: randomUUID(), trigger: "backup" });
   const now = options.now ? new Date(options.now) : new Date();
   const manual = Boolean(options.manual);
   const exec = options.exec || runCommand;
   const config = assertConfig(resolveConfig(options.config || {}));
   const bucket = options.bucket || createBucketClient(config);

   const filename = buildObjectName(now, { manual });
   const objectPath = `${config.prefix}/${filename}`;

   await preflight({ config, bucket, exec, log });

   const existing = await findObject(bucket, config.prefix, filename);
   if (existing) {
      log.info("backup_already_present", { objectPath });
      return {
         skipped: true,
         filename,
         objectPath,
         pruned: 0,
         durationMs: Date.now() - startedAt,
      };
   }

   const directory = await mkdtemp(join(tmpdir(), "supabase-backup-"));
   const filePath = join(directory, filename);
   let stored = false;

   try {
      log.info("backup_started", { objectPath });

      const dumpStartedAt = Date.now();
      const dumpArgs = [
         "--format=custom",
         "-h",
         config.connection.host,
         "-p",
         config.connection.port,
         "-U",
         config.connection.user,
         "-d",
         config.connection.database,
         "--no-owner",
         "--no-privileges",
      ];
      for (const schema of config.schemaList) {
         dumpArgs.push("--schema", schema);
      }
      dumpArgs.push("-f", filePath);

      await exec(config.pgDump, dumpArgs, {
         env: {
            ...process.env,
            PGPASSWORD: config.connection.password,
         },
      });

      const fileStats = await stat(filePath);
      if (fileStats.size === 0) {
         throw new Error("Backup file is empty");
      }

      log.info("backup_dump_completed", {
         filename,
         sizeBytes: fileStats.size,
         durationMs: Date.now() - dumpStartedAt,
      });

      await exec(config.pgRestore, ["--list", filePath]);
      log.info("backup_verified", { filename });

      if (fileStats.size > MAX_UPLOAD_BYTES) {
         throw new Error(
            `Backup is ${(fileStats.size / 1024 / 1024).toFixed(2)} MiB, ` +
               `above the ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)} MiB ` +
               "storage upload limit. Resumable/TUS uploads are required."
         );
      }

      const { error } = await bucket.upload(
         objectPath,
         await readFile(filePath),
         {
            contentType: "application/octet-stream",
            upsert: false,
         }
      );

      if (error && !isDuplicateError(error)) {
         throw new Error(`Storage upload failed: ${error.message}`);
      }
      stored = true;

      log.info("backup_uploaded", {
         objectPath,
         sizeBytes: fileStats.size,
         duplicate: Boolean(error),
      });

      let pruned = 0;
      try {
         pruned = await pruneOldBackups({ bucket, config, now, log });
      } catch (error) {
         log.warn("backup_prune_failed", { error: error.message });
      }

      return {
         skipped: false,
         filename,
         objectPath,
         sizeBytes: fileStats.size,
         pruned,
         durationMs: Date.now() - startedAt,
      };
   } finally {
      if (stored) {
         await rm(directory, { recursive: true, force: true });
      } else {
         log.warn("backup_files_retained", { directory });
      }
   }
}
