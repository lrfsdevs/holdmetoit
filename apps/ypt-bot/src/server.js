import { createServer } from "node:http";
import readline from "node:readline";
import { randomUUID } from "node:crypto";
import {
   signIn,
   splashLogin,
   getJoinedGroups,
   getAggregatedMembers,
} from "./yptService.js";
import { ingestGroupMembersToDailyStudyLogs } from "./sync/ingestStudyLogs.js";
import { env } from "./config/env.js";
import { logger } from "./logger.js";
import { startDailyBackupScheduler } from "./backup/databaseBackup.js";

// Global state holding session and cached joined groups
const state = {
   token: null,
   user: null,
   joinedGroups: [],
};

/**
 * Interactive prompt for Email and Password in CLI
 */
async function promptCredentials() {
   if (env.YPT_EMAIL && env.YPT_PASSWORD) {
      return {
         email: env.YPT_EMAIL,
         password: env.YPT_PASSWORD,
      };
   }

   const isTTY = Boolean(process.stdin.isTTY);
   const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: isTTY,
   });

   const it = rl[Symbol.asyncIterator]();

   console.log("\n=============================================");
   console.log("       YPT Analytics Server Login Setup      ");
   console.log("=============================================\n");

   process.stdout.write("Enter YPT Email: ");
   const emailLine = (await it.next()).value || "";

   process.stdout.write("Enter YPT Password: ");
   const passwordLine = (await it.next()).value || "";

   rl.close();

   return {
      email: emailLine.trim(),
      password: passwordLine.trim(),
   };
}

/**
 * Log joined groups in a structured table in the terminal
 */
function displayJoinedGroups(groups) {
   if (!groups || groups.length === 0) {
      logger.warn(
         "No joined groups found for this account. Join a group on YPT, or use the join API to enter one."
      );
      return;
   }

   console.log(`\n📋 Joined Groups (${groups.length}):`);
   console.table(
      groups.map((g) => ({
         "Group ID": g.id,
         "Group Name": g.name,
         Category: g.category,
         Members: `${g.memberCount}/${g.maxCapacity}`,
         Role: g.role,
         Private: g.isPrivate ? "🔒 Yes" : "🌐 No",
         Owner: g.owner,
      }))
   );
}

/**
 * Log unified group members in a single structured grid with duplicates removed
 */
function displayUnifiedMembers(
   members,
   totalGroupsCount = 1,
   duplicatesRemoved = 0
) {
   if (!members || members.length === 0) {
      logger.warn("No members found across joined groups.");
      return;
   }

   const groupText =
      totalGroupsCount === 1
         ? "1 group/channel"
         : `${totalGroupsCount} groups/channels`;
   console.log(
      `\n👥 Unified Leaderboard (${members.length} unique members across ${groupText}${
         duplicatesRemoved > 0
            ? `, ${duplicatesRemoved} duplicate(s) merged`
            : ""
      }):`
   );
   console.table(
      members.map((m, index) => {
         const hoursDecimal = (m.liveStudyMs / (1000 * 60 * 60)).toFixed(2);
         const statusLabel = m.isStudying
            ? m.isPaused
               ? "⏸️ Paused"
               : "🔥 Studying"
            : "💤 Offline";

         return {
            Rank: `#${index + 1}`,
            Nickname: m.nickname,
            "Study Duration": m.liveStudyTime,
            "Hours (Dec)": `${hoursDecimal} hrs`,
            Status: statusLabel,
            Subject: m.currentSubject || "-",
            "Group(s)": Array.isArray(m.groupNames)
               ? m.groupNames.join(", ")
               : m.groupName || "-",
            "User ID": m.userId,
         };
      })
   );
}

/**
 * Main application entrypoint
 */
async function startServer() {
   try {
      // 1. Prompt CLI for credentials
      const { email, password } = await promptCredentials();

      if (!email || !password) {
         logger.error("Email and password cannot be empty.");
         process.exit(1);
      }

      // 2. Authenticate with YPT
      logger.info("Authenticating with YPT API...");
      const authResult = await signIn(email, password);
      state.token = authResult.token;
      state.user = authResult.user;
      logger.info("Logged in successfully.", {
         nickname: state.user.nickname,
         userId: state.user.id,
      });

      // 3. Handshake session
      await splashLogin(state.token);

      // 4. Fetch and log joined groups
      logger.info("Fetching joined groups...");
      state.joinedGroups = await getJoinedGroups(state.token);
      displayJoinedGroups(state.joinedGroups);

      // 5. Fetch and log aggregated members across all joined groups in a single unified grid
      if (state.joinedGroups.length > 0) {
         const run = logger.child({ runId: randomUUID(), trigger: "startup" });
         run.info("Fetching & aggregating members across joined groups...", {
            groups: state.joinedGroups.length,
         });
         try {
            const aggregated = await getAggregatedMembers(
               state.token,
               state.joinedGroups
            );
            displayUnifiedMembers(
               aggregated.members,
               aggregated.successfulGroups,
               aggregated.duplicatesRemoved
            );
            await ingestGroupMembersToDailyStudyLogs(
               "all",
               aggregated.members,
               new Date(),
               run
            );
         } catch (err) {
            run.error("Could not load or ingest aggregated members", err);
         }
      }

      // 6. HTTP server (health check only)
      const server = createServer((req, res) => {
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

      const PORT = env.PORT || process.env.PORT || 3000;
      server.listen(PORT, "0.0.0.0", () => {
         console.log(
            `\n🚀 YPT Analytics Server listening on http://localhost:${PORT}`
         );
         console.log(
            `   - GET  http://localhost:${PORT}/health             (Liveness check)\n`
         );

         // 7. Automatic periodic background logger & database syncer (every 5 minutes by default)
         const intervalMinutes = parseInt(
            process.env.REFRESH_INTERVAL_MINUTES || "5",
            10
         );
         if (intervalMinutes > 0 && state.joinedGroups.length > 0) {
            logger.info(
               "Auto-logger active: refreshing & logging study hours on an interval.",
               { intervalMinutes }
            );
            setInterval(
               async () => {
                  const run = logger.child({
                     runId: randomUUID(),
                     trigger: "scheduled",
                  });
                  run.info("Periodic update: unified members & study hours");
                  try {
                     const aggregated = await getAggregatedMembers(
                        state.token,
                        state.joinedGroups
                     );
                     displayUnifiedMembers(
                        aggregated.members,
                        aggregated.successfulGroups,
                        aggregated.duplicatesRemoved
                     );
                     await ingestGroupMembersToDailyStudyLogs(
                        "all",
                        aggregated.members,
                        new Date(),
                        run
                     );
                  } catch (err) {
                     run.error("Periodic update error", err);
                  }
               },
               intervalMinutes * 60 * 1000
            );
         }

         // 8. Nightly PostgreSQL backup at 00:00 UTC (in-process scheduler)
         startDailyBackupScheduler();
      });
   } catch (error) {
      logger.error("Initialization error", error);
      process.exit(1);
   }
}

startServer();
