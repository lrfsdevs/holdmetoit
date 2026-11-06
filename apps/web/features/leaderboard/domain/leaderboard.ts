import {
   capDailyStudySeconds,
   DurationRangeError,
   formatSecondsToClock,
   formatSecondsToHuman,
} from "@/features/study-logs/domain/duration";
import { filterLogsBeforeWithdrawal } from "@/features/challenges/domain/withdrawal";
import {
   formatDayDate,
   getChallengeDayDateKey,
   getChallengeDayFromDateKey,
} from "@/features/study-logs/domain/challenge-day";

export interface TeamRef {
   id: string;
   isDeleted?: boolean;
}

export interface ParticipantLogEntry {
   teamId: string;
   loggedSeconds?: number;
   isWithdrawn?: boolean;
   withdrawalAt?: Date | string | null;
   dailyStudyLogs?: readonly {
      durationSeconds: number;
      createdAt?: Date | string | null;
      logDate?: Date | string | null;
   }[];
}

export interface TeamAggregateScore {
   teamId: string;
   totalSeconds: number;
}

export type LeadSide = "a" | "b" | "tie";

export interface LeadMarginResult {
   /** Absolute difference in seconds between the two teams. */
   marginSeconds: number;
   /** Which side leads, or `tie` when totals are equal. */
   leader: LeadSide;
   /** Signed margin from team A's perspective (positive = A leads). */
   signedMarginSeconds: number;
}

/**
 * Calculates effective scored seconds for a participant in team aggregations (GH-#210).
 * Active participants contribute all study logs.
 * Withdrawn participants contribute historical study logs recorded on or before withdrawalAt.
 */
export function calculateParticipantScoredSeconds(participant: {
   isWithdrawn?: boolean;
   withdrawalAt?: Date | string | null;
   dailyStudyLogs?: readonly {
      durationSeconds: number;
      createdAt?: Date | string | null;
      logDate?: Date | string | null;
   }[];
   loggedSeconds?: number;
}): number {
   if (participant.loggedSeconds != null && !participant.dailyStudyLogs) {
      return participant.loggedSeconds;
   }
   const logs = participant.dailyStudyLogs ?? [];
   if (!participant.isWithdrawn) {
      return logs.reduce((total, log) => total + log.durationSeconds, 0);
   }
   return filterLogsBeforeWithdrawal(logs, participant.withdrawalAt).reduce(
      (total, log) => total + log.durationSeconds,
      0
   );
}

/**
 * Aggregates participant logged seconds by team (Law L1).
 * Every team in `teams` receives an entry; teams with no logs total 0.
 * Frozen historical study hours of withdrawn members are preserved and credited (GH-#210).
 * Results are sorted descending by totalSeconds (standings order).
 */
export function aggregateTeamScores(
   teams: readonly TeamRef[],
   logs: readonly ParticipantLogEntry[]
): TeamAggregateScore[] {
   const totals = new Map<string, number>();
   const activeTeams = teams.filter((team) => !team.isDeleted);

   for (const team of activeTeams) {
      totals.set(team.id, 0);
   }

   for (const log of logs) {
      const loggedSeconds =
         log.dailyStudyLogs != null
            ? calculateParticipantScoredSeconds(log)
            : (log.loggedSeconds ?? 0);

      assertNonNegativeInteger("loggedSeconds", loggedSeconds);

      const current = totals.get(log.teamId) ?? 0;
      totals.set(log.teamId, current + loggedSeconds);
   }

   const aggregates: TeamAggregateScore[] = [];

   for (const team of activeTeams) {
      aggregates.push({
         teamId: team.id,
         totalSeconds: totals.get(team.id) ?? 0,
      });
   }

   // Include scores for team IDs present only in logs (orphan assignments).
   for (const [teamId, totalSeconds] of Array.from(totals.entries())) {
      if (!aggregates.some((entry) => entry.teamId === teamId)) {
         aggregates.push({ teamId, totalSeconds });
      }
   }

   return aggregates.sort((a, b) => b.totalSeconds - a.totalSeconds);
}

/**
 * Calculates the lead margin between two team totals (FEAT-LEAD-01).
 */
export function calculateLeadMargin(
   teamASeconds: number,
   teamBSeconds: number
): LeadMarginResult {
   assertNonNegativeInteger("teamASeconds", teamASeconds);
   assertNonNegativeInteger("teamBSeconds", teamBSeconds);

   const signedMarginSeconds = teamASeconds - teamBSeconds;
   const marginSeconds = Math.abs(signedMarginSeconds);

   if (marginSeconds === 0) {
      return {
         marginSeconds: 0,
         leader: "tie",
         signedMarginSeconds: 0,
      };
   }

   return {
      marginSeconds,
      leader: signedMarginSeconds > 0 ? "a" : "b",
      signedMarginSeconds,
   };
}

