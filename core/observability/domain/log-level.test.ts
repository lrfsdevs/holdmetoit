import { describe, expect, it } from "vitest";

import {
   isLogLevel,
   parseLogLevel,
   shouldEmit,
   type LogLevel,
} from "@/core/observability/domain/log-level";

describe("log-level: isLogLevel", () => {
   it("accepts known levels", () => {
      for (const level of ["debug", "info", "warn", "error"] as LogLevel[]) {
         expect(isLogLevel(level)).toBe(true);
      }
   });

   it("rejects unknown or non-string values", () => {
      expect(isLogLevel("verbose")).toBe(false);
      expect(isLogLevel("")).toBe(false);
      expect(isLogLevel(undefined)).toBe(false);
      expect(isLogLevel(null)).toBe(false);
   });
});

describe("log-level: parseLogLevel", () => {
   it("normalizes casing and whitespace", () => {
      expect(parseLogLevel("  WARN ", "info")).toBe("warn");
   });

   it("falls back when the value is missing or invalid", () => {
      expect(parseLogLevel(undefined, "info")).toBe("info");
      expect(parseLogLevel(null, "debug")).toBe("debug");
      expect(parseLogLevel("nope", "error")).toBe("error");
   });
});

describe("log-level: shouldEmit", () => {
   it("emits at or above the threshold", () => {
      expect(shouldEmit("error", "info")).toBe(true);
      expect(shouldEmit("info", "info")).toBe(true);
      expect(shouldEmit("debug", "info")).toBe(false);
   });

   it("always emits errors regardless of threshold", () => {
      expect(shouldEmit("error", "error")).toBe(true);
      expect(shouldEmit("error", "debug")).toBe(true);
   });

   it("only emits debug when the threshold is debug", () => {
      expect(shouldEmit("debug", "debug")).toBe(true);
      expect(shouldEmit("debug", "warn")).toBe(false);
   });
});
