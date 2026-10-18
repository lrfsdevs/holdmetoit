import { z } from "zod";

export const consistencyOptions = [
   "Yes, significantly",
   "Somewhat",
   "No, it did not make a difference",
] as const;

export const trackingPreferenceOptions = [
   "Strictly YPT",
   "Allow all apps with no restrictions",
] as const;

export const workSchoolHoursOptions = [
   "Yes, include work and school hours",
   "No, dont include them",
] as const;

export const soloStyleOptions = [
   "Competitive (Keep a leaderboard)",
   "Laid-back (Personal goals for role rewards)",
] as const;

export const soloPunishmentOptions = [
   "Yes, keep the punishment",
   "No, remove the punishment",
] as const;

export const submitChallengeFeedbackSchema = z.object({
   challengeId: z
      .string({ message: "Challenge ID is required" })
      .trim()
      .min(1, "Challenge ID cannot be empty"),
   consistency: z.enum(consistencyOptions, {
      message: "Please indicate if Team Battles helped your consistency",
   }),
   fairnessRating: z
      .number({ message: "Fairness rating is required" })
      .int("Fairness rating must be an integer")
      .min(1, "Fairness rating must be between 1 and 5")
      .max(5, "Fairness rating must be between 1 and 5"),
   trackingPreference: z.enum(trackingPreferenceOptions, {
      message: "Please select your preferred tracking method",
   }),
   teamBattleFeedback: z
      .string()
      .trim()
      .max(2000, "Feedback must be under 2000 characters")
      .optional()
      .or(z.literal("")),
   workSchoolHours: z.enum(workSchoolHoursOptions, {
      message: "Please select an option for work or school hours",
   }),
   soloStyle: z.enum(soloStyleOptions, {
      message: "Please select how you prefer the Solo Challenge to operate",
   }),
   soloPunishment: z.enum(soloPunishmentOptions, {
      message: "Please indicate whether to keep the punishment PFP system",
   }),
   soloIdeas: z
      .string()
      .trim()
      .max(2000, "Ideas must be under 2000 characters")
      .optional()
      .or(z.literal("")),
});

export type SubmitChallengeFeedbackInput = z.infer<
   typeof submitChallengeFeedbackSchema
>;
