import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import * as avatarService from "@/features/auth/data/discord-avatar.service";

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

   it("returns 400 when neither userId nor discordId is provided", async () => {
      const req = new Request("http://localhost/api/users/sync-avatar", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
   });

   it("calls syncUserAvatar and returns 200 on valid payload", async () => {
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
      expect(json.newImageUrl).toBe(
         "https://cdn.discordapp.com/avatars/123/fresh.png"
      );
      expect(avatarService.syncUserAvatar).toHaveBeenCalledWith({
         userId: "user_abc",
         discordId: undefined,
      });
   });
});
