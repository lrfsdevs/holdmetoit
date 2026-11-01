import { prisma } from "./client.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { clampDailyStudySeconds } from "../config/limits.js";

export const CHALLENGE_GRACE_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Computes the lifecycle state of a challenge relative to a given UTC instant.
 * States:
 * - 'LOCKED': resultsLockedAt is set and has passed (logging prohibited).
 * - 'UPCOMING': now is before challenge startAt (logging prohibited).
 * - 'ACTIVE': now is within [startAt, endAt] and challenge is not locked.
 * - 'DAY7_GRACE': now is within (endAt, endAt + 6h] and challenge is not locked.
 *   Only ongoing sessions started before endAt are permitted; no new sessions.
 * - 'EXPIRED': now is past endAt + 6h (logging prohibited).
 *
 * @param {object} challenge
 * @param {Date|string|number} [nowUtc=new Date()]
 * @returns {{ state: 'LOCKED'|'UPCOMING'|'ACTIVE'|'DAY7_GRACE'|'EXPIRED', canIngest: boolean, isGracePeriod: boolean, day7End: Date }}
 */
export function getChallengeLifecycle(challenge, nowUtc = new Date()) {
   const now = new Date(nowUtc).getTime();
   const start = new Date(challenge.startAt).getTime();
   const end = new Date(challenge.endAt).getTime();
   const day7End = new Date(end);

   if (
      challenge.resultsLockedAt &&
      new Date(challenge.resultsLockedAt).getTime() <= now
   ) {
      return {
         state: "LOCKED",
         canIngest: false,
         isGracePeriod: false,
         day7End,
      };
   }
   if (now < start) {
      return {
         state: "UPCOMING",
         canIngest: false,
         isGracePeriod: false,
         day7End,
      };
   }
   if (now <= end) {
      return {
         state: "ACTIVE",
         canIngest: true,
         isGracePeriod: false,
         day7End,
      };
   }
   if (now <= end + CHALLENGE_GRACE_WINDOW_MS) {
      return {
         state: "DAY7_GRACE",
         canIngest: true,
         isGracePeriod: true,
         day7End,
      };
   }
   return { state: "EXPIRED", canIngest: false, isGracePeriod: false, day7End };
}

/**
 * Automatically locks any challenges whose Day 7 completion + 6-hour grace window
 * has expired and that have not yet been locked. Writes an immutable system AuditLog
 * with actionType: 'CHALLENGE_LOCKED' and auditReason: 'challenge locked after 6 hr grace hours'.
 *
 * @param {Date|string|number} [nowUtc=new Date()]
 * @param {import('winston').Logger} [log=logger]
 * @returns {Promise<Array<object>>}
 */
export async function lockExpiredChallengesAfterGrace(
   nowUtc = new Date(),
   log = logger
) {
   const now = new Date(nowUtc);
   const cutoff = new Date(now.getTime() - CHALLENGE_GRACE_WINDOW_MS);

   // Find challenges whose Day 7 + 6h grace window has passed and resultsLockedAt is null
   const expiredUnlocked = await prisma.challenge.findMany({
      where: {
         resultsLockedAt: null,
         endAt: { lte: cutoff },
      },
      select: {
         id: true,
         title: true,
         endAt: true,
         resultsLockedAt: true,
      },
   });

   if (!expiredUnlocked || expiredUnlocked.length === 0) {
      return [];
   }

   const locked = [];

   for (const challenge of expiredUnlocked) {
      // Atomic update ensures idempotency across concurrent instances
      const updateResult = await prisma.challenge.updateMany({
         where: {
            id: challenge.id,
            resultsLockedAt: null,
         },
         data: {
            resultsLockedAt: now,
         },
      });

      if (updateResult.count > 0) {
         await prisma.auditLog.create({
            data: {
               challengeId: challenge.id,
               actorId: null,
               actorUsername: "system",
               actorDisplayName: "YPT Auto-Lock",
               actionType: "CHALLENGE_LOCKED",
               targetEntityId: challenge.id,
               targetEntityType: "CHALLENGE",
               targetEntityName: challenge.title,
               previousValue: { resultsLockedAt: null },
               newValue: {
                  resultsLockedAt: now.toISOString(),
                  title: "challenge locked after 6 hr grace hours",
                  autoLocked: true,
               },
               auditReason: "challenge locked after 6 hr grace hours",
               createdAt: now,
            },
         });

         log.info("Challenge auto-locked after 6-hour grace window expired.", {
            challengeId: challenge.id,
            challengeTitle: challenge.title,
            resultsLockedAt: now.toISOString(),
         });

         try {
            await reconcileChallengeAccountability(challenge.id, now, log);
         } catch (reconcileErr) {
            log.error(
               "Failed to reconcile challenge accountability during auto-lock:",
               {
                  challengeId: challenge.id,
                  error: reconcileErr?.message,
               }
            );
         }

         locked.push({ ...challenge, resultsLockedAt: now });
      }
   }

   return locked;
}

