import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "../db.js";
import { env } from "../config/env.js";
import {
   clampDailyStudySeconds,
   cappedLiveStudyMs,
   MAX_DAILY_STUDY_SECONDS,
   MAX_CONTINUOUS_SESSION_MS,
} from "../config/limits.js";
import {
   getActiveChallenge,
   getParticipantMap,
} from "../db/challengeService.js";
import {
   computeUtcLogDate,
   computeChallengeDayLogDate,
   deriveStudyStatus,
} from "./ingestStudyLogs.js";
import { signIn, splashLogin, getAggregatedMembers } from "../yptService.js";
import { logger } from "../logger.js";

/**
 * Normalizes a date to YYYY-MM-DD string in UTC.
 * @param {Date|string} date
 * @returns {string}
 */
export function formatUtcDateString(date) {
   const d = new Date(date);
   return d.toISOString().slice(0, 10);
}

/**
 * Synchronizes all study hours for the active challenge into DailyStudyLogV2 (study_logs_v2)
 * starting from Monday (the challenge start date) up to the current day.
 *
 * Strategy:
 * 1. Resolves the active challenge in UTC (startAt <= nowUtc <= endAt).
 * 2. Phase 1 (Historical): Backfills from DailyStudyLog (V1) for dates from challenge start
 *    up to yesterday (and any future overrides), setting appropriate status and preserving
 *    durationSeconds and admin overrides while respecting any existing overrides in V2.
 * 3. Phase 2 (Live): Scrapes live telemetry from configured YPT groups for today in UTC
 *    and upserts real-time duration and study status.
 * 4. Generates and displays a date-by-date summary table from Monday to today.
 *
 * @param {object} [options]
 * @param {Date} [options.nowUtc=new Date()]
 * @param {boolean} [options.skipYpt=false]
 * @param {boolean} [options.verbose=true]
 * @returns {Promise<object>}
 */
