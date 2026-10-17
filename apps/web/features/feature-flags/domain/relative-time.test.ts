import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relative-time";

describe("formatRelativeTime pure domain helper", () => {
   const baseNow = new Date("2026-10-14T12:00:00Z");

   it("returns 'just now' for under 60 seconds", () => {
      const d = new Date(baseNow.getTime() - 30 * 1000);
      expect(formatRelativeTime(d, baseNow)).toBe("just now");
   });

   it("returns 'just now' for negative or future times", () => {
      const future = new Date(baseNow.getTime() + 10000);
      expect(formatRelativeTime(future, baseNow)).toBe("just now");
   });

   it("returns 'Xm ago' for minutes", () => {
      const d5 = new Date(baseNow.getTime() - 5 * 60 * 1000);
      expect(formatRelativeTime(d5, baseNow)).toBe("5m ago");

      const d45 = new Date(baseNow.getTime() - 45 * 60 * 1000);
      expect(formatRelativeTime(d45, baseNow)).toBe("45m ago");
   });

   it("returns 'Xh ago' for hours", () => {
      const d2 = new Date(baseNow.getTime() - 2 * 60 * 60 * 1000);
      expect(formatRelativeTime(d2, baseNow)).toBe("2h ago");
   });

   it("returns 'Xd ago' for days under 7", () => {
      const d3 = new Date(baseNow.getTime() - 3 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(d3, baseNow)).toBe("3d ago");
   });

   it("returns localized short date for 7+ days", () => {
      const d10 = new Date(baseNow.getTime() - 10 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(d10, baseNow)).toBe("Oct 4");
   });
});
