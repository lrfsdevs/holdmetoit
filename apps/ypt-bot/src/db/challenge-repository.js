import { prisma } from "./client.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

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
