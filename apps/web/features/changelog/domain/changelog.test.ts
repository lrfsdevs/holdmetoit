import { describe, expect, it } from "vitest";

import {
   formatEntryDate,
   hasEntries,
   parseChangelogMarkdown,
   selectVisibleGroups,
   sortGroupsByDate,
   type ChangelogGroup,
} from "./changelog";

const SAMPLE = `# Changelog

Intro text that should be ignored.

## 2026-10-11

### Internal thing
Internal body.

## 2026-10-10

### Visible thing [user]
First paragraph line
continues here.

Second paragraph.

- first bullet
- second bullet

### Another visible [user]
Body only.
`;

describe("changelog domain", () => {
   describe("parseChangelogMarkdown", () => {
      it("parses date groups and entries in file order", () => {
         const groups = parseChangelogMarkdown(SAMPLE);

         expect(groups.map((group) => group.date)).toEqual([
            "2026-10-11",
            "2026-10-10",
         ]);
         expect(groups[0].entries.map((entry) => entry.title)).toEqual([
            "Internal thing",
         ]);
         expect(groups[1].entries.map((entry) => entry.title)).toEqual([
            "Visible thing",
            "Another visible",
         ]);
      });

      it("defaults an untagged entry to the internal audience", () => {
         const groups = parseChangelogMarkdown(SAMPLE);

         expect(groups[0].entries[0].audience).toBe("internal");
      });

      it("parses the [user] tag case-insensitively", () => {
         const groups = parseChangelogMarkdown(
            "## 2026-10-10\n\n### Something [USER]\nBody"
         );

         expect(groups[0].entries[0].audience).toBe("user");
      });

      it("joins paragraph lines and collects bullets as highlights", () => {
         const entry = parseChangelogMarkdown(SAMPLE)[1].entries[0];

         expect(entry.body).toBe(
            "First paragraph line continues here. Second paragraph."
         );
         expect(entry.highlights).toEqual(["first bullet", "second bullet"]);
      });

      it("omits highlights when there are no bullets", () => {
         const entry = parseChangelogMarkdown(SAMPLE)[1].entries[1];

         expect(entry.highlights).toBeUndefined();
      });

      it("ignores content before the first date heading", () => {
         const groups = parseChangelogMarkdown(SAMPLE);

         expect(groups).toHaveLength(2);
      });

      it("returns an empty array for content without date headings", () => {
         expect(
            parseChangelogMarkdown("# Changelog\n\nNo dates here.")
         ).toEqual([]);
      });
   });

   describe("sortGroupsByDate", () => {
      it("orders groups newest date first and does not mutate input", () => {
         const groups: ChangelogGroup[] = [
            { date: "2026-10-05", entries: [] },
            { date: "2026-10-10", entries: [] },
         ];
         const snapshot = groups.map((group) => group.date);

         expect(sortGroupsByDate(groups).map((group) => group.date)).toEqual([
            "2026-10-10",
            "2026-10-05",
         ]);
         expect(groups.map((group) => group.date)).toEqual(snapshot);
      });
   });

   describe("selectVisibleGroups", () => {
      it("shows only user-facing entries to non-admins", () => {
         const groups = selectVisibleGroups(
            parseChangelogMarkdown(SAMPLE),
            false
         );

         expect(groups.map((group) => group.date)).toEqual(["2026-10-10"]);
         expect(groups[0].entries).toHaveLength(2);
      });

      it("shows every entry to admins", () => {
         const groups = selectVisibleGroups(
            parseChangelogMarkdown(SAMPLE),
            true
         );

         expect(groups.map((group) => group.date)).toEqual([
            "2026-10-11",
            "2026-10-10",
         ]);
      });

      it("drops date groups that have no visible entries", () => {
         const groups = selectVisibleGroups(
            parseChangelogMarkdown(SAMPLE),
            false
         );

         expect(groups.every((group) => group.entries.length > 0)).toBe(true);
         expect(groups.some((group) => group.date === "2026-10-11")).toBe(
            false
         );
      });
   });

   describe("formatEntryDate", () => {
      it("formats ISO dates as long US dates", () => {
         expect(formatEntryDate("2026-10-10")).toBe("October 10, 2026");
         expect(formatEntryDate("2026-01-03")).toBe("January 3, 2026");
      });

      it("returns the raw value when the date is invalid", () => {
         expect(formatEntryDate("not-a-date")).toBe("not-a-date");
      });
   });

   describe("hasEntries", () => {
      it("is true only when a group has entries", () => {
         const groups = parseChangelogMarkdown(SAMPLE);

         expect(hasEntries(groups[0])).toBe(true);
         expect(hasEntries({ date: "2026-10-10", entries: [] })).toBe(false);
      });
   });
});
