import { describe, expect, it } from "vitest";

import {
   generateDiscordSummary,
   type DiscordSummaryInput,
} from "./discord-summary";

describe("generateDiscordSummary (FEAT-DISC-01)", () => {
   it("formats full completed challenge results with winning team, podium, and punishments", () => {
      const input: DiscordSummaryInput = {
         title: "Midterm Reading Week Sprint",
         status: "COMPLETED",
         startDate: "Sep 1, 2026",
         endDate: "Sep 8, 2026",
         teams: [
            {
               name: "Honey Bees",
               iconEmoji: "🐝",
               totalLoggedSeconds: 142 * 3600 + 15 * 60,
               isLeader: true,
            },
            {
               name: "Lavender Butterflies",
               iconEmoji: "🦋",
               totalLoggedSeconds: 138 * 3600 + 3 * 60,
               isLeader: false,
            },
         ],
         leadMarginSeconds: 4 * 3600 + 12 * 60,
         podium: [
            {
               rank: 1,
               displayName: "Alice",
               username: "alice_study",
               teamName: "Honey Bees",
               totalLoggedSeconds: 38 * 3600 + 15 * 60,
            },
            {
               rank: 2,
               displayName: "Bob",
               username: "bob_codes",
               teamName: "Lavender Butterflies",
               totalLoggedSeconds: 35 * 3600 + 20 * 60,
            },
            {
               rank: 3,
               displayName: "Charlie",
               username: null,
               teamName: "Honey Bees",
               totalLoggedSeconds: 32 * 3600 + 10 * 60,
            },
         ],
         punishedMembers: [
            {
               displayName: "Dave",
               username: "dave_slacking",
               isPardoned: false,
               pardonReason: null,
            },
            {
               displayName: "Eve",
               username: "eve_sick",
               isPardoned: true,
               pardonReason: "Flu medical excuse",
            },
         ],
      };

      const summary = generateDiscordSummary(input);

      expect(summary).toContain("HOLDMETOIT — MIDTERM READING WEEK SPRINT");
      expect(summary).toContain("FINAL RESULTS");
      expect(summary).toContain("🐝 Honey Bees**: `142:15:00` 👑 [WINNER]");
      expect(summary).toContain("🦋 Lavender Butterflies**: `138:03:00`");
      expect(summary).toContain("Current lead delta: +04:12:00");
      expect(summary).toContain(
         "🥇 1st Place: **@alice_study** (Honey Bees) — `38:15:00`"
      );
      expect(summary).toContain(
         "🥈 2nd Place: **@bob_codes** (Lavender Butterflies) — `35:20:00`"
      );
      expect(summary).toContain(
         "🥉 3rd Place: **Charlie** (Honey Bees) — `32:10:00`"
      );
      expect(summary).toContain("PUNISHMENT WALL");
      expect(summary).toContain("**@dave_slacking** — Event forfeit");
      expect(summary).toContain("EXCUSED / PARDONED BY HOST");
      expect(summary).toContain("**@eve_sick** — Reason: *Flu medical excuse*");
   });

   it("handles zero punishments gracefully in completed events", () => {
      const input: DiscordSummaryInput = {
         title: "Solos Sprint",
         status: "COMPLETED",
         startDate: "Sep 1, 2026",
         endDate: "Sep 7, 2026",
         teams: [
            {
               name: "Grinder",
               iconEmoji: null,
               totalLoggedSeconds: 20 * 3600,
               isLeader: true,
            },
         ],
         podium: [
            {
               rank: 1,
               displayName: "Victor",
               username: "victor",
               teamName: "Grinder",
               totalLoggedSeconds: 20 * 3600,
            },
         ],
         punishedMembers: [],
      };

      const summary = generateDiscordSummary(input);
      expect(summary).toContain("HONOR ROLL — ZERO PUNISHMENTS!");
      expect(summary).not.toContain("PUNISHMENT WALL");
   });

   it("handles active ongoing event broadcast with live standings", () => {
      const input: DiscordSummaryInput = {
         title: "Sprint 2",
         status: "ACTIVE",
         startDate: "Sep 1, 2026",
         endDate: "Sep 8, 2026",
         teams: [
            {
               name: "Team A",
               iconEmoji: "⭐",
               totalLoggedSeconds: 10 * 3600,
               isLeader: true,
            },
         ],
         podium: [],
         punishedMembers: [],
      };

      const summary = generateDiscordSummary(input);
      expect(summary).toContain("LIVE STANDINGS");
      expect(summary).toContain("👑 [IN LEAD]");
   });
});
