import { prisma } from "@/core/db";
import { getRankForTrophies } from "@/features/trophies/domain/trophy-rank";
import { calculateChallengeStatus } from "@/features/challenges/domain/challenge-lifecycle";
import {
   calculateStudyStreaks,
   formatLifetimeStudyStats,
   toUtcDateKey,
} from "../domain/global-profile";
import type {
   GlobalUserProfile,
   ParticipatedChallengeItem,
} from "../domain/global-profile.types";
import {
   getChallengeParticipantStats,
   type GetChallengeParticipantStatsOptions,
} from "./participant-stats.repository";
import type { ParticipantStatsViewModel } from "../domain/participant-stats.types";

/**
 * Fetches complete user identity, lifetime career stats (even with 0 challenge enrollments),
 * and chronologically ordered challenge participation history (newest first).
 * Accepts either a user CUID or a platform username (@handle or handle).
 */
export async function getGlobalUserProfile(
   identifier: string
): Promise<GlobalUserProfile | null> {
   const cleanIdentifier = identifier.trim().replace(/^@/, "");

   const userSelectFields = {
      id: true,
      displayName: true,
      username: true,
      usernameChangedAt: true,
      name: true,
      image: true,
      role: true,
      createdAt: true,
      trophyBalance: true,
      yptId: true,
      isSick: true,
      sickModeActivatedAt: true,
      sickModeNote: true,
      sickModeReminderSnoozedUntil: true,
      sickModeLastDeactivatedAt: true,
   };

   // 1. Fetch user core record (try by primary CUID first, then by platform username)
   let user = await prisma.user.findUnique({
      where: { id: cleanIdentifier },
      select: userSelectFields,
   });

   if (!user) {
      const canonical = cleanIdentifier.toLowerCase();
      const matched = await prisma.$queryRaw<{ id: string }[]>`
         SELECT "id" FROM "User"
         WHERE LOWER("username") = ${canonical}
         LIMIT 1
      `;
      if (matched.length > 0) {
         user = await prisma.user.findUnique({
            where: { id: matched[0].id },
            select: userSelectFields,
         });
      }
   }

   if (!user) {
      return null;
   }

   const userId = user.id;

   // 2. Fetch parallel aggregates: completed tasks, pokedex count, participations, trophy txns
   const [
      totalTasksCompleted,
      pokedexCount,
      participations,
      trophyTransactions,
   ] = await Promise.all([
      // Tasks completed across lifetime
      prisma.task.count({
         where: {
            userId,
            isDeleted: false,
            OR: [{ status: "COMPLETED" }, { isComplete: true }],
         },
      }),

      // Pokemon collection count
      prisma.userPokemon.count({
         where: { userId },
      }),

      // Challenges entered (excluding soft-deleted challenges)
      prisma.challengeParticipant.findMany({
         where: {
            userId,
            challenge: { isDeleted: false },
         },
         include: {
            challenge: {
               select: {
                  id: true,
                  title: true,
                  format: true,
                  startAt: true,
                  endAt: true,
                  resultsLockedAt: true,
               },
            },
            dailyStudyLogs: {
               select: {
                  logDate: true,
                  durationSeconds: true,
                  isLeave: true,
               },
               orderBy: { logDate: "asc" },
            },
         },
         orderBy: {
            challenge: {
               startAt: "desc", // Newest first
            },
         },
      }),

      // Trophy transactions to associate trophy deltas with challenges
      prisma.trophyTransaction.findMany({
         where: {
            userId,
         },
         select: {
            amount: true,
            sourceId: true,
            groupId: true,
            metadata: true,
         },
      }),
   ]);

   // 3. Map trophy delta per challenge
   const trophyDeltaMap = new Map<string, number>();
   for (const tx of trophyTransactions) {
      const metadata = tx.metadata as { challengeId?: string } | null;
      const challengeId =
         tx.sourceId || tx.groupId || metadata?.challengeId || null;
      if (challengeId) {
         trophyDeltaMap.set(
            challengeId,
            (trophyDeltaMap.get(challengeId) || 0) + tx.amount
         );
      }
   }

   // 4. Compute lifetime study hours and distinct study dates for streak math
   let lifetimeStudySeconds = 0;
   const activeStudyDateStrings: string[] = [];

   for (const p of participations) {
      for (const log of p.dailyStudyLogs) {
         lifetimeStudySeconds += log.durationSeconds || 0;
         if (log.durationSeconds > 0 && !log.isLeave) {
            const dateStr =
               log.logDate instanceof Date
                  ? toUtcDateKey(log.logDate)
                  : String(log.logDate).slice(0, 10);
            activeStudyDateStrings.push(dateStr);
         }
      }
   }

   const { currentStreak, longestStreak, totalActiveStudyDays } =
      calculateStudyStreaks(activeStudyDateStrings);

   const { lifetimeStudyHours, lifetimeStudyClock, lifetimeStudyHuman } =
      formatLifetimeStudyStats(lifetimeStudySeconds);

   // 5. Build chronological participated challenge items
   const totalChallengesEntered = participations.length;
   let challengesCompleted = 0;

   const challengeHistory: ParticipatedChallengeItem[] = participations.map(
      (p) => {
         const challengeStatus = p.challenge.resultsLockedAt
            ? "COMPLETED"
            : calculateChallengeStatus(p.challenge);

         if (challengeStatus === "COMPLETED" && !p.isWithdrawn) {
            challengesCompleted++;
         }

         const participantLoggedSeconds = p.dailyStudyLogs.reduce(
            (sum: number, log) => sum + (log.durationSeconds || 0),
            0
         );
         const loggedHours =
            Math.round((participantLoggedSeconds / 3600) * 10) / 10;
         const targetHours = Math.round((p.targetSeconds / 3600) * 10) / 10;

         const status = p.isWithdrawn ? "WITHDRAWN" : challengeStatus;

         return {
            challengeId: p.challenge.id,
            participantId: p.id,
            title: p.challenge.title,
            mode: p.challenge.format,
            status,
            startDate: p.challenge.startAt.toISOString(),
            endDate: p.challenge.endAt.toISOString(),
            targetHours,
            loggedHours,
            trophyDelta: trophyDeltaMap.get(p.challenge.id) || 0,
         };
      }
   );

   // 6. Compute Trophy Rank
   const trophyTotal = user.trophyBalance ?? 0;
   const rankCalc = getRankForTrophies(trophyTotal);

   return {
      user: {
         id: user.id,
         displayName:
            user.displayName || user.name || user.username || "Scholar",
         username: user.username,
         usernameChangedAt: user.usernameChangedAt
            ? user.usernameChangedAt.toISOString()
            : null,
         image: user.image,
         role: user.role,
         joinedAt: user.createdAt.toISOString(),
         trophyBalance: trophyTotal,
         yptId: user.yptId,
         isSick: Boolean(user.isSick),
         sickModeActivatedAt: user.sickModeActivatedAt
            ? user.sickModeActivatedAt.toISOString()
            : null,
         sickModeNote: user.sickModeNote ?? null,
         sickModeReminderSnoozedUntil: user.sickModeReminderSnoozedUntil
            ? user.sickModeReminderSnoozedUntil.toISOString()
            : null,
         sickModeLastDeactivatedAt: user.sickModeLastDeactivatedAt
            ? user.sickModeLastDeactivatedAt.toISOString()
            : null,
      },
      careerStats: {
         lifetimeStudyHours,
         lifetimeStudySeconds,
         lifetimeStudyClock,
         lifetimeStudyHuman,
         totalActiveStudyDays,
         currentStreak,
         longestStreak,
         totalChallengesEntered,
         challengesCompleted,
         totalTasksCompleted,
         trophyTotal,
         trophyRank: rankCalc.role,
         trophyRankDetails: rankCalc,
         pokedexCount,
      },
      challengeHistory,
   };
}

/**
 * Fetches complete user identity and career stats by platform username.
 */
export async function getGlobalUserProfileByUsername(
   username: string
): Promise<GlobalUserProfile | null> {
   return getGlobalUserProfile(username);
}

/**
 * Fetches the full participant stats payload for a specific challenge.
 * Delegates to getChallengeParticipantStats, which calculates all summary cards,
 * charts, team metrics, accountability status, and chronological daily history.
 */
export async function getChallengeSnapshotForUser(
   userId: string,
   challengeId: string,
   options?: GetChallengeParticipantStatsOptions
): Promise<ParticipantStatsViewModel | null> {
   return getChallengeParticipantStats(challengeId, userId, {
      ...options,
      currentUserId: options?.currentUserId ?? userId,
   });
}
