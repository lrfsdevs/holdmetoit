import { describe, expect, it } from "vitest";
import {
   buildChallengeFeedbackEmbed,
   formatReporterMention,
   formatStarRating,
   resolveRatingColor,
} from "./challenge-feedback-embed";

describe("challenge-feedback-embed", () => {
   describe("formatStarRating", () => {
      it("formats 5 stars correctly", () => {
         expect(formatStarRating(5)).toBe("⭐⭐⭐⭐⭐ (5/5)");
      });

      it("formats 3 stars correctly", () => {
         expect(formatStarRating(3)).toBe("⭐⭐⭐☆☆ (3/5)");
      });

      it("formats 1 star correctly", () => {
         expect(formatStarRating(1)).toBe("⭐☆☆☆☆ (1/5)");
      });
   });

   describe("resolveRatingColor", () => {
      it("returns emerald for 5", () => {
         expect(resolveRatingColor(5)).toBe(0x22c55e);
      });

      it("returns teal for 4", () => {
         expect(resolveRatingColor(4)).toBe(0x10b981);
      });

      it("returns amber for 3", () => {
         expect(resolveRatingColor(3)).toBe(0xf59e0b);
      });

      it("returns red for 1 and 2", () => {
         expect(resolveRatingColor(2)).toBe(0xef4444);
         expect(resolveRatingColor(1)).toBe(0xef4444);
      });
   });

   describe("formatReporterMention", () => {
      it("prefers discordId mention when available", () => {
         const result = formatReporterMention({
            userId: "u1",
            discordId: "123456789012345678",
            displayName: "Test User",
            username: "testuser",
         });
         expect(result).toBe("<@123456789012345678>");
      });

      it("falls back to displayName if discordId is missing", () => {
         const result = formatReporterMention({
            userId: "u1",
            displayName: "Test User",
         });
         expect(result).toBe("Test User");
      });
   });

   describe("buildChallengeFeedbackEmbed", () => {
      it("builds a complete embed with all 8 questions answered", () => {
         const embed = buildChallengeFeedbackEmbed({
            challengeId: "chal_abc",
            challengeTitle: "October Study Sprint",
            consistency: "Yes, significantly",
            fairnessRating: 5,
            trackingPreference: "Strictly YPT",
            teamBattleFeedback: "Loved the competition!",
            workSchoolHours: "No, dont include them",
            soloStyle: "Competitive (Keep a leaderboard)",
            soloPunishment: "Yes, keep the punishment",
            soloIdeas: "Add streaks!",
            reporter: {
               userId: "u1",
               discordId: "999888777",
               displayName: "Afnan",
            },
            appUrl: "https://holdmetoit.com",
            createdAt: new Date("2026-10-12T00:00:00.000Z"),
         });

         expect(embed.title).toBe(
            "💬 Challenge Feedback · October Study Sprint"
         );
         expect(embed.color).toBe(0x22c55e);
         const fields = embed.fields ?? [];
         expect(fields).toHaveLength(10); // 8 base fields + 2 multiline responses
         expect(fields[0]).toEqual({
            name: "👤 Submitter",
            value: "<@999888777>",
            inline: true,
         });
         expect(fields[1]).toEqual({
            name: "⚖️ Fairness Rating",
            value: "⭐⭐⭐⭐⭐ (5/5)",
            inline: true,
         });
         expect(fields[2]).toEqual({
            name: "📈 Improved Consistency?",
            value: "Yes, significantly",
            inline: true,
         });
         expect(fields[3]).toEqual({
            name: "⏱️ Preferred Tracking",
            value: "Strictly YPT",
            inline: true,
         });
         expect(fields[4]).toEqual({
            name: "🎒 Count Work/School?",
            value: "No, dont include them",
            inline: true,
         });
         expect(fields[5]).toEqual({
            name: "🏆 Solo Challenge Style",
            value: "Competitive (Keep a leaderboard)",
            inline: true,
         });
         expect(fields[6]).toEqual({
            name: "🎭 Keep Punishment PFPs?",
            value: "Yes, keep the punishment",
            inline: true,
         });
         expect(fields[8]).toEqual({
            name: "💬 Team Battle Suggestions & Complaints",
            value: "Loved the competition!",
            inline: false,
         });
         expect(fields[9]).toEqual({
            name: "💡 Solo Challenge Ideas & Thoughts",
            value: "Add streaks!",
            inline: false,
         });
         expect(embed.timestamp).toBe("2026-10-12T00:00:00.000Z");
      });

      it("omits empty optional text responses", () => {
         const embed = buildChallengeFeedbackEmbed({
            challengeId: "chal_abc",
            challengeTitle: "Minimal Sprint",
            consistency: "Somewhat",
            fairnessRating: 4,
            trackingPreference: "Allow all apps with no restrictions",
            workSchoolHours: "Yes, include work and school hours",
            soloStyle: "Laid-back (Personal goals for role rewards)",
            soloPunishment: "No, remove the punishment",
            reporter: {
               userId: "u1",
               displayName: "Participant A",
            },
         });

         const fields = embed.fields ?? [];
         expect(fields).toHaveLength(8); // Only the 8 base fields, no multiline sections
         expect(
            fields.some((f) => f.name.includes("Suggestions & Complaints"))
         ).toBe(false);
         expect(fields.some((f) => f.name.includes("Ideas & Thoughts"))).toBe(
            false
         );
      });
   });
});
