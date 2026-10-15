import { prisma } from "@/core/db";
import {
   calculateInclusiveDaysRemaining,
   sumLoggedSeconds,
} from "@/features/leaderboard/domain/catch-up-presentation";
import {
   aggregateTeamScores,
   calculateLeadMargin,
   calculateSharePercentages,
   type TeamRef,
} from "@/features/leaderboard/domain/leaderboard";
import {
   formatSecondsToClock,
   formatSecondsToHuman,
} from "@/features/study-logs/domain/duration";
import {
   getChallengeDayBuckets,
   getChallengeDayDateKey,
   getChallengeDayNumber,
} from "@/features/study-logs/domain/challenge-day";
import { calculateChallengeStatus } from "@/features/challenges/domain/challenge-lifecycle";
import { CACHE_REVALIDATE_SECONDS, cacheTags } from "@/core/cache";
import { unstable_cache } from "next/cache";
import type {
   ChallengeScoreboardViewModel,
   ParticipantPaceStatus,
   ScoreboardMatchHeader,
   ScoreboardStandingEntry,
   ScoreboardTeam,
} from "@/features/leaderboard/domain/leaderboard.types";

export interface RawChallengePayload {
   id: string;
   title: string;
   format: "TEAM_VS_TEAM" | "DUOS" | "SOLOS";
   status?: "UPCOMING" | "ACTIVE" | "COMPLETED";
   isDeleted?: boolean;
   deletionTime?: Date | null;
   resultsLockedAt?: Date | null;
   startAt: Date;
   endAt: Date;
   eventBannerUrl: string | null;
   punishmentPfpUrl: string | null;
   teams: Array<{
      id: string;
      name: string;
      color: string | null;
      iconEmoji: string | null;
      mascotUrl: string | null;
      sortOrder: number;
   }>;
   participants: Array<{
      id: string;
      userId: string;
      teamId: string | null;
      targetSeconds: number;
      status: "NORMAL" | "DEFICIT" | "EXCUSED" | "PUNISHED";
      isWrappedSeen?: boolean;
      isFeedbackFilled?: boolean;
      weeklyTasksCompletedCount?: number;
      weeklyTasksTotalCount?: number;
      user: {
         id: string;
         displayName: string | null;
         username: string | null;
         name: string | null;
         image: string | null;
      };
      dailyStudyLogs: Array<{
         durationSeconds: number;
         logDate?: Date | string;
         status?: string | null;
      }>;
      punishmentRecords?: Array<{
         isPardoned: boolean;
         pardonReason: string | null;
      }>;
   }>;
}

export type SerializedChallengePayload = Omit<
   RawChallengePayload,
   "startAt" | "endAt"
> & {
   startAt: Date | string;
   endAt: Date | string;
};

function normalizeScoreboardDate(value: Date | string, field: string): Date {
   const date = value instanceof Date ? value : new Date(value);
   if (Number.isNaN(date.getTime())) {
      throw new TypeError(`Invalid scoreboard ${field}.`);
   }
   return date;
}

export function normalizeScoreboardPayload(
   challenge: SerializedChallengePayload
): RawChallengePayload {
   return {
      ...challenge,
      startAt: normalizeScoreboardDate(challenge.startAt, "startAt"),
      endAt: normalizeScoreboardDate(challenge.endAt, "endAt"),
      participants: challenge.participants.map((participant) => ({
         ...participant,
         dailyStudyLogs: participant.dailyStudyLogs.map((log) => ({
            ...log,
            ...(log.logDate === undefined
               ? {}
               : { logDate: normalizeScoreboardDate(log.logDate, "logDate") }),
         })),
      })),
   };
}

function formatUtcDateKey(date: Date): string {
   return date.toISOString().slice(0, 10);
}

