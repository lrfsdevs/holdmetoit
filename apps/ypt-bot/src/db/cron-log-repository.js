import { randomUUID } from "node:crypto";
import { prisma } from "./client.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export const CRON_JOBS = {
   YPT_INGEST: "YPT_INGEST",
   DB_BACKUP: "DB_BACKUP",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function truncate(value, max) {
   return String(value ?? "").slice(0, max);
}

function toJson(value) {
   if (value === null || value === undefined) {
      return null;
   }
   try {
      return JSON.parse(JSON.stringify(value));
   } catch {
      return null;
   }
}

/**
 * Cursor writes must never break the job they are recording.
 */
async function safeWrite(promise, context, log) {
   try {
      return await promise;
   } catch (error) {
      log.warn("cron_log_write_failed", {
         ...context,
         error: error.message,
      });
      return null;
   }
}

/**
 * Creates a RUNNING CronLog row, executes fn, then finalizes the row with
 * SUCCESS/FAILED/SKIPPED. Returns fn's result and rethrows its error.
 *
 * @param {{ jobName: string, trigger: string, runId?: string }} meta
 * @param {(context: { runId: string }) => Promise<object>} fn
 * @param {{ db?: object, log?: object }} [deps]
 */
export async function withCronLog(meta, fn, deps = {}) {
   const db = deps.db || prisma;
   const log = deps.log || logger;
   const runId = meta.runId || randomUUID();
   const startedAt = new Date();

   const created = await safeWrite(
      db.cronLog.create({
         data: {
            jobName: meta.jobName,
            runId,
            trigger: meta.trigger,
            status: "RUNNING",
            startedAt,
         },
      }),
      { jobName: meta.jobName, runId },
      log
   );
   const cronLogId = created?.id || null;

   try {
      const result = await fn({ runId });
      const finishedAt = new Date();

      if (cronLogId) {
         await safeWrite(
            db.cronLog.update({
               where: { id: cronLogId },
               data: {
                  status: result?.skipped ? "SKIPPED" : "SUCCESS",
                  finishedAt,
                  durationMs: finishedAt.getTime() - startedAt.getTime(),
                  challengeId: result?.challengeId || null,
                  summary: toJson(result),
               },
            }),
            { cronLogId, jobName: meta.jobName },
            log
         );
      }

      return result;
   } catch (error) {
      const finishedAt = new Date();

      if (cronLogId) {
         await safeWrite(
            db.cronLog.update({
               where: { id: cronLogId },
               data: {
                  status: "FAILED",
                  finishedAt,
                  durationMs: finishedAt.getTime() - startedAt.getTime(),
                  errorCode: error?.code ? truncate(error.code, 64) : null,
                  errorMessage: truncate(error?.message, 4000),
               },
            }),
            { cronLogId, jobName: meta.jobName },
            log
         );
      }

      throw error;
   }
}

/**
 * Writes a completed row directly (used for overlap skips where no job runs).
 *
 * @param {{ jobName: string, trigger?: string, status?: string, runId?: string,
 *           startedAt?: Date, finishedAt?: Date, durationMs?: number,
 *           summary?: object }} entry
 */
export async function recordCronRun(entry, deps = {}) {
   const db = deps.db || prisma;
   const log = deps.log || logger;
   const now = new Date();

   return safeWrite(
      db.cronLog.create({
         data: {
            jobName: entry.jobName,
            runId: entry.runId || randomUUID(),
            trigger: entry.trigger || "overlap",
            status: entry.status || "SKIPPED",
            startedAt: entry.startedAt || now,
            finishedAt: entry.finishedAt || now,
            durationMs: entry.durationMs ?? 0,
            summary: toJson(entry.summary),
         },
      }),
      { jobName: entry.jobName },
      log
   );
}

/**
 * Marks runs left RUNNING by a terminated process as FAILED.
 * Single-instance assumption: the bot runs one process.
 */
export async function recoverInterruptedRuns(deps = {}) {
   const db = deps.db || prisma;
   const log = deps.log || logger;

   return safeWrite(
      db.cronLog.updateMany({
         where: { status: "RUNNING" },
         data: {
            status: "FAILED",
            errorCode: "INTERRUPTED",
            errorMessage: "Process exited before the run completed",
            finishedAt: new Date(),
         },
      }),
      { jobName: "recoverInterruptedRuns" },
      log
   );
}

/**
 * Deletes expired CronLog runs.
 */
export async function pruneCronLogs(deps = {}) {
   const db = deps.db || prisma;
   const log = deps.log || logger;
   const now = deps.now || new Date();

   const runCutoff = new Date(
      now.getTime() - env.CRON_LOG_RETENTION_DAYS * DAY_MS
   );

   const runs = await safeWrite(
      db.cronLog.deleteMany({
         where: { startedAt: { lt: runCutoff } },
      }),
      { jobName: "pruneCronLogs" },
      log
   );

   const summary = { runs: runs?.count || 0 };
   log.info("cron_log_pruned", summary);
   return summary;
}
