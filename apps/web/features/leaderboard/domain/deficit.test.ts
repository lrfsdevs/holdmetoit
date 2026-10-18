import { describe, expect, it } from "vitest";

import { DurationRangeError } from "@/features/study-logs/domain/duration";
import {
   calculateRemainingDeficit,
   calculateRequiredDailyPace,
   DeficitCalculationError,
} from "@/features/leaderboard/domain/deficit";

describe("calculateRemainingDeficit", () => {
   it("returns zero when target is met or exceeded", () => {
      expect(calculateRemainingDeficit(126_000, 126_000)).toBe(0);
      expect(calculateRemainingDeficit(126_000, 130_000)).toBe(0);
   });

   it("returns positive deficit when logged is below target", () => {
      expect(calculateRemainingDeficit(126_000, 81_900)).toBe(44_100);
      expect(calculateRemainingDeficit(35_000, 0)).toBe(35_000);
   });

   it("handles zero target and zero logged", () => {
      expect(calculateRemainingDeficit(0, 0)).toBe(0);
   });

   it("rejects negative inputs", () => {
      expect(() => calculateRemainingDeficit(-1, 0)).toThrow(
         DurationRangeError
      );
      expect(() => calculateRemainingDeficit(100, -1)).toThrow(
         DurationRangeError
      );
   });

   it("rejects non-integer inputs", () => {
      expect(() => calculateRemainingDeficit(1.5, 0)).toThrow(
         DurationRangeError
      );
   });
});

describe("calculateRequiredDailyPace", () => {
   it("returns zero when deficit is zero", () => {
      expect(calculateRequiredDailyPace(0, 3)).toBe(0);
   });

   it("calculates exact daily pace per catch-up formula", () => {
      expect(calculateRequiredDailyPace(44_100, 3)).toBe(14_700);
      expect(calculateRequiredDailyPace(10_000, 4)).toBe(2_500);
   });

   it("supports fractional pace for indivisible deficits", () => {
      expect(calculateRequiredDailyPace(10_000, 3)).toBeCloseTo(3_333.3333333);
   });

   it("rejects zero or negative days remaining", () => {
      expect(() => calculateRequiredDailyPace(100, 0)).toThrow(
         DeficitCalculationError
      );
      expect(() => calculateRequiredDailyPace(100, -2)).toThrow(
         DeficitCalculationError
      );
   });

   it("rejects invalid deficit values", () => {
      expect(() => calculateRequiredDailyPace(-1, 2)).toThrow(
         DurationRangeError
      );
      expect(() => calculateRequiredDailyPace(100, 1.5)).toThrow(
         DeficitCalculationError
      );
   });
});

describe("catch-up scenario integration", () => {
   it("models a participant behind pace with three days left", () => {
      const targetSeconds = 126_000; // 35:00:00
      const loggedSeconds = 81_900; // 22:45:00
      const daysRemaining = 3;

      const deficit = calculateRemainingDeficit(targetSeconds, loggedSeconds);
      const pace = calculateRequiredDailyPace(deficit, daysRemaining);

      expect(deficit).toBe(44_100);
      expect(pace).toBe(14_700); // 4h 05m/day
   });
});
