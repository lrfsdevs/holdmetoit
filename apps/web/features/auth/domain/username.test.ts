import { describe, expect, it } from "vitest";
import {
   canonicalizeUsername,
   formatUsername,
   generateSuffixedUsername,
   isReservedUsername,
   isUsernameChangeAllowed,
   sanitizeDiscordUsername,
   USERNAME_MAX_LENGTH,
   USERNAME_MIN_LENGTH,
   usernameZodSchema,
   validateUsername,
} from "./username";

describe("username domain logic (Law L7)", () => {
   describe("validateUsername", () => {
      it("accepts valid alphanumeric usernames with preserved casing", () => {
         const validCases = [
            "Alice",
            "bob123",
            "Study_Champ",
            "A_B_C",
            "scholar99",
            "PRO_2026",
         ];

         for (const candidate of validCases) {
            const res = validateUsername(candidate);
            expect(res.ok).toBe(true);
            if (res.ok) {
               expect(res.formatted).toBe(candidate);
               expect(res.canonical).toBe(candidate.toLowerCase());
            }
         }
      });

      it("trims outer whitespace but preserves internal casing", () => {
         const res = validateUsername("   Alice_Scholar   ");
         expect(res.ok).toBe(true);
         if (res.ok) {
            expect(res.formatted).toBe("Alice_Scholar");
            expect(res.canonical).toBe("alice_scholar");
         }
      });

      it("rejects non-string or empty input", () => {
         expect(validateUsername("").ok).toBe(false);
         expect(validateUsername("   ").ok).toBe(false);
         expect(validateUsername(null).ok).toBe(false);
         expect(validateUsername(undefined).ok).toBe(false);
      });

      it("enforces minimum length (3 chars)", () => {
         const res = validateUsername("ab");
         expect(res.ok).toBe(false);
         if (!res.ok) {
            expect(res.code).toBe("USERNAME_TOO_SHORT");
         }
      });

      it("enforces maximum length (20 chars)", () => {
         const res = validateUsername("a".repeat(21));
         expect(res.ok).toBe(false);
         if (!res.ok) {
            expect(res.code).toBe("USERNAME_TOO_LONG");
         }

         const validBoundary = validateUsername("a".repeat(20));
         expect(validBoundary.ok).toBe(true);
      });

      it("rejects leading or trailing underscores", () => {
         const leading = validateUsername("_alice");
         expect(leading.ok).toBe(false);
         if (!leading.ok) {
            expect(leading.code).toBe("USERNAME_CANNOT_START_OR_END_WITH_UNDERSCORE");
         }

         const trailing = validateUsername("alice_");
         expect(trailing.ok).toBe(false);
         if (!trailing.ok) {
            expect(trailing.code).toBe("USERNAME_CANNOT_START_OR_END_WITH_UNDERSCORE");
         }
      });

      it("rejects consecutive underscores", () => {
         const res = validateUsername("alice__scholar");
         expect(res.ok).toBe(false);
         if (!res.ok) {
            expect(res.code).toBe("USERNAME_CONSECUTIVE_UNDERSCORES");
         }
      });

      it("rejects invalid characters (spaces, hyphens, dots, emojis)", () => {
         const invalidCharacters = [
            "alice scholar",
            "alice-scholar",
            "alice.scholar",
            "alice@home",
            "alice#1234",
            "alice🔥",
         ];

         for (const invalid of invalidCharacters) {
            const res = validateUsername(invalid);
            expect(res.ok).toBe(false);
            if (!res.ok) {
               expect(res.code).toBe("USERNAME_INVALID_CHARS");
            }
         }
      });

      it("rejects reserved keywords case-insensitively", () => {
         const reserved = ["admin", "ADMIN", "Admin", "api", "dashboard", "team", "support"];

         for (const word of reserved) {
            const res = validateUsername(word);
            expect(res.ok).toBe(false);
            if (!res.ok) {
               expect(res.code).toBe("USERNAME_RESERVED");
            }
         }
      });
   });

   describe("canonicalizeUsername & formatUsername", () => {
      it("canonicalizes to trimmed lowercase", () => {
         expect(canonicalizeUsername("  Alice_PRO  ")).toBe("alice_pro");
      });

      it("formats preserving casing", () => {
         expect(formatUsername("  Alice_PRO  ")).toBe("Alice_PRO");
      });
   });

   describe("isUsernameChangeAllowed (7-day cooldown)", () => {
      const now = new Date("2026-11-05T10:00:00.000Z");

      it("allows changes if lastChangedAt is null or undefined", () => {
         expect(isUsernameChangeAllowed(null, now).allowed).toBe(true);
         expect(isUsernameChangeAllowed(undefined, now).allowed).toBe(true);
      });

      it("allows changes if 7 or more days have elapsed", () => {
         const exactly7DaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
         expect(isUsernameChangeAllowed(exactly7DaysAgo, now).allowed).toBe(true);

         const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
         expect(isUsernameChangeAllowed(eightDaysAgo, now).allowed).toBe(true);
      });

      it("blocks changes within the 7-day window and calculates remaining days", () => {
         // Changed 2 days ago -> 5 days remaining
         const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
         const res = isUsernameChangeAllowed(twoDaysAgo, now);

         expect(res.allowed).toBe(false);
         expect(res.remainingDays).toBe(5);
         expect(res.cooldownEndsAt?.toISOString()).toBe(
            new Date(twoDaysAgo.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
         );
      });

      it("reports 1 day remaining when under 24 hours left", () => {
         const almost7DaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000 - 3600000));
         const res = isUsernameChangeAllowed(almost7DaysAgo, now);

         expect(res.allowed).toBe(false);
         expect(res.remainingDays).toBe(1);
      });
   });

   describe("generateSuffixedUsername", () => {
      it("appends numeric suffix to base", () => {
         expect(generateSuffixedUsername("Alice", 1)).toBe("Alice_1");
         expect(generateSuffixedUsername("Alice", 42)).toBe("Alice_42");
      });

      it("truncates base when necessary so result never exceeds 20 characters", () => {
         const longBase = "abcdefghijklmnopqrst"; // 20 chars
         const suffixed = generateSuffixedUsername(longBase, 1); // _1 is 2 chars -> base should be 18
         expect(suffixed.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
         expect(suffixed).toBe("abcdefghijklmnopqr_1");
      });

      it("cleans trailing underscores on truncated base before adding suffix", () => {
         const baseWithUnderscoreAtCutoff = "abcdefghijklmnop_rst";
         const suffixed = generateSuffixedUsername(baseWithUnderscoreAtCutoff, 12);
         expect(suffixed.includes("__")).toBe(false);
      });
   });

   describe("sanitizeDiscordUsername", () => {
      it("converts spaces, hyphens and dots to underscores", () => {
         expect(sanitizeDiscordUsername("Alice.Smith-99")).toBe("Alice_Smith_99");
      });

      it("falls back to scholar if empty or invalid", () => {
         expect(sanitizeDiscordUsername("")).toBe("scholar");
         expect(sanitizeDiscordUsername(null)).toBe("scholar");
         expect(sanitizeDiscordUsername("___")).toBe("scholar");
      });

      it("expands short handles to meet minimum length", () => {
         const sanitized = sanitizeDiscordUsername("al");
         expect(sanitized.length).toBeGreaterThanOrEqual(USERNAME_MIN_LENGTH);
      });

      it("truncates overly long handles to 20 characters", () => {
         const long = "a".repeat(30);
         const sanitized = sanitizeDiscordUsername(long);
         expect(sanitized.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
      });

      it("suffices reserved handles", () => {
         const sanitized = sanitizeDiscordUsername("admin");
         expect(sanitized).toBe("admin_1");
      });
   });

   describe("usernameZodSchema", () => {
      it("parses and trims valid username", () => {
         const parsed = usernameZodSchema.parse("  MasterCoder_99  ");
         expect(parsed).toBe("MasterCoder_99");
      });

      it("throws validation error for invalid username", () => {
         expect(() => usernameZodSchema.parse("ad")).toThrow();
         expect(() => usernameZodSchema.parse("admin")).toThrow();
         expect(() => usernameZodSchema.parse("invalid!char")).toThrow();
      });
   });
});
