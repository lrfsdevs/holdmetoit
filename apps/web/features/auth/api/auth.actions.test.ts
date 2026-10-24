import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshUserAvatarAction } from "./auth.actions";
import { auth } from "@/core/auth";
import { clearRateLimitStore } from "@/core/security/rate-limiter";
import * as avatarService from "@/features/auth/data/discord-avatar.service";

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
   signIn: vi.fn(),
   signOut: vi.fn(),
}));

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
}));

vi.mock("@/core/observability/logger", () => ({
   createLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
   }),
   logEvents: {
      authDiscordSignin: "auth.discord_signin",
      authSignout: "auth.signout",
   },
}));

vi.mock("@/features/auth/data/discord-avatar.service", () => ({
   syncUserAvatar: vi.fn(),
}));

describe("refreshUserAvatarAction", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      clearRateLimitStore();
   });

   it("returns unauthorized when session is missing", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);
      const res = await refreshUserAvatarAction();
      expect(res).toEqual({
         success: false,
         newImageUrl: null,
         error: "Unauthorized",
      });
   });

   it("calls syncUserAvatar with allowOAuth true and returns fresh image on success", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_123" },
      } as never);

      vi.mocked(avatarService.syncUserAvatar).mockResolvedValue({
         success: true,
         newImageUrl: "https://cdn.discordapp.com/avatars/123/hash.png",
         updated: true,
      });

      const res = await refreshUserAvatarAction();
      expect(res).toEqual({
         success: true,
         newImageUrl: "https://cdn.discordapp.com/avatars/123/hash.png",
         updated: true,
      });
      expect(avatarService.syncUserAvatar).toHaveBeenCalledWith({
         userId: "user_123",
         allowOAuth: true,
      });
   });

   it("rate-limits after 5 consecutive requests within window", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_spammer" },
      } as never);

      vi.mocked(avatarService.syncUserAvatar).mockResolvedValue({
         success: true,
         newImageUrl: "https://cdn.discordapp.com/avatars/123/hash.png",
      });

      for (let i = 0; i < 5; i++) {
         const res = await refreshUserAvatarAction();
         expect(res.success).toBe(true);
      }

      const throttled = await refreshUserAvatarAction();
      expect(throttled.success).toBe(false);
      expect(throttled.error).toContain("Too many refresh attempts");
   });
});
