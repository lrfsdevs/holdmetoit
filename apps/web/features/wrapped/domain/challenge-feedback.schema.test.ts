import { describe, expect, it } from "vitest";
import { submitChallengeFeedbackSchema } from "./challenge-feedback.schema";

describe("challenge-feedback.schema", () => {
   const validPayload = {
      challengeId: "chal_123",
      consistency: "Yes, significantly" as const,
      fairnessRating: 5,
      trackingPreference: "Strictly YPT" as const,
      teamBattleFeedback: "The team battles were very engaging.",
      workSchoolHours: "No, dont include them" as const,
      soloStyle: "Competitive (Keep a leaderboard)" as const,
      soloPunishment: "Yes, keep the punishment" as const,
      soloIdeas: "Daily streak bonuses would be awesome!",
   };

   it("accepts a complete valid feedback submission", () => {
      const parsed = submitChallengeFeedbackSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
         expect(parsed.data.consistency).toBe("Yes, significantly");
         expect(parsed.data.fairnessRating).toBe(5);
         expect(parsed.data.trackingPreference).toBe("Strictly YPT");
      }
   });

   it("accepts empty optional text fields", () => {
      const parsed = submitChallengeFeedbackSchema.safeParse({
         ...validPayload,
         teamBattleFeedback: "",
         soloIdeas: "",
      });
      expect(parsed.success).toBe(true);
   });

   it("rejects invalid fairness ratings", () => {
      const parsedLow = submitChallengeFeedbackSchema.safeParse({
         ...validPayload,
         fairnessRating: 0,
      });
      expect(parsedLow.success).toBe(false);

      const parsedHigh = submitChallengeFeedbackSchema.safeParse({
         ...validPayload,
         fairnessRating: 6,
      });
      expect(parsedHigh.success).toBe(false);
   });

   it("rejects invalid options for enum fields", () => {
      const parsed = submitChallengeFeedbackSchema.safeParse({
         ...validPayload,
         consistency: "Maybe",
      });
      expect(parsed.success).toBe(false);
   });

   it("rejects missing required fields", () => {
      const { trackingPreference, ...missingField } = validPayload;
      const parsed = submitChallengeFeedbackSchema.safeParse(missingField);
      expect(parsed.success).toBe(false);
   });

   it("rejects text exceeding 2000 characters", () => {
      const parsed = submitChallengeFeedbackSchema.safeParse({
         ...validPayload,
         teamBattleFeedback: "a".repeat(2001),
      });
      expect(parsed.success).toBe(false);
   });
});
