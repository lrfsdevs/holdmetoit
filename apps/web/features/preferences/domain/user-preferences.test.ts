import { describe, expect, it } from "vitest";
import {
   DEFAULT_USER_PREFERENCES,
   clampVolume,
   isTodoCompletionSfxEnabled,
   sanitizeUserPreferences,
   type UserPreferences,
} from "./user-preferences";

describe("user-preferences domain", () => {
   describe("DEFAULT_USER_PREFERENCES", () => {
      it("strictly disables todoCompletionSfx by default (opt-in requirement)", () => {
         expect(DEFAULT_USER_PREFERENCES.sound.todoCompletionSfx).toBe(false);
      });

      it("defaults to full volume (1.0) and yippee soundPack", () => {
         expect(DEFAULT_USER_PREFERENCES.sound.volume).toBe(1.0);
         expect(DEFAULT_USER_PREFERENCES.sound.soundPack).toBe("yippee");
      });
   });

   describe("isTodoCompletionSfxEnabled", () => {
      it("returns false for null or undefined input", () => {
         expect(isTodoCompletionSfxEnabled(null)).toBe(false);
         expect(isTodoCompletionSfxEnabled(undefined)).toBe(false);
      });

      it("returns false when todoCompletionSfx is false", () => {
         const prefs: UserPreferences = {
            ...DEFAULT_USER_PREFERENCES,
            sound: {
               ...DEFAULT_USER_PREFERENCES.sound,
               todoCompletionSfx: false,
            },
         };
         expect(isTodoCompletionSfxEnabled(prefs)).toBe(false);
      });

      it("returns true when todoCompletionSfx is true", () => {
         const prefs: UserPreferences = {
            ...DEFAULT_USER_PREFERENCES,
            sound: {
               ...DEFAULT_USER_PREFERENCES.sound,
               todoCompletionSfx: true,
            },
         };
         expect(isTodoCompletionSfxEnabled(prefs)).toBe(true);
      });
   });

   describe("clampVolume", () => {
      it("clamps values outside [0, 1]", () => {
         expect(clampVolume(-0.5)).toBe(0.0);
         expect(clampVolume(1.5)).toBe(1.0);
         expect(clampVolume(0.75)).toBe(0.75);
      });

      it("falls back safely for invalid inputs", () => {
         expect(clampVolume("high" as unknown as number)).toBe(1.0);
         expect(clampVolume(NaN, 0.5)).toBe(0.5);
      });
   });

   describe("sanitizeUserPreferences", () => {
      it("returns default preferences for null, undefined, or invalid inputs", () => {
         expect(sanitizeUserPreferences(null)).toEqual(
            DEFAULT_USER_PREFERENCES
         );
         expect(sanitizeUserPreferences("string")).toEqual(
            DEFAULT_USER_PREFERENCES
         );
         expect(sanitizeUserPreferences([])).toEqual(DEFAULT_USER_PREFERENCES);
      });

      it("preserves valid customized sound preferences", () => {
         const custom = {
            sound: {
               todoCompletionSfx: true,
               volume: 0.8,
               soundPack: "yippee",
            },
         };

         const sanitized = sanitizeUserPreferences(custom);
         expect(sanitized.sound.todoCompletionSfx).toBe(true);
         expect(sanitized.sound.volume).toBe(0.8);
         expect(sanitized.sound.soundPack).toBe("yippee");
      });

      it("falls back to default soundPack for unknown sound pack ids", () => {
         const custom = {
            sound: {
               soundPack: "unknown_pack",
            },
         };
         const sanitized = sanitizeUserPreferences(custom);
         expect(sanitized.sound.soundPack).toBe("yippee");
      });
   });
});
