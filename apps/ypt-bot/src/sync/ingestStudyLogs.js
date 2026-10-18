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
   getChallengeLifecycle,
   lockExpiredChallengesAfterGrace,
} from "../db/challengeService.js";
import { signIn, splashLogin, getAggregatedMembers } from "../yptService.js";
import { logger } from "../logger.js";

/**
 * Normalizes any timestamp to a strict UTC midnight Date object (00:00:00.000Z)
 * @param {Date|string|number} [nowUtc=new Date()]
 * @returns {Date}
 */
export function computeUtcLogDate(nowUtc = new Date()) {
   const d = new Date(nowUtc);
   return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
   );
}

export const CHALLENGE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Computes the challenge-anchored day bucket for a UTC instant.
 * Day N spans [startAt + N*24h, startAt + (N+1)*24h); the returned Date is the
 * UTC midnight of that bucket's calendar date (matching the @db.Date column).
 * @param {Date|string|number} [nowUtc=new Date()]
 * @param {Date|string|number} challengeStartAt
 * @returns {Date}
 */
export function computeChallengeDayLogDate(
   nowUtc = new Date(),
   challengeStartAt
) {
   const now = new Date(nowUtc).getTime();
   const start = new Date(challengeStartAt).getTime();
   const dayIndex = Math.max(0, Math.floor((now - start) / CHALLENGE_DAY_MS));
   const bucketStart = new Date(start + dayIndex * CHALLENGE_DAY_MS);
   return new Date(
      Date.UTC(
         bucketStart.getUTCFullYear(),
         bucketStart.getUTCMonth(),
         bucketStart.getUTCDate()
      )
   );
}

/**
 * Derives a human-readable status string from member telemetry
 * @param {object} member
 * @returns {string}
 */
export function deriveStudyStatus(member) {
   if (member.isStudying) {
      return "STUDYING";
   }
   return "OFFLINE";
}

/**
 * Ingests scraped YPT members into DailyStudyLog (canonical shared table)
 * for the currently active challenge in UTC time.
 *
 * Performance Optimized: Pre-fetches existing daily logs in a single query
 * and performs concurrent upserts to eliminate N+1 latency.
 *
 * @param {string|number} groupId
 * @param {Array<object>} members
 * @param {Date} [nowUtc=new Date()]
 * @param {import('winston').Logger} [log=logger]
 * @returns {Promise<object>}
 */