export function buildScoreboardViewModel(
   challenge: RawChallengePayload,
   currentUserId?: string,
   now = new Date()
): ChallengeScoreboardViewModel {
   const status = challenge.status ?? calculateChallengeStatus(challenge, now);
   const isResultsLocked = challenge.resultsLockedAt != null;
   const isUpcoming = status === "UPCOMING";
   const targetDate = isUpcoming ? challenge.startAt : challenge.endAt;
   const daysRemaining = calculateInclusiveDaysRemaining(targetDate, now);
   const totalDays = Math.max(
      1,
      Math.ceil(
         (challenge.endAt.getTime() - challenge.startAt.getTime()) / 86_400_000
      )
   );
   const elapsedDays = isUpcoming
      ? 0
      : Math.min(totalDays, getChallengeDayNumber(challenge.startAt, now));

   // 1. Participant logs mapping
   const participantScores = challenge.participants.map((p) => {
      const totalLoggedSeconds = sumLoggedSeconds(p.dailyStudyLogs);
      return {
         participantId: p.id,
         teamId: p.teamId ?? "no-assigned",
         loggedSeconds: totalLoggedSeconds,
      };
   });

   // 2. Aggregate team scores (Law L1)
   const teamRefs: TeamRef[] = challenge.teams.map((t) => ({ id: t.id }));
   const teamAggregates = aggregateTeamScores(
      teamRefs,
      participantScores.map((ps) => ({
         teamId: ps.teamId,
         loggedSeconds: ps.loggedSeconds,
      }))
   );

   const teamScoreMap = new Map(
      teamAggregates.map((ta) => [ta.teamId, ta.totalSeconds])
   );

   const highestTeamScore = teamAggregates[0]?.totalSeconds ?? 0;

   const companionCounts = new Map<string, number>();
   const teamTargetMap = new Map<string, number>();
   for (const p of challenge.participants) {
      if (p.teamId) {
         companionCounts.set(
            p.teamId,
            (companionCounts.get(p.teamId) ?? 0) + 1
         );
         teamTargetMap.set(
            p.teamId,
            (teamTargetMap.get(p.teamId) ?? 0) + (p.targetSeconds ?? 0)
         );
      }
   }

   const teams: ScoreboardTeam[] = challenge.teams.map((team) => {
      const totalLoggedSeconds = teamScoreMap.get(team.id) ?? 0;
      const isLeader =
         teamAggregates.length > 0 &&
         totalLoggedSeconds === highestTeamScore &&
         totalLoggedSeconds > 0;
      const targetSeconds = teamTargetMap.get(team.id) ?? 0;
      const targetHours = Math.round(targetSeconds / 3600);
      const completionPercentage =
         targetSeconds > 0
            ? Math.min(
                 100,
                 Math.round((totalLoggedSeconds / targetSeconds) * 100)
              )
            : 0;

      return {
         id: team.id,
         name: team.name,
         color: team.color,
         iconEmoji: team.iconEmoji,
         mascotUrl: team.mascotUrl,
         sortOrder: team.sortOrder,
         companionCount: companionCounts.get(team.id) ?? 0,
         totalLoggedSeconds,
         totalLoggedClock: formatSecondsToClock(totalLoggedSeconds),
         targetSeconds,
         targetClock: formatSecondsToClock(targetSeconds),
         targetHours,
         completionPercentage,
         isLeader,
      };
   });

   // 3. Head-to-Head Banner (FEAT-LEAD-01)
   const sortedTeams = [...teams].sort(
      (a, b) =>
         b.totalLoggedSeconds - a.totalLoggedSeconds ||
         a.sortOrder - b.sortOrder
   );

   const teamA = sortedTeams[0] ?? null;
   const teamB = sortedTeams[1] ?? null;

   let leadMarginResult = {
      marginSeconds: 0,
      leader: "tie" as "a" | "b" | "tie",
      signedMarginSeconds: 0,
   };

   let sharePercentages = {
      ratioPercentageA: 0,
      ratioPercentageB: 0,
   };

   if (teamA && teamB) {
      leadMarginResult = calculateLeadMargin(
         teamA.totalLoggedSeconds,
         teamB.totalLoggedSeconds
      );
      sharePercentages = calculateSharePercentages(
         teamA.totalLoggedSeconds,
         teamB.totalLoggedSeconds
      );
   }

   const matchHeader: ScoreboardMatchHeader = {
      hasMatchup: teams.length >= 2,
      teamA,
      teamB,
      leadMarginSeconds: leadMarginResult.marginSeconds,
      leadMarginClock: formatSecondsToClock(leadMarginResult.marginSeconds),
      leadMarginHuman: formatSecondsToHuman(leadMarginResult.marginSeconds),
      leaderTeamId:
         leadMarginResult.leader === "a" && teamA
            ? teamA.id
            : leadMarginResult.leader === "b" && teamB
              ? teamB.id
              : null,
      leaderSide: leadMarginResult.leader,
      ratioPercentageA: sharePercentages.ratioPercentageA,
      ratioPercentageB: sharePercentages.ratioPercentageB,
   };

   // 4. Standings rows (FEAT-LEAD-02)
   const teamLookup = new Map(challenge.teams.map((t) => [t.id, t]));
   const isGracePeriod =
      !isResultsLocked &&
      status === "COMPLETED" &&
      getChallengeDayNumber(challenge.startAt, now) > totalDays;
   const todayDateKey = isGracePeriod
      ? getChallengeDayDateKey(challenge.startAt, totalDays)
      : getChallengeDayBuckets(challenge.startAt, now).current.dateKey;

   const participantRows = challenge.participants.map((p) => {
      const totalLoggedSeconds = sumLoggedSeconds(p.dailyStudyLogs);
      const todayLog = p.dailyStudyLogs.find((log) => {
         if (!log.logDate) return false;
         const logDateObj =
            log.logDate instanceof Date ? log.logDate : new Date(log.logDate);
         return formatUtcDateKey(logDateObj) === todayDateKey;
      });
      const todayLoggedSeconds = todayLog?.durationSeconds ?? 0;
      const todayLoggedClock = formatSecondsToClock(todayLoggedSeconds);
      const liveStatus =
         todayLog?.status ??
         p.dailyStudyLogs[p.dailyStudyLogs.length - 1]?.status ??
         null;
      const weeklyTasksCompletedCount = p.weeklyTasksCompletedCount ?? 0;
      const weeklyTasksTotalCount = p.weeklyTasksTotalCount ?? 0;
      const deficitSeconds = Math.max(0, p.targetSeconds - totalLoggedSeconds);

      const completionPercentage =
         p.targetSeconds > 0
            ? Math.min(
                 100,
                 Math.round((totalLoggedSeconds / p.targetSeconds) * 100)
              )
            : 100;

      const punishmentRecords = p.punishmentRecords ?? [];
      const isPardonedRecord =
         p.status === "EXCUSED" ||
         punishmentRecords.some((record) => record.isPardoned);
      const isPunishedRecord =
         p.status === "PUNISHED" ||
         punishmentRecords.some((record) => !record.isPardoned);

      let paceStatus: ParticipantPaceStatus = "on-track";
      let paceLabel = "On Track";

      if (status === "COMPLETED") {
         if (isPardonedRecord) {
            paceStatus = "excused";
            paceLabel = "Excused";
         } else if (isPunishedRecord) {
            paceStatus = "punished";
            paceLabel = "Punished";
         } else if (!isResultsLocked && deficitSeconds > 0) {
            paceStatus = "punished";
            paceLabel = "Punished";
         } else {
            paceStatus = "serene";
            paceLabel = "Completed";
         }
      } else {
         if (deficitSeconds === 0) {
            paceStatus = "serene";
            paceLabel = "Serene";
         } else {
            paceStatus = "catch-up";
            paceLabel = "Catch-Up";
         }
      }

      const team = p.teamId ? teamLookup.get(p.teamId) : null;

      const dailyLogs: Record<string, number> = {};
      for (const log of p.dailyStudyLogs) {
         if (log.logDate) {
            const dObj =
               log.logDate instanceof Date
                  ? log.logDate
                  : new Date(log.logDate);
            dailyLogs[formatUtcDateKey(dObj)] = log.durationSeconds;
         }
      }

      return {
         participantId: p.id,
         userId: p.userId,
         displayName:
            p.user.displayName ?? p.user.name ?? p.user.username ?? "Anonymous",
         username: p.user.username,
         image: p.user.image,
         teamId: p.teamId ?? "no-assigned",
         teamName: team?.name ?? "Unassigned",
         teamColor: team?.color ?? null,
         teamIcon: team?.iconEmoji ?? "⏳",
         totalLoggedSeconds,
         totalLoggedClock: formatSecondsToClock(totalLoggedSeconds),
         todayLoggedSeconds,
         todayLoggedClock,
         targetSeconds: p.targetSeconds,
         targetClock: formatSecondsToClock(p.targetSeconds),
         completionPercentage,
         weeklyTasksCompletedCount,
         weeklyTasksTotalCount,
         paceStatus,
         paceLabel,
         status: liveStatus,
         deficitSeconds,
         dailyLogs,
      };
   });

   // Sort descending by totalLoggedSeconds, then more weekly tasks completed
   participantRows.sort((a, b) => {
      if (b.totalLoggedSeconds !== a.totalLoggedSeconds) {
         return b.totalLoggedSeconds - a.totalLoggedSeconds;
      }
      if (b.weeklyTasksCompletedCount !== a.weeklyTasksCompletedCount) {
         return b.weeklyTasksCompletedCount - a.weeklyTasksCompletedCount;
      }
      return a.displayName.localeCompare(b.displayName);
   });

   const standings: ScoreboardStandingEntry[] = participantRows.map(
      (row, idx) => ({
         ...row,
         rank: idx + 1,
      })
   );

   // 5. Punishment Wall data (FEAT-PUN-02, FEAT-PUN-03, FEAT-PUN-01)
   const isEventCompleted = status === "COMPLETED";
   const currentUserParticipant = currentUserId
      ? challenge.participants.find((p) => p.userId === currentUserId)
      : undefined;

   let timeRemainingHuman = "Event concluded";
   if (isUpcoming) {
      const timeUntilStartMs = challenge.startAt.getTime() - now.getTime();
      if (timeUntilStartMs > 0) {
         const totalRemainingSecs = Math.floor(timeUntilStartMs / 1000);
         const remDays = Math.floor(totalRemainingSecs / 86400);
         const remHours = Math.floor((totalRemainingSecs % 86400) / 3600);
         const remMins = Math.floor((totalRemainingSecs % 3600) / 60);
         timeRemainingHuman = `Starts in ${remDays}d ${remHours.toString().padStart(2, "0")}h ${remMins.toString().padStart(2, "0")}m`;
      } else {
         timeRemainingHuman = "Starts today";
      }
   } else if (!isEventCompleted) {
      const timeRemainingMs = challenge.endAt.getTime() - now.getTime();
      if (timeRemainingMs > 0) {
         const totalRemainingSecs = Math.floor(timeRemainingMs / 1000);
         const remDays = Math.floor(totalRemainingSecs / 86400);
         const remHours = Math.floor((totalRemainingSecs % 86400) / 3600);
         const remMins = Math.floor((totalRemainingSecs % 3600) / 60);
         timeRemainingHuman = `${remDays}d ${remHours.toString().padStart(2, "0")}h ${remMins.toString().padStart(2, "0")}m`;
      }
   }

   return {
      id: challenge.id,
      title: challenge.title,
      heroImageUrl: challenge.eventBannerUrl?.trim() || null,
      eventBannerUrl: challenge.eventBannerUrl,
      punishmentPfpUrl: challenge.punishmentPfpUrl,
      format: challenge.format,
      status,
      isDeleted: challenge.isDeleted ?? false,
      resultsLockedAt: challenge.resultsLockedAt
         ? new Date(challenge.resultsLockedAt).toISOString()
         : null,
      startAt: challenge.startAt.toISOString(),
      endAt: challenge.endAt.toISOString(),
      daysRemaining,
      totalDays,
      currentDayNumber: elapsedDays,
      timeRemainingHuman,
      teams,
      matchHeader,
      standings,
      currentUser: {
         isLoggedIn: Boolean(currentUserId),
         isEnrolled: Boolean(currentUserParticipant),
         participantId: currentUserParticipant?.id ?? null,
         isWrappedSeen: currentUserParticipant?.isWrappedSeen ?? false,
         isFeedbackFilled: currentUserParticipant?.isFeedbackFilled ?? false,
      },
   };
}

