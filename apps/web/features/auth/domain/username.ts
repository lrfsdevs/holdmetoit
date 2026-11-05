import { z } from "zod";

/**
 * Pure domain logic for HoldMeToIt platform usernames.
 * Governed by Law L7 (Pure Domain Isolation): Zero Next.js, React, or Prisma imports.
 */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_COOLDOWN_DAYS = 7;
export const USERNAME_COOLDOWN_MS = USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

/**
 * Allowed syntax:
 * - 3 to 20 characters
 * - Alphanumeric ASCII characters (a-z, A-Z, 0-9) and single underscores
 * - Cannot start or end with an underscore
 * - No consecutive underscores (__)
 */
export const USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|_(?![_]))*[a-zA-Z0-9]$/;

/**
 * Case-insensitive reserved system keywords, routes, and roles
 * that cannot be claimed as scholar handles.
 */
export const RESERVED_USERNAMES = new Set<string>([
   "admin",
   "api",
   "audit",
   "auth",
   "betting",
   "challenge",
   "challenges",
   "changelog",
   "dashboard",
   "dev",
   "docs",
   "favicon",
   "feedback",
   "help",
   "holdmetoit",
   "host",
   "leaderboard",
   "login",
   "logout",
   "me",
   "null",
   "offline",
   "pokemon",
   "preferences",
   "privacy",
   "profile",
   "public",
   "rewards",
   "robots",
   "root",
   "settings",
   "sick",
   "signin",
   "signout",
   "sitemap",
   "static",
   "status",
   "support",
   "system",
   "task",
   "tasks",
   "team",
   "teams",
   "terms",
   "trophies",
   "u",
   "undefined",
   "user",
   "users",
   "wager",
   "wagers",
   "wrapped",
   "ypt",
]);

export type UsernameErrorCode =
   | "USERNAME_EMPTY"
   | "USERNAME_TOO_SHORT"
   | "USERNAME_TOO_LONG"
   | "USERNAME_INVALID_CHARS"
   | "USERNAME_CANNOT_START_OR_END_WITH_UNDERSCORE"
   | "USERNAME_CONSECUTIVE_UNDERSCORES"
   | "USERNAME_RESERVED";

export type UsernameValidationResult =
   | {
        ok: true;
        formatted: string;
        canonical: string;
     }
   | {
        ok: false;
        code: UsernameErrorCode;
        message: string;
     };

/**
 * Formats a username by trimming outer whitespace while preserving entered casing.
 */
export function formatUsername(raw: string): string {
   return raw.trim();
}

/**
 * Normalizes a username for case-insensitive indexing and comparisons.
 */
export function canonicalizeUsername(raw: string): string {
   return raw.trim().toLowerCase();
}

/**
 * Checks whether a candidate string matches a reserved system name (case-insensitively).
 */
export function isReservedUsername(candidate: string): boolean {
   return RESERVED_USERNAMES.has(canonicalizeUsername(candidate));
}

/**
 * Validates a candidate username against all platform syntax and reservation rules.
 * Preserves the user's casing in `formatted` while returning the lowercased `canonical`.
 */
export function validateUsername(candidate: unknown): UsernameValidationResult {
   if (typeof candidate !== "string") {
      return {
         ok: false,
         code: "USERNAME_EMPTY",
         message: "Username must be a valid text string.",
      };
   }

   const trimmed = candidate.trim();

   if (trimmed.length === 0) {
      return {
         ok: false,
         code: "USERNAME_EMPTY",
         message: "Username cannot be empty.",
      };
   }

   if (trimmed.length < USERNAME_MIN_LENGTH) {
      return {
         ok: false,
         code: "USERNAME_TOO_SHORT",
         message: `Username must be at least ${USERNAME_MIN_LENGTH} characters long.`,
      };
   }

   if (trimmed.length > USERNAME_MAX_LENGTH) {
      return {
         ok: false,
         code: "USERNAME_TOO_LONG",
         message: `Username cannot exceed ${USERNAME_MAX_LENGTH} characters.`,
      };
   }

   if (trimmed.startsWith("_") || trimmed.endsWith("_")) {
      return {
         ok: false,
         code: "USERNAME_CANNOT_START_OR_END_WITH_UNDERSCORE",
         message: "Username cannot start or end with an underscore.",
      };
   }

   if (trimmed.includes("__")) {
      return {
         ok: false,
         code: "USERNAME_CONSECUTIVE_UNDERSCORES",
         message: "Username cannot contain consecutive underscores.",
      };
   }

   if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return {
         ok: false,
         code: "USERNAME_INVALID_CHARS",
         message:
            "Username can only contain alphanumeric characters (letters and numbers) and underscores.",
      };
   }

   if (isReservedUsername(trimmed)) {
      return {
         ok: false,
         code: "USERNAME_RESERVED",
         message: `"${trimmed}" is a reserved system keyword and cannot be claimed.`,
      };
   }

   return {
      ok: true,
      formatted: trimmed,
      canonical: trimmed.toLowerCase(),
   };
}

