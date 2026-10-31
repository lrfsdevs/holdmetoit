import { describe, expect, it } from "vitest";
import {
   calculateStudyStreaks,
   formatLifetimeStudyStats,
   toUtcDateKey,
} from "./global-profile";

describe("global-profile domain logic", () => {
   describe("toUtcDateKey", () => {
      it("formats date to YYYY-MM-DD in UTC", () => {
         const date = new Date("2026-10-31T15:30:00.000Z");
         expect(toUtcDateKey(date)).toBe("2026-10-31");
      });
   });

   describe("calculateStudyStreaks", () => {
      const refDate = new Date("2026-10-31T12:00:00.000Z"); // Today is 2026-10-31

      it("returns zeroes when array is empty or null", () => {
         expect(calculateStudyStreaks([], refDate)).toEqual({
            currentStreak: 0,
            longestStreak: 0,
            totalActiveStudyDays: 0,
         });
      });

      it("calculates 1 day streak when studied today", () => {
         const result = calculateStudyStreaks(["2026-10-31"], refDate);
         expect(result).toEqual({
            currentStreak: 1,
            longestStreak: 1,
            totalActiveStudyDays: 1,
         });
      });

      it("calculates active streak preserved from yesterday when today has no study yet", () => {
         const result = calculateStudyStreaks(["2026-10-30"], refDate);
         expect(result).toEqual({
            currentStreak: 1,
            longestStreak: 1,
            totalActiveStudyDays: 1,
         });
      });

      it("calculates broken streak when last study day was 2+ days ago", () => {
         const result = calculateStudyStreaks(
            ["2026-10-25", "2026-10-26", "2026-10-27"],
            refDate
         );
         expect(result).toEqual({
            currentStreak: 0,
            longestStreak: 3,
            totalActiveStudyDays: 3,
         });
      });

      it("calculates consecutive days streak ending today", () => {
         const dates = ["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"];
         const result = calculateStudyStreaks(dates, refDate);
         expect(result).toEqual({
            currentStreak: 4,
            longestStreak: 4,
            totalActiveStudyDays: 4,
         });
      });

      it("calculates consecutive days streak ending yesterday", () => {
         const dates = ["2026-10-28", "2026-10-29", "2026-10-30"];
         const result = calculateStudyStreaks(dates, refDate);
         expect(result).toEqual({
            currentStreak: 3,
            longestStreak: 3,
            totalActiveStudyDays: 3,
         });
      });

      it("identifies past historical streak longer than current streak", () => {
         const dates = [
            // Past streak of 5 days
            "2026-10-01",
            "2026-10-02",
            "2026-10-03",
            "2026-10-04",
            "2026-10-05",
            // Gap, then current streak of 2 days
            "2026-10-30",
            "2026-10-31",
         ];
         const result = calculateStudyStreaks(dates, refDate);
         expect(result).toEqual({
            currentStreak: 2,
            longestStreak: 5,
            totalActiveStudyDays: 7,
         });
      });

      it("deduplicates identical dates and handles ISO date formats", () => {
         const dates = [
            "2026-10-30T04:00:00.000Z",
            "2026-10-30T09:00:00.000Z",
            "2026-10-31T01:00:00.000Z",
         ];
         const result = calculateStudyStreaks(dates, refDate);
         expect(result).toEqual({
            currentStreak: 2,
            longestStreak: 2,
            totalActiveStudyDays: 2,
         });
      });
   });

   describe("formatLifetimeStudyStats", () => {
      it("formats zero seconds safely", () => {
         expect(formatLifetimeStudyStats(0)).toEqual({
            lifetimeStudySeconds: 0,
            lifetimeStudyHours: 0,
            lifetimeStudyClock: "00:00:00",
            lifetimeStudyHuman: "0s",
         });
      });

      it("formats valid study seconds", () => {
         const stats = formatLifetimeStudyStats(36000); // 10 hours
         expect(stats.lifetimeStudySeconds).toBe(36000);
         expect(stats.lifetimeStudyHours).toBe(10);
         expect(stats.lifetimeStudyClock).toBe("10:00:00");
         expect(stats.lifetimeStudyHuman).toBe("10h");
      });
   });
});
