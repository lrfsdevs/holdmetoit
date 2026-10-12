import { findParticipantForUser } from "@/features/challenges/data/participant.repository";
import {
   calculateChallengeStatus,
   canEditDeclarations,
   canLogStudyTime,
   isChallengeReadOnly,
} from "@/features/challenges/domain/challenge-lifecycle";
import {
   buildCatchUpSummary,
   calculateInclusiveDaysRemaining,
   sumLoggedSeconds,
} from "@/features/leaderboard/domain/catch-up-presentation";
import { formatSecondsToClock } from "@/features/study-logs/domain/duration";
import {
   calculateChallengeTotalDays,
   getChallengeDayBuckets,
} from "@/features/study-logs/domain/challenge-day";
import { getChallengeScoreboard } from "@/features/leaderboard/data/leaderboard-data";
import { getUserCategorizedTasks } from "@/features/tasks/data/task.repository";
import type { UserCategorizedTasks } from "@/features/tasks/domain/task.types";

export interface CockpitLogDay {
   logDate: string;
   durationSeconds: number;
   durationClock: string;
   isLeave?: boolean;
}

export interface ParticipantIdentity {
   id: string;
   userId: string;
   displayName: string | null;
   username: string | null;
   image: string | null;
}

export interface CockpitViewModel {
   challengeId: string;
   challengeTitle: string;
   challengeStatus: "UPCOMING" | "ACTIVE" | "COMPLETED";
   challengeFormat: "TEAM_VS_TEAM" | "DUOS" | "SOLOS";
   teamName: string;
   teamColor: string | null;
   teamIcon: string | null;
   participant: ParticipantIdentity;
   targetSeconds: number;
   targetClock: string;
   totalLoggedSeconds: number;
   totalLoggedClock: string;
   canEditDeclarations: boolean;
   canLogStudyTime: boolean;
   isReadOnly: boolean;
   userTasks?: UserCategorizedTasks;
   logs: CockpitLogDay[];
   catchUp: ReturnType<typeof buildCatchUpSummary>;
   todayDate: string;
   todayDayNumber: number;
   todayLoggedSeconds: number;
   todayLoggedClock: string;
   todayIsLeave?: boolean;
   yesterdayDate?: string;
   yesterdayDayNumber?: number;
   yesterdayLoggedSeconds: number;
   yesterdayIsLeave?: boolean;
   isYesterdayMissed: boolean;
   teamRank: number | null;
   remainingDailyAllowanceSeconds: number;
   challengeStartDate?: string;
   totalChallengeDays?: number;
   isResultsLocked: boolean;
   resultsLockedAt?: string | null;
}

function formatUtcDateKey(date: Date): string {
   return date.toISOString().slice(0, 10);
}

