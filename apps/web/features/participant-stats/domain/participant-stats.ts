import {
   capDailyStudySeconds,
   formatSecondsToClock,
   formatSecondsToHuman,
} from "@/features/study-logs/domain/duration";
import {
   getChallengeDayOptions,
   type ChallengeDayOption,
} from "@/features/study-logs/domain/challenge-day";
import {
   calculateRemainingDeficit,
   calculateRequiredDailyPace,
} from "@/features/leaderboard/domain/deficit";
import type {
   ParticipantDailyHistoryEntry,
   ParticipantSummaryStats,
   ParticipantAccountabilityStats,
   ParticipantTeamStats,
} from "./participant-stats.types";
import type { ParticipantPaceStatus } from "@/features/leaderboard/domain/leaderboard.types";

export interface RawStudyLogEntry {
   logDate: Date | string;
   durationSeconds: number;
   isOverride?: boolean;
   isLeave?: boolean;
}

function formatUtcDateKey(dateInput: Date | string): string {
   if (typeof dateInput === "string") {
      return dateInput.slice(0, 10);
   }
   return dateInput.toISOString().slice(0, 10);
}

function formatDateFormatted(dateKey: string): string {
   try {
      const parts = dateKey.split("-").map(Number);
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
         const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
         return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
         });
      }
   } catch {}
   return dateKey;
}

/**
 * Calculates a complete chronological daily timeline for a participant in a challenge.
 * Includes every single day of the challenge period (Day 1..Day N), preserving zero-study days.
 */
export function calculateParticipantDailyTimeline(
   startAt: Date | string,
   totalDays: number,
   logs: RawStudyLogEntry[],
   now: Date | string = new Date()
): ParticipantDailyHistoryEntry[] {
   const dayOptions: ChallengeDayOption[] = getChallengeDayOptions(
      startAt,
      now,
      Math.max(1, totalDays)
   );

   // Group logs by dateKey in case of multiple logs
   const logsByDate = new Map<
      string,
      { durationSeconds: number; isOverride: boolean; isLeave: boolean }
   >();

   for (const log of logs) {
      if (!log.logDate) continue;
      const dateKey = formatUtcDateKey(log.logDate);
      const existing = logsByDate.get(dateKey) || {
         durationSeconds: 0,
         isOverride: false,
         isLeave: false,
      };
      logsByDate.set(dateKey, {
         durationSeconds: existing.durationSeconds + (log.durationSeconds || 0),
         isOverride: existing.isOverride || Boolean(log.isOverride),
         isLeave: existing.isLeave || Boolean(log.isLeave),
      });
   }

   let cumulativeSeconds = 0;
   const history: ParticipantDailyHistoryEntry[] = [];

   for (const day of dayOptions) {
      const log = logsByDate.get(day.dateKey) || {
         durationSeconds: 0,
         isOverride: false,
         isLeave: false,
      };
      const durationSeconds = log.durationSeconds;
      if (!day.isFuture) {
         cumulativeSeconds += capDailyStudySeconds(durationSeconds);
      }

      history.push({
         dayNumber: day.dayNumber,
         dateKey: day.dateKey,
         dateFormatted: formatDateFormatted(day.dateKey),
         weekday: day.weekday,
         label: day.label,
         durationSeconds,
         durationClock: formatSecondsToClock(durationSeconds),
         durationHuman: formatSecondsToHuman(durationSeconds),
         cumulativeSeconds: day.isFuture ? 0 : cumulativeSeconds,
         cumulativeClock: day.isFuture
            ? "—"
            : formatSecondsToClock(cumulativeSeconds),
         cumulativeHuman: day.isFuture
            ? "—"
            : formatSecondsToHuman(cumulativeSeconds),
         isToday: day.isToday,
         isYesterday: day.isYesterday,
         isFuture: day.isFuture,
         isPast: day.isPast,
         isOverride: log.isOverride,
         isLeave: log.isLeave,
      });
   }

   return history;
}

/**
 * Calculates summary metrics for a participant.
 */
