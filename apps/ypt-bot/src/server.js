import express from "express";
import readline from "node:readline";
import { randomUUID } from "node:crypto";
import {
   signIn,
   splashLogin,
   getJoinedGroups,
   searchJoinedGroups,
   getGroupMembers,
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
 * Log group members and their recorded study hours in a structured table
 */
function displayGroupMembers(group, members) {
   if (!members || members.length === 0) {
      logger.warn(`No members found in group "${group.name}".`, {
         groupId: group.id,
      });
      return;
   }

   console.log(
      `\n👥 Members & Study Hours for "${group.name}" (${members.length} members):`
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
            "User ID": m.userId,
         };
      })
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

      // 6. Setup Express Server
      const app = express();
      app.use(express.json());

      // Middleware: structured HTTP access log (status + duration on response finish)
      app.use((req, res, next) => {
         const startedAt = Date.now();
         res.on("finish", () => {
            logger.http("http_request", {
               method: req.method,
               url: req.originalUrl,
               status: res.statusCode,
               durationMs: Date.now() - startedAt,
            });
         });
         next();
      });

      /**
       * GET /health - Server health & session status
       */
      app.get("/health", (req, res) => {
         res.json({
            status: "ok",
            authenticatedUser: state.user,
            joinedGroupsCount: state.joinedGroups.length,
         });
      });

      /**
       * GET /groups - List or search joined groups
       * Query params:
       *   ?q=keyword  (Search within joined groups)
       *   ?refresh=true  (Force re-fetch from YPT servers)
       */
      app.get("/groups", async (req, res) => {
         try {
            const { q, refresh } = req.query;

            if (refresh === "true") {
               state.joinedGroups = await getJoinedGroups(state.token);
               displayJoinedGroups(state.joinedGroups);
            }

            const results = searchJoinedGroups(state.joinedGroups, q);
            res.json({
               success: true,
               total: results.length,
               groups: results,
            });
         } catch (err) {
            res.status(500).json({ success: false, error: err.message });
         }
      });

      /**
       * GET /groups/:groupId - Get single joined group details
       */
      app.get("/groups/:groupId", (req, res) => {
         const groupId = Number(req.params.groupId);
         const group = state.joinedGroups.find((g) => g.id === groupId);

         if (!group) {
            return res.status(404).json({
               success: false,
               error: `Group ID ${groupId} is not found in your joined groups.`,
            });
         }

         res.json({ success: true, group });
      });

      /**
       * GET /groups/:groupId/members - Fetch real-time study times of all members
       * (Ideal for hourly cron/poller to collect analytics)
       */
      app.get("/groups/:groupId/members", async (req, res) => {
         try {
            const groupId = Number(req.params.groupId);
            const members = await getGroupMembers(state.token, groupId);

            if (req.query.log === "true") {
               const group = state.joinedGroups.find(
                  (g) => g.id === groupId
               ) || { id: groupId, name: `Group ${groupId}` };
               displayGroupMembers(group, members);
            }

            res.json({
               success: true,
               groupId,
               memberCount: members.length,
               members,
            });
         } catch (err) {
            res.status(500).json({ success: false, error: err.message });
         }
      });

      /**
       * GET /members (and /groups/members) - Fetch unified, deduplicated members across all joined groups
       * Query params:
       *   ?log=true   (Print unified table to console)
       *   ?q=keyword  (Search within members by nickname, subject, or group)
       */
      const handleUnifiedMembers = async (req, res) => {
         try {
            const { q, log } = req.query;
            const aggregated = await getAggregatedMembers(
               state.token,
               state.joinedGroups
            );

            let filteredMembers = aggregated.members;
            if (q) {
               const query = String(q).trim().toLowerCase();
               filteredMembers = filteredMembers.filter(
                  (m) =>
                     m.nickname.toLowerCase().includes(query) ||
                     (m.currentSubject &&
                        m.currentSubject.toLowerCase().includes(query)) ||
                     (m.groupNames &&
                        m.groupNames.some((gn) =>
                           gn.toLowerCase().includes(query)
                        )) ||
                     String(m.userId) === query
               );
            }

            if (log === "true") {
               displayUnifiedMembers(
                  filteredMembers,
                  aggregated.successfulGroups,
                  aggregated.duplicatesRemoved
               );
            }

            res.json({
               success: true,
               totalGroups: state.joinedGroups.length,
               successfulGroups: aggregated.successfulGroups,
               uniqueMemberCount: filteredMembers.length,
               totalRawMembers: aggregated.totalRawCount,
               duplicatesRemoved: aggregated.duplicatesRemoved,
               members: filteredMembers,
            });
         } catch (err) {
            res.status(500).json({ success: false, error: err.message });
         }
      };

      app.get("/members", handleUnifiedMembers);
      app.get("/groups/members", handleUnifiedMembers);

      /**
       * POST /sync - On-demand trigger to refresh YPT and ingest into DailyStudyLogV2
       */
      app.post("/sync", async (req, res) => {
         const run = logger.child({
            runId: randomUUID(),
            trigger: "POST /sync",
         });
         try {
            run.info("Manual sync requested");
            const aggregated = await getAggregatedMembers(
               state.token,
               state.joinedGroups
            );
            const result = await ingestGroupMembersToDailyStudyLogs(
               "all",
               aggregated.members,
               new Date(),
               run
            );
            res.json({ success: true, ...result });
         } catch (err) {
            run.error("Manual sync failed", err);
            res.status(500).json({ success: false, error: err.message });
         }
      });

      const PORT = env.PORT || process.env.PORT || 3000;
      app.listen(PORT, "0.0.0.0", () => {
         console.log(
            `\n🚀 YPT Analytics Server listening on http://localhost:${PORT}`
         );
         console.log("   Available API Endpoints:");
         console.log(
            `   - GET  http://localhost:${PORT}/members             (Unified deduplicated members list)`
         );
         console.log(
            `   - GET  http://localhost:${PORT}/groups             (List all joined groups)`
         );
         console.log(
            `   - GET  http://localhost:${PORT}/groups?q=<keyword> (Search within joined groups)`
         );
         console.log(
            `   - GET  http://localhost:${PORT}/groups/:id/members (Get group member study times)`
         );
         console.log(
            `   - GET  http://localhost:${PORT}/health             (Status & Account info)`
         );
         console.log(
            `   - POST http://localhost:${PORT}/sync               (Ingest study logs into DailyStudyLogV2)\n`
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
