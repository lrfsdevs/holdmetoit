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
 */
export async function getGlobalUserProfile(
   userId: string
): Promise<GlobalUserProfile | null> {
   // 1. Fetch user core record
   const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
         id: true,
         displayName: true,
         username: true,
         name: true,
         image: true,
         role: true,
         createdAt: true,
         trophyBalance: true,
         yptId: true,
      },
   });

   if (!user) {
      return null;
   }

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
         image: user.image,
         role: user.role,
         joinedAt: user.createdAt.toISOString(),
         trophyBalance: trophyTotal,
         yptId: user.yptId,
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