async function getCachedChallengeScoreboardPayload(challengeId: string) {
   const read = unstable_cache(
      async () => {
         const challenge = await prisma.challenge.findFirst({
            where: { id: challengeId, isDeleted: false },
            include: {
               teams: {
                  where: { isDeleted: false },
                  orderBy: { sortOrder: "asc" },
               },
               participants: {
                  include: {
                     user: {
                        select: {
                           id: true,
                           displayName: true,
                           username: true,
                           name: true,
                           image: true,
                        },
                     },
                     dailyStudyLogs: {
                        select: {
                           durationSeconds: true,
                           logDate: true,
                           status: true,
                           isLeave: true,
                        },
                     },
                     punishmentRecords: {
                        select: {
                           isPardoned: true,
                           pardonReason: true,
                        },
                     },
                  },
               },
            },
         });

         if (!challenge) {
            return null;
         }

         // Challenge-linked weekly task counts (mirrors the lock evaluation:
         // soft-deleted rows are intentionally included).
         const participantUserIds = challenge.participants.map(
            (participant) => participant.userId
         );
         const weeklyTasks =
            participantUserIds.length > 0
               ? await prisma.task.findMany({
                    where: {
                       challengeId,
                       taskType: "WEEKLY",
                       userId: { in: participantUserIds },
                    },
                    select: { userId: true, status: true },
                 })
               : [];

         const weeklyTaskCounts = new Map<
            string,
            { completed: number; total: number }
         >();
         for (const task of weeklyTasks) {
            const counts = weeklyTaskCounts.get(task.userId) ?? {
               completed: 0,
               total: 0,
            };
            counts.total += 1;
            if (task.status === "COMPLETED") {
               counts.completed += 1;
            }
            weeklyTaskCounts.set(task.userId, counts);
         }

         return {
            ...challenge,
            participants: challenge.participants.map((participant) => {
               const counts = weeklyTaskCounts.get(participant.userId) ?? {
                  completed: 0,
                  total: 0,
               };

               return {
                  ...participant,
                  dailyStudyLogs: participant.dailyStudyLogs,
                  weeklyTasksCompletedCount: counts.completed,
                  weeklyTasksTotalCount: counts.total,
               };
            }),
         };
      },
      ["challenge-scoreboard-payload", challengeId],
      {
         revalidate: CACHE_REVALIDATE_SECONDS.stable,
         tags: [cacheTags.challengeScoreboard(challengeId)],
      }
   );

   const challenge = await read();
   if (!challenge) {
      return null;
   }

   return normalizeScoreboardPayload(
      challenge as unknown as SerializedChallengePayload
   );
}

export async function getChallengeScoreboard(
   challengeId: string,
   currentUserId?: string
): Promise<ChallengeScoreboardViewModel | null> {
   const challenge = await getCachedChallengeScoreboardPayload(challengeId);

   if (!challenge) {
      return null;
   }

   return buildScoreboardViewModel(challenge, currentUserId);
}
