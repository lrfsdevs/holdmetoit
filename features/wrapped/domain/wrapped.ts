import {
   evaluateLockOutcome,
   resolveWinningTeamIds,
   type LockReason,
} from "@/features/accountability/domain/punishment";
import {
   formatSecondsToClock,
   formatSecondsToHuman,
} from "@/features/study-logs/domain/duration";
import type {
   ChallengeScoreboardViewModel,
   ScoreboardStandingEntry,
} from "@/features/leaderboard/data/leaderboard-data";

/**
 * Pure wrapped domain (Law L7): window/due math and the story view model
 * derived from the cached challenge scoreboard.
 */

export const WRAPPED_POPUP_WINDOW_DAYS = 3;

const DAY_MS = 86_400_000;

function toValidDate(value: string | Date | null | undefined): Date | null {
   if (value == null) {
      return null;
   }
   const date = value instanceof Date ? value : new Date(value);
   return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The wrapped is "available" while the popup window is open: 3 days after
 * the host locked the results.
 */
export function isWrappedWindowOpen(
   resultsLockedAt: string | Date | null | undefined,
   now: Date = new Date()
): boolean {
   const lockedAt = toValidDate(resultsLockedAt);
   if (!lockedAt) {
      return false;
   }
   const deadline = lockedAt.getTime() + WRAPPED_POPUP_WINDOW_DAYS * DAY_MS;
   return now.getTime() < deadline;
}

/**
 * True once the 3-day window has elapsed (used by the page-load auto-seen
 * check that flips `isWrappedSeen` to true).
 */
export function isWrappedWindowExpired(
   resultsLockedAt: string | Date | null | undefined,
   now: Date = new Date()
): boolean {
   const lockedAt = toValidDate(resultsLockedAt);
   if (!lockedAt) {
      return false;
   }
   const deadline = lockedAt.getTime() + WRAPPED_POPUP_WINDOW_DAYS * DAY_MS;
   return now.getTime() >= deadline;
}

/**
 * Popup eligibility. localStorage values take precedence over the server
 * flags when present; the story popup is "done" once it has been seen (reached Slide 4).
 * Outside the 3-day window the popup never opens.
 */
export function isWrappedPopupDue(input: {
   resultsLockedAt?: string | Date | null;
   isWrappedSeen?: boolean;
   isFeedbackFilled?: boolean;
   localSeen?: boolean | null;
   localFeedback?: boolean | null;
   now?: Date;
}): boolean {
   if (!isWrappedWindowOpen(input.resultsLockedAt, input.now ?? new Date())) {
      return false;
   }

   const seen = input.localSeen ?? input.isWrappedSeen ?? false;

   return !seen;
}

export type WrappedVerdict = "saved" | "punished" | "excused";

export interface WrappedTeamSummary {
   id: string;
   name: string;
   color: string | null;
   iconEmoji: string | null;
   totalLoggedSeconds: number;
   totalLoggedClock: string;
   isWinner: boolean;
}

export interface WrappedDailyPoint {
   dateKey: string;
   label: string;
   dayNumber: number;
   durationSeconds: number;
   durationHuman: string;
   averageSeconds: number;
   isBestDay: boolean;
}

export interface ParticipantWrappedViewModel {
   participantId: string;
   displayName: string;
   image: string | null;
   rank: number;
   totalParticipants: number;
   totalSeconds: number;
   totalClock: string;
   totalHuman: string;
   targetSeconds: number;
   targetClock: string;
   completionPercentage: number;
   isTargetMet: boolean;
   hoursDeficitSeconds: number;
   weeklyTasksCompletedCount: number;
   weeklyTasksTotalCount: number;
   teamId: string;
   teamName: string;
   teamColor: string | null;
   teamIcon: string | null;
   teamResult: "winner" | "beaten" | "no-team";
   contributionPercentage: number;
   bestDay: WrappedDailyPoint | null;
   timesVsAverage: number | null;
   daily: WrappedDailyPoint[];
   verdict: WrappedVerdict;
   reasons: LockReason[];
}

export interface ChallengeWrappedViewModel {
   challengeId: string;
   title: string;
   unlockedAt: string | null;
   startAt: string;
   endAt: string;
   totalDays: number;
   participantsCount: number;
   challengeTotalSeconds: number;
   challengeTotalClock: string;
   winningTeamIds: string[];
   teams: WrappedTeamSummary[];
   viewer: ParticipantWrappedViewModel | null;
}

function formatUtcDateKey(date: Date): string {
   return date.toISOString().slice(0, 10);
}

function formatDayLabel(date: Date): string {
   return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
   });
}

