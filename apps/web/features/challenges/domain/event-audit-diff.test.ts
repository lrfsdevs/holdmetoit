import { describe, expect, it } from "vitest";
import { computeEventDetailsDiff } from "./event-audit-diff";

describe("event-audit-diff domain utility", () => {
   const baseExisting = {
      title: "Midterm Sprint",
      startAt: "2026-10-01T00:00:00.000Z",
      endAt: "2026-10-07T23:59:59.000Z",
      eventBannerUrl: "https://example.com/banner.png",
      punishmentPfpUrl: "https://example.com/pfp.png",
      teams: [
         {
            id: "team_1",
            name: "Bees",
            color: "#FFB066",
            iconEmoji: "🐝",
            mascotUrl: null,
         },
         {
            id: "team_2",
            name: "Butterflies",
            color: "#60A5FA",
            iconEmoji: "🦋",
            mascotUrl: null,
         },
      ],
   };

   it("detects no changes when input matches existing state exactly", () => {
      const diff = computeEventDetailsDiff(baseExisting, {
         title: "Midterm Sprint",
         startAt: "2026-10-01T00:00:00.000Z",
         endAt: "2026-10-07T23:59:59.000Z",
         eventBannerUrl: "https://example.com/banner.png",
         punishmentPfpUrl: "https://example.com/pfp.png",
         teams: [
            { id: "team_1", name: "Bees", color: "#FFB066", iconEmoji: "🐝" },
            {
               id: "team_2",
               name: "Butterflies",
               color: "#60A5FA",
               iconEmoji: "🦋",
            },
         ],
      });

      expect(diff.hasChanges).toBe(false);
      expect(diff.fieldChanges).toHaveLength(0);
      expect(diff.summary).toBe("No modifications detected in event details");
   });

   it("detects title change and generates clean before/after diff", () => {
      const diff = computeEventDetailsDiff(baseExisting, {
         ...baseExisting,
         title: "Finals Marathon",
      });

      expect(diff.hasChanges).toBe(true);
      expect(diff.fieldChanges).toContain("title");
      expect(diff.previousValue.title).toBe("Midterm Sprint");
      expect(diff.newValue.title).toBe("Finals Marathon");
      expect(diff.summary).toContain('Renamed event to "Finals Marathon"');
   });

   it("detects description change and generates clean before/after diff", () => {
      const diff = computeEventDetailsDiff(
         { ...baseExisting, description: "Old challenge description" },
         {
            ...baseExisting,
            description: "New updated challenge description",
         }
      );

      expect(diff.hasChanges).toBe(true);
      expect(diff.fieldChanges).toContain("description");
      expect(diff.previousValue.description).toBe("Old challenge description");
      expect(diff.newValue.description).toBe(
         "New updated challenge description"
      );
      expect(diff.summary).toContain("Updated event description");
   });

   it("detects timetable date changes", () => {
      const diff = computeEventDetailsDiff(baseExisting, {
         ...baseExisting,
         endAt: "2026-10-10T23:59:59.000Z",
      });

      expect(diff.hasChanges).toBe(true);
      expect(diff.fieldChanges).toContain("dates");
      expect(diff.summary).toContain("Adjusted event timetable");
   });

   it("detects header banner artwork and punishment PFP updates", () => {
      const diff = computeEventDetailsDiff(baseExisting, {
         ...baseExisting,
         eventBannerUrl: "https://example.com/new-banner.png",
         punishmentPfpUrl: null,
      });

      expect(diff.hasChanges).toBe(true);
      expect(diff.fieldChanges).toContain("eventBannerUrl");
      expect(diff.fieldChanges).toContain("punishmentPfpUrl");
      expect(diff.summary).toContain("Updated header banner artwork");
      expect(diff.summary).toContain("Removed punishment PFP");
   });

   it("detects added, removed, and modified houses/teams", () => {
      const diff = computeEventDetailsDiff(baseExisting, {
         ...baseExisting,
         teams: [
            // team_1 modified: renamed to Honeybees
            {
               id: "team_1",
               name: "Honeybees",
               color: "#FFB066",
               iconEmoji: "🐝",
            },
            // team_2 omitted (removed)
            // team_3 added
            { name: "Lions", color: "#F472B6", iconEmoji: "🦁" },
         ],
      });

      expect(diff.hasChanges).toBe(true);
      expect(diff.fieldChanges).toContain("teams");
      expect(diff.summary).toContain("added house (Lions 🦁)");
      expect(diff.summary).toContain("removed house (Butterflies 🦋)");
      expect(diff.summary).toContain(
         'updated house "Honeybees" (renamed to "Honeybees")'
      );
   });
});
