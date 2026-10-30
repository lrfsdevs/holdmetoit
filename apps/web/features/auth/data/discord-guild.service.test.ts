import { beforeEach, describe, expect, it, vi } from "vitest";

const discord = vi.hoisted(() => ({
   fetchGuildMember: vi.fn(),
}));

vi.mock("@holdmetoit/discord", () => ({
   fetchGuildMember: discord.fetchGuildMember,
}));

import {
   fetchMemberRoles,
   isDiscordAdmin,
   isDiscordDev,
} from "./discord-guild.service";

describe("discord-guild.service", () => {
   const originalEnv = process.env;

   beforeEach(() => {
      vi.clearAllMocks();
      process.env = { ...originalEnv };
      discord.fetchGuildMember.mockResolvedValue(null);
   });

   describe("fetchMemberRoles", () => {
      it("returns an empty array when env vars are missing", async () => {
         delete process.env.DISCORD_GUILD_ID;

         const roles = await fetchMemberRoles("12345");
         expect(roles).toEqual([]);
         expect(discord.fetchGuildMember).not.toHaveBeenCalled();
      });

      it("returns the member roles from the shared Discord client", async () => {
         process.env.DISCORD_GUILD_ID = "guild_123";
         process.env.DISCORD_BOT_TOKEN = "bot_secret";
         discord.fetchGuildMember.mockResolvedValue({
            roles: ["role_1", "role_2"],
         });

         const roles = await fetchMemberRoles("user_456");

         expect(roles).toEqual(["role_1", "role_2"]);
         expect(discord.fetchGuildMember).toHaveBeenCalledWith({
            guildId: "guild_123",
            userId: "user_456",
         });
      });

      it("returns an empty array when the member lookup fails", async () => {
         process.env.DISCORD_GUILD_ID = "guild_123";
         discord.fetchGuildMember.mockResolvedValue(null);

         const roles = await fetchMemberRoles("user_not_in_server");
         expect(roles).toEqual([]);
      });
   });

   describe("isDiscordAdmin", () => {
      it("returns false when the user has no matching admin role", async () => {
         process.env.DISCORD_GUILD_ID = "guild_123";
         process.env.DISCORD_ADMIN_ROLE_IDS = "admin_role_a";
         discord.fetchGuildMember.mockResolvedValue({
            roles: ["regular_role"],
         });

         expect(await isDiscordAdmin("737561189755912223")).toBe(false);
      });

      it("returns true when the user has a configured admin role", async () => {
         process.env.DISCORD_GUILD_ID = "guild_123";
         process.env.DISCORD_ADMIN_ROLE_IDS = "admin_role_a, admin_role_b";
         discord.fetchGuildMember.mockResolvedValue({
            roles: ["member_role", "admin_role_b"],
         });

         expect(await isDiscordAdmin("user_with_admin_role")).toBe(true);
      });

      it("returns false for an empty user id without calling Discord", async () => {
         expect(await isDiscordAdmin("")).toBe(false);
         expect(discord.fetchGuildMember).not.toHaveBeenCalled();
      });
   });

   describe("isDiscordDev", () => {
      it("supports JSON array and comma-separated DEV_DISCORD_IDS", () => {
         process.env.DEV_DISCORD_IDS =
            '["123456789012345678", "987654321098765432"]';
         expect(isDiscordDev("123456789012345678")).toBe(true);

         process.env.DEV_DISCORD_IDS = "123456789012345678, 987654321098765432";
         expect(isDiscordDev("987654321098765432")).toBe(true);
      });

      it("supports the DISCORD_DEV_IDS fallback", () => {
         delete process.env.DEV_DISCORD_IDS;
         process.env.DISCORD_DEV_IDS = '["dev_user_snowflake"]';
         expect(isDiscordDev("dev_user_snowflake")).toBe(true);
      });

      it("returns false for unknown or empty ids", () => {
         process.env.DEV_DISCORD_IDS = '["123456789012345678"]';
         expect(isDiscordDev("random_user_snowflake")).toBe(false);
         expect(isDiscordDev("")).toBe(false);
      });
   });
});
