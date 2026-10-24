import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { auth } from "@/core/auth";
import * as avatarService from "@/features/auth/data/discord-avatar.service";

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
}));

vi.mock("@/features/auth/data/discord-avatar.service", () => ({
   syncUserAvatar: vi.fn(),
}));

vi.mock("@/core/observability/logger", () => ({
   createLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
   }),
   logEvents: {
      appError: "app.error",
   },
}));

describe("POST /api/users/sync-avatar", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("returns 401 when unauthenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const req = new Request("http://localhost/api/users/sync-avatar", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ userId: "user_abc" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
      expect(avatarService.syncUserAvatar).not.toHaveBeenCalled();
   });

   it("calls syncUserAvatar with allowOAuth: true when target matches session.user.id", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_abc" },
      } as never);

      vi.mocked(avatarService.syncUserAvatar).mockResolvedValue({
         success: true,
         newImageUrl: "https://cdn.discordapp.com/avatars/123/fresh.png",
      });

      const req = new Request("http://localhost/api/users/sync-avatar", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ userId: "user_abc" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(avatarService.syncUserAvatar).toHaveBeenCalledWith({
         userId: "user_abc",
         discordId: undefined,
         allowOAuth: true,
      });
   });

   it("calls syncUserAvatar with allowOAuth: false when target is another user", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_caller" },
      } as never);

      vi.mocked(avatarService.syncUserAvatar).mockResolvedValue({
         success: true,
         newImageUrl: "https://cdn.discordapp.com/avatars/123/fresh.png",
      });

      const req = new Request("http://localhost/api/users/sync-avatar", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ userId: "user_victim" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(avatarService.syncUserAvatar).toHaveBeenCalledWith({
         userId: "user_victim",
         discordId: undefined,
         allowOAuth: false,
      });
   });

   it("defaults to session.user.id with allowOAuth: true when body is empty", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_caller" },
      } as never);

      vi.mocked(avatarService.syncUserAvatar).mockResolvedValue({
         success: true,
         newImageUrl: "https://cdn.discordapp.com/avatars/123/fresh.png",
      });

      const req = new Request("http://localhost/api/users/sync-avatar", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(avatarService.syncUserAvatar).toHaveBeenCalledWith({
         userId: "user_caller",
         discordId: undefined,
         allowOAuth: true,
      });
   });
});
