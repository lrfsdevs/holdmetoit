import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { getAggregatedMembers } from "../ypt/client.js";
import { getOrRefreshAuthToken, invalidateAuthToken } from "../ypt/session.js";
import { logger } from "../lib/logger.js";
import { ingestGroupMembersToDailyStudyLogs } from "./daily-study-log.js";

/**
 * Executes a single ingestion iteration across all configured YPT groups.
 * Uses multi-group aggregation to deduplicate members and handle errors gracefully.
 */
export async function runIngest() {
   const start = Date.now();
   const run = logger.child({ runId: randomUUID(), trigger: "runIngest" });
   run.info("Running YPT study logs ingestion...");

   if (!env.YPT_EMAIL || !env.YPT_PASSWORD) {
      throw new Error("YPT_EMAIL and YPT_PASSWORD must be configured in .env");
   }

   const groupIds = env.YPT_GROUP_IDS;
   if (!groupIds || groupIds.length === 0) {
      throw new Error("YPT_GROUP_IDS must be configured in .env");
   }

   let token = await getOrRefreshAuthToken();
   const groups = groupIds.map((id) => ({ id, name: `Group ${id}` }));
   let aggregated;

   try {
      aggregated = await getAggregatedMembers(token, groups);
   } catch (err) {
      const isAuthError =
         err.message?.includes("401") ||
         err.message?.includes("JWT") ||
         err.message?.includes("session");
      if (isAuthError) {
         run.warn(
            "Cached auth token expired or rejected. Refreshing session...",
            { error: err.message }
         );
         invalidateAuthToken();
         token = await getOrRefreshAuthToken();
         aggregated = await getAggregatedMembers(token, groups);
      } else {
         throw err;
      }
   }

   run.info("Fetched aggregated members.", {
      members: aggregated.members.length,
      successfulGroups: aggregated.successfulGroups,
      groups: groups.length,
   });
   const result = await ingestGroupMembersToDailyStudyLogs(
      "aggregated",
      aggregated.members,
      new Date(),
      run
   );

   run.info("Ingestion cycle completed.", { durationMs: Date.now() - start });
   return result;
}
