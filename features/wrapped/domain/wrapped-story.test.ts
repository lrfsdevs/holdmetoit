import { describe, expect, it } from "vitest";

import {
   buildLinePath,
   buildTickIndices,
   buildWrappedChart,
   buildWrappedPeriodLabel,
   buildWrappedStory,
   buildWrappedVerdict,
} from "./wrapped-story";
import type {
   ChallengeWrappedViewModel,
   ParticipantWrappedViewModel,
   WrappedDailyPoint,
} from "./wrapped";

function buildDailyPoint(
   overrides: Partial<WrappedDailyPoint> = {}
): WrappedDailyPoint {
   return {
      dateKey: "2026-10-05",
      label: "Oct 5",
      dayNumber: 1,
      durationSeconds: 3_600,
      durationHuman: "1h",
      averageSeconds: 1_800,
      isBestDay: false,
      ...overrides,
   };
}

function buildViewer(
   overrides: Partial<ParticipantWrappedViewModel> = {}
): ParticipantWrappedViewModel {
   return {
      participantId: "part-1",
      displayName: "AuraStudier",
      image: null,
      rank: 1,
      totalParticipants: 2,
      totalSeconds: 12_600,
      totalClock: "03:30:00",
      totalHuman: "3h 30m",
      targetSeconds: 12_600,
      targetClock: "03:30:00",
      completionPercentage: 100,
      isTargetMet: true,
      hoursDeficitSeconds: 0,
      weeklyTasksCompletedCount: 2,
      weeklyTasksTotalCount: 2,
      teamId: "team-bees",
      teamName: "Honey Bees",
      teamColor: null,
      teamIcon: null,
      teamResult: "winner",
      contributionPercentage: 75,
      bestDay: null,
      timesVsAverage: 1.5,
      daily: [
         buildDailyPoint({
            dateKey: "2026-10-05",
            label: "Oct 5",
            durationSeconds: 3_600,
            isBestDay: true,
            durationHuman: "1h",
         }),
         buildDailyPoint({
            dateKey: "2026-10-06",
            label: "Oct 6",
            dayNumber: 2,
            durationSeconds: 9_000,
            durationHuman: "2h 30m",
            averageSeconds: 3_600,
         }),
      ],
      verdict: "saved",
      reasons: [],
      ...overrides,
   };
}

function buildWrapped(
   viewer: ParticipantWrappedViewModel | null
): ChallengeWrappedViewModel {
   return {
      challengeId: "chal-1",
      title: "October Team Battle",
      unlockedAt: "2026-10-12T00:00:00.000Z",
      startAt: "2026-10-05T00:00:00.000Z",
      endAt: "2026-10-12T00:00:00.000Z",
      totalDays: 7,
      participantsCount: 2,
      challengeTotalSeconds: 20_000,
      challengeTotalClock: "05:33:20",
      winningTeamIds: ["team-bees"],
      teams: [],
      viewer,
   };
}

describe("buildWrappedPeriodLabel", () => {
   it("renders the first and last challenge days in UTC", () => {
      expect(
         buildWrappedPeriodLabel(
            "2026-10-05T00:00:00.000Z",
            "2026-10-12T00:00:00.000Z"
         )
      ).toBe("Oct 5 – 11 · Wrapped");
   });

   it("handles month boundaries and single-day challenges", () => {
      expect(
         buildWrappedPeriodLabel(
            "2026-10-28T00:00:00.000Z",
            "2026-11-04T00:00:00.000Z"
         )
      ).toBe("Oct 28 – Nov 3 · Wrapped");

      expect(
         buildWrappedPeriodLabel(
            "2026-10-05T00:00:00.000Z",
            "2026-10-06T00:00:00.000Z"
         )
      ).toBe("Oct 5 · Wrapped");
   });
});