export async function getParticipantCockpit(
   userId: string,
   challengeId?: string
): Promise<CockpitViewModel | null> {
   const participant = await findParticipantForUser(userId, challengeId);

   if (!participant) {
      return null;
   }

   const now = new Date();
   const totalDays = calculateChallengeTotalDays(
      participant.challenge.startAt,
      participant.challenge.endAt
   );
   const challengeStatus = calculateChallengeStatus(participant.challenge, now);
   const resultsLockedAt = participant.challenge.resultsLockedAt;
   const isResultsLocked = resultsLockedAt != null;

   const rawBuckets = getChallengeDayBuckets(
      participant.challenge.startAt,
      now
   );
   const isGracePeriod =
      !isResultsLocked &&
      challengeStatus === "COMPLETED" &&
      rawBuckets.current.dayNumber > totalDays;

   const challengeDayBuckets = isGracePeriod
      ? getChallengeDayBuckets(participant.challenge.startAt, now, totalDays)
      : rawBuckets;
   const todayDate = challengeDayBuckets.current.dateKey;
   const yesterdayDate = challengeDayBuckets.previous?.dateKey;

   const participantLogs = participant.dailyStudyLogsV2 ?? [];

   const totalLoggedSeconds = sumLoggedSeconds(participantLogs);
   const todayLog = participantLogs.find(
      (log) => formatUtcDateKey(log.logDate) === todayDate
   );
   const todayLoggedSeconds = todayLog?.durationSeconds ?? 0;
   const remainingDailyAllowanceSeconds = Math.max(
      0,
      86_400 - todayLoggedSeconds
   );

   const yesterdayLog = challengeDayBuckets.previous
      ? participantLogs.find(
           (log) => formatUtcDateKey(log.logDate) === yesterdayDate
        )
      : undefined;
   const yesterdayLoggedSeconds = yesterdayLog?.durationSeconds ?? 0;

   const isYesterdayMissed =
      !isResultsLocked &&
      challengeStatus !== "UPCOMING" &&
      challengeDayBuckets.previous !== null &&
      yesterdayLog === undefined;

   let teamRank: number | null = null;
   if (isResultsLocked) {
      try {
         const scoreboard = await getChallengeScoreboard(
            participant.challengeId,
            userId
         );
         if (participant.challenge.format === "SOLOS") {
            const userStanding = scoreboard?.standings.find(
               (s) => s.participantId === participant.id
            );
            teamRank = userStanding?.rank ?? 1;
         } else {
            if (scoreboard?.teams && participant.teamId) {
               const idx = scoreboard.teams.findIndex(
                  (t) => t.id === participant.teamId
               );
               teamRank = idx >= 0 ? idx + 1 : 1;
            } else {
               teamRank = 1;
            }
         }
      } catch {
         teamRank = 1;
      }
   }

   const daysRemaining = calculateInclusiveDaysRemaining(
      participant.challenge.endAt,
      now
   );

   const userTasks = await getUserCategorizedTasks(userId);

   return {
      challengeId: participant.challengeId,
      challengeTitle: participant.challenge.title,
      challengeStatus,
      challengeFormat: participant.challenge.format,
      teamName: participant.team?.name ?? "Unassigned",
      teamColor: participant.team?.color ?? null,
      teamIcon: participant.team?.iconEmoji ?? "⏳",
      participant: {
         id: participant.id,
         userId: participant.userId,
         displayName: participant.user.displayName ?? participant.user.name,
         username: participant.user.username,
         image: participant.user.image,
      },
      targetSeconds: participant.targetSeconds,
      targetClock: formatSecondsToClock(participant.targetSeconds),
      totalLoggedSeconds,
      totalLoggedClock: formatSecondsToClock(totalLoggedSeconds),
      canEditDeclarations: canEditDeclarations(challengeStatus),
      canLogStudyTime: canLogStudyTime(challengeStatus, resultsLockedAt),
      isReadOnly: isChallengeReadOnly(challengeStatus, resultsLockedAt),
      isResultsLocked,
      resultsLockedAt: resultsLockedAt ? resultsLockedAt.toISOString() : null,
      userTasks,
      logs: participantLogs.map((log) => ({
         logDate: formatUtcDateKey(log.logDate),
         durationSeconds: log.durationSeconds,
         durationClock: formatSecondsToClock(log.durationSeconds),
         isLeave: Boolean(log.isLeave),
      })),
      catchUp: buildCatchUpSummary({
         targetSeconds: participant.targetSeconds,
         totalLoggedSeconds,
         daysRemaining,
      }),
      todayDate,
      todayDayNumber: challengeDayBuckets.current.dayNumber,
      todayLoggedSeconds,
      todayLoggedClock: formatSecondsToClock(todayLoggedSeconds),
      todayIsLeave: Boolean(todayLog?.isLeave),
      yesterdayDate,
      yesterdayDayNumber: challengeDayBuckets.previous?.dayNumber,
      yesterdayLoggedSeconds,
      yesterdayIsLeave: Boolean(yesterdayLog?.isLeave),
      isYesterdayMissed,
      teamRank,
      remainingDailyAllowanceSeconds,
      challengeStartDate: formatUtcDateKey(participant.challenge.startAt),
      totalChallengeDays: totalDays,
   };
}
