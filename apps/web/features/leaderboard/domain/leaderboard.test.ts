import { describe, expect, it } from "vitest";

import { DurationRangeError } from "@/features/study-logs/domain/duration";
import {
   aggregateTeamScores,
   calculateLeadMargin,
   calculateSharePercentages,
   rankByTodaySeconds,
   resolveLeaderboardViewMode,
   supportsTeamView,
} from "@/features/leaderboard/domain/leaderboard";

const teams = [{ id: "bees" }, { id: "butterflies" }, { id: "solos-team-1" }];

describe("aggregateTeamScores", () => {
   it("sums participant seconds per team and sorts descending", () => {
      const logs = [
         { teamId: "bees", loggedSeconds: 22_500 },
         { teamId: "bees", loggedSeconds: 18_000 },
         { teamId: "butterflies", loggedSeconds: 21_000 },
         { teamId: "butterflies", loggedSeconds: 19_335 },
      ];

      const result = aggregateTeamScores(teams.slice(0, 2), logs);

      expect(result).toEqual([
         { teamId: "bees", totalSeconds: 40_500 },
         { teamId: "butterflies", totalSeconds: 40_335 },
      ]);
   });

   it("returns zero totals for teams with no logs", () => {
      const result = aggregateTeamScores(teams, []);

      expect(result).toEqual([
         { teamId: "bees", totalSeconds: 0 },
         { teamId: "butterflies", totalSeconds: 0 },
         { teamId: "solos-team-1", totalSeconds: 0 },
      ]);
   });

   it("treats solo teams as standard team aggregates (Law L1)", () => {
      const soloTeams = [{ id: "solo-a" }, { id: "solo-b" }];
      const logs = [
         { teamId: "solo-a", loggedSeconds: 12_000 },
         { teamId: "solo-b", loggedSeconds: 9_500 },
      ];

      const result = aggregateTeamScores(soloTeams, logs);

      expect(result[0]).toEqual({ teamId: "solo-a", totalSeconds: 12_000 });
      expect(result[1]).toEqual({ teamId: "solo-b", totalSeconds: 9_500 });
   });

   it("includes orphan log team IDs not present in the teams array", () => {
      const result = aggregateTeamScores(
         [{ id: "bees" }],
         [
            { teamId: "bees", loggedSeconds: 1_000 },
            { teamId: "orphan", loggedSeconds: 500 },
         ]
      );

      expect(result).toEqual([
         { teamId: "bees", totalSeconds: 1_000 },
         { teamId: "orphan", totalSeconds: 500 },
      ]);
   });

   it("excludes teams marked as isDeleted", () => {
      const result = aggregateTeamScores(
         [
            { id: "bees", isDeleted: false },
            { id: "butterflies", isDeleted: true },
         ],
         [{ teamId: "bees", loggedSeconds: 1_000 }]
      );

      expect(result).toEqual([{ teamId: "bees", totalSeconds: 1_000 }]);
   });

   it("rejects negative logged seconds", () => {
      expect(() =>
         aggregateTeamScores(teams, [{ teamId: "bees", loggedSeconds: -1 }])
      ).toThrow(DurationRangeError);
   });
});

describe("calculateLeadMargin", () => {
   it("identifies team A as leader", () => {
      const result = calculateLeadMargin(198_000, 183_935);

      expect(result).toEqual({
         marginSeconds: 14_065,
         leader: "a",
         signedMarginSeconds: 14_065,
      });
   });

   it("identifies team B as leader", () => {
      const result = calculateLeadMargin(40_335, 40_500);

      expect(result).toEqual({
         marginSeconds: 165,
         leader: "b",
         signedMarginSeconds: -165,
      });
   });

   it("returns a tie when totals are equal", () => {
      const result = calculateLeadMargin(50_000, 50_000);

      expect(result).toEqual({
         marginSeconds: 0,
         leader: "tie",
         signedMarginSeconds: 0,
      });
   });

   it("handles zero-second totals", () => {
      expect(calculateLeadMargin(0, 0).leader).toBe("tie");
   });

   it("rejects negative totals", () => {
      expect(() => calculateLeadMargin(-1, 0)).toThrow(DurationRangeError);
      expect(() => calculateLeadMargin(0, -1)).toThrow(DurationRangeError);
   });
});

describe("calculateSharePercentages", () => {
   it("returns 100% and 0% when Team A has all hours and Team B has zero", () => {
      const result = calculateSharePercentages(25_200, 0);

      expect(result).toEqual({
         ratioPercentageA: 100,
         ratioPercentageB: 0,
      });
   });

   it("returns 0% and 100% when Team A has zero and Team B has all hours", () => {
      const result = calculateSharePercentages(0, 18_000);

      expect(result).toEqual({
         ratioPercentageA: 0,
         ratioPercentageB: 100,
      });
   });

   it("returns 0% and 0% when neither team has logged any hours", () => {
      const result = calculateSharePercentages(0, 0);

      expect(result).toEqual({
         ratioPercentageA: 0,
         ratioPercentageB: 0,
      });
   });

   it("splits equally when both teams have logged identical hours", () => {
      const result = calculateSharePercentages(18_000, 18_000);

      expect(result).toEqual({
         ratioPercentageA: 50,
         ratioPercentageB: 50,
      });
   });

   it("calculates 75% and 25% share correctly", () => {
      const result = calculateSharePercentages(27_000, 9_000);

      expect(result).toEqual({
         ratioPercentageA: 75,
         ratioPercentageB: 25,
      });
   });

   it("handles fractional percentages summing to 100%", () => {
      const result = calculateSharePercentages(10_000, 20_000);

      expect(result.ratioPercentageA).toBe(33.3);
      expect(result.ratioPercentageB).toBe(66.7);
      expect(result.ratioPercentageA + result.ratioPercentageB).toBe(100);
   });

   it("rejects negative totals", () => {
      expect(() => calculateSharePercentages(-1, 0)).toThrow(
         DurationRangeError
      );
      expect(() => calculateSharePercentages(0, -1)).toThrow(
         DurationRangeError
      );
   });
});