/**
 * Formats lead margin seconds into a human-readable lead delta string (Law L7, Law L8).
 * Positive seconds: `+<human> ahead` (e.g. `+7h 45m ahead`, `+1h 1m 1s ahead`).
 * Zero seconds: `Tied`.
 */
export function formatLeadMarginDelta(marginSeconds: number): string {
   assertNonNegativeInteger("marginSeconds", marginSeconds);
   if (marginSeconds === 0) {
      return "Tied";
   }
   return `+${formatSecondsToHuman(marginSeconds)} ahead`;
}

export interface SharePercentages {
   /** Percentage of the combined logged time belonging to Team A (0 to 100). */
   ratioPercentageA: number;
   /** Percentage of the combined logged time belonging to Team B (0 to 100). */
   ratioPercentageB: number;
}

/**
 * Calculates head-to-head percentage share between two teams (Law L7).
 * When totalMatchSeconds is 0, both shares are 0%.
 * When totalMatchSeconds > 0, shares sum to exactly 100%.
 */
export function calculateSharePercentages(
   teamASeconds: number,
   teamBSeconds: number
): SharePercentages {
   assertNonNegativeInteger("teamASeconds", teamASeconds);
   assertNonNegativeInteger("teamBSeconds", teamBSeconds);

   const totalMatchSeconds = teamASeconds + teamBSeconds;
   if (totalMatchSeconds === 0) {
      return {
         ratioPercentageA: 0,
         ratioPercentageB: 0,
      };
   }

   const ratioPercentageA =
      Math.round((teamASeconds / totalMatchSeconds) * 1000) / 10;
   const ratioPercentageB = Math.round((100 - ratioPercentageA) * 10) / 10;

   return {
      ratioPercentageA,
      ratioPercentageB,
   };
}

function assertNonNegativeInteger(label: string, value: number): void {
   if (!Number.isInteger(value)) {
      throw new DurationRangeError(`${label} must be an integer.`);
   }

   if (value < 0) {
      throw new DurationRangeError(`${label} cannot be negative.`);
   }
}

export interface DayRankedEntry {
   dayRank: number;
   todayRank: number;
   dayLoggedSeconds: number;
   dayLoggedClock: string;
}

/**
 * Extracts and caps non-negative integer seconds logged by an entry on targetDateKey.
 */
export function getParticipantDayLoggedSeconds<
   T extends {
      dailyLogs?: Record<string, number>;
      todayLoggedSeconds?: number;
   },
>(entry: T, targetDateKey: string, todayDateKey?: string): number {
   let rawSeconds: number | undefined;

   if (entry.dailyLogs && entry.dailyLogs[targetDateKey] !== undefined) {
      rawSeconds = entry.dailyLogs[targetDateKey];
   } else if (
      todayDateKey &&
      targetDateKey === todayDateKey &&
      entry.todayLoggedSeconds !== undefined
   ) {
      rawSeconds = entry.todayLoggedSeconds;
   } else if (!entry.dailyLogs && entry.todayLoggedSeconds !== undefined) {
      rawSeconds =
         todayDateKey && targetDateKey !== todayDateKey
            ? 0
            : entry.todayLoggedSeconds;
   } else {
      rawSeconds = 0;
   }

   const seconds = Math.max(0, Math.floor(rawSeconds ?? 0));
   return capDailyStudySeconds(seconds);
}

/**
 * Ranks leaderboard entries descending by study seconds logged on targetDateKey (Law L7, Law L8).
 * Primary: day study seconds descending.
 * Secondary tie-breaker: cumulative totalLoggedSeconds descending.
 * Tertiary tie-breaker: displayName alphabetical ascending.
 */
export function rankByDaySeconds<
   T extends {
      dailyLogs?: Record<string, number>;
      todayLoggedSeconds?: number;
      totalLoggedSeconds?: number;
      displayName?: string;
   },