export async function ingestGroupMembersToDailyStudyLogs(
   groupId,
   members,
   nowUtc = new Date(),
   log = logger
) {
   const startTime = Date.now();

   // 0. Auto-lock any challenges whose 6-hour grace window has expired
   await lockExpiredChallengesAfterGrace(nowUtc, log);

   // 1. Resolve the anchor challenge in UTC. The cron is challenge-window independent:
   //    locked/ended challenges still anchor telemetry via fallback. No challenge at all
   //    means there is no participant to key rows to, so fail loudly.
   const challenge = await getActiveChallenge(nowUtc, { allowFallback: true });
   if (!challenge) {
      throw new Error("No challenge available to anchor study telemetry");
   }

   const lifecycle =
      challenge.lifecycle || getChallengeLifecycle(challenge, nowUtc);

   // Challenge-anchored day bucket (derived from challenge start in UTC)
   // During Day 7 grace period, lock target bucket to Day 7 (1 second prior to day7End)
   const logDate = lifecycle.isGracePeriod
      ? computeChallengeDayLogDate(
           new Date(lifecycle.day7End.getTime() - 1000),
           challenge.startAt
        )
      : computeChallengeDayLogDate(nowUtc, challenge.startAt);

   // 2. Resolve in-memory participant lookup table (yptId -> participantId)
   const participantMap = await getParticipantMap(challenge.id);

   // 3. Pre-fetch existing logs for today in a single query to eliminate N+1 roundtrips
   const participantIds = Array.from(participantMap.values()).map(
      (p) => p.participantId
   );
   const existingRecords = await prisma.dailyStudyLog.findMany({
      where: {
         logDate,
         participantId: { in: participantIds },
      },
      select: {
         id: true,
         participantId: true,
         durationSeconds: true,
         status: true,
         isOverride: true,
      },
   });
   const existingMap = new Map(
      existingRecords.map((r) => [r.participantId, r])
   );

   const targetLogDateStr = logDate.toISOString().slice(0, 10);

   let matchedCount = 0;
   let unlinkedCount = 0;
   let skippedOverrides = 0;
   let protectedRollovers = 0;
   let protectedZeroDrops = 0;
   let cappedCount = 0;
   let sessionCappedCount = 0;
   let upsertedCount = 0;

   const upsertOperations = [];

   for (const member of members) {
      const yptId = String(
         member.userId || member.ud || member.id || ""
      ).trim();
      if (!yptId) continue;

      const participant = participantMap.get(yptId);

      // If member has not linked their YPT ID to a participant in this challenge
      if (!participant) {
         unlinkedCount++;
         continue;
      }

      matchedCount++;

      const existing = existingMap.get(participant.participantId);

      let durationSeconds;
      let status;

      if (lifecycle.isGracePeriod) {
         // Day 7 Completion 6-hour Grace Period Rules:
         // - No new sessions of YPT are logged (sessionStartMs >= day7End).
         // - Only old sessions (in-progress sessions started before Day 7 completion) continue to accumulate.
         // - When an in-progress old session completes, its final study duration is recorded to Day 7 and marked OFFLINE.
         const isStudying = Boolean(member.isStudying);
         const sessionStartMs = member.sessionStartMs
            ? Number(member.sessionStartMs)
            : null;
         const day7EndMs = lifecycle.day7End.getTime();

         const isOldSession =
            isStudying && sessionStartMs !== null && sessionStartMs < day7EndMs;
         const wasStudyingOldSession = existing?.status === "STUDYING";

         if (isOldSession) {
            // Accumulate active old session
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
            durationSeconds = clampDailyStudySeconds(rawSeconds);
            if (rawSeconds > MAX_DAILY_STUDY_SECONDS) cappedCount++;
            if (
               Number(member.sessionElapsedMs || 0) > MAX_CONTINUOUS_SESSION_MS
            )
               sessionCappedCount++;
            status = deriveStudyStatus(member);
         } else if (wasStudyingOldSession && !isStudying) {
            // Completed old session finalized
            const rawSeconds = Math.floor(
               Number(member.todayStudyMs || member.studyMs || 0) / 1000
            );
            const finalizedSeconds = clampDailyStudySeconds(rawSeconds);
            durationSeconds = Math.max(
               existing?.durationSeconds || 0,
               finalizedSeconds
            );
            status = "OFFLINE";
         } else {
            // New session started after Day 7 or offline without pending old session: DO NOT LOG NEW SESSIONS
            durationSeconds = existing ? existing.durationSeconds : 0;
            status = "OFFLINE";
         }
      } else {
         // Normal active challenge day: calculate real-time integer seconds
         // Continuous sessions are capped at 4h before the daily 14h clamp is applied.
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
         durationSeconds = clampDailyStudySeconds(rawSeconds);
         if (rawSeconds > MAX_DAILY_STUDY_SECONDS) cappedCount++;
         if (Number(member.sessionElapsedMs || 0) > MAX_CONTINUOUS_SESSION_MS)
            sessionCappedCount++;
         status = deriveStudyStatus(member);
      }

      // 4. Admin Override Safety (Law L5)
      // Check if an existing row has isOverride: true. If so, do not overwrite durationSeconds.

      if (existing?.isOverride) {
         skippedOverrides++;
         // Still update live status without touching durationSeconds
         upsertOperations.push(
            prisma.dailyStudyLog.update({
               where: { id: existing.id },
               data: { status },
            })
         );
         continue;
      }

      // 5. Zero-Drop & Rollover Glitch Guard
      // - If YPT has already rolled over to a future day (member.studyDate > targetLogDateStr)
      //   during normal challenge days (!lifecycle.isGracePeriod), incoming telemetry belongs to
      //   tomorrow; preserve today's completed study duration.
      // - If incoming duration is 0 but existing record has durationSeconds > 0, preserve existing duration.
      const isFutureYptDate =
         !lifecycle.isGracePeriod &&
         Boolean(member.studyDate && member.studyDate > targetLogDateStr);
      const isZeroDrop = Boolean(
         durationSeconds === 0 && existing && existing.durationSeconds > 0
      );

      let finalDurationSeconds = durationSeconds;
      if (isFutureYptDate && existing) {
         finalDurationSeconds = existing.durationSeconds;
         protectedRollovers++;
      } else if (isZeroDrop) {
         finalDurationSeconds = existing.durationSeconds;
         protectedZeroDrops++;
      }

      // 6. Upsert DailyStudyLog
      upsertOperations.push(
         prisma.dailyStudyLog.upsert({
            where: {
               participantId_logDate: {
                  participantId: participant.participantId,
                  logDate,
               },
            },
            create: {
               participantId: participant.participantId,
               logDate,
               durationSeconds: finalDurationSeconds,
               status,
               source: "YPT_BOT",
               isOverride: false,
            },
            update: {
               durationSeconds: finalDurationSeconds,
               status,
            },
         })
      );

      upsertedCount++;
   }

   // Execute all upserts concurrently
   await Promise.all(upsertOperations);

   const durationMs = Date.now() - startTime;
   log.info("Ingest complete", {
      challengeId: challenge.id,
      challengeTitle: challenge.title,
      logDate: logDate.toISOString().slice(0, 10),
      matchedCount,
      upsertedCount,
      skippedOverrides,
      protectedRollovers,
      protectedZeroDrops,
      cappedCount,
      sessionCappedCount,
      unlinkedCount,
      durationMs,
   });

   return {
      success: true,
      challengeId: challenge.id,
      challengeTitle: challenge.title,
      logDate,
      matchedCount,
      unlinkedCount,
      skippedOverrides,
      protectedRollovers,
      protectedZeroDrops,
      cappedCount,
      sessionCappedCount,
      upsertedCount,
      durationMs,
   };
}