export interface UsernameCooldownCheck {
   allowed: boolean;
   remainingDays: number;
   cooldownEndsAt: Date | null;
}

/**
 * Evaluates whether a user is permitted to update their username under the 7-day cooldown rule.
 * Users who have never changed their username (null/undefined) are exempt.
 */
export function isUsernameChangeAllowed(
   lastChangedAt: Date | string | null | undefined,
   now: Date = new Date()
): UsernameCooldownCheck {
   if (!lastChangedAt) {
      return { allowed: true, remainingDays: 0, cooldownEndsAt: null };
   }

   const lastDate =
      typeof lastChangedAt === "string" ? new Date(lastChangedAt) : lastChangedAt;

   if (Number.isNaN(lastDate.getTime())) {
      return { allowed: true, remainingDays: 0, cooldownEndsAt: null };
   }

   const cooldownEndsAt = new Date(lastDate.getTime() + USERNAME_COOLDOWN_MS);
   const diffMs = cooldownEndsAt.getTime() - now.getTime();

   if (diffMs <= 0) {
      return { allowed: true, remainingDays: 0, cooldownEndsAt: null };
   }

   const remainingDays = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));

   return {
      allowed: false,
      remainingDays,
      cooldownEndsAt,
   };
}

/**
 * Generates an alternative username candidate by appending a numeric suffix,
 * ensuring the resulting string never exceeds USERNAME_MAX_LENGTH.
 */
export function generateSuffixedUsername(base: string, attempt: number): string {
   const suffix = `_${attempt}`;
   const maxBaseLength = USERNAME_MAX_LENGTH - suffix.length;

   let truncatedBase = base.slice(0, maxBaseLength);
   // Clean any trailing underscore from truncation so we don't produce '__'
   truncatedBase = truncatedBase.replace(/_+$/, "");

   if (truncatedBase.length === 0) {
      truncatedBase = "scholar";
      const cleanMax = USERNAME_MAX_LENGTH - suffix.length;
      truncatedBase = truncatedBase.slice(0, cleanMax);
   }

   return `${truncatedBase}${suffix}`;
}

/**
 * Sanitizes arbitrary strings (such as Discord handles) into a valid platform candidate.
 */
export function sanitizeDiscordUsername(
   rawDiscordUsername: string | null | undefined
): string {
   if (!rawDiscordUsername || typeof rawDiscordUsername !== "string") {
      return "scholar";
   }

   // Replace spaces, dots, hyphens, and non-alphanumeric chars with underscores
   let cleaned = rawDiscordUsername
      .trim()
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

   if (cleaned.length === 0) {
      cleaned = "scholar";
   } else if (cleaned.length < USERNAME_MIN_LENGTH) {
      cleaned = `${cleaned}_scholar`.slice(0, USERNAME_MAX_LENGTH);
   } else if (cleaned.length > USERNAME_MAX_LENGTH) {
      cleaned = cleaned.slice(0, USERNAME_MAX_LENGTH).replace(/_+$/, "");
   }

   if (isReservedUsername(cleaned)) {
      cleaned = generateSuffixedUsername(cleaned, 1);
   }

   return cleaned;
}

/**
 * Runtime Zod schema for validating username payloads in server actions.
 */
export const usernameZodSchema = z
   .string()
   .min(1, "Username is required.")
   .superRefine((val, ctx) => {
      const result = validateUsername(val);
      if (!result.ok) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: result.message,
         });
      }
   })
   .transform((val) => formatUsername(val));