>(
   entries: readonly T[],
   targetDateKey: string,
   options?: { todayDateKey?: string }
): (T & DayRankedEntry)[] {
   const sorted = [...entries].sort((a, b) => {
      const aDaySec = getParticipantDayLoggedSeconds(
         a,
         targetDateKey,
         options?.todayDateKey
      );
      const bDaySec = getParticipantDayLoggedSeconds(
         b,
         targetDateKey,
         options?.todayDateKey
      );

      if (bDaySec !== aDaySec) {
         return bDaySec - aDaySec;
      }

      const aTotal = a.totalLoggedSeconds ?? 0;
      const bTotal = b.totalLoggedSeconds ?? 0;
      if (bTotal !== aTotal) {
         return bTotal - aTotal;
      }

      const aName = a.displayName ?? "";
      const bName = b.displayName ?? "";
      return aName.localeCompare(bName);
   });

   return sorted.map((entry, index) => {
      const dayLoggedSeconds = getParticipantDayLoggedSeconds(
         entry,
         targetDateKey,
         options?.todayDateKey
      );
      return {
         ...entry,
         dayRank: index + 1,
         todayRank: index + 1,
         dayLoggedSeconds,
         dayLoggedClock: formatSecondsToClock(dayLoggedSeconds),
      };
   });
}

/**
 * Ranks leaderboard entries descending by today's logged study seconds (Law L7).
 * Secondary tie-breaker: cumulative challenge totalLoggedSeconds.
 */
export function rankByTodaySeconds<
   T extends { todayLoggedSeconds: number; totalLoggedSeconds?: number },
>(entries: readonly T[]): (T & { todayRank: number })[] {
   const sorted = [...entries].sort((a, b) => {
      if (b.todayLoggedSeconds !== a.todayLoggedSeconds) {
         return b.todayLoggedSeconds - a.todayLoggedSeconds;
      }
      return (b.totalLoggedSeconds ?? 0) - (a.totalLoggedSeconds ?? 0);
   });

   return sorted.map((entry, index) => ({
      ...entry,
      todayRank: index + 1,
   }));
}

export interface LeaderboardDayOption {
   dayNumber: number;
   dateKey: string;
   label: string;
   shortLabel: string;
   formattedDate: string;
   isToday: boolean;
   isFinalDay?: boolean;
}

/**
 * Computes available challenge day options for the daily selector control (Law L7).
 * For ACTIVE challenges: returns Day 1 through current day number (with current day marked as Today).
 * For COMPLETED challenges: returns Day 1 through totalDays (with final day marked).
 * For UPCOMING challenges: returns Day 1.
 */
export function getLeaderboardDayOptions(params: {
   startAt: Date | string;
   totalDays: number;
   currentDayNumber: number;
   status?: "UPCOMING" | "ACTIVE" | "COMPLETED";
}): LeaderboardDayOption[] {
   const totalDays = Math.max(1, params.totalDays);
   let maxSelectableDay = 1;

   if (params.status === "COMPLETED") {
      maxSelectableDay = totalDays;
   } else if (params.status === "UPCOMING") {
      maxSelectableDay = 1;
   } else {
      maxSelectableDay = Math.min(
         totalDays,
         Math.max(1, params.currentDayNumber)
      );
   }

   const options: LeaderboardDayOption[] = [];

   for (let d = 1; d <= maxSelectableDay; d++) {
      const dateKey = getChallengeDayDateKey(params.startAt, d);
      const formattedDate = formatDayDate(dateKey);
      const isToday =
         params.status === "ACTIVE" && d === params.currentDayNumber;
      const isFinalDay = params.status === "COMPLETED" && d === totalDays;

      let label = `Day ${d} · ${formattedDate}`;
      if (isToday) {
         label = `Today (Day ${d} · ${formattedDate})`;
      } else if (isFinalDay) {
         label = `Day ${d} · ${formattedDate} (Final Day)`;
      }

      options.push({
         dayNumber: d,
         dateKey,
         label,
         shortLabel: isToday ? "Today" : `Day ${d}`,
         formattedDate,
         isToday,
         isFinalDay,
      });
   }

   return options;
}

export interface ResolvedLeaderboardDay {
   dayNumber: number;
   dateKey: string;
   isToday: boolean;
   formattedDate: string;
}

/**
 * Resolves requested day number or dateKey to a validated challenge day (Law L7).
 * Gracefully falls back to current day (ongoing) or final day (completed) if invalid or out of bounds.
 */
