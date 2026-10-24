import { describe, expect, it } from "vitest";
import {
   buildDiscordAvatarUrl,
   getDiscordDefaultAvatarUrl,
   getInitials,
   parseDiscordAvatarUrl,
} from "./discord-avatar";

describe("discord-avatar domain logic", () => {
   describe("getDiscordDefaultAvatarUrl", () => {
      it("calculates default avatar based on legacy discriminator", () => {
         // 1337 % 5 = 2
         expect(getDiscordDefaultAvatarUrl("123456", "1337")).toBe(
            "https://cdn.discordapp.com/embed/avatars/2.png"
         );
         // 1000 % 5 = 0
         expect(getDiscordDefaultAvatarUrl("123456", "1000")).toBe(
            "https://cdn.discordapp.com/embed/avatars/0.png"
         );
      });

      it("calculates default avatar based on Discord snowflake when discriminator is '0' or missing", () => {
         // Snowflake (80351110224678912n >> 22n) % 6n = 5
         expect(getDiscordDefaultAvatarUrl("80351110224678912", "0")).toBe(
            "https://cdn.discordapp.com/embed/avatars/5.png"
         );
         expect(getDiscordDefaultAvatarUrl("80351110224678912", null)).toBe(
            "https://cdn.discordapp.com/embed/avatars/5.png"
         );
      });

      it("falls back to 0.png if discordId is invalid or missing", () => {
         expect(getDiscordDefaultAvatarUrl(null, null)).toBe(
            "https://cdn.discordapp.com/embed/avatars/0.png"
         );
         expect(getDiscordDefaultAvatarUrl("not-a-number", null)).toBe(
            "https://cdn.discordapp.com/embed/avatars/0.png"
         );
      });
   });

   describe("buildDiscordAvatarUrl", () => {
      it("builds standard png url when static hash is provided", () => {
         expect(
            buildDiscordAvatarUrl("80351110224678912", "abc1234567890def")
         ).toBe(
            "https://cdn.discordapp.com/avatars/80351110224678912/abc1234567890def.png"
         );
      });

      it("builds animated gif url when hash starts with a_", () => {
         expect(
            buildDiscordAvatarUrl("80351110224678912", "a_animatedhash123")
         ).toBe(
            "https://cdn.discordapp.com/avatars/80351110224678912/a_animatedhash123.gif"
         );
      });

      it("appends size query parameter when provided", () => {
         expect(
            buildDiscordAvatarUrl("80351110224678912", "abc1234567890def", {
               size: 256,
            })
         ).toBe(
            "https://cdn.discordapp.com/avatars/80351110224678912/abc1234567890def.png?size=256"
         );
      });

      it("falls back to default avatar when hash is absent", () => {
         expect(buildDiscordAvatarUrl("80351110224678912", null)).toBe(
            "https://cdn.discordapp.com/embed/avatars/5.png"
         );
      });
   });

   describe("parseDiscordAvatarUrl", () => {
      it("identifies valid Discord CDN avatar URLs", () => {
         const parsed = parseDiscordAvatarUrl(
            "https://cdn.discordapp.com/avatars/80351110224678912/abc1234567890def.png?size=128"
         );
         expect(parsed).toEqual({
            isDiscordAvatar: true,
            discordId: "80351110224678912",
            avatarHash: "abc1234567890def",
         });
      });

      it("returns false for non-avatar or external URLs", () => {
         expect(parseDiscordAvatarUrl("https://example.com/image.png")).toEqual(
            { isDiscordAvatar: false }
         );
         expect(parseDiscordAvatarUrl(null)).toEqual({
            isDiscordAvatar: false,
         });
         expect(
            parseDiscordAvatarUrl(
               "https://cdn.discordapp.com/embed/avatars/0.png"
            )
         ).toEqual({ isDiscordAvatar: false });
      });
   });

   describe("getInitials", () => {
      it("formats two-word names", () => {
         expect(getInitials("Aura Studier")).toBe("AS");
         expect(getInitials("john doe")).toBe("JD");
      });

      it("formats single-word names", () => {
         expect(getInitials("Krish")).toBe("KR");
         expect(getInitials("A")).toBe("A");
      });

      it("handles empty or null values gracefully", () => {
         expect(getInitials("")).toBe("?");
         expect(getInitials(null)).toBe("?");
         expect(getInitials("   ")).toBe("?");
      });
   });
});
