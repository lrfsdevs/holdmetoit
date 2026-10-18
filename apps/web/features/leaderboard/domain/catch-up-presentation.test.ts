import { describe, expect, it } from "vitest";

import {
   buildCatchUpSummary,
   calculateInclusiveDaysRemaining,
   sumLoggedSeconds,
} from "@/features/leaderboard/domain/catch-up-presentation";
import {
   calculateRemainingDeficit,
   calculateRequiredDailyPace,
} from "@/features/leaderboard/domain/deficit";

describe("catch-up presentation", () => {
   it("reports complete tone when deficit is zero", () => {
      const summary = buildCatchUpSummary({
         targetSeconds: 35 * 3_600,
         totalLoggedSeconds: 35 * 3_600,
         daysRemaining: 3,
      });

      expect(summary.tone).toBe("complete");
      expect(summary.deficitSeconds).toBe(0);
      expect(summary.message).toMatch(/serene pace/i);
   });

   it("reports catch-up pace when deficit remains and days are left", () => {
      const summary = buildCatchUpSummary({
         targetSeconds: 35 * 3_600,
         totalLoggedSeconds: 10 * 3_600,
         daysRemaining: 2,
      });

      expect(summary.tone).toBe("catch-up");
      expect(summary.deficitSeconds).toBe(25 * 3_600);
      expect(summary.paceSecondsPerDay).toBe((25 * 3_600) / 2);
      expect(summary.message).toMatch(/gentle catch-up/i);
   });

   it("reports deadline tone when days remaining is zero", () => {
      const summary = buildCatchUpSummary({
         targetSeconds: 10 * 3_600,
         totalLoggedSeconds: 4 * 3_600,
         daysRemaining: 0,
      });

      expect(summary.tone).toBe("deadline");
      expect(summary.paceSecondsPerDay).toBeNull();
   });

   it("delegates calculations directly to domain calculateRemainingDeficit and calculateRequiredDailyPace", () => {
      const targetSeconds = 35 * 3_600;
      const totalLoggedSeconds = 15 * 3_600;
      const daysRemaining = 4;

      const summary = buildCatchUpSummary({
         targetSeconds,
         totalLoggedSeconds,
         daysRemaining,
      });

      // Verification that returned results match the exact pure domain function outputs
      expect(summary.deficitSeconds).toBe(
         calculateRemainingDeficit(targetSeconds, totalLoggedSeconds)
      );
      expect(summary.paceSecondsPerDay).toBe(
         calculateRequiredDailyPace(summary.deficitSeconds, daysRemaining)
      );
   });
});

describe("calculateInclusiveDaysRemaining", () => {
   it("counts inclusive days until challenge end date", () => {
      const endAt = new Date("2026-09-10T23:59:59.000Z");
      const now = new Date("2026-09-08T12:00:00.000Z");
      expect(calculateInclusiveDaysRemaining(endAt, now)).toBe(2);
   });

   it("never returns negative days", () => {
      const endAt = new Date("2026-09-01T00:00:00.000Z");
      const now = new Date("2026-09-08T00:00:00.000Z");
      expect(calculateInclusiveDaysRemaining(endAt, now)).toBe(0);
   });
});

describe("sumLoggedSeconds", () => {
   it("aggregates participant log durations", () => {
      expect(
         sumLoggedSeconds([
            { durationSeconds: 3_600 },
            { durationSeconds: 1_800 },
         ])
      ).toBe(5_400);
   });
});
