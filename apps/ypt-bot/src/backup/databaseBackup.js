import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { logger } from "../logger.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CAPTURED_OUTPUT = 5 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const DELETE_BATCH_SIZE = 100;
const LIST_PAGE_SIZE = 100;

const OBJECT_NAME_PATTERN =
   /^holdmetoit-(\d{4})-(\d{2})-(\d{2})(?:T(\d{2})-(\d{2})-(\d{2})Z)?\.dump$/;

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
 * Returns the next 00:00:00.000 UTC strictly after `now`.
 * @param {Date|string|number} [now=new Date()]
 * @returns {Date}
 */
export function computeNextUtcMidnight(now = new Date()) {
   const current = new Date(now);
   return new Date(
      Date.UTC(
         current.getUTCFullYear(),
         current.getUTCMonth(),
         current.getUTCDate() + 1,
         0,
         0,
         0,
         0
      )
   );
}

/**
 * Builds the storage object name. Scheduled runs are day-scoped so restarts
 * cannot create duplicate dumps; manual runs keep second-level precision.
 * @param {Date|string|number} [now=new Date()]
 * @param {{ manual?: boolean }} [options]
 * @returns {string}
 */
export function buildObjectName(now = new Date(), options = {}) {
   const iso = new Date(now).toISOString();
   const day = iso.slice(0, 10);
   if (!options.manual) {
      return `holdmetoit-${day}.dump`;
   }
   return `holdmetoit-${iso.slice(0, 19).replace(/:/g, "-")}Z.dump`;
}

/**
 * Parses the UTC timestamp embedded in a backup object name.
 * @param {string} name
 * @returns {Date|null}
 */
export function parseObjectDate(name) {
   const match = OBJECT_NAME_PATTERN.exec(String(name || ""));
   if (!match) return null;

   const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
   const parts = [month, day, hour, minute, second].map(Number);

   if (
      parts[0] < 1 ||
      parts[0] > 12 ||
      parts[1] < 1 ||
      parts[1] > 31 ||
      parts[2] > 23 ||
      parts[3] > 59 ||
      parts[4] > 59
   ) {
      return null;
   }

   const timestamp = Date.UTC(
      Number(year),
      parts[0] - 1,
      parts[1],
      parts[2],
      parts[3],
      parts[4]
   );

   if (!Number.isFinite(timestamp)) return null;

   const date = new Date(timestamp);
   if (
      date.getUTCFullYear() !== Number(year) ||
      date.getUTCMonth() !== parts[0] - 1 ||
      date.getUTCDate() !== parts[1]
   ) {
      return null;
   }

   return date;
}

/**
 * True when no backup exists or the newest backup is at least 24h old.
 * @param {Date|string|number} now
 * @param {Date|string|number|null} lastBackupAt
 * @returns {boolean}
 */
export function isBackupDue(now, lastBackupAt) {
   if (!lastBackupAt) return true;
   const last = new Date(lastBackupAt).getTime();
   if (!Number.isFinite(last)) return true;
   return new Date(now).getTime() - last >= DAY_MS;
}

/**
 * Selects object paths older than the retention window.
 * Retention is clamped to a minimum of 1 day: `0` (or any invalid value)
 * behaves exactly like `1`, keeping the last 24 hours of backups.
 * @param {Array<{ name: string }>} objects
 * @param {Date|string|number} now
 * @param {number} retentionDays
 * @param {string} [prefix="backups"]
 * @returns {string[]}
 */
