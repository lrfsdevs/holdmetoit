import { describe, expect, it } from "vitest";
import { validateWeeklyTargetSeconds } from "./target-hours.validation";

describe("validateWeeklyTargetSeconds", () => {
   it("accepts valid weekly targets between 1h and 105h", () => {
      expect(validateWeeklyTargetSeconds(3_600)).toEqual({ ok: true }); // 1h
      expect(validateWeeklyTargetSeconds(126_000)).toEqual({ ok: true }); // 35h
      expect(validateWeeklyTargetSeconds(378_000)).toEqual({ ok: true }); // 105h
   });

   it("rejects non-integer seconds", () => {
      const result = validateWeeklyTargetSeconds(3600.5);
      expect(result.ok).toBe(false);
      if (!result.ok) {
         expect(result.code).toBe("INVALID_TARGET");
      }
   });

   it("rejects targets below 1 hour", () => {
      const result = validateWeeklyTargetSeconds(3_599);
      expect(result.ok).toBe(false);
      if (!result.ok) {
         expect(result.code).toBe("TARGET_TOO_LOW");
      }
   });

   it("rejects targets above 105 hours", () => {
      const result = validateWeeklyTargetSeconds(378_001);
      expect(result.ok).toBe(false);
      if (!result.ok) {
         expect(result.code).toBe("TARGET_TOO_HIGH");
      }
   });
});
