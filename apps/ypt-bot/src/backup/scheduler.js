import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { assertConfig, resolveConfig } from "./config.js";
import {
   computeNextUtcMidnight,
   isBackupDue,
   parseObjectDate,
} from "./retention.js";
import {
   createBucketClient,
   listAllObjects,
   runDatabaseBackup,
} from "./runner.js";
import { CRON_JOBS, withCronLog } from "../db/cron-log-repository.js";

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

   const enabled = options.enabled ?? env.DATABASE_BACKUP_ENABLED;
   if (!enabled) {
      log.info("backup_scheduler_disabled");
      return null;
   }

   const clock =
      typeof options.clock === "function"
         ? options.clock
         : () => new Date(options.clock || Date.now());
   const run = options.run || runDatabaseBackup;
   const record = options.record || withCronLog;
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
         const result = await record(
            { jobName: CRON_JOBS.DB_BACKUP, trigger: reason },
            () =>
               run({
                  log:
                     typeof log.child === "function"
                        ? log.child({ trigger: reason })
                        : log,
               })
         );
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
            await record(
               { jobName: CRON_JOBS.DB_BACKUP, trigger: "catch-up" },
               async () => ({ skipped: true, reason: "not_due" })
            );
            return;
         }

         await execute("catch-up");
      } catch (error) {
         log.error("backup_catch_up_failed", { error: error.message });
      }
   };

   scheduleNext();

   const catchUpEnabled =
      options.catchUpEnabled ?? env.DATABASE_BACKUP_CATCH_UP;
   if (catchUpEnabled) {
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
