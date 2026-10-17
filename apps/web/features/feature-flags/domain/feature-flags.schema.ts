import { z } from "zod";

export const rolloutModeEnum = z.enum(["DISABLED", "TARGETED", "GLOBAL"]);

export const createFeatureFlagSchema = z.object({
   key: z
      .string()
      .trim()
      .min(2, "Flag key must be at least 2 characters")
      .max(64, "Flag key cannot exceed 64 characters")
      .regex(
         /^[a-z0-9_-]+$/,
         "Key must be lowercase letters, numbers, underscores, or hyphens (e.g. enhanced_leaderboard)"
      ),
   name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(128, "Name cannot exceed 128 characters"),
   description: z.string().trim().max(1000).optional().nullable(),
   isEnabled: z.boolean().default(false),
   rolloutMode: rolloutModeEnum.default("DISABLED"),
});

export const updateFeatureFlagSchema = z.object({
   flagId: z.string().min(1, "Flag ID is required"),
   name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(128, "Name cannot exceed 128 characters"),
   description: z.string().trim().max(1000).optional().nullable(),
});

export const toggleMasterSwitchSchema = z.object({
   flagId: z.string().min(1, "Flag ID is required"),
   isEnabled: z.boolean(),
});

export const setRolloutModeSchema = z.object({
   flagId: z.string().min(1, "Flag ID is required"),
   rolloutMode: rolloutModeEnum,
});

export const manageTesterSchema = z.object({
   flagId: z.string().min(1, "Flag ID is required"),
   targetUserId: z.string().min(1, "Target user ID is required"),
});

export type CreateFeatureFlagInput = z.infer<typeof createFeatureFlagSchema>;
export type UpdateFeatureFlagInput = z.infer<typeof updateFeatureFlagSchema>;
export type ToggleMasterSwitchInput = z.infer<typeof toggleMasterSwitchSchema>;
export type SetRolloutModeInput = z.infer<typeof setRolloutModeSchema>;
export type ManageTesterInput = z.infer<typeof manageTesterSchema>;