describe("rankByTodaySeconds", () => {
   it("sorts entries with highest todayLoggedSeconds first and assigns todayRank", () => {
      const entries = [
         { id: "p1", todayLoggedSeconds: 3600, totalLoggedSeconds: 10000 },
         { id: "p2", todayLoggedSeconds: 7200, totalLoggedSeconds: 8000 },
         { id: "p3", todayLoggedSeconds: 1800, totalLoggedSeconds: 20000 },
      ];

      const ranked = rankByTodaySeconds(entries);

      expect(ranked).toEqual([
         {
            id: "p2",
            todayLoggedSeconds: 7200,
            totalLoggedSeconds: 8000,
            todayRank: 1,
         },
         {
            id: "p1",
            todayLoggedSeconds: 3600,
            totalLoggedSeconds: 10000,
            todayRank: 2,
         },
         {
            id: "p3",
            todayLoggedSeconds: 1800,
            totalLoggedSeconds: 20000,
            todayRank: 3,
         },
      ]);
   });

   it("breaks ties using totalLoggedSeconds descending", () => {
      const entries = [
         { id: "p1", todayLoggedSeconds: 3600, totalLoggedSeconds: 10000 },
         { id: "p2", todayLoggedSeconds: 3600, totalLoggedSeconds: 15000 },
         { id: "p3", todayLoggedSeconds: 3600, totalLoggedSeconds: 8000 },
      ];

      const ranked = rankByTodaySeconds(entries);

      expect(ranked[0]?.id).toBe("p2");
      expect(ranked[0]?.todayRank).toBe(1);
      expect(ranked[1]?.id).toBe("p1");
      expect(ranked[1]?.todayRank).toBe(2);
      expect(ranked[2]?.id).toBe("p3");
      expect(ranked[2]?.todayRank).toBe(3);
   });

   it("handles participants with 0 seconds today", () => {
      const entries = [
         { id: "p1", todayLoggedSeconds: 0, totalLoggedSeconds: 12000 },
         { id: "p2", todayLoggedSeconds: 5000, totalLoggedSeconds: 6000 },
         { id: "p3", todayLoggedSeconds: 0, totalLoggedSeconds: 4000 },
      ];

      const ranked = rankByTodaySeconds(entries);

      expect(ranked[0]?.id).toBe("p2");
      expect(ranked[0]?.todayRank).toBe(1);
      expect(ranked[1]?.id).toBe("p1");
      expect(ranked[1]?.todayRank).toBe(2);
      expect(ranked[2]?.id).toBe("p3");
      expect(ranked[2]?.todayRank).toBe(3);
   });

   it("returns empty array when input is empty", () => {
      expect(rankByTodaySeconds([])).toEqual([]);
   });

   it("preserves extra fields while adding todayRank", () => {
      const entries = [
         {
            displayName: "Afnan",
            teamName: "Serpents",
            todayLoggedSeconds: 4000,
            totalLoggedSeconds: 10000,
            status: "studying",
         },
      ];

      const ranked = rankByTodaySeconds(entries);

      expect(ranked).toEqual([
         {
            displayName: "Afnan",
            teamName: "Serpents",
            todayLoggedSeconds: 4000,
            totalLoggedSeconds: 10000,
            status: "studying",
            todayRank: 1,
         },
      ]);
   });
});

describe("resolveLeaderboardViewMode", () => {
   it("resolves 'today' correctly", () => {
      expect(resolveLeaderboardViewMode("today")).toBe("today");
   });

   it("resolves 'team' correctly", () => {
      expect(resolveLeaderboardViewMode("team")).toBe("team");
   });

   it("resolves 'individual' correctly", () => {
      expect(resolveLeaderboardViewMode("individual")).toBe("individual");
   });

   it("defaults invalid, null, or undefined values to 'individual'", () => {
      expect(resolveLeaderboardViewMode(undefined)).toBe("individual");
      expect(resolveLeaderboardViewMode(null)).toBe("individual");
      expect(resolveLeaderboardViewMode("")).toBe("individual");
      expect(resolveLeaderboardViewMode("unknown")).toBe("individual");
   });

   it("defaults DUOS battles to the team view", () => {
      expect(resolveLeaderboardViewMode(undefined, "DUOS")).toBe("team");
      expect(resolveLeaderboardViewMode(null, "DUOS")).toBe("team");
      expect(resolveLeaderboardViewMode("", "DUOS")).toBe("team");
   });

   it("keeps other formats on the individual default", () => {
      expect(resolveLeaderboardViewMode(undefined, "TEAM_VS_TEAM")).toBe(
         "individual"
      );
      expect(resolveLeaderboardViewMode(undefined, "SOLOS")).toBe("individual");
   });

   it("lets an explicit view override the DUOS default", () => {
      expect(resolveLeaderboardViewMode("individual", "DUOS")).toBe(
         "individual"
      );
      expect(resolveLeaderboardViewMode("today", "DUOS")).toBe("today");
      expect(resolveLeaderboardViewMode("team", "TEAM_VS_TEAM")).toBe("team");
   });
});

describe("supportsTeamView", () => {
   it("is false only for SOLOS", () => {
      expect(supportsTeamView("SOLOS")).toBe(false);
      expect(supportsTeamView("TEAM_VS_TEAM")).toBe(true);
      expect(supportsTeamView("DUOS")).toBe(true);
   });
});