function buildChallengeDays(
   startAt: Date,
   endAt: Date
): Array<{ dateKey: string; label: string; dayNumber: number }> {
   const days: Array<{ dateKey: string; label: string; dayNumber: number }> =
      [];
   const totalDays = Math.max(
      1,
      Math.ceil((endAt.getTime() - startAt.getTime()) / DAY_MS)
   );

   for (let index = 0; index < totalDays; index += 1) {
      const date = new Date(startAt.getTime() + index * DAY_MS);
      days.push({
         dateKey: formatUtcDateKey(date),
         label: formatDayLabel(date),
         dayNumber: index + 1,
      });
   }

   return days;
}

function buildParticipantWrapped(input: {
   standing: ScoreboardStandingEntry;
   totalParticipants: number;
   winningTeamIds: string[];
   teamTotals: Map<string, number>;
   participantTotals: Array<{ participantId: string; totalSeconds: number }>;
   dailyTotals: Map<string, number>; // dateKey -> sum across participants
   days: Array<{ dateKey: string; label: string; dayNumber: number }>;
}): ParticipantWrappedViewModel {
   const {
      standing,
      totalParticipants,
      winningTeamIds,
      teamTotals,
      participantTotals,
      dailyTotals,
      days,
   } = input;

   const hasTeam = standing.teamId !== "no-assigned";
   const isInWinningTeam = hasTeam && winningTeamIds.includes(standing.teamId);
   const teamResult: ParticipantWrappedViewModel["teamResult"] = !hasTeam
      ? "no-team"
      : isInWinningTeam
        ? "winner"
        : "beaten";

   const weeklyTasksCompletedCount = standing.weeklyTasksCompletedCount ?? 0;
   const weeklyTasksTotalCount = standing.weeklyTasksTotalCount ?? 0;
   const hoursDeficitSeconds = Math.max(
      0,
      standing.targetSeconds - standing.totalLoggedSeconds
   );

   // Recompute the reasons with the shared lock rule (single source of truth).
   const outcome = evaluateLockOutcome({
      targetSeconds: standing.targetSeconds,
      loggedSeconds: standing.totalLoggedSeconds,
      weeklyTasks: Array.from(
         { length: weeklyTasksTotalCount },
         (_, index) => ({
            status: index < weeklyTasksCompletedCount ? "COMPLETED" : "TODO",
         })
      ),
      isInWinningTeam,
   });

   const verdict: WrappedVerdict =
      standing.paceStatus === "excused"
         ? "excused"
         : standing.paceStatus === "punished"
           ? "punished"
           : "saved";

   const bestDaySeconds = days.reduce((best, day) => {
      const duration = standing.dailyLogs?.[day.dateKey] ?? 0;
      return Math.max(best, duration);
   }, 0);

   const daily: WrappedDailyPoint[] = days.map((day) => {
      const durationSeconds = standing.dailyLogs?.[day.dateKey] ?? 0;
      const averageSeconds =
         totalParticipants > 0
            ? Math.round(
                 (dailyTotals.get(day.dateKey) ?? 0) / totalParticipants
              )
            : 0;

      return {
         ...day,
         durationSeconds,
         durationHuman: formatSecondsToHuman(durationSeconds),
         averageSeconds,
         isBestDay: bestDaySeconds > 0 && durationSeconds === bestDaySeconds,
      };
   });

   const bestDay = daily.find((day) => day.isBestDay) ?? null;

   const averageTotalSeconds =
      participantTotals.length > 0
         ? participantTotals.reduce((sum, p) => sum + p.totalSeconds, 0) /
           participantTotals.length
         : 0;
   const timesVsAverage =
      averageTotalSeconds > 0
         ? Math.round(
              (standing.totalLoggedSeconds / averageTotalSeconds) * 10
           ) / 10
         : null;

   const teamTotalSeconds = teamTotals.get(standing.teamId) ?? 0;
   const contributionPercentage =
      teamTotalSeconds > 0
         ? Math.min(
              100,
              Math.max(
                 0,
                 Math.round(
                    (standing.totalLoggedSeconds / teamTotalSeconds) * 100
                 )
              )
           )
         : 0;

   const completionPercentage =
      standing.targetSeconds > 0
         ? Math.min(
              100,
              Math.round(
                 (standing.totalLoggedSeconds / standing.targetSeconds) * 100
              )
           )
         : 100;

   return {
      participantId: standing.participantId,
      displayName: standing.displayName,
      image: standing.image,
      rank: standing.rank,
      totalParticipants,
      totalSeconds: standing.totalLoggedSeconds,
      totalClock: formatSecondsToClock(standing.totalLoggedSeconds),
      totalHuman: formatSecondsToHuman(standing.totalLoggedSeconds),
      targetSeconds: standing.targetSeconds,
      targetClock: formatSecondsToClock(standing.targetSeconds),
      completionPercentage,
      isTargetMet: standing.totalLoggedSeconds >= standing.targetSeconds,
      hoursDeficitSeconds,
      weeklyTasksCompletedCount,
      weeklyTasksTotalCount,
      teamId: standing.teamId,
      teamName: standing.teamName,
      teamColor: standing.teamColor,
      teamIcon: standing.teamIcon,
      teamResult,
      contributionPercentage,
      bestDay,
      timesVsAverage,
      daily,
      verdict,
      reasons: outcome.reasons,
   };
}