let cachedToken = null;

/**
 * Resets cached auth token (used on 401 or auth failures and in tests)
 */
export function invalidateAuthToken() {
   cachedToken = null;
}

/**
 * Returns cached JWT session token or performs fresh signIn + splashLogin handshake
 */
export async function getOrRefreshAuthToken() {
   if (cachedToken) {
      return cachedToken;
   }
   const auth = await signIn(env.YPT_EMAIL, env.YPT_PASSWORD);
   await splashLogin(auth.token);
   cachedToken = auth.token;
   return cachedToken;
}

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

// Auto-run when executed directly via CLI (daemon mode; interval from env)
const isDirectExecution =
   process.argv[1] &&
   resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
   const intervalSeconds = env.POLL_INTERVAL_IDLE_SEC;

   logger.info("Ingest daemon started.", { intervalSeconds });

   // If deployed on Render Web Service (which requires an open HTTP port)
   if (process.env.PORT) {
      import("node:http").then(({ createServer }) => {
         const port = Number(process.env.PORT) || 3000;
         const server = createServer((req, res) => {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
               JSON.stringify({
                  status: "ok",
                  service: "ingest-watch",
                  intervalSeconds,
               })
            );
         });
         server.listen(port, "0.0.0.0", () => {
            logger.info("Health server listening (Render compatible).", {
               host: "0.0.0.0",
               port,
            });
         });
      });
   }

   runIngest().catch((e) => logger.error("Ingest error", e));
   setInterval(() => {
      runIngest().catch((e) => logger.error("Ingest error", e));
   }, intervalSeconds * 1000);
}