export async function syncChallengeFromMonday(options = {}) {
   const {
      nowUtc = new Date(),
      skipYpt = false,
      verbose = true,
      allowFallback = false,
   } = options;

   const startTime = Date.now();

   // 1. Resolve Active Challenge
   const challenge = await getActiveChallenge(nowUtc, { allowFallback });
   if (!challenge) {
      logger.warn("No active challenge found in database.", {
         nowUtc: nowUtc.toISOString(),
      });
      return {
         success: false,
         reason: "NO_ACTIVE_CHALLENGE",
      };
   }

   const run = logger.child({
      runId: randomUUID(),
      challengeId: challenge.id,
      trigger: "challenge_sync",
   });
   const log = (...args) => {
      if (verbose) run.info(args.join(" "));
   };

   const challengeStartUtc = computeUtcLogDate(challenge.startAt);
   const challengeEndUtc = computeUtcLogDate(challenge.endAt);
   // Challenge-anchored day bucket (derived from challenge start in UTC)
   const todayUtc = computeChallengeDayLogDate(nowUtc, challenge.startAt);

   log(
      `🏁 [ChallengeSync] Active Challenge: "${challenge.title}" (${challenge.id})`
   );
   log(
      `📅 [ChallengeSync] Challenge Window (UTC): ${formatUtcDateString(challengeStartUtc)} to ${formatUtcDateString(challengeEndUtc)}`
   );
   log(
      `📆 [ChallengeSync] Sync Target: From Monday (${formatUtcDateString(challengeStartUtc)}) to Today (${formatUtcDateString(todayUtc)})`
   );

   // 2. Phase 1: Historical Synchronization from DailyStudyLog (V1)
   log("\n📦 [Phase 1] Syncing historical days from DailyStudyLog (V1)...");

   // Query all historical rows for participants of this challenge
   // from challengeStartUtc to yesterday, plus any future admin overrides in the challenge window
   const historicalRows = await prisma.$queryRaw`
    SELECT 
      dsl."id", 
      dsl."participantId", 
      dsl."logDate", 
      dsl."durationSeconds", 
      dsl."isOverride", 
      dsl."overrideById", 
      dsl."overrideReason", 
      dsl."isLeave"
    FROM "DailyStudyLog" dsl
    JOIN "ChallengeParticipant" cp ON cp.id = dsl."participantId"
    WHERE cp."challengeId" = ${challenge.id}
      AND (
        (dsl."logDate" >= ${challengeStartUtc}::date AND dsl."logDate" < ${todayUtc}::date)
        OR (dsl."logDate" > ${todayUtc}::date AND dsl."logDate" <= ${challengeEndUtc}::date AND dsl."isOverride" = true)
      )
    ORDER BY dsl."logDate" ASC;
  `;

   log(
      `Found ${historicalRows.length} historical/override log entries in DailyStudyLog.`
   );

   let historicalUpserted = 0;
   let skippedExistingOverrides = 0;
   let historicalCapped = 0;

   for (const row of historicalRows) {
      const rowLogDate = computeUtcLogDate(row.logDate);

      // Check if row already exists in DailyStudyLogV2 with isOverride: true
      const existingV2 = await prisma.dailyStudyLog.findUnique({
         where: {
            participantId_logDate: {
               participantId: row.participantId,
               logDate: rowLogDate,
            },
         },
         select: {
            id: true,
            isOverride: true,
         },
      });

      if (existingV2?.isOverride) {
         // Respect existing override in V2 (Law L5)
         skippedExistingOverrides++;
         continue;
      }

      const rawSeconds = Number(row.durationSeconds || 0);
      const durationSeconds = clampDailyStudySeconds(rawSeconds);
      if (rawSeconds > MAX_DAILY_STUDY_SECONDS) historicalCapped++;
      const status = "OFFLINE";

      await prisma.dailyStudyLog.upsert({
         where: {
            participantId_logDate: {
               participantId: row.participantId,
               logDate: rowLogDate,
            },
         },
         create: {
            participantId: row.participantId,
            logDate: rowLogDate,
            durationSeconds,
            status,
            source: "YPT_BOT",
            isOverride: Boolean(row.isOverride),
            overrideById: row.overrideById || null,
            overrideReason: row.overrideReason || null,
         },
         update: {
            durationSeconds,
            status,
            isOverride: Boolean(row.isOverride),
            overrideById: row.overrideById || null,
            overrideReason: row.overrideReason || null,
         },
      });

      historicalUpserted++;
   }

   log(
      `✅ [Phase 1 Complete] Upserted ${historicalUpserted} historical records (Protected ${skippedExistingOverrides} existing V2 overrides, Capped ${historicalCapped} at 14h).`
   );

   // 3. Phase 2: Today's Live Ingestion from YPT
   let liveUpserted = 0;
   let liveMatched = 0;
   let liveOverridesSkipped = 0;
   let liveCapped = 0;
   let liveSessionCapped = 0;

   if (skipYpt) {
      log(
         "\n⏭️ [Phase 2] Skipping live YPT scraping as requested (skipYpt=true)."
      );
   } else if (
      !env.YPT_EMAIL ||
      !env.YPT_PASSWORD ||
      !env.YPT_GROUP_IDS?.length
   ) {
      log(
         "\n⚠️ [Phase 2] YPT credentials or group IDs missing in environment. Skipping live scrape."
      );
   } else {
      log(
         `\n📡 [Phase 2] Fetching live YPT telemetry for today (${formatUtcDateString(todayUtc)})...`
      );
      try {
         const auth = await signIn(env.YPT_EMAIL, env.YPT_PASSWORD);
         await splashLogin(auth.token);

         const groups = env.YPT_GROUP_IDS.map((id) => ({
            id,
            name: `Group ${id}`,
         }));
         const aggregated = await getAggregatedMembers(auth.token, groups);

         log(
            `Fetched ${aggregated.members.length} unique members across ${aggregated.successfulGroups} groups.`
         );

         const participantMap = await getParticipantMap(challenge.id);

         for (const member of aggregated.members) {
            const yptId = String(
               member.userId || member.ud || member.id || ""
            ).trim();
            if (!yptId) continue;

            const participant = participantMap.get(yptId);
            if (!participant) continue;

            liveMatched++;

            const cappedLiveMs = cappedLiveStudyMs(
               member.todayStudyMs,
               member.sessionElapsedMs
            );
            const studyMs = Math.max(
               cappedLiveMs,
               Number(member.todayStudyMs || 0),
               Number(member.studyMs || 0)
            );
            const rawSeconds = Math.floor(studyMs / 1000);
            const durationSeconds = clampDailyStudySeconds(rawSeconds);
            if (rawSeconds > MAX_DAILY_STUDY_SECONDS) liveCapped++;
            if (
               Number(member.sessionElapsedMs || 0) > MAX_CONTINUOUS_SESSION_MS
            )
               liveSessionCapped++;
            const status = deriveStudyStatus(member);

            const existingV2 = await prisma.dailyStudyLog.findUnique({
               where: {
                  participantId_logDate: {
                     participantId: participant.participantId,
                     logDate: todayUtc,
                  },
               },
               select: {
                  id: true,
                  isOverride: true,
                  durationSeconds: true,
               },
            });

            if (existingV2?.isOverride) {
               liveOverridesSkipped++;
               // Preserve override duration, update live status only
               await prisma.dailyStudyLog.update({
                  where: { id: existingV2.id },
                  data: { status },
               });
               continue;
            }

            const todayUtcStr = formatUtcDateString(todayUtc);
            const isFutureYptDate = Boolean(
               member.studyDate && member.studyDate > todayUtcStr
            );
            const isZeroDrop = Boolean(
               durationSeconds === 0 &&
               existingV2 &&
               existingV2.durationSeconds > 0
            );

            let finalDurationSeconds = durationSeconds;
            if (isFutureYptDate && existingV2) {
               finalDurationSeconds = existingV2.durationSeconds;
            } else if (isZeroDrop) {
               finalDurationSeconds = existingV2.durationSeconds;
            }

            await prisma.dailyStudyLog.upsert({
               where: {
                  participantId_logDate: {
                     participantId: participant.participantId,
                     logDate: todayUtc,
                  },
               },
               create: {
                  participantId: participant.participantId,
                  logDate: todayUtc,
                  durationSeconds: finalDurationSeconds,
                  status,
                  source: "YPT_BOT",
                  isOverride: false,
               },
               update: {
                  durationSeconds: finalDurationSeconds,
                  status,
               },
            });

            liveUpserted++;
         }

         log(
            `✅ [Phase 2 Complete] Matched ${liveMatched} participants, upserted ${liveUpserted} live logs (${liveOverridesSkipped} overrides protected, ${liveCapped} capped at 14h, ${liveSessionCapped} sessions capped at 4h).`
         );
      } catch (err) {
         run.error("Failed to scrape live YPT data", err);
      }
   }

   // 4. Generate Daily Summary Table from Monday to Today
   log(
      "\n📊 [Summary] Querying consolidated challenge study logs (study_logs_v2) from Monday..."
   );

   const dailySummary = await prisma.$queryRaw`
    SELECT 
      sl."logDate"::text as "log_date",
      COUNT(*)::int as "participants",
      COUNT(CASE WHEN sl."isOverride" THEN 1 END)::int as "overrides",
      ROUND(SUM(sl."durationSeconds") / 3600.0, 2) as "total_hours",
      SUM(sl."durationSeconds")::int as "total_seconds"
    FROM "DailyStudyLog" sl
    JOIN "ChallengeParticipant" cp ON cp.id = sl."participantId"
    WHERE cp."challengeId" = ${challenge.id}
      AND sl."logDate" >= ${challengeStartUtc}::date
    GROUP BY sl."logDate"
    ORDER BY sl."logDate" ASC;
  `;

   if (verbose) {
      console.table(
         dailySummary.map((d) => ({
            Date: d.log_date,
            Participants: d.participants,
            Overrides: d.overrides,
            "Total Hours": Number(d.total_hours).toFixed(2),
            "Total Seconds": d.total_seconds,
         }))
      );
   }

   const durationMs = Date.now() - startTime;
   log(
      `\n🎉 [ChallengeSync Finished] Total time: ${(durationMs / 1000).toFixed(2)}s\n`
   );

   return {
      success: true,
      challengeId: challenge.id,
      challengeTitle: challenge.title,
      challengeStartUtc,
      todayUtc,
      historicalUpserted,
      skippedExistingOverrides,
      historicalCapped,
      liveMatched,
      liveUpserted,
      liveOverridesSkipped,
      liveCapped,
      liveSessionCapped,
      dailySummary,
      durationMs,
   };
}

// Auto-run when executed directly via CLI
const isDirectExecution =
   process.argv[1] &&
   resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
   const allowFallback = process.argv.includes("--fallback");
   syncChallengeFromMonday({ allowFallback })
      .then(() => process.exit(0))
      .catch((err) => {
         logger.error("Fatal error in challenge_sync", err);
         process.exit(1);
      });
}
