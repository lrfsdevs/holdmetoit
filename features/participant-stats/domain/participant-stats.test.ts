import { describe, expect, it } from "vitest";
import {
   calculateParticipantDailyTimeline,
   calculateParticipantSummaryStats,
   calculateParticipantTeamStats,
   calculateParticipantAccountability,
} from "./participant-stats";

describe("calculateParticipantDailyTimeline", () => {
   const startAt = "2026-10-01T00:00:00.000Z";
   const now = "2026-10-03T12:00:00.000Z"; // Day 3
   const totalDays = 7;

   it("builds a full timeline including zero-study days", () => {
      const logs = [
         {
            logDate: "2026-10-01T00:00:00.000Z",
            durationSeconds: 7200, // 2h
            isOverride: false,
         },
         {
            logDate: "2026-10-03T00:00:00.000Z",
            durationSeconds: 3600, // 1h
            isOverride: true,
         },
      ];

      const timeline = calculateParticipantDailyTimeline(
         startAt,
         totalDays,
         logs,
         now
      );

      expect(timeline.length).toBe(7);
      expect(timeline[0].dayNumber).toBe(1);
      expect(timeline[0].durationSeconds).toBe(7200);
      expect(timeline[0].durationClock).toBe("02:00:00");
      expect(timeline[0].cumulativeSeconds).toBe(7200);
      expect(timeline[0].isOverride).toBe(false);

      // Day 2 had no logs - should be 0s, cumulative still 7200
      expect(timeline[1].dayNumber).toBe(2);
      expect(timeline[1].durationSeconds).toBe(0);
      expect(timeline[1].durationClock).toBe("00:00:00");
      expect(timeline[1].cumulativeSeconds).toBe(7200);
      expect(timeline[1].isOverride).toBe(false);

      // Day 3 had override log
      expect(timeline[2].dayNumber).toBe(3);
      expect(timeline[2].durationSeconds).toBe(3600);
      expect(timeline[2].durationClock).toBe("01:00:00");
      expect(timeline[2].cumulativeSeconds).toBe(10800);
      expect(timeline[2].isOverride).toBe(true);
      expect(timeline[2].isToday).toBe(true);
   });

   it("aggregates multiple logs on the same date cleanly", () => {
      const logs = [
         {
            logDate: "2026-10-01T00:00:00.000Z",
            durationSeconds: 3600,
            isOverride: false,
         },
         {
            logDate: "2026-10-01T15:00:00.000Z",
            durationSeconds: 1800,
            isOverride: true,
         },
      ];

      const timeline = calculateParticipantDailyTimeline(startAt, 3, logs, now);
      expect(timeline[0].durationSeconds).toBe(5400); // 1.5h
      expect(timeline[0].durationClock).toBe("01:30:00");
      expect(timeline[0].isOverride).toBe(true);
   });

   it("handles empty logs gracefully", () => {
      const timeline = calculateParticipantDailyTimeline(startAt, 5, [], now);
      expect(timeline.length).toBe(5);
      expect(timeline.every((day) => day.durationSeconds === 0)).toBe(true);
      expect(timeline.every((day) => day.cumulativeSeconds === 0)).toBe(true);
      expect(timeline.every((day) => day.isLeave === false)).toBe(true);
   });

   it("tracks leave days correctly in the timeline", () => {
      const logs = [
         {
            logDate: "2026-10-01T00:00:00.000Z",
            durationSeconds: 0,
            isOverride: false,
            isLeave: true,
         },
      ];

      const timeline = calculateParticipantDailyTimeline(
         startAt,
         totalDays,
         logs,
         now
      );

      expect(timeline[0].isLeave).toBe(true);
      expect(timeline[0].durationSeconds).toBe(0);
      expect(timeline[1].isLeave).toBe(false);
   });

   it("does not accumulate or display cumulative hours for upcoming/future days", () => {
      const logs = [
         {
            logDate: "2026-10-01T00:00:00.000Z",
            durationSeconds: 7200,
            isOverride: false,
         },
      ];

      const timeline = calculateParticipantDailyTimeline(
         startAt,
         totalDays,
         logs,
         now
      );

      // Days 1..3: past/today
      expect(timeline[0].cumulativeClock).toBe("02:00:00");
      expect(timeline[1].cumulativeClock).toBe("02:00:00");
      expect(timeline[2].cumulativeClock).toBe("02:00:00");

      // Days 4..7: upcoming/future days must show "—" and not carry forward cumulative hours
      expect(timeline[3].dayNumber).toBe(4);
      expect(timeline[3].isFuture).toBe(true);
      expect(timeline[3].cumulativeSeconds).toBe(0);
      expect(timeline[3].cumulativeClock).toBe("—");
      expect(timeline[3].cumulativeHuman).toBe("—");

      expect(timeline[6].dayNumber).toBe(7);
      expect(timeline[6].isFuture).toBe(true);
      expect(timeline[6].cumulativeSeconds).toBe(0);
      expect(timeline[6].cumulativeClock).toBe("—");
      expect(timeline[6].cumulativeHuman).toBe("—");
   });
});