export function resolveLeaderboardSelectedDay(params: {
   requestedDay?: number | string | null;
   requestedDateKey?: string | null;
   startAt: Date | string;
   totalDays: number;
   currentDayNumber: number;
   status?: "UPCOMING" | "ACTIVE" | "COMPLETED";
}): ResolvedLeaderboardDay {
   const totalDays = Math.max(1, params.totalDays);
   let maxSelectableDay = 1;
   let defaultDay = 1;

   if (params.status === "COMPLETED") {
      maxSelectableDay = totalDays;
      defaultDay = totalDays;
   } else if (params.status === "UPCOMING") {
      maxSelectableDay = 1;
      defaultDay = 1;
   } else {
      maxSelectableDay = Math.min(
         totalDays,
         Math.max(1, params.currentDayNumber)
      );
      defaultDay = maxSelectableDay;
   }

   let resolvedDayNumber = defaultDay;

   if (
      params.requestedDateKey &&
      /^\d{4}-\d{2}-\d{2}$/.test(params.requestedDateKey)
   ) {
      try {
         const dayFromKey = getChallengeDayFromDateKey(
            params.startAt,
            params.requestedDateKey
         );
         if (dayFromKey >= 1 && dayFromKey <= maxSelectableDay) {
            resolvedDayNumber = dayFromKey;
         }
      } catch {}
   } else if (params.requestedDay != null && params.requestedDay !== "") {
      let parsed: number | null = null;
      if (typeof params.requestedDay === "number") {
         parsed = Number.isInteger(params.requestedDay)
            ? params.requestedDay
            : null;
      } else if (
         typeof params.requestedDay === "string" &&
         /^\s*\d+\s*$/.test(params.requestedDay)
      ) {
         parsed = parseInt(params.requestedDay.trim(), 10);
      }
      if (parsed !== null && parsed >= 1 && parsed <= maxSelectableDay) {
         resolvedDayNumber = parsed;
      }
   }

   const dateKey = getChallengeDayDateKey(params.startAt, resolvedDayNumber);
   const isToday =
      params.status === "ACTIVE" &&
      resolvedDayNumber === params.currentDayNumber;
   const formattedDate = formatDayDate(dateKey);

   return {
      dayNumber: resolvedDayNumber,
      dateKey,
      isToday,
      formattedDate,
   };
}

/**
 * Formats full date with year: e.g. 'Oct 22, 2026'.
 */
export function formatDayDateWithYear(dateKey: string): string {
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
 * Formats a prominent leaderboard day header title (e.g. 'Showing Day 3 Standings · Oct 22, 2026').
 */
export function formatLeaderboardDayHeading(params: {
   dayNumber: number;
   dateKey: string;
   isToday?: boolean;
}): string {
   const formattedDate = formatDayDateWithYear(params.dateKey);
   if (params.isToday) {
      return `Showing Today's Standings · ${formattedDate}`;
   }
   return `Showing Day ${params.dayNumber} Standings · ${formattedDate}`;
}

export interface TeamDayScore {
   teamId: string;
   dayLoggedSeconds: number;
   dayLoggedClock: string;
}

/**
 * Aggregates participant day study seconds by team (Law L1, Law L7, Law L8).
 */
export function calculateTeamDayScores<
   T extends {
      teamId: string;
      dayLoggedSeconds?: number;
      dailyLogs?: Record<string, number>;
   },
>(
   teams: readonly TeamRef[],
   entries: readonly T[],
   dateKey?: string
): TeamDayScore[] {
   const totals = new Map<string, number>();
   const activeTeams = teams.filter((t) => !t.isDeleted);
   for (const team of activeTeams) {
      totals.set(team.id, 0);
   }

   for (const entry of entries) {
      let seconds = 0;
      if (entry.dayLoggedSeconds !== undefined) {
         seconds = entry.dayLoggedSeconds;
      } else if (
         dateKey &&
         entry.dailyLogs &&
         entry.dailyLogs[dateKey] !== undefined
      ) {
         seconds = entry.dailyLogs[dateKey];
      }
      const current = totals.get(entry.teamId) ?? 0;
      totals.set(
         entry.teamId,
         current + capDailyStudySeconds(Math.max(0, Math.floor(seconds)))
      );
   }

   return activeTeams.map((team) => {
      const dayLoggedSeconds = totals.get(team.id) ?? 0;
      return {
         teamId: team.id,
         dayLoggedSeconds,
         dayLoggedClock: formatSecondsToClock(dayLoggedSeconds),
      };
   });
}

export type LeaderboardViewMode = "individual" | "today" | "day" | "team";

/**
 * Resolves and validates a leaderboard view mode parameter (Law L7).
 * Explicit `?view=` values always win; DUOS battles default to the team view,
 * while every other format defaults to "individual" (Overall Rank).
 */
export function resolveLeaderboardViewMode(
   value?: string | null,
   format?: "TEAM_VS_TEAM" | "DUOS" | "SOLOS" | null
): LeaderboardViewMode {
   if (value === "today") return "today";
   if (value === "day") return "day";
   if (value === "team") return "team";
   if (value === "individual") return "individual";
   return format === "DUOS" ? "team" : "individual";
}

/**
 * Solos are teams of one, so only 'SOLOS' returns false.
 * Used to hide the team toggle and to fall back to "individual".
 */
export function supportsTeamView(format: string): boolean {
   return format !== "SOLOS";
}
