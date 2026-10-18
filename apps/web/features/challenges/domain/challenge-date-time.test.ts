import { describe, expect, it } from "vitest";
import {
   formatDateToUtcInputString,
   isUtcDateRangeValid,
   parseUtcInputStringToIso,
} from "./challenge-date-time";

describe("challenge-date-time domain utility (Law L7 / L8)", () => {
   it("formats Date objects and ISO strings to canonical YYYY-MM-DDTHH:mm UTC string", () => {
      const iso = "2026-10-04T01:00:00.000Z";
      expect(formatDateToUtcInputString(iso)).toBe("2026-10-04T01:00");

      const dateObj = new Date("2026-10-04T01:00:00.000Z");
      expect(formatDateToUtcInputString(dateObj)).toBe("2026-10-04T01:00");
   });

   it("handles invalid inputs gracefully", () => {
      expect(formatDateToUtcInputString("invalid-date")).toBe("");
      expect(formatDateToUtcInputString("")).toBe("");
   });

   it("parses input string strictly as UTC without client timezone drift", () => {
      // A user in IST (+05:30) enters 01:00 in an input marked as UTC
      const inputStr = "2026-10-04T01:00";
      const resultIso = parseUtcInputStringToIso(inputStr);

      expect(resultIso).toBe("2026-10-04T01:00:00.000Z");
   });

   it("preserves exact timestamp across multiple consecutive round-trips (Zero Drift Invariant)", () => {
      let current = "2026-10-04T01:00:00.000Z";

      // Simulate 10 consecutive saves in Manage tab
      for (let i = 0; i < 10; i++) {
         const inputStr = formatDateToUtcInputString(current);
         current = parseUtcInputStringToIso(inputStr);
      }

      expect(current).toBe("2026-10-04T01:00:00.000Z");
   });

   it("validates UTC date ranges chronologically", () => {
      expect(isUtcDateRangeValid("2026-10-04T01:00", "2026-10-10T01:00")).toBe(
         true
      );

      expect(isUtcDateRangeValid("2026-10-10T01:00", "2026-10-04T01:00")).toBe(
         false
      );

      expect(isUtcDateRangeValid("2026-10-04T01:00", "2026-10-04T01:00")).toBe(
         false
      );
   });
});