/**
 * Dynamically resolves the active challenge from the database using strict UTC time.
 * Evaluates locking (resultsLockedAt), active window, and the Day 7 6-hour grace window.
 *
 * @param {Date} [nowUtc=new Date()]
 * @param {object} [options]
 * @param {boolean} [options.allowFallback=false] - If true, falls back to the most recently ended challenge
 * @returns {Promise<object|null>}
 */
export async function getActiveChallenge(nowUtc = new Date(), options = {}) {
   const { allowFallback = false } = options;
   const now = new Date(nowUtc);

   // 0. Auto-lock any challenges whose 6-hour grace window has expired
   await lockExpiredChallengesAfterGrace(now, logger);

   // 1. Check if an explicit challenge ID was provided in environment
   if (env.ACTIVE_CHALLENGE_ID) {
      const explicit = await prisma.challenge.findUnique({
         where: { id: env.ACTIVE_CHALLENGE_ID },
      });
      if (explicit) {
         explicit.lifecycle = getChallengeLifecycle(explicit, now);
         return explicit;
      }
      logger.warn(
         "Configured ACTIVE_CHALLENGE_ID not found. Falling back to dynamic query.",
         { activeChallengeId: env.ACTIVE_CHALLENGE_ID }
      );
   }

   // 2. Query candidates that started in the past and whose grace window hasn't expired
   const cutoff = new Date(now.getTime() - CHALLENGE_GRACE_WINDOW_MS);
   const candidates = await prisma.challenge.findMany({
      where: {
         startAt: { lte: now },
         endAt: { gte: cutoff },
         OR: [{ resultsLockedAt: null }, { resultsLockedAt: { gt: now } }],
      },
      orderBy: { startAt: "desc" },
   });

   for (const candidate of candidates) {
      const lifecycle = getChallengeLifecycle(candidate, now);
      if (lifecycle.canIngest) {
         candidate.lifecycle = lifecycle;
         return candidate;
      }
   }

   // 3. Fallback: Only if explicitly requested by caller (e.g. CLI tools with --fallback)
   if (allowFallback) {
      const latest = await prisma.challenge.findFirst({
         orderBy: { endAt: "desc" },
      });

      if (latest) {
         latest.lifecycle = getChallengeLifecycle(latest, now);
         logger.warn(
            "No challenge currently active. Using the latest challenge instead.",
            {
               nowUtc: now.toISOString(),
               challengeId: latest.id,
               challengeTitle: latest.title,
            }
         );
         return latest;
      }
   }

   return null;
}

/**
 * Builds an in-memory lookup map of YPT User ID -> ChallengeParticipant
 * @param {string} challengeId
 * @returns {Promise<Map<string, { participantId: string, userId: string, yptId: string, displayName: string, username: string }>>}
 */
export async function getParticipantMap(challengeId) {
   if (!challengeId) return new Map();

   const participants = await prisma.challengeParticipant.findMany({
      where: { challengeId },
      include: {
         user: {
            select: {
               id: true,
               yptId: true,
               username: true,
               displayName: true,
            },
         },
      },
   });

   const map = new Map();

   for (const p of participants) {
      const yptId = p.user?.yptId ? String(p.user.yptId).trim() : null;
      if (yptId) {
         map.set(yptId, {
            participantId: p.id,
            userId: p.userId,
            yptId,
            username: p.user.username || "",
            displayName: p.user.displayName || p.user.username || "Participant",
         });
      }
   }

   return map;
}

/**
 * Reconciles the three-condition accountability invariant (Law L6) upon challenge locking:
 * Condition 1: Target hours met (deficitSeconds === 0)
 * Condition 2: All challenge-linked weekly tasks completed
 * Condition 3: In a winning team (ties are draws: all teams with maximum score win; in SOLOS format or no teams, individual)
 *
 * Participants meeting all 3 conditions receive status 'NORMAL'.
 * Participants failing any condition receive status 'PUNISHED' and a PunishmentRecord entry.
 * Excused/pardoned participants retain their excused status.
 *
 * @param {string} challengeId
 * @param {Date|string|number} [now=new Date()]
 * @param {import('winston').Logger} [log=logger]
 */
