import { describe, expect, it } from "vitest";
import { formatFeedbackCode } from "./feedback-code";

describe("formatFeedbackCode", () => {
   it("formats positive integers with FB- prefix", () => {
      expect(formatFeedbackCode(1)).toBe("FB-1");
      expect(formatFeedbackCode(42)).toBe("FB-42");
      expect(formatFeedbackCode(9999)).toBe("FB-9999");
   });

   it("handles fallback for non-positive or invalid numbers", () => {
      expect(formatFeedbackCode(0)).toBe("FB-1");
      expect(formatFeedbackCode(-5)).toBe("FB-1");
   });
});
