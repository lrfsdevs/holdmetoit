import { describe, expect, it } from "vitest";

import {
   composeDurationSeconds,
   validateDailyLogDurationSeconds,
} from "@/features/study-logs/domain/daily-log.validation";
import { MAX_DAILY_LOG_SECONDS } from "@/features/study-logs/domain/duration";

describe("validateDailyLogDurationSeconds", () => {
   it("accepts valid positive durations within the daily cap", () => {
      expect(validateDailyLogDurationSeconds(3_600)).toEqual({ ok: true });
      expect(validateDailyLogDurationSeconds(16_200)).toEqual({ ok: true });
      expect(validateDailyLogDurationSeconds(72_000)).toEqual({ ok: true });
   });

   it("accepts exactly zero duration (0s / 00:00:00)", () => {
      expect(validateDailyLogDurationSeconds(0)).toEqual({ ok: true });
   });

   it("accepts exactly the 24-hour boundary (86,400s / 24:00:00)", () => {
      expect(validateDailyLogDurationSeconds(86_400)).toEqual({ ok: true });
      expect(validateDailyLogDurationSeconds(MAX_DAILY_LOG_SECONDS)).toEqual({
         ok: true,
      });
   });

   it("rejects durations strictly greater than 24 hours (86,401s)", () => {
      const boundaryPlusOne = validateDailyLogDurationSeconds(
         MAX_DAILY_LOG_SECONDS + 1
      );
      expect(boundaryPlusOne).toEqual({
         ok: false,
         code: "DAILY_LIMIT_EXCEEDED",
         message: "A single day cannot exceed 24:00:00 of study time.",
      });

      const farExceeded = validateDailyLogDurationSeconds(100_000);
      expect(farExceeded.ok).toBe(false);
      if (!farExceeded.ok) {
         expect(farExceeded.code).toBe("DAILY_LIMIT_EXCEEDED");
      }
   });

   it("rejects negative durations", () => {
      const minusOne = validateDailyLogDurationSeconds(-1);
      expect(minusOne).toEqual({
         ok: false,
         code: "NEGATIVE_DURATION",
         message: "Study time cannot be negative.",
      });

      const minusHour = validateDailyLogDurationSeconds(-3_600);
      expect(minusHour.ok).toBe(false);
      if (!minusHour.ok) {
         expect(minusHour.code).toBe("NEGATIVE_DURATION");
      }
   });

   it("rejects malformed non-integer durations (floats, NaN, Infinity)", () => {
      for (const malformed of [90.5, 0.1, NaN, Infinity, -Infinity]) {
         const result = validateDailyLogDurationSeconds(malformed);
         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("INVALID_DURATION");
            expect(result.message).toBe(
               "Study time must be a whole number of seconds."
            );
         }
      }
   });
});

describe("composeDurationSeconds", () => {
   it("composes HH:MM:SS parts into total seconds", () => {
      expect(composeDurationSeconds(4, 30, 0)).toBe(16_200);
      expect(composeDurationSeconds(0, 0, 45)).toBe(45);
      expect(composeDurationSeconds(0, 0, 0)).toBe(0);
      expect(composeDurationSeconds(24, 0, 0)).toBe(86_400);
   });

   it("rejects invalid minute and second ranges (> 59)", () => {
      expect(() => composeDurationSeconds(0, 60, 0)).toThrow();
      expect(() => composeDurationSeconds(0, 0, 60)).toThrow();
      expect(() => composeDurationSeconds(1, 99, 10)).toThrow();
   });

   it("rejects negative and non-integer component parts", () => {
      expect(() => composeDurationSeconds(-1, 0, 0)).toThrow();
      expect(() => composeDurationSeconds(0, -5, 0)).toThrow();
      expect(() => composeDurationSeconds(0, 0, -10)).toThrow();
      expect(() => composeDurationSeconds(1.5, 0, 0)).toThrow();
      expect(() => composeDurationSeconds(0, 2.5, 0)).toThrow();
      expect(() => composeDurationSeconds(0, 0, 3.14)).toThrow();
   });
});
