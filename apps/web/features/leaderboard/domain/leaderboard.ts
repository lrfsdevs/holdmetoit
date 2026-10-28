import { DurationRangeError } from "@/features/study-logs/domain/duration";

export interface TeamRef {
   id: string;
   isDeleted?: boolean;
}

export interface ParticipantLogEntry {
   teamId: string;
   loggedSeconds: number;
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
 * Aggregates participant logged seconds by team (Law L1).
 * Every team in `teams` receives an entry; teams with no logs total 0.
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
      assertNonNegativeInteger("loggedSeconds", log.loggedSeconds);

      const current = totals.get(log.teamId) ?? 0;
      totals.set(log.teamId, current + log.loggedSeconds);
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

export type LeaderboardViewMode = "individual" | "today" | "team";

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
