/**
 * @file user-preferences.ts
 * Pure domain definitions, schemas, and guards for user application preferences.
 * Adheres to Law L7 (Pure Domain Isolation): zero framework/React/Prisma dependencies.
 */

export type SoundPackId = "yippee";

export interface SoundPreferences {
   /**
    * Whether audio celebratory sound effects play upon task completion.
    * Invariant: strictly disabled by default (opt-in).
    */
   todoCompletionSfx: boolean;
   /**
    * Playback volume multiplier (0.0 to 1.0).
    * Default: 1.0.
    */
   volume: number;
   /**
    * Active sound pack identifier.
    */
   soundPack: SoundPackId;
}

export type ThemeId = "obsidian" | "midnight" | "emerald" | "sunset";

export interface ThemePreferences {
   /**
    * Active visual theme palette identifier.
    * Obsidian Dark is the ratified default system theme.
    */
   activeTheme: ThemeId;
}

export interface NotificationPreferences {
   /**
    * Browser / web push notification preferences (Coming Soon).
    */
   dailyReminder: boolean;
   challengeAlerts: boolean;
   soundAlerts: boolean;
}

export interface UserPreferences {
   version: number;
   sound: SoundPreferences;
   theme: ThemePreferences;
   notifications: NotificationPreferences;
}

export const PREFERENCES_SCHEMA_VERSION = 1;

/**
 * Authoritative default preferences.
 * By specification, todo completion sound effect is strictly DISABLED by default.
 */
export const DEFAULT_USER_PREFERENCES: Readonly<UserPreferences> =
   Object.freeze({
      version: PREFERENCES_SCHEMA_VERSION,
      sound: Object.freeze({
         todoCompletionSfx: false,
         volume: 1.0,
         soundPack: "yippee" as const,
      }),
      theme: Object.freeze({
         activeTheme: "obsidian" as const,
      }),
      notifications: Object.freeze({
         dailyReminder: false,
         challengeAlerts: false,
         soundAlerts: false,
      }),
   });

/**
 * Pure domain guard to determine whether todo completion SFX is enabled.
 */
export function isTodoCompletionSfxEnabled(
   preferences: UserPreferences | null | undefined
): boolean {
   if (!preferences || typeof preferences !== "object") {
      return false;
   }
   return Boolean(preferences.sound?.todoCompletionSfx);
}

/**
 * Validates and clamps a volume number between 0.0 and 1.0.
 */
export function clampVolume(volume: unknown, fallback = 1.0): number {
   if (typeof volume !== "number" || Number.isNaN(volume)) {
      return fallback;
   }
   return Math.min(1.0, Math.max(0.0, volume));
}

/**
 * Pure domain parser and sanitizer that merges untrusted input with default preferences.
 */
export function sanitizeUserPreferences(input: unknown): UserPreferences {
   if (!input || typeof input !== "object") {
      return {
         ...DEFAULT_USER_PREFERENCES,
         sound: { ...DEFAULT_USER_PREFERENCES.sound },
         theme: { ...DEFAULT_USER_PREFERENCES.theme },
         notifications: { ...DEFAULT_USER_PREFERENCES.notifications },
      };
   }

   const record = input as Record<string, unknown>;
   const soundRecord =
      record.sound && typeof record.sound === "object"
         ? (record.sound as Record<string, unknown>)
         : {};
   const themeRecord =
      record.theme && typeof record.theme === "object"
         ? (record.theme as Record<string, unknown>)
         : {};
   const notifRecord =
      record.notifications && typeof record.notifications === "object"
         ? (record.notifications as Record<string, unknown>)
         : {};

   const todoCompletionSfx =
      typeof soundRecord.todoCompletionSfx === "boolean"
         ? soundRecord.todoCompletionSfx
         : DEFAULT_USER_PREFERENCES.sound.todoCompletionSfx;

   const volume = clampVolume(
      soundRecord.volume,
      DEFAULT_USER_PREFERENCES.sound.volume
   );

   const soundPack: SoundPackId =
      soundRecord.soundPack === "yippee"
         ? "yippee"
         : DEFAULT_USER_PREFERENCES.sound.soundPack;

   const activeTheme: ThemeId =
      themeRecord.activeTheme === "midnight" ||
      themeRecord.activeTheme === "emerald" ||
      themeRecord.activeTheme === "sunset"
         ? themeRecord.activeTheme
         : "obsidian";

   const dailyReminder =
      typeof notifRecord.dailyReminder === "boolean"
         ? notifRecord.dailyReminder
         : DEFAULT_USER_PREFERENCES.notifications.dailyReminder;

   const challengeAlerts =
      typeof notifRecord.challengeAlerts === "boolean"
         ? notifRecord.challengeAlerts
         : DEFAULT_USER_PREFERENCES.notifications.challengeAlerts;

   const soundAlerts =
      typeof notifRecord.soundAlerts === "boolean"
         ? notifRecord.soundAlerts
         : DEFAULT_USER_PREFERENCES.notifications.soundAlerts;

   return {
      version: PREFERENCES_SCHEMA_VERSION,
      sound: {
         todoCompletionSfx,
         volume,
         soundPack,
      },
      theme: {
         activeTheme,
      },
      notifications: {
         dailyReminder,
         challengeAlerts,
         soundAlerts,
      },
   };
}
