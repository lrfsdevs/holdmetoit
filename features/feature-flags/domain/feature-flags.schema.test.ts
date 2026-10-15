import { describe, expect, it } from "vitest";
import {
   createFeatureFlagSchema,
   manageTesterSchema,
   setRolloutModeSchema,
   toggleMasterSwitchSchema,
   updateFeatureFlagSchema,
} from "./feature-flags.schema";

describe("Feature Flags Zod Schemas", () => {
   describe("createFeatureFlagSchema", () => {
      it("accepts valid flag configuration", () => {
         const valid = {
            key: "modern_leaderboard_v2",
            name: "Modern Leaderboard V2",
            description: "Replaces legacy table",
            isEnabled: false,
            rolloutMode: "DISABLED",
         };
         const result = createFeatureFlagSchema.safeParse(valid);
         expect(result.success).toBe(true);
      });

      it("rejects invalid key formats (uppercase, spaces, special chars)", () => {
         expect(
            createFeatureFlagSchema.safeParse({
               key: "UPPERCASE_KEY",
               name: "Valid Name",
            }).success
         ).toBe(false);

         expect(
            createFeatureFlagSchema.safeParse({
               key: "has space",
               name: "Valid Name",
            }).success
         ).toBe(false);

         expect(
            createFeatureFlagSchema.safeParse({
               key: "a", // too short (< 2 chars)
               name: "Valid Name",
            }).success
         ).toBe(false);
      });

      it("applies defaults for isEnabled and rolloutMode", () => {
         const minimal = {
            key: "quick_study_log",
            name: "Quick Study Log",
         };
         const result = createFeatureFlagSchema.safeParse(minimal);
         expect(result.success).toBe(true);
         if (result.success) {
            expect(result.data.isEnabled).toBe(false);
            expect(result.data.rolloutMode).toBe("DISABLED");
         }
      });
   });

   describe("updateFeatureFlagSchema", () => {
      it("validates update fields", () => {
         const valid = {
            flagId: "flag_123",
            name: "Updated Name",
            description: "Updated description",
         };
         expect(updateFeatureFlagSchema.safeParse(valid).success).toBe(true);
      });

      it("requires flagId and valid name", () => {
         expect(
            updateFeatureFlagSchema.safeParse({
               flagId: "",
               name: "Valid Name",
            }).success
         ).toBe(false);

         expect(
            updateFeatureFlagSchema.safeParse({
               flagId: "flag_1",
               name: " ",
            }).success
         ).toBe(false);
      });
   });

   describe("toggleMasterSwitchSchema", () => {
      it("validates toggle payload", () => {
         expect(
            toggleMasterSwitchSchema.safeParse({
               flagId: "flag_1",
               isEnabled: true,
            }).success
         ).toBe(true);

         expect(
            toggleMasterSwitchSchema.safeParse({
               flagId: "flag_1",
               isEnabled: false,
            }).success
         ).toBe(true);
      });
   });

   describe("setRolloutModeSchema", () => {
      it("validates valid rollout modes", () => {
         for (const mode of ["DISABLED", "TARGETED", "GLOBAL"]) {
            expect(
               setRolloutModeSchema.safeParse({
                  flagId: "flag_1",
                  rolloutMode: mode,
               }).success
            ).toBe(true);
         }
      });

      it("rejects invalid mode strings", () => {
         expect(
            setRolloutModeSchema.safeParse({
               flagId: "flag_1",
               rolloutMode: "PERCENTAGE",
            }).success
         ).toBe(false);
      });
   });

   describe("manageTesterSchema", () => {
      it("validates tester assignment payload", () => {
         expect(
            manageTesterSchema.safeParse({
               flagId: "flag_1",
               targetUserId: "user_123",
            }).success
         ).toBe(true);
      });
   });
});
