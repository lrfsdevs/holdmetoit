import { describe, expect, it } from "vitest";
import { evaluateFeatureFlag } from "./evaluator";
import type { FeatureFlagEntity } from "./feature-flags.types";

describe("evaluateFeatureFlag (Law L7 Domain Evaluator)", () => {
   const baseFlag: FeatureFlagEntity = {
      id: "flag_1",
      key: "modern_podium",
      name: "Modern Podium",
      description: "New leaderboard UI",
      isEnabled: true,
      rolloutMode: "GLOBAL",
      createdBy: "user_admin",
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      targets: [],
   };

   it("returns fallback (false) when flag is null or undefined", () => {
      expect(evaluateFeatureFlag(null)).toBe(false);
      expect(evaluateFeatureFlag(undefined)).toBe(false);
      expect(evaluateFeatureFlag(null, undefined, true)).toBe(true);
   });

   it("returns fallback (false) when flag is soft-deleted", () => {
      const deletedFlag: FeatureFlagEntity = {
         ...baseFlag,
         isDeleted: true,
      };
      expect(evaluateFeatureFlag(deletedFlag)).toBe(false);
      expect(evaluateFeatureFlag(deletedFlag, undefined, true)).toBe(true);
   });

   it("unconditionally returns false when Master Switch (isEnabled) is false", () => {
      // Even if GLOBAL
      const killedGlobal: FeatureFlagEntity = {
         ...baseFlag,
         isEnabled: false,
         rolloutMode: "GLOBAL",
      };
      expect(evaluateFeatureFlag(killedGlobal)).toBe(false);

      // Even if TARGETED and user matches
      const killedTargeted: FeatureFlagEntity = {
         ...baseFlag,
         isEnabled: false,
         rolloutMode: "TARGETED",
         targets: [
            {
               flagId: "flag_1",
               userId: "user_123",
               createdBy: "admin",
               createdAt: new Date(),
            },
         ],
      };
      expect(evaluateFeatureFlag(killedTargeted, { userId: "user_123" })).toBe(
         false
      );
   });

   it("returns false for DISABLED mode even when isEnabled is true", () => {
      const disabledFlag: FeatureFlagEntity = {
         ...baseFlag,
         isEnabled: true,
         rolloutMode: "DISABLED",
      };
      expect(evaluateFeatureFlag(disabledFlag)).toBe(false);
      expect(evaluateFeatureFlag(disabledFlag, { userId: "user_123" })).toBe(
         false
      );
   });

   it("returns true for GLOBAL mode for any user or spectator", () => {
      const globalFlag: FeatureFlagEntity = {
         ...baseFlag,
         isEnabled: true,
         rolloutMode: "GLOBAL",
      };
      expect(evaluateFeatureFlag(globalFlag)).toBe(true);
      expect(evaluateFeatureFlag(globalFlag, { userId: "user_999" })).toBe(
         true
      );
      expect(evaluateFeatureFlag(globalFlag, { isSpectator: true })).toBe(true);
   });

   it("returns true for TARGETED mode only when context.userId matches target", () => {
      const targetedFlag: FeatureFlagEntity = {
         ...baseFlag,
         isEnabled: true,
         rolloutMode: "TARGETED",
         targets: [
            {
               flagId: "flag_1",
               userId: "tester_alpha",
               createdBy: "admin",
               createdAt: new Date(),
            },
            {
               flagId: "flag_1",
               userId: "tester_beta",
               createdBy: "admin",
               createdAt: new Date(),
            },
         ],
      };

      // Matching testers
      expect(
         evaluateFeatureFlag(targetedFlag, { userId: "tester_alpha" })
      ).toBe(true);
      expect(evaluateFeatureFlag(targetedFlag, { userId: "tester_beta" })).toBe(
         true
      );

      // Non-matching user
      expect(evaluateFeatureFlag(targetedFlag, { userId: "random_user" })).toBe(
         false
      );

      // Unauthenticated spectator (no userId)
      expect(evaluateFeatureFlag(targetedFlag, undefined)).toBe(false);
      expect(evaluateFeatureFlag(targetedFlag, { isSpectator: true })).toBe(
         false
      );
   });

   it("supports targetUserIds array directly on flag", () => {
      const targetedFlag = {
         key: "fast_cache",
         isEnabled: true,
         rolloutMode: "TARGETED" as const,
         targetUserIds: ["usr_1", "usr_2"],
      };

      expect(evaluateFeatureFlag(targetedFlag, { userId: "usr_1" })).toBe(true);
      expect(evaluateFeatureFlag(targetedFlag, { userId: "usr_3" })).toBe(
         false
      );
   });
});
