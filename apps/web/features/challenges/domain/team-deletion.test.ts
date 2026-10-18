import { describe, expect, it } from "vitest";
import { buildTeamTombstoneName } from "./team-deletion";

describe("buildTeamTombstoneName", () => {
   it("appends tombstone suffix with first 8 characters of team id", () => {
      const result = buildTeamTombstoneName("Butterflies", "team_123456789abc");
      expect(result).toBe("Butterflies ·deleted·team_123");
   });

   it("truncates names longer than max length to fit within 255 chars", () => {
      const veryLongName = "A".repeat(300);
      const result = buildTeamTombstoneName(veryLongName, "team_abcdef123456");
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result.endsWith(" ·deleted·team_abc")).toBe(true);
   });
});
