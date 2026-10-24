import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/core/db";
import {
   fetchDiscordUserAvatar,
   fetchDiscordUserAvatarViaOAuth,
   syncUserAvatar,
} from "./discord-avatar.service";

vi.mock("@/core/db", () => ({
   prisma: {
      user: {
         findFirst: vi.fn(),
         update: vi.fn(),
      },
      account: {
         findFirst: vi.fn(),
         update: vi.fn(),
      },
   },
}));

vi.mock("@/core/observability/logger", () => ({
   createLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
   }),
   logEvents: {
      appError: "app.error",
      authUserSynced: "auth.user_synced",
   },
}));

describe("discord-avatar.service", () => {
   const originalEnv = process.env;

   beforeEach(() => {
      vi.clearAllMocks();
      process.env = { ...originalEnv };
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null);
   });

   afterEach(() => {
      process.env = originalEnv;
   });

   describe("fetchDiscordUserAvatar", () => {
      it("returns null when DISCORD_BOT_TOKEN is not configured", async () => {
         delete process.env.DISCORD_BOT_TOKEN;
         const result = await fetchDiscordUserAvatar("80351110224678912");
         expect(result).toBeNull();
      });

      it("fetches and formats avatar when Discord API returns valid user", async () => {
         process.env.DISCORD_BOT_TOKEN = "fake_bot_token";
         global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
               id: "80351110224678912",
               username: "testuser",
               avatar: "new_avatar_hash_123",
               discriminator: "0",
            }),
         });

         const result = await fetchDiscordUserAvatar("80351110224678912");
         expect(result).toEqual({
            avatarUrl:
               "https://cdn.discordapp.com/avatars/80351110224678912/new_avatar_hash_123.png",
            avatarHash: "new_avatar_hash_123",
         });
      });

      it("returns default avatar when user has no custom avatar on Discord", async () => {
         process.env.DISCORD_BOT_TOKEN = "fake_bot_token";
         global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
               id: "80351110224678912",
               username: "testuser",
               avatar: null,
               discriminator: "0",
            }),
         });

         const result = await fetchDiscordUserAvatar("80351110224678912");
         expect(result?.avatarUrl).toContain("embed/avatars");
         expect(result?.avatarHash).toBeNull();
      });

      it("handles 404 from Discord by returning default embed avatar", async () => {
         process.env.DISCORD_BOT_TOKEN = "fake_bot_token";
         global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
         });

         const result = await fetchDiscordUserAvatar("80351110224678912");
         expect(result?.avatarUrl).toContain("embed/avatars");
         expect(result?.avatarHash).toBeNull();
      });
   });

   describe("fetchDiscordUserAvatarViaOAuth", () => {
      it("returns null if no account exists", async () => {
         vi.mocked(prisma.account.findFirst).mockResolvedValue(null);
         const res = await fetchDiscordUserAvatarViaOAuth("user_none");
         expect(res).toBeNull();
      });

      it("fetches profile using valid access token without re-login", async () => {
         vi.mocked(prisma.account.findFirst).mockResolvedValue({
            id: "acc_1",
            access_token: "valid_token",
            refresh_token: "refresh_123",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
         } as never);

         global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
               id: "617551062102048779",
               username: "nrgslayer",
               avatar: "fresh_hash_oauth",
               discriminator: "0",
            }),
         });

         const res = await fetchDiscordUserAvatarViaOAuth("user_1");
         expect(res?.avatarUrl).toBe(
            "https://cdn.discordapp.com/avatars/617551062102048779/fresh_hash_oauth.png"
         );
      });
   });

   describe("syncUserAvatar", () => {
      it("returns false if neither userId nor discordId is provided", async () => {
         const result = await syncUserAvatar({});
         expect(result).toEqual({ success: false, newImageUrl: null });
      });

      it("updates user avatar in DB when fresh avatar is fetched from Discord via Bot", async () => {
         process.env.DISCORD_BOT_TOKEN = "fake_bot_token";
         vi.mocked(prisma.user.findFirst).mockResolvedValue({
            id: "user_1",
            discordId: "80351110224678912",
            image: "https://cdn.discordapp.com/avatars/80351110224678912/old_dead_hash.png",
         } as never);

         global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
               id: "80351110224678912",
               username: "testuser",
               avatar: "fresh_hash_456",
               discriminator: "0",
            }),
         });

         const result = await syncUserAvatar({ userId: "user_1" });
         expect(result.success).toBe(true);
         expect(result.newImageUrl).toBe(
            "https://cdn.discordapp.com/avatars/80351110224678912/fresh_hash_456.png"
         );
         expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "user_1" },
            data: {
               image: "https://cdn.discordapp.com/avatars/80351110224678912/fresh_hash_456.png",
            },
         });
      });

      it("heals dead avatar hash to default embed avatar if bot query and oauth are unavailable", async () => {
         delete process.env.DISCORD_BOT_TOKEN;
         vi.mocked(prisma.user.findFirst).mockResolvedValue({
            id: "user_2",
            discordId: "80351110224678912",
            image: "https://cdn.discordapp.com/avatars/80351110224678912/dead_hash.png",
         } as never);

         const result = await syncUserAvatar({
            discordId: "80351110224678912",
         });
         expect(result.success).toBe(true);
         expect(result.newImageUrl).toContain("embed/avatars");
         expect(prisma.user.update).toHaveBeenCalled();
      });
   });
});