export function calculateParticipantSummaryStats(params: {
   totalLoggedSeconds: number;
   todayLoggedSeconds: number;
   targetSeconds: number;
   rank: number;
   totalParticipants: number;
   paceStatus: ParticipantPaceStatus;
   paceLabel: string;
   todayIsLeave?: boolean;
   leavesCount?: number;
}): ParticipantSummaryStats {
   const {
      totalLoggedSeconds,
      todayLoggedSeconds,
      targetSeconds,
      rank,
      totalParticipants,
      paceStatus,
      paceLabel,
      todayIsLeave = false,
      leavesCount = 0,
   } = params;

   const completionPercentage =
      targetSeconds > 0
         ? Math.min(100, Math.round((totalLoggedSeconds / targetSeconds) * 100))
         : 100;

   const remainingSeconds = Math.max(0, targetSeconds - totalLoggedSeconds);
   const excessSeconds = Math.max(0, totalLoggedSeconds - targetSeconds);
   const isTargetMet = totalLoggedSeconds >= targetSeconds;

   return {
      totalLoggedSeconds,
      totalLoggedClock: formatSecondsToClock(totalLoggedSeconds),
      totalLoggedHuman: formatSecondsToHuman(totalLoggedSeconds),
      todayLoggedSeconds,
      todayLoggedClock: formatSecondsToClock(todayLoggedSeconds),
      todayLoggedHuman: formatSecondsToHuman(todayLoggedSeconds),
      targetSeconds,
      targetClock: formatSecondsToClock(targetSeconds),
      targetHuman: formatSecondsToHuman(targetSeconds),
      completionPercentage,
      rank,
      totalParticipants,
      remainingSeconds,
      remainingClock: formatSecondsToClock(remainingSeconds),
      remainingHuman: formatSecondsToHuman(remainingSeconds),
      isTargetMet,
      excessSeconds,
      excessClock: formatSecondsToClock(excessSeconds),
      excessHuman: formatSecondsToHuman(excessSeconds),
      paceStatus,
      paceLabel,
      todayIsLeave,
      leavesCount,
   };
}

/**
 * Calculates team contribution metrics for team-based challenges.
 */
export function calculateParticipantTeamStats(params: {
   teamId: string;
   teamName: string;
   teamColor: string | null;
   teamIcon: string | null;
   teamRank: number;
   participantTeamRank: number;
   teamTotalLoggedSeconds: number;
   participantTotalLoggedSeconds: number;
   companionCount: number;
}): ParticipantTeamStats {
   const {
      teamId,
      teamName,
      teamColor,
      teamIcon,
      teamRank,
      participantTeamRank,
      teamTotalLoggedSeconds,
      participantTotalLoggedSeconds,
      companionCount,
   } = params;

   const participantContributionPercentage =
      teamTotalLoggedSeconds > 0
         ? Math.min(
              100,
              Math.max(
                 0,
                 Math.round(
                    (participantTotalLoggedSeconds / teamTotalLoggedSeconds) *
                       100
                 )
              )
           )
         : 0;

   return {
      teamId,
      teamName,
      teamColor,
      teamIcon,
      teamRank,
      participantTeamRank: Math.max(1, participantTeamRank),
      teamTotalLoggedSeconds,
      teamTotalLoggedClock: formatSecondsToClock(teamTotalLoggedSeconds),
      participantContributionPercentage,
      companionCount,
   };
}

/**
 * Calculates accountability, deficit, and punishment stats.
 */
export function calculateParticipantAccountability(params: {
   targetSeconds: number;
   totalLoggedSeconds: number;
   daysRemaining: number;
   isCompleted: boolean;
   status: "NORMAL" | "DEFICIT" | "EXCUSED" | "PUNISHED";
   punishmentRecord?: {
      isPardoned: boolean;
      pardonReason: string | null;
   } | null;
}): ParticipantAccountabilityStats {
   const {
      targetSeconds,
      totalLoggedSeconds,
      daysRemaining,
      isCompleted,
      status,
      punishmentRecord,
   } = params;

   const deficitSeconds = calculateRemainingDeficit(
      targetSeconds,
      totalLoggedSeconds
   );

   let requiredDailyPaceSeconds = 0;
   if (!isCompleted && daysRemaining > 0 && deficitSeconds > 0) {
      requiredDailyPaceSeconds = Math.round(
         calculateRequiredDailyPace(deficitSeconds, daysRemaining)
      );
   }

   const isPunished = status === "PUNISHED" || Boolean(punishmentRecord);
   const isPardoned =
      status === "EXCUSED" || Boolean(punishmentRecord?.isPardoned);
   const pardonReason = punishmentRecord?.pardonReason ?? null;

   let statusBadge:
      "On-Track" | "Catch-Up" | "Punished" | "Excused" | "Completed" =
      "On-Track";

   if (isCompleted) {
      if (isPardoned) {
         statusBadge = "Excused";
      } else if (isPunished || deficitSeconds > 0) {
         statusBadge = "Punished";
      } else {
         statusBadge = "Completed";
      }
   } else {
      if (deficitSeconds > 0) {
         statusBadge = "Catch-Up";
      } else {
         statusBadge = "On-Track";
      }
   }

   return {
      deficitSeconds,
      deficitClock: formatSecondsToClock(deficitSeconds),
      deficitHuman: formatSecondsToHuman(deficitSeconds),
      requiredDailyPaceSeconds,
      requiredDailyPaceClock: formatSecondsToClock(requiredDailyPaceSeconds),
      requiredDailyPaceHuman: formatSecondsToHuman(requiredDailyPaceSeconds),
      daysRemaining,
      isPunished,
      isPardoned,
      pardonReason,
      statusBadge,
   };
}
