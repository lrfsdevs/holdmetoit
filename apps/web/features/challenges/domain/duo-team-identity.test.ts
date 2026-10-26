import { describe, expect, it } from "vitest";

import {
   canEditDuoTeamIdentity,
   DUO_TEAM_EMOJI_MAX_INPUT_LENGTH,
   DUO_TEAM_NAME_MAX_LENGTH,
   DuoTeamIdentityError,
   validateDuoTeamEmoji,
   validateDuoTeamName,
} from "./duo-team-identity";

describe("validateDuoTeamName", () => {
   it("trims surrounding whitespace", () => {
      expect(validateDuoTeamName("  Caffeine & Calculus  ")).toEqual({
         ok: true,
         name: "Caffeine & Calculus",
      });
   });

   it("rejects empty and whitespace-only names", () => {
      for (const value of ["", "   ", "\n\t"]) {
         const result = validateDuoTeamName(value);
         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("INVALID_NAME");
         }
      }
   });

   it("rejects names longer than the max length", () => {
      const result = validateDuoTeamName(
         "x".repeat(DUO_TEAM_NAME_MAX_LENGTH + 1)
      );
      expect(result.ok).toBe(false);
   });

   it("accepts a name exactly at the max length", () => {
      const name = "x".repeat(DUO_TEAM_NAME_MAX_LENGTH);
      expect(validateDuoTeamName(name)).toEqual({ ok: true, name });
   });
});

describe("validateDuoTeamEmoji", () => {
   it.each([
      ["🔥", "single pictographic emoji"],
      ["❤️", "VS16 sequence"],
      ["👨‍👩‍👧", "ZWJ family"],
      ["🇯🇵", "regional-indicator flag"],
      ["👍🏽", "skin-tone modifier"],
      ["1️⃣", "keycap sequence"],
   ])("accepts %s (%s)", (emoji) => {
      expect(validateDuoTeamEmoji(emoji)).toEqual({ ok: true, emoji });
   });

   it("trims surrounding whitespace", () => {
      expect(validateDuoTeamEmoji("  🦊  ")).toEqual({ ok: true, emoji: "🦊" });
   });

   it.each([[""], ["   "], [null], [undefined]])(
      "treats %s as a cleared emoji",
      (value) => {
         expect(validateDuoTeamEmoji(value)).toEqual({
            ok: true,
            emoji: null,
         });
      }
   );

   it.each([["🐝🐝"], ["abc"], ["42"], ["🔥 fire"]])(
      "rejects %s as not a single emoji",
      (value) => {
         const result = validateDuoTeamEmoji(value);
         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("INVALID_EMOJI");
         }
      }
   );

   it("rejects input longer than the safety cap", () => {
      const result = validateDuoTeamEmoji(
         "🔥".repeat(DUO_TEAM_EMOJI_MAX_INPUT_LENGTH)
      );
      expect(result.ok).toBe(false);
   });
});

describe("canEditDuoTeamIdentity", () => {
   it("allows editing while the challenge is upcoming or active and unlocked", () => {
      expect(
         canEditDuoTeamIdentity({ status: "UPCOMING", resultsLockedAt: null })
      ).toBe(true);
      expect(
         canEditDuoTeamIdentity({
            status: "ACTIVE",
            resultsLockedAt: undefined,
         })
      ).toBe(true);
   });

   it("blocks editing once results are locked", () => {
      expect(
         canEditDuoTeamIdentity({
            status: "ACTIVE",
            resultsLockedAt: new Date("2026-10-26T00:00:00.000Z"),
         })
      ).toBe(false);
   });

   it("blocks editing after completion", () => {
      expect(
         canEditDuoTeamIdentity({ status: "COMPLETED", resultsLockedAt: null })
      ).toBe(false);
   });
});

describe("DuoTeamIdentityError", () => {
   it("carries its error code", () => {
      const error = new DuoTeamIdentityError("DUPLICATE_NAME", "Taken");
      expect(error.code).toBe("DUPLICATE_NAME");
      expect(error.name).toBe("DuoTeamIdentityError");
   });
});