describe("buildTickIndices", () => {
   it("spreads ~5 ticks for a 31-day challenge including both ends", () => {
      expect(buildTickIndices(31)).toEqual([0, 8, 15, 23, 30]);
   });

   it("handles short challenges and single days", () => {
      expect(buildTickIndices(7)).toEqual([0, 2, 3, 5, 6]);
      expect(buildTickIndices(1)).toEqual([0]);
      expect(buildTickIndices(0)).toEqual([0]);
   });
});

describe("buildLinePath", () => {
   it("builds a 1-decimal M/L path", () => {
      expect(
         buildLinePath([
            { x: 32, y: 160 },
            { x: 174.25, y: 86 },
         ])
      ).toBe("M32.0 160.0 L174.3 86.0");
   });

   it("returns an empty string for no points", () => {
      expect(buildLinePath([])).toBe("");
   });
});

describe("buildWrappedChart", () => {
   it("computes geometry, paths, ticks and the best-day marker", () => {
      const chart = buildWrappedChart(buildViewer().daily);

      expect(chart.yMax).toBe(3); // max 2.5h * 1.1 -> 3
      expect(chart.ticks).toEqual([0, 1]);
      expect(chart.bestIndex).toBe(0);
      expect(chart.bestLabel).toBe("Oct 5");
      expect(chart.bestHuman).toBe("1h");
      expect(chart.x).toHaveLength(2);
      expect(chart.youPath.startsWith("M32.0")).toBe(true);
      expect(chart.areaPath.endsWith("Z")).toBe(true);
   });

   it("marks no best day when every value is zero", () => {
      const chart = buildWrappedChart([
         buildDailyPoint({
            durationSeconds: 0,
            averageSeconds: 0,
            isBestDay: false,
         }),
      ]);

      expect(chart.bestIndex).toBe(-1);
      expect(chart.bestLabel).toBeNull();
      expect(chart.yMax).toBe(1);
   });

   it("keeps single-day charts stable (no division by zero)", () => {
      const chart = buildWrappedChart([buildDailyPoint()]);
      expect(Number.isFinite(chart.x[0])).toBe(true);
      expect(chart.x[0]).toBe((chart.x0 + chart.x1) / 2);
   });
});

describe("buildWrappedVerdict", () => {
   it("builds the saved verdict", () => {
      const verdict = buildWrappedVerdict(buildViewer());
      expect(verdict.stamp).toBe("Saved");
      expect(verdict.tone).toBe("saved");
      expect(verdict.headline).toBe("You cleared every condition.");
      expect(verdict.note).toContain("Seriously good work, AuraStudier.");
   });

   it("lists the failed conditions for a punished verdict", () => {
      const verdict = buildWrappedVerdict(
         buildViewer({
            verdict: "punished",
            reasons: ["hours_deficit", "incomplete_weekly_tasks"],
         })
      );

      expect(verdict.stamp).toBe("Punished");
      expect(verdict.headline).toBe("You missed it this time.");
      expect(verdict.note).toContain("target hours · weekly tasks");
   });

   it("builds the excused verdict", () => {
      const verdict = buildWrappedVerdict(
         buildViewer({ verdict: "excused", reasons: [] })
      );

      expect(verdict.stamp).toBe("Excused");
      expect(verdict.tone).toBe("excused");
      expect(verdict.headline).toBe("The host excused you.");
   });
});

describe("buildWrappedStory", () => {
   it("returns null for spectators", () => {
      expect(buildWrappedStory(buildWrapped(null))).toBeNull();
   });

   it("assembles the full story model", () => {
      const story = buildWrappedStory(buildWrapped(buildViewer()));

      expect(story).not.toBeNull();
      expect(story?.periodLabel).toBe("Oct 5 – 11 · Wrapped");
      expect(story?.time.minutes).toBe(210); // 12600s
      expect(story?.time.totalHuman).toBe("3h 30m");
      expect(story?.chartCopy.timesVsAverage).toBe(1.5);
      expect(story?.chartCopy.contributionPercent).toBe(75);
      expect(story?.verdict.stamp).toBe("Saved");
   });
});