export function selectExpiredObjects(
   objects,
   now,
   retentionDays,
   prefix = "backups"
) {
   const days =
      !Number.isFinite(retentionDays) || retentionDays < 1 ? 1 : retentionDays;

   const cutoff = new Date(now).getTime() - days * DAY_MS;

   return (objects || [])
      .map((object) => ({ object, date: parseObjectDate(object.name) }))
      .filter(({ date }) => date !== null && date.getTime() < cutoff)
      .map(({ object }) => `${prefix}/${object.name}`);
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

/**
 * Parses the direct PostgreSQL URL into connection parts.
 * @param {string} rawUrl
 * @returns {{ host: string, port: string, user: string, password: string, database: string }}
 */
export function parsePostgresUrl(rawUrl) {
   let url;
   try {
      url = new URL(rawUrl);
   } catch {
      throw new Error("DIRECT_URL is not a valid URL");
   }

   if (!["postgres:", "postgresql:"].includes(url.protocol)) {
      throw new Error("DIRECT_URL must be a PostgreSQL connection URL");
   }

   const isTransactionPooler =
      url.port === "6543" || url.searchParams.get("pgbouncer") === "true";

   if (isTransactionPooler) {
      throw new Error(
         "DIRECT_URL must be the direct/session connection (port 5432), not the transaction pooler"
      );
   }

   const decode = (value) => {
      try {
         return decodeURIComponent(value);
      } catch {
         return value;
      }
   };

   return {
      host: url.hostname,
      port: url.port || "5432",
      user: decode(url.username),
      password: decode(url.password),
      database: decode(url.pathname.replace(/^\//, "")) || "postgres",
   };
}

function resolveConfig(overrides = {}) {
   return {
      directUrl: overrides.directUrl ?? env.DIRECT_URL,
      supabaseUrl: overrides.supabaseUrl ?? env.SUPABASE_URL,
      serviceRoleKey: overrides.serviceRoleKey ?? env.SUPABASE_SERVICE_ROLE_KEY,
      bucket: overrides.bucket ?? env.SUPABASE_BACKUP_BUCKET,
      prefix: overrides.prefix ?? env.DATABASE_BACKUP_PREFIX,
      schemas: overrides.schemas ?? env.DATABASE_BACKUP_SCHEMAS,
      retentionDays:
         overrides.retentionDays ?? env.DATABASE_BACKUP_RETENTION_DAYS,
      pgDump: overrides.pgDump ?? env.PG_DUMP_BIN,
      pgRestore: overrides.pgRestore ?? env.PG_RESTORE_BIN,
      pgPsql: overrides.pgPsql ?? env.PG_PSQL_BIN,
   };
}

function assertConfig(config) {
   const missing = [
      ["DIRECT_URL", config.directUrl],
      ["SUPABASE_URL", config.supabaseUrl],
      ["SUPABASE_SERVICE_ROLE_KEY", config.serviceRoleKey],
      ["SUPABASE_BACKUP_BUCKET", config.bucket],
   ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

   if (missing.length > 0) {
      throw new Error(
         `Missing backup environment variables: ${missing.join(", ")}`
      );
   }

   return {
      ...config,
      connection: parsePostgresUrl(config.directUrl),
      schemaList: String(config.schemas || "public")
         .split(",")
         .map((schema) => schema.trim())
         .filter(Boolean),
   };
}

function createBucketClient(config) {
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

async function listAllObjects(bucket, prefix) {
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

/**
 * Starts the 00:00 UTC scheduler. Returns null when backups are disabled.
 * @param {object} [options]
 * @param {Date|Function} [options.clock]
 * @param {Function} [options.run]
 * @param {number} [options.catchUpDelayMs]
 * @param {object} [options.log]
 * @returns {{ stop: Function }|null}
 */
export function startDailyBackupScheduler(options = {}) {
   const log =
      options.log ||
      logger.child({ runId: randomUUID(), trigger: "backup-scheduler" });

   if (!env.DATABASE_BACKUP_ENABLED) {
      log.info("backup_scheduler_disabled");
      return null;
   }

   const clock =
      typeof options.clock === "function"
         ? options.clock
         : () => new Date(options.clock || Date.now());
   const run = options.run || runDatabaseBackup;
   const catchUpDelayMs = options.catchUpDelayMs ?? 60 * 1000;

   let stopped = false;
   let inFlight = false;
   let timer = null;
   let catchUpTimer = null;

   const execute = async (reason) => {
      if (stopped) {
         log.warn("backup_skipped", { reason, cause: "stopped" });
         return;
      }
      if (inFlight) {
         log.warn("backup_skipped", { reason, cause: "already_running" });
         return;
      }

      inFlight = true;
      try {
         const result = await run({
            log:
               typeof log.child === "function"
                  ? log.child({ trigger: reason })
                  : log,
         });
         log.info("backup_run_finished", { reason, ...result });
      } catch (error) {
         log.error("backup_failed", { reason, error: error.message });
      } finally {
         inFlight = false;
      }
   };

   const scheduleNext = () => {
      if (stopped) return;

      const now = clock();
      const nextAt = computeNextUtcMidnight(now);
      const delay = Math.max(
         0,
         Math.min(nextAt.getTime() - new Date(now).getTime(), 2147483647)
      );

      log.info("backup_scheduled", { nextRunAt: nextAt.toISOString() });
      timer = setTimeout(() => {
         execute("scheduled").finally(scheduleNext);
      }, delay);
      if (typeof timer.unref === "function") timer.unref();
   };

   const catchUp = async () => {
      try {
         const config = assertConfig(resolveConfig({}));
         const bucket = createBucketClient(config);
         const objects = await listAllObjects(bucket, config.prefix);
         const dates = objects
            .map((object) => parseObjectDate(object.name))
            .filter(Boolean)
            .map((date) => date.getTime());
         const lastBackupAt = dates.length
            ? new Date(Math.max(...dates))
            : null;

         if (!isBackupDue(clock(), lastBackupAt)) {
            log.info("backup_catch_up_not_due", {
               lastBackupAt: lastBackupAt ? lastBackupAt.toISOString() : null,
            });
            return;
         }

         await execute("catch-up");
      } catch (error) {
         log.error("backup_catch_up_failed", { error: error.message });
      }
   };

   scheduleNext();

   if (env.DATABASE_BACKUP_CATCH_UP) {
      catchUpTimer = setTimeout(catchUp, catchUpDelayMs);
      if (typeof catchUpTimer.unref === "function") catchUpTimer.unref();
   }

   return {
      stop() {
         stopped = true;
         if (timer) clearTimeout(timer);
         if (catchUpTimer) clearTimeout(catchUpTimer);
      },
   };
}

// Auto-run when executed directly via CLI (manual, timestamped object name).
const isDirectExecution =
   process.argv[1] &&
   resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
   runDatabaseBackup({ manual: true })
      .then((result) => {
         logger.info("backup_run_finished", result);
         process.exit(0);
      })
      .catch((error) => {
         logger.error("backup_failed", { error: error.message });
         process.exit(1);
      });
}
