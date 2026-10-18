import { describe, expect, it } from "vitest";

import {
   DurationParseError,
   DurationRangeError,
   decomposeSecondsToParts,
   formatSecondsToClock,
   formatSecondsToHuman,
   MAX_DAILY_LOG_SECONDS,
   MAX_WEEKLY_TARGET_SECONDS,
   MIN_WEEKLY_TARGET_SECONDS,
   parseDurationToSeconds,
} from "@/features/study-logs/domain/duration";

describe("parseDurationToSeconds", () => {
   it("parses HH:MM:SS clock strings", () => {
      expect(parseDurationToSeconds("04:30:00")).toBe(16_200);
      expect(parseDurationToSeconds("35:00:00")).toBe(126_000);
      expect(parseDurationToSeconds("00:00:00")).toBe(0);
      expect(parseDurationToSeconds("01:01:01")).toBe(3_661);
   });

   it("parses HH:MM with implicit zero seconds", () => {
      expect(parseDurationToSeconds("04:30")).toBe(16_200);
      expect(parseDurationToSeconds("9:05")).toBe(32_700);
   });

   it("supports weekly target upper bound (105:00:00)", () => {
      expect(parseDurationToSeconds("105:00:00")).toBe(
         MAX_WEEKLY_TARGET_SECONDS
      );
   });

   it("supports daily log upper bound (24:00:00)", () => {
      expect(parseDurationToSeconds("24:00:00")).toBe(MAX_DAILY_LOG_SECONDS);
   });

   it("trims surrounding whitespace", () => {
      expect(parseDurationToSeconds("  04:30:00  ")).toBe(16_200);
   });

   it("rejects empty input", () => {
      expect(() => parseDurationToSeconds("")).toThrow(DurationParseError);
      expect(() => parseDurationToSeconds("   ")).toThrow(DurationParseError);
   });

   it("rejects malformed formats", () => {
      expect(() => parseDurationToSeconds("4h30m")).toThrow(DurationParseError);
      expect(() => parseDurationToSeconds("04-30-00")).toThrow(
         DurationParseError
      );
      expect(() => parseDurationToSeconds("04:30:00:00")).toThrow(
         DurationParseError
      );
      expect(() => parseDurationToSeconds("04")).toThrow(DurationParseError);
      expect(() => parseDurationToSeconds("abc:30:00")).toThrow(
         DurationParseError
      );
   });

   it("rejects minutes or seconds outside 0-59", () => {
      expect(() => parseDurationToSeconds("01:60:00")).toThrow(
         DurationParseError
      );
      expect(() => parseDurationToSeconds("01:00:60")).toThrow(
         DurationParseError
      );
   });
});

describe("formatSecondsToClock", () => {
   it("formats seconds as zero-padded HH:MM:SS", () => {
      expect(formatSecondsToClock(0)).toBe("00:00:00");
      expect(formatSecondsToClock(16_200)).toBe("04:30:00");
      expect(formatSecondsToClock(126_000)).toBe("35:00:00");
      expect(formatSecondsToClock(3_661)).toBe("01:01:01");
   });

   it("round-trips with parseDurationToSeconds", () => {
      const samples = [
         "00:00:00",
         "04:30:00",
         "35:00:00",
         "105:00:00",
         "24:00:00",
      ];
      for (const sample of samples) {
         expect(formatSecondsToClock(parseDurationToSeconds(sample))).toBe(
            sample
         );
      }
   });

   it("rejects negative and non-integer values", () => {
      expect(() => formatSecondsToClock(-1)).toThrow(DurationRangeError);
      expect(() => formatSecondsToClock(1.5)).toThrow(DurationRangeError);
   });
});

describe("formatSecondsToHuman", () => {
   it("formats non-zero durations with h/m/s units", () => {
      expect(formatSecondsToHuman(0)).toBe("0s");
      expect(formatSecondsToHuman(45)).toBe("45s");
      expect(formatSecondsToHuman(3_600)).toBe("1h");
      expect(formatSecondsToHuman(16_200)).toBe("4h 30m");
      expect(formatSecondsToHuman(3_661)).toBe("1h 1m 1s");
   });

   it("matches lead-margin style copy from the design spec", () => {
      expect(formatSecondsToHuman(15_120)).toBe("4h 12m");
   });

   it("rejects negative and non-integer values", () => {
      expect(() => formatSecondsToHuman(-1)).toThrow(DurationRangeError);
      expect(() => formatSecondsToHuman(2.2)).toThrow(DurationRangeError);
   });
});

describe("duration constants", () => {
   it("exposes specification limits", () => {
      expect(MIN_WEEKLY_TARGET_SECONDS).toBe(3_600);
      expect(MAX_WEEKLY_TARGET_SECONDS).toBe(378_000);
      expect(MAX_DAILY_LOG_SECONDS).toBe(86_400);
   });
});

describe("decomposeSecondsToParts", () => {
   it("decomposes 0 seconds to all zeros", () => {
      expect(decomposeSecondsToParts(0)).toEqual({
         hours: 0,
         minutes: 0,
         seconds: 0,
      });
   });

   it("decomposes negative or non-integer seconds to all zeros safely", () => {
      expect(decomposeSecondsToParts(-100)).toEqual({
         hours: 0,
         minutes: 0,
         seconds: 0,
      });
      expect(decomposeSecondsToParts(12.5)).toEqual({
         hours: 0,
         minutes: 0,
         seconds: 0,
      });
   });

   it("decomposes seconds into exact hours, minutes, and seconds", () => {
      expect(decomposeSecondsToParts(7_200)).toEqual({
         hours: 2,
         minutes: 0,
         seconds: 0,
      }); // 2h
      expect(decomposeSecondsToParts(9_000)).toEqual({
         hours: 2,
         minutes: 30,
         seconds: 0,
      }); // 2h 30m
      expect(decomposeSecondsToParts(9_035)).toEqual({
         hours: 2,
         minutes: 30,
         seconds: 35,
      }); // 2h 30m 35s
      expect(decomposeSecondsToParts(45)).toEqual({
         hours: 0,
         minutes: 0,
         seconds: 45,
      });
      expect(decomposeSecondsToParts(3_599)).toEqual({
         hours: 0,
         minutes: 59,
         seconds: 59,
      });
      expect(decomposeSecondsToParts(86_400)).toEqual({
         hours: 24,
         minutes: 0,
         seconds: 0,
      });
   });
});
