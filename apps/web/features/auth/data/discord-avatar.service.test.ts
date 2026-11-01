import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/core/db";

const discord = vi.hoisted(() => {
   class DiscordAPIError extends Error {
      status: number;

      constructor(message: string, status: number) {
         super(message);
         this.name = "DiscordAPIError";
         this.status = status;
      }
   }

   return { DiscordAPIError, requestDiscord: vi.fn() };
});

vi.mock("@holdmetoit/discord", () => ({
   DiscordAPIError: discord.DiscordAPIError,
   requestDiscord: discord.requestDiscord,
}));

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

import {
   fetchDiscordUserAvatar,
   fetchDiscordUserAvatarViaOAuth,
   syncUserAvatar,
} from "./discord-avatar.service";

describe("discord-avatar.service", () => {
   const originalEnv = process.env;

   beforeEach(() => {
      vi.clearAllMocks();
      discord.requestDiscord.mockReset();
      discord.requestDiscord.mockResolvedValue(null);
      process.env = { ...originalEnv };
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.account.update).mockResolvedValue({} as never);
      vi.mocked(prisma.user.update).mockResolvedValue({} as never);
   });

   afterEach(() => {
      process.env = originalEnv;
   });

   describe("fetchDiscordUserAvatar", () => {
      it("returns null when DISCORD_BOT_TOKEN is not configured", async () => {
         delete process.env.DISCORD_BOT_TOKEN;

         expect(await fetchDiscordUserAvatar("80351110224678912")).toBeNull();
         expect(discord.requestDiscord).not.toHaveBeenCalled();
      });

      it("formats the avatar returned by the Discord client", async () => {
         process.env.DISCORD_BOT_TOKEN = "fake_bot_token";
         discord.requestDiscord.mockResolvedValue({
            id: "80351110224678912",
            username: "testuser",
            avatar: "new_avatar_hash_123",
            discriminator: "0",
         });

         const result = await fetchDiscordUserAvatar("80351110224678912");

         expect(result).toEqual({
            avatarUrl:
               "https://cdn.discordapp.com/avatars/80351110224678912/new_avatar_hash_123.png",
            avatarHash: "new_avatar_hash_123",
         });
         expect(discord.requestDiscord).toHaveBeenCalledWith(
            "/users/80351110224678912"
         );
      });

      it("returns the default embed avatar when the user has none", async () => {
         process.env.DISCORD_BOT_TOKEN = "fake_bot_token";
         discord.requestDiscord.mockResolvedValue({
            id: "80351110224678912",
            username: "testuser",
            avatar: null,
            discriminator: "0",
         });

         const result = await fetchDiscordUserAvatar("80351110224678912");
         expect(result?.avatarUrl).toContain("embed/avatars");
         expect(result?.avatarHash).toBeNull();
      });

      it("returns the default embed avatar on a 404", async () => {
         process.env.DISCORD_BOT_TOKEN = "fake_bot_token";
         discord.requestDiscord.mockRejectedValue(
            new discord.DiscordAPIError("Unknown User", 404)
         );

         const result = await fetchDiscordUserAvatar("80351110224678912");
         expect(result?.avatarUrl).toContain("embed/avatars");
         expect(result?.avatarHash).toBeNull();
      });

      it("returns null on any other Discord error", async () => {
         process.env.DISCORD_BOT_TOKEN = "fake_bot_token";
         discord.requestDiscord.mockRejectedValue(
            new discord.DiscordAPIError("Internal Server Error", 500)
         );

         expect(await fetchDiscordUserAvatar("80351110224678912")).toBeNull();
      });
   });

   describe("fetchDiscordUserAvatarViaOAuth", () => {
      it("returns requiresReauth when no account exists", async () => {
         const result = await fetchDiscordUserAvatarViaOAuth("user_none");

         expect(result.success).toBe(false);
         if (!result.success) expect(result.requiresReauth).toBe(true);
      });

      it("fetches the profile with a valid access token", async () => {
         vi.mocked(prisma.account.findFirst).mockResolvedValue({
            id: "acc_1",
            access_token: "valid_token",
            refresh_token: "refresh_123",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
         } as never);

         discord.requestDiscord.mockResolvedValue({
            id: "617551062102048779",
            username: "nrgslayer",
            avatar: "fresh_hash_oauth",
            discriminator: "0",
         });

         const result = await fetchDiscordUserAvatarViaOAuth("user_1");

         expect(result.success).toBe(true);
         if (result.success) {
            expect(result.avatarUrl).toBe(
               "https://cdn.discordapp.com/avatars/617551062102048779/fresh_hash_oauth.png"
            );
         }
         expect(discord.requestDiscord).toHaveBeenCalledWith("/users/@me", {
            auth: "bearer",
            token: "valid_token",
         });
      });

      it("refreshes an expired token and retries the profile lookup", async () => {
         process.env.AUTH_DISCORD_ID = "client_id";
         process.env.AUTH_DISCORD_SECRET = "client_secret";

         vi.mocked(prisma.account.findFirst).mockResolvedValue({
            id: "acc_1",
            access_token: "expired_token",
            refresh_token: "refresh_123",
            expires_at: Math.floor(Date.now() / 1000) - 60,
         } as never);

         discord.requestDiscord
            .mockResolvedValueOnce({
               access_token: "new_token",
               refresh_token: "new_refresh",
               expires_in: 3600,
            })
            .mockResolvedValueOnce({
               id: "617551062102048779",
               username: "nrgslayer",
               avatar: "refreshed_hash",
               discriminator: "0",
            });

         const result = await fetchDiscordUserAvatarViaOAuth("user_1");

         expect(result.success).toBe(true);
         expect(discord.requestDiscord).toHaveBeenNthCalledWith(
            1,
            "/oauth2/token",
            expect.objectContaining({
               method: "POST",
               auth: "none",
               passThroughBody: true,
            })
         );
         expect(discord.requestDiscord).toHaveBeenNthCalledWith(
            2,
            "/users/@me",
            { auth: "bearer", token: "new_token" }
         );
         expect(prisma.account.update).toHaveBeenCalledWith({
            where: { id: "acc_1" },
            data: {
               access_token: "new_token",
               refresh_token: "new_refresh",
               expires_at: expect.any(Number),
            },
         });
      });
   });

   describe("syncUserAvatar", () => {
      it("returns false when neither userId nor discordId is provided", async () => {
         const result = await syncUserAvatar({});

         expect(result.success).toBe(false);
         expect(result.newImageUrl).toBeNull();
      });

      it("skips OAuth lookup when allowOAuth is false", async () => {
         delete process.env.DISCORD_BOT_TOKEN;
         vi.mocked(prisma.user.findFirst).mockResolvedValue({
            id: "user_target",
            discordId: "80351110224678912",
            image: "https://cdn.discordapp.com/avatars/80351110224678912/active.png",
         } as never);

         global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
         });

         const result = await syncUserAvatar({
            userId: "user_target",
            allowOAuth: false,
         });

         expect(prisma.account.findFirst).not.toHaveBeenCalled();
         expect(result.success).toBe(false);
         expect(result.error).toContain("without OAuth authorization");
      });

      it("updates the stored avatar when the bot lookup returns a new hash", async () => {
         process.env.DISCORD_BOT_TOKEN = "fake_bot_token";
         vi.mocked(prisma.user.findFirst).mockResolvedValue({
            id: "user_1",
            discordId: "80351110224678912",
            image: "https://cdn.discordapp.com/avatars/80351110224678912/old_dead_hash.png",
         } as never);

         discord.requestDiscord.mockResolvedValue({
            id: "80351110224678912",
            username: "testuser",
            avatar: "fresh_hash_456",
            discriminator: "0",
         });

         const result = await syncUserAvatar({ userId: "user_1" });

         expect(result.success).toBe(true);
         expect(result.updated).toBe(true);
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

      it("does not write when the avatar is already current", async () => {
         process.env.DISCORD_BOT_TOKEN = "fake_bot_token";
         const currentAvatar =
            "https://cdn.discordapp.com/avatars/80351110224678912/current_hash.png";
         vi.mocked(prisma.user.findFirst).mockResolvedValue({
            id: "user_1",
            discordId: "80351110224678912",
            image: currentAvatar,
         } as never);

         discord.requestDiscord.mockResolvedValue({
            id: "80351110224678912",
            username: "testuser",
            avatar: "current_hash",
            discriminator: "0",
         });

         const result = await syncUserAvatar({ userId: "user_1" });

         expect(result.success).toBe(true);
         expect(result.updated).toBe(false);
         expect(result.message).toContain("up to date");
         expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it("heals a dead avatar hash to the default embed avatar", async () => {
         delete process.env.DISCORD_BOT_TOKEN;
         vi.mocked(prisma.user.findFirst).mockResolvedValue({
            id: "user_2",
            discordId: "80351110224678912",
            image: "https://cdn.discordapp.com/avatars/80351110224678912/dead_hash.png",
         } as never);

         global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
         });

         const result = await syncUserAvatar({
            discordId: "80351110224678912",
         });

         expect(result.success).toBe(true);
         expect(result.newImageUrl).toContain("embed/avatars");
         expect(prisma.user.update).toHaveBeenCalled();
      });

      it("preserves a healthy avatar and requests reauth when OAuth is unavailable", async () => {
         delete process.env.DISCORD_BOT_TOKEN;
         const healthyAvatar =
            "https://cdn.discordapp.com/avatars/80351110224678912/healthy_hash.png";
         vi.mocked(prisma.user.findFirst).mockResolvedValue({
            id: "user_3",
            discordId: "80351110224678912",
            image: healthyAvatar,
         } as never);

         global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
         });

         const result = await syncUserAvatar({
            userId: "user_3",
            allowOAuth: true,
         });

         expect(result.success).toBe(false);
         expect(result.requiresReauth).toBe(true);
         expect(result.newImageUrl).toBe(healthyAvatar);
         expect(prisma.user.update).not.toHaveBeenCalled();
      });
   });
});
