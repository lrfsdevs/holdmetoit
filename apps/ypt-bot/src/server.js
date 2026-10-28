import { runIngest } from "./ingest/run-ingest.js";
import { createHealthServer } from "./http/health-server.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { startDailyBackupScheduler } from "./backup/scheduler.js";
import {
   CRON_JOBS,
   pruneCronLogs,
   recordCronRun,
   recoverInterruptedRuns,
   withCronLog,
} from "./db/cron-log-repository.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Fail fast when the runtime is missing configuration the ingest loop needs.
 */
function validateConfig() {
   const missing = [];
   if (!env.YPT_EMAIL) missing.push("YPT_EMAIL");
   if (!env.YPT_PASSWORD) missing.push("YPT_PASSWORD");
   if (!env.YPT_GROUP_IDS.length) missing.push("YPT_GROUP_IDS");

   if (missing.length > 0) {
      throw new Error(
         `Missing required environment variables: ${missing.join(", ")}`
      );
   }

   if (
      !Number.isFinite(env.POLL_INTERVAL_IDLE_SEC) ||
      env.POLL_INTERVAL_IDLE_SEC <= 0
   ) {
      throw new Error("POLL_INTERVAL_IDLE_SEC must be a positive integer");
   }
}

let ingestInFlight = false;
let firstIngest = true;

async function ingestTick() {
   if (ingestInFlight) {
      await recordCronRun({
         jobName: CRON_JOBS.YPT_INGEST,
         trigger: "overlap",
         summary: { reason: "previous_run_in_flight" },
      });
      logger.warn("Ingest tick skipped: previous run still in flight");
      return;
   }

   ingestInFlight = true;
   const trigger = firstIngest ? "startup" : "interval";
   firstIngest = false;

   try {
      await withCronLog(
         { jobName: CRON_JOBS.YPT_INGEST, trigger },
         ({ runId }) => runIngest({ runId })
      );
   } catch (error) {
      logger.error("Ingest error", error);
   } finally {
      ingestInFlight = false;
   }
}

/**
 * Main application entrypoint: health endpoint, ingest loop, and backups.
 */
async function startServer() {
   try {
      validateConfig();

      const server = createHealthServer();
      const PORT = env.PORT;

      server.listen(PORT, "0.0.0.0", () => {
         console.log(
            `\n🚀 YPT bot listening on http://localhost:${PORT} (GET /health)\n`
         );
         startDailyBackupScheduler();
      });

      await recoverInterruptedRuns();
      await pruneCronLogs();

      logger.info("Ingest loop started.", {
         intervalSeconds: env.POLL_INTERVAL_IDLE_SEC,
      });
      ingestTick();
      setInterval(ingestTick, env.POLL_INTERVAL_IDLE_SEC * 1000);
      setInterval(pruneCronLogs, DAY_MS).unref();
   } catch (error) {
      logger.error("Initialization error", error);
      process.exit(1);
   }
}

startServer();