/**
 * Builds the wrapped view model. Challenge-level data is available to every
 * viewer (spectators included); the personal block requires the viewer to be
 * enrolled. Teams at the maximum combined hours are all winners (ties never
 * punish).
 */
export function buildChallengeWrappedViewModel(
   challenge: ChallengeScoreboardViewModel,
   viewerParticipantId?: string | null
): ChallengeWrappedViewModel {
   const teams: WrappedTeamSummary[] = challenge.teams.map((team) => ({
      id: team.id,
      name: team.name,
      color: team.color,
      iconEmoji: team.iconEmoji,
      totalLoggedSeconds: team.totalLoggedSeconds,
      totalLoggedClock: formatSecondsToClock(team.totalLoggedSeconds),
      isWinner: false,
   }));

   const winningTeamIds = resolveWinningTeamIds(
      teams.map((team) => ({
         teamId: team.id,
         totalSeconds: team.totalLoggedSeconds,
      }))
   );

   const winningTeamIdSet = new Set(winningTeamIds);
   for (const team of teams) {
      team.isWinner = winningTeamIdSet.has(team.id);
   }

   const teamTotals = new Map(
      teams.map((team) => [team.id, team.totalLoggedSeconds])
   );

   const days = buildChallengeDays(
      new Date(challenge.startAt),
      new Date(challenge.endAt)
   );

   const dailyTotals = new Map<string, number>();
   for (const standing of challenge.standings) {
      for (const [dateKey, duration] of Object.entries(
         standing.dailyLogs ?? {}
      )) {
         dailyTotals.set(dateKey, (dailyTotals.get(dateKey) ?? 0) + duration);
      }
   }

   const participantTotals = challenge.standings.map((standing) => ({
      participantId: standing.participantId,
      totalSeconds: standing.totalLoggedSeconds,
   }));

   const challengeTotalSeconds = participantTotals.reduce(
      (sum, entry) => sum + entry.totalSeconds,
      0
   );

   const viewerStanding = viewerParticipantId
      ? challenge.standings.find(
           (standing) => standing.participantId === viewerParticipantId
        )
      : undefined;

   const viewer = viewerStanding
      ? buildParticipantWrapped({
           standing: viewerStanding,
           totalParticipants: challenge.standings.length,
           winningTeamIds,
           teamTotals,
           participantTotals,
           dailyTotals,
           days,
        })
      : null;

   const totalDays = Math.max(
      1,
      Math.ceil(
         (new Date(challenge.endAt).getTime() -
            new Date(challenge.startAt).getTime()) /
            DAY_MS
      )
   );

   return {
      challengeId: challenge.id,
      title: challenge.title,
      unlockedAt: challenge.resultsLockedAt ?? null,
      startAt: challenge.startAt,
      endAt: challenge.endAt,
      totalDays,
      participantsCount: challenge.standings.length,
      challengeTotalSeconds,
      challengeTotalClock: formatSecondsToClock(challengeTotalSeconds),
      winningTeamIds,
      teams,
      viewer,
   };
}
