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

      it("defaults active theme to obsidian", () => {
         expect(DEFAULT_USER_PREFERENCES.theme.activeTheme).toBe("obsidian");
      });

      it("defaults all notifications to disabled", () => {
         expect(DEFAULT_USER_PREFERENCES.notifications.dailyReminder).toBe(
            false
         );
         expect(DEFAULT_USER_PREFERENCES.notifications.challengeAlerts).toBe(
            false
         );
         expect(DEFAULT_USER_PREFERENCES.notifications.soundAlerts).toBe(false);
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

      it("preserves valid customized preferences", () => {
         const custom = {
            sound: {
               todoCompletionSfx: true,
               volume: 0.8,
               soundPack: "yippee",
            },
            theme: {
               activeTheme: "emerald",
            },
            notifications: {
               dailyReminder: true,
               challengeAlerts: true,
               soundAlerts: false,
            },
         };

         const sanitized = sanitizeUserPreferences(custom);
         expect(sanitized.sound.todoCompletionSfx).toBe(true);
         expect(sanitized.sound.volume).toBe(0.8);
         expect(sanitized.theme.activeTheme).toBe("emerald");
         expect(sanitized.notifications.dailyReminder).toBe(true);
         expect(sanitized.notifications.challengeAlerts).toBe(true);
         expect(sanitized.notifications.soundAlerts).toBe(false);
      });

      it("falls back to obsidian for unknown theme ids", () => {
         const custom = {
            theme: {
               activeTheme: "cyberpunk_neon",
            },
         };
         const sanitized = sanitizeUserPreferences(custom);
         expect(sanitized.theme.activeTheme).toBe("obsidian");
      });
   });
});
