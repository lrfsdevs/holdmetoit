import { createServer } from "node:http";
import { runIngest } from "./sync/ingestStudyLogs.js";
import { env } from "./config/env.js";
import { logger } from "./logger.js";
import { startDailyBackupScheduler } from "./backup/databaseBackup.js";

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

function createHealthServer() {
   return createServer((req, res) => {
      const pathname = (req.url || "/").split("?")[0];

      if (req.method === "GET" && pathname === "/health") {
         res.writeHead(200, { "Content-Type": "application/json" });
         res.end(
            JSON.stringify({
               status: "ok",
               service: "ypt-bot",
               uptimeSeconds: Math.floor(process.uptime()),
            })
         );
         return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
   });
}

let ingestInFlight = false;

async function ingestTick() {
   if (ingestInFlight) {
      logger.warn("Ingest tick skipped: previous run still in flight");
      return;
   }

   ingestInFlight = true;
   try {
      await runIngest();
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

      logger.info("Ingest loop started.", {
         intervalSeconds: env.POLL_INTERVAL_IDLE_SEC,
      });
      ingestTick();
      setInterval(ingestTick, env.POLL_INTERVAL_IDLE_SEC * 1000);
   } catch (error) {
      logger.error("Initialization error", error);
      process.exit(1);
   }
}

startServer();