describe("calculateParticipantSummaryStats", () => {
   it("computes stats for normal progress below target", () => {
      const stats = calculateParticipantSummaryStats({
         totalLoggedSeconds: 36_000, // 10h
         todayLoggedSeconds: 7_200, // 2h
         targetSeconds: 72_000, // 20h
         rank: 2,
         totalParticipants: 10,
         paceStatus: "catch-up",
         paceLabel: "Catch-Up",
      });

      expect(stats.completionPercentage).toBe(50);
      expect(stats.isTargetMet).toBe(false);
      expect(stats.remainingSeconds).toBe(36_000);
      expect(stats.excessSeconds).toBe(0);
      expect(stats.totalLoggedClock).toBe("10:00:00");
      expect(stats.targetClock).toBe("20:00:00");
      expect(stats.rank).toBe(2);
   });

   it("computes stats when target is exceeded", () => {
      const stats = calculateParticipantSummaryStats({
         totalLoggedSeconds: 90_000, // 25h
         todayLoggedSeconds: 18_000, // 5h
         targetSeconds: 72_000, // 20h
         rank: 1,
         totalParticipants: 10,
         paceStatus: "serene",
         paceLabel: "Serene",
      });

      expect(stats.completionPercentage).toBe(100);
      expect(stats.isTargetMet).toBe(true);
      expect(stats.remainingSeconds).toBe(0);
      expect(stats.excessSeconds).toBe(18_000); // 5h excess
      expect(stats.excessClock).toBe("05:00:00");
   });

   it("handles zero target safely without division by zero", () => {
      const stats = calculateParticipantSummaryStats({
         totalLoggedSeconds: 0,
         todayLoggedSeconds: 0,
         targetSeconds: 0,
         rank: 5,
         totalParticipants: 5,
         paceStatus: "serene",
         paceLabel: "Serene",
      });

      expect(stats.completionPercentage).toBe(100);
      expect(stats.isTargetMet).toBe(true);
      expect(stats.remainingSeconds).toBe(0);
      expect(stats.excessSeconds).toBe(0);
      expect(Number.isNaN(stats.completionPercentage)).toBe(false);
   });

   it("preserves todayIsLeave and leavesCount in summary stats", () => {
      const stats = calculateParticipantSummaryStats({
         totalLoggedSeconds: 36_000,
         todayLoggedSeconds: 0,
         targetSeconds: 72_000,
         rank: 1,
         totalParticipants: 5,
         paceStatus: "serene",
         paceLabel: "Serene",
         todayIsLeave: true,
         leavesCount: 2,
      });

      expect(stats.todayIsLeave).toBe(true);
      expect(stats.leavesCount).toBe(2);
   });
});

describe("calculateParticipantTeamStats", () => {
   it("calculates contribution percentage and preserves participant team rank correctly", () => {
      const teamStats = calculateParticipantTeamStats({
         teamId: "team-1",
         teamName: "Honey Bees",
         teamColor: "#eab308",
         teamIcon: "🐝",
         teamRank: 1,
         participantTeamRank: 2,
         teamTotalLoggedSeconds: 100_000,
         participantTotalLoggedSeconds: 25_000,
         companionCount: 4,
      });

      expect(teamStats.participantTeamRank).toBe(2);
      expect(teamStats.teamRank).toBe(1);
      expect(teamStats.participantContributionPercentage).toBe(25);
      expect(teamStats.teamTotalLoggedClock).toBe("27:46:40");
      expect(teamStats.teamName).toBe("Honey Bees");
   });

   it("handles zero team total seconds safely without NaN", () => {
      const teamStats = calculateParticipantTeamStats({
         teamId: "team-2",
         teamName: "Butterflies",
         teamColor: "#3b82f6",
         teamIcon: "🦋",
         teamRank: 2,
         participantTeamRank: 1,
         teamTotalLoggedSeconds: 0,
         participantTotalLoggedSeconds: 0,
         companionCount: 3,
      });

      expect(teamStats.participantTeamRank).toBe(1);
      expect(teamStats.participantContributionPercentage).toBe(0);
      expect(Number.isNaN(teamStats.participantContributionPercentage)).toBe(
         false
      );
   });
});

describe("calculateParticipantAccountability", () => {
   it("calculates deficit and required daily pace during active challenge", () => {
      const acc = calculateParticipantAccountability({
         targetSeconds: 72_000, // 20h
         totalLoggedSeconds: 36_000, // 10h logged, 10h deficit
         daysRemaining: 2,
         isCompleted: false,
         status: "NORMAL",
      });

      expect(acc.deficitSeconds).toBe(36_000);
      expect(acc.requiredDailyPaceSeconds).toBe(18_000); // 5h / day
      expect(acc.requiredDailyPaceClock).toBe("05:00:00");
      expect(acc.statusBadge).toBe("Catch-Up");
      expect(acc.isPunished).toBe(false);
   });

   it("flags punished on completed challenge with deficit", () => {
      const acc = calculateParticipantAccountability({
         targetSeconds: 72_000,
         totalLoggedSeconds: 36_000,
         daysRemaining: 0,
         isCompleted: true,
         status: "NORMAL",
         punishmentRecord: {
            isPardoned: false,
            pardonReason: null,
         },
      });

      expect(acc.deficitSeconds).toBe(36_000);
      expect(acc.requiredDailyPaceSeconds).toBe(0);
      expect(acc.statusBadge).toBe("Punished");
      expect(acc.isPunished).toBe(true);
      expect(acc.isPardoned).toBe(false);
   });

   it("recognizes pardon on completed challenge", () => {
      const acc = calculateParticipantAccountability({
         targetSeconds: 72_000,
         totalLoggedSeconds: 36_000,
         daysRemaining: 0,
         isCompleted: true,
         status: "EXCUSED",
         punishmentRecord: {
            isPardoned: true,
            pardonReason: "Medical emergency",
         },
      });

      expect(acc.statusBadge).toBe("Excused");
      expect(acc.isPardoned).toBe(true);
      expect(acc.pardonReason).toBe("Medical emergency");
   });
});