export async function reconcileChallengeAccountability(
   challengeId,
   now = new Date(),
   log = logger
) {
   if (!prisma.challenge?.findUnique) {
      return;
   }

   const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
         teams: { where: { isDeleted: false }, select: { id: true } },
         participants: {
            where: { isWithdrawn: false },
            include: {
               dailyStudyLogs: true,
               punishmentRecords: true,
            },
         },
      },
   });

   if (!challenge) {
      return;
   }

   const evaluatedParticipants = challenge.participants || [];
   const participantUserIds = evaluatedParticipants
      .map((p) => p.userId)
      .filter(Boolean);

   const weeklyTasks =
      participantUserIds.length > 0 && prisma.task?.findMany
         ? await prisma.task.findMany({
              where: {
                 challengeId,
                 taskType: "WEEKLY",
                 isDeleted: false,
                 userId: { in: participantUserIds },
              },
              select: { userId: true, status: true },
           })
         : [];

   const weeklyTasksByUser = new Map();
   for (const task of weeklyTasks) {
      const list = weeklyTasksByUser.get(task.userId) || [];
      list.push(task);
      weeklyTasksByUser.set(task.userId, list);
   }

   // Aggregate team totals using capped study seconds (Law L1 / Law L8)
   const teamTotals = new Map();
   for (const team of challenge.teams || []) {
      teamTotals.set(team.id, 0);
   }

   for (const p of evaluatedParticipants) {
      if (p.teamId && teamTotals.has(p.teamId)) {
         const loggedSeconds = (p.dailyStudyLogs || []).reduce(
            (sum, logEntry) =>
               sum + clampDailyStudySeconds(logEntry.durationSeconds || 0),
            0
         );
         teamTotals.set(p.teamId, teamTotals.get(p.teamId) + loggedSeconds);
      }
   }

   // Find max score and winning team IDs
   let maxTeamScore = 0;
   for (const score of teamTotals.values()) {
      if (score > maxTeamScore) {
         maxTeamScore = score;
      }
   }

   const winningTeamIds = [];
   for (const [teamId, score] of teamTotals.entries()) {
      if (score === maxTeamScore) {
         winningTeamIds.push(teamId);
      }
   }

   const isSoloChallenge =
      challenge.format === "SOLOS" || (challenge.teams || []).length === 0;

   const punishedParticipantIds = [];
   const savedParticipantIds = [];

   for (const p of evaluatedParticipants) {
      const isExcused =
         p.status === "EXCUSED" ||
         (p.punishmentRecords || []).some((r) => r.isPardoned);

      if (isExcused) {
         continue;
      }

      const loggedSeconds = (p.dailyStudyLogs || []).reduce(
         (sum, logEntry) =>
            sum + clampDailyStudySeconds(logEntry.durationSeconds || 0),
         0
      );
      const hoursMet = loggedSeconds >= (p.targetSeconds || 0);

      const userTasks = weeklyTasksByUser.get(p.userId) || [];
      const allWeeklyTasksCompleted = userTasks.every(
         (t) => t.status === "COMPLETED"
      );

      const inWinningTeam =
         isSoloChallenge ||
         (p.teamId != null && winningTeamIds.includes(p.teamId));

      const isSaved = hoursMet && allWeeklyTasksCompleted && inWinningTeam;

      if (isSaved) {
         savedParticipantIds.push(p.id);
      } else {
         punishedParticipantIds.push(p.id);
      }
   }

   if (
      savedParticipantIds.length > 0 &&
      prisma.challengeParticipant?.updateMany
   ) {
      await prisma.challengeParticipant.updateMany({
         where: { id: { in: savedParticipantIds } },
         data: { status: "NORMAL" },
      });
   }

   if (
      punishedParticipantIds.length > 0 &&
      prisma.challengeParticipant?.updateMany
   ) {
      await prisma.challengeParticipant.updateMany({
         where: { id: { in: punishedParticipantIds } },
         data: { status: "PUNISHED" },
      });
   }

   if (prisma.punishmentRecord?.deleteMany) {
      await prisma.punishmentRecord.deleteMany({
         where: { challengeId, isPardoned: false },
      });
   }

   if (
      punishedParticipantIds.length > 0 &&
      prisma.punishmentRecord?.createMany
   ) {
      await prisma.punishmentRecord.createMany({
         data: punishedParticipantIds.map((participantId) => ({
            challengeId,
            participantId,
         })),
      });
   }

   log.info("Challenge accountability reconciled after lock.", {
      challengeId,
      punishedCount: punishedParticipantIds.length,
      savedCount: savedParticipantIds.length,
   });

   return {
      punishedParticipantIds,
      savedParticipantIds,
   };
}
