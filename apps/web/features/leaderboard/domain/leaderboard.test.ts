import { describe, expect, it } from "vitest";

import { DurationRangeError } from "@/features/study-logs/domain/duration";
import {
   aggregateTeamScores,
   calculateLeadMargin,
   calculateParticipantScoredSeconds,
   calculateSharePercentages,
   calculateTeamDayScores,
   formatLeadMarginDelta,
   formatLeaderboardDayHeading,
   getLeaderboardDayOptions,
   getParticipantDayLoggedSeconds,
   rankByDaySeconds,
   rankByTodaySeconds,
   resolveLeaderboardSelectedDay,
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

   it("preserves frozen historical hours of a withdrawn member and excludes post-withdrawal logs (GH-#210)", () => {
      const withdrawalAt = new Date("2026-10-25T15:00:00.000Z");
      const logs = [
         {
            teamId: "bees",
            isWithdrawn: false,
            dailyStudyLogs: [
               {
                  durationSeconds: 10_000,
                  createdAt: new Date("2026-10-24T12:00:00.000Z"),
               },
            ],
         },
         {
            teamId: "bees",
            isWithdrawn: true,
            withdrawalAt,
            dailyStudyLogs: [
               {
                  durationSeconds: 14_000,
                  createdAt: new Date("2026-10-24T10:00:00.000Z"),
               },
               {
                  durationSeconds: 7_000,
                  createdAt: new Date("2026-10-26T10:00:00.000Z"),
               },
            ],
         },
         {
            teamId: "butterflies",
            isWithdrawn: false,
            dailyStudyLogs: [
               {
                  durationSeconds: 20_000,
                  createdAt: new Date("2026-10-24T12:00:00.000Z"),
               },
            ],
         },
      ];

      const result = aggregateTeamScores(teams.slice(0, 2), logs);

      expect(result).toEqual([
         { teamId: "bees", totalSeconds: 24_000 },
         { teamId: "butterflies", totalSeconds: 20_000 },
      ]);
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

describe("formatLeadMarginDelta", () => {
   it("returns 'Tied' when margin is zero", () => {
      expect(formatLeadMarginDelta(0)).toBe("Tied");
   });

   it("formats positive margin seconds with + prefix and ahead suffix", () => {
      expect(formatLeadMarginDelta(3_600)).toBe("+1h ahead");
      expect(formatLeadMarginDelta(16_200)).toBe("+4h 30m ahead");
      expect(formatLeadMarginDelta(27_900)).toBe("+7h 45m ahead");
      expect(formatLeadMarginDelta(3_661)).toBe("+1h 1m 1s ahead");
   });

   it("rejects negative or fractional values", () => {
      expect(() => formatLeadMarginDelta(-1)).toThrow(DurationRangeError);
      expect(() => formatLeadMarginDelta(2.5)).toThrow(DurationRangeError);
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
   it("resolves 'day' correctly", () => {
      expect(resolveLeaderboardViewMode("day")).toBe("day");
   });

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

describe("getParticipantDayLoggedSeconds", () => {
   it("extracts logged seconds from dailyLogs for targetDateKey", () => {
      const entry = {
         dailyLogs: { "2026-10-20": 7200, "2026-10-21": 3600 },
         todayLoggedSeconds: 1800,
      };
      expect(getParticipantDayLoggedSeconds(entry, "2026-10-20")).toBe(7200);
      expect(getParticipantDayLoggedSeconds(entry, "2026-10-21")).toBe(3600);
      expect(getParticipantDayLoggedSeconds(entry, "2026-10-22")).toBe(0);
   });

   it("falls back to todayLoggedSeconds when target matches todayDateKey", () => {
      const entry = {
         todayLoggedSeconds: 5400,
      };
      expect(
         getParticipantDayLoggedSeconds(entry, "2026-10-22", "2026-10-22")
      ).toBe(5400);
      expect(
         getParticipantDayLoggedSeconds(entry, "2026-10-21", "2026-10-22")
      ).toBe(0);
   });

   it("caps seconds at MAX_COUNTED_DAILY_STUDY_SECONDS (43,200s / 12h)", () => {
      const entry = {
         dailyLogs: { "2026-10-20": 100_000 },
      };
      expect(getParticipantDayLoggedSeconds(entry, "2026-10-20")).toBe(43_200);
   });
});

describe("rankByDaySeconds", () => {
   it("sorts entries with highest day study seconds first and assigns dayRank and todayRank", () => {
      const entries = [
         {
            id: "p1",
            displayName: "Alice",
            dailyLogs: { "2026-10-21": 3600 },
            totalLoggedSeconds: 10000,
         },
         {
            id: "p2",
            displayName: "Bob",
            dailyLogs: { "2026-10-21": 7200 },
            totalLoggedSeconds: 8000,
         },
         {
            id: "p3",
            displayName: "Charlie",
            dailyLogs: { "2026-10-21": 1800 },
            totalLoggedSeconds: 20000,
         },
      ];

      const ranked = rankByDaySeconds(entries, "2026-10-21");

      expect(ranked[0]).toMatchObject({
         id: "p2",
         dayRank: 1,
         todayRank: 1,
         dayLoggedSeconds: 7200,
         dayLoggedClock: "02:00:00",
      });
      expect(ranked[1]).toMatchObject({
         id: "p1",
         dayRank: 2,
         todayRank: 2,
         dayLoggedSeconds: 3600,
         dayLoggedClock: "01:00:00",
      });
      expect(ranked[2]).toMatchObject({
         id: "p3",
         dayRank: 3,
         todayRank: 3,
         dayLoggedSeconds: 1800,
         dayLoggedClock: "00:30:00",
      });
   });

   it("breaks ties using cumulative totalLoggedSeconds descending", () => {
      const entries = [
         {
            id: "p1",
            displayName: "Alice",
            dailyLogs: { "2026-10-21": 3600 },
            totalLoggedSeconds: 10000,
         },
         {
            id: "p2",
            displayName: "Bob",
            dailyLogs: { "2026-10-21": 3600 },
            totalLoggedSeconds: 20000,
         },
      ];

      const ranked = rankByDaySeconds(entries, "2026-10-21");

      expect(ranked[0].id).toBe("p2");
      expect(ranked[1].id).toBe("p1");
   });

   it("breaks secondary ties using displayName alphabetical ascending", () => {
      const entries = [
         {
            id: "p2",
            displayName: "Zara",
            dailyLogs: { "2026-10-21": 3600 },
            totalLoggedSeconds: 10000,
         },
         {
            id: "p1",
            displayName: "Adam",
            dailyLogs: { "2026-10-21": 3600 },
            totalLoggedSeconds: 10000,
         },
      ];

      const ranked = rankByDaySeconds(entries, "2026-10-21");

      expect(ranked[0].id).toBe("p1");
      expect(ranked[1].id).toBe("p2");
   });

   it("handles participants with 0 seconds on target date", () => {
      const entries = [
         {
            id: "p1",
            displayName: "Alice",
            dailyLogs: {},
            totalLoggedSeconds: 5000,
         },
      ];

      const ranked = rankByDaySeconds(entries, "2026-10-21");

      expect(ranked[0]).toMatchObject({
         id: "p1",
         dayRank: 1,
         dayLoggedSeconds: 0,
         dayLoggedClock: "00:00:00",
      });
   });
});

describe("getLeaderboardDayOptions", () => {
   const startAt = "2026-10-20T00:00:00.000Z";

   it("returns day options for an ACTIVE challenge up to currentDayNumber with today flagged", () => {
      const options = getLeaderboardDayOptions({
         startAt,
         totalDays: 7,
         currentDayNumber: 3,
         status: "ACTIVE",
      });

      expect(options).toHaveLength(3);
      expect(options[0]).toMatchObject({
         dayNumber: 1,
         dateKey: "2026-10-20",
         label: "Day 1 · Oct 20",
         shortLabel: "Day 1",
         isToday: false,
      });
      expect(options[2]).toMatchObject({
         dayNumber: 3,
         dateKey: "2026-10-22",
         label: "Today (Day 3 · Oct 22)",
         shortLabel: "Today",
         isToday: true,
      });
   });

   it("returns all challenge days for a COMPLETED challenge with final day flagged", () => {
      const options = getLeaderboardDayOptions({
         startAt,
         totalDays: 5,
         currentDayNumber: 8,
         status: "COMPLETED",
      });

      expect(options).toHaveLength(5);
      expect(options[4]).toMatchObject({
         dayNumber: 5,
         dateKey: "2026-10-24",
         label: "Day 5 · Oct 24 (Final Day)",
         isToday: false,
         isFinalDay: true,
      });
   });

   it("returns Day 1 for an UPCOMING challenge", () => {
      const options = getLeaderboardDayOptions({
         startAt,
         totalDays: 7,
         currentDayNumber: 0,
         status: "UPCOMING",
      });

      expect(options).toHaveLength(1);
      expect(options[0].dayNumber).toBe(1);
   });
});

describe("resolveLeaderboardSelectedDay", () => {
   const startAt = "2026-10-20T00:00:00.000Z";

   it("resolves explicit valid day number", () => {
      const resolved = resolveLeaderboardSelectedDay({
         requestedDay: 2,
         startAt,
         totalDays: 7,
         currentDayNumber: 4,
         status: "ACTIVE",
      });

      expect(resolved).toEqual({
         dayNumber: 2,
         dateKey: "2026-10-21",
         isToday: false,
         formattedDate: "Oct 21",
      });
   });

   it("resolves valid dateKey string", () => {
      const resolved = resolveLeaderboardSelectedDay({
         requestedDateKey: "2026-10-22",
         startAt,
         totalDays: 7,
         currentDayNumber: 4,
         status: "ACTIVE",
      });

      expect(resolved).toEqual({
         dayNumber: 3,
         dateKey: "2026-10-22",
         isToday: false,
         formattedDate: "Oct 22",
      });
   });

   it("falls back to current day (Today) for active challenges when out of bounds or invalid", () => {
      const resolvedOutOfBounds = resolveLeaderboardSelectedDay({
         requestedDay: 99,
         startAt,
         totalDays: 7,
         currentDayNumber: 3,
         status: "ACTIVE",
      });
      expect(resolvedOutOfBounds).toMatchObject({
         dayNumber: 3,
         dateKey: "2026-10-22",
         isToday: true,
      });

      const resolvedInvalid = resolveLeaderboardSelectedDay({
         requestedDay: "invalid",
         startAt,
         totalDays: 7,
         currentDayNumber: 3,
         status: "ACTIVE",
      });
      expect(resolvedInvalid).toMatchObject({
         dayNumber: 3,
         isToday: true,
      });

      const resolvedPartialNumeric = resolveLeaderboardSelectedDay({
         requestedDay: "2garbage",
         startAt,
         totalDays: 7,
         currentDayNumber: 3,
         status: "ACTIVE",
      });
      expect(resolvedPartialNumeric).toMatchObject({
         dayNumber: 3,
         isToday: true,
      });

      const resolvedFractional = resolveLeaderboardSelectedDay({
         requestedDay: 2.5,
         startAt,
         totalDays: 7,
         currentDayNumber: 3,
         status: "ACTIVE",
      });
      expect(resolvedFractional).toMatchObject({
         dayNumber: 3,
         isToday: true,
      });
   });

   it("defaults to final day for completed challenges", () => {
      const resolved = resolveLeaderboardSelectedDay({
         startAt,
         totalDays: 7,
         currentDayNumber: 10,
         status: "COMPLETED",
      });

      expect(resolved).toMatchObject({
         dayNumber: 7,
         dateKey: "2026-10-26",
         isToday: false,
      });
   });
});

describe("formatLeaderboardDayHeading", () => {
   it("formats heading for past days with year", () => {
      expect(
         formatLeaderboardDayHeading({
            dayNumber: 3,
            dateKey: "2026-10-22",
            isToday: false,
         })
      ).toBe("Showing Day 3 Standings · Oct 22, 2026");
   });

   it("formats heading for today with year", () => {
      expect(
         formatLeaderboardDayHeading({
            dayNumber: 3,
            dateKey: "2026-10-22",
            isToday: true,
         })
      ).toBe("Showing Today's Standings · Oct 22, 2026");
   });
});

describe("calculateTeamDayScores", () => {
   const teams = [{ id: "t1" }, { id: "t2" }];

   it("aggregates participant day seconds by team and formats clocks", () => {
      const entries = [
         { teamId: "t1", dayLoggedSeconds: 3600 },
         { teamId: "t1", dayLoggedSeconds: 1800 },
         { teamId: "t2", dayLoggedSeconds: 7200 },
      ];

      const scores = calculateTeamDayScores(teams, entries);

      expect(scores).toEqual([
         { teamId: "t1", dayLoggedSeconds: 5400, dayLoggedClock: "01:30:00" },
         { teamId: "t2", dayLoggedSeconds: 7200, dayLoggedClock: "02:00:00" },
      ]);
   });

   it("supports extracting day seconds from dailyLogs for a given dateKey", () => {
      const entries = [
         { teamId: "t1", dailyLogs: { "2026-10-20": 4000 } },
         { teamId: "t2", dailyLogs: { "2026-10-20": 8000 } },
      ];

      const scores = calculateTeamDayScores(teams, entries, "2026-10-20");

      expect(scores).toEqual([
         { teamId: "t1", dayLoggedSeconds: 4000, dayLoggedClock: "01:06:40" },
         { teamId: "t2", dayLoggedSeconds: 8000, dayLoggedClock: "02:13:20" },
      ]);
   });
});
