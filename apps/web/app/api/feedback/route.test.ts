import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import * as feedbackRepo from "@/features/feedback/data/feedback.repository";
import * as discordService from "@/features/feedback/data/discord-feedback.service";
import { clearRateLimitStore } from "@/core/security/rate-limiter";

vi.mock("@/core/auth", () => ({
   auth: vi.fn().mockResolvedValue({
      user: { id: "usr_1", name: "Tester", role: "PARTICIPANT" },
   }),
}));

vi.mock("@/features/feedback/data/feedback.repository", () => ({
   createFeedbackRecord: vi.fn(),
   updateFeedbackDiscordStatus: vi.fn(),
}));

vi.mock("@/features/feedback/data/discord-feedback.service", () => ({
   sendFeedbackToDiscord: vi.fn(),
}));

describe("POST /api/feedback", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      clearRateLimitStore();
   });

   function createRequest(body: any, ip = "127.0.0.1"): NextRequest {
      return new NextRequest("http://localhost:3000/api/feedback", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": ip,
         },
         body: JSON.stringify(body),
      });
   }

   it("rejects invalid feedback payload with 400", async () => {
      const req = createRequest({ title: "" });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
   });

   it("accepts valid feedback and returns 201 with feedback code", async () => {
      vi.mocked(feedbackRepo.createFeedbackRecord).mockResolvedValue({
         id: "fb_123",
         feedbackNumber: 42,
         type: "BUG" as any,
         title: "Button alignment issue",
         description: "The submit button is slightly off-center on mobile.",
         url: "https://holdmetoit.com/",
         logrocketSessionId: null,
         userId: "usr_1",
         status: "OPEN" as any,
         discordStatus: "PENDING" as any,
         createdAt: new Date(),
         updatedAt: new Date(),
         discordMessageId: null,
         discordChannelId: null,
         user: null,
      } as any);

      vi.mocked(discordService.sendFeedbackToDiscord).mockResolvedValue({
         success: true,
         messageId: "msg_999",
         channelId: "chan_888",
      });

      const req = createRequest({
         type: "bug",
         title: "Button alignment issue",
         description: "The submit button is slightly off-center on mobile.",
         url: "https://holdmetoit.com/",
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.code).toBe("FB-42");
   });

   it("enforces rate limit and returns 429 when submissions exceed threshold", async () => {
      vi.mocked(feedbackRepo.createFeedbackRecord).mockResolvedValue({
         id: "fb_123",
         feedbackNumber: 42,
         type: "BUG" as any,
         title: "Rate limit test",
         description: "Testing rate limit threshold behavior.",
         url: "https://holdmetoit.com/",
         logrocketSessionId: null,
         userId: "usr_1",
         status: "OPEN" as any,
         discordStatus: "PENDING" as any,
         createdAt: new Date(),
         updatedAt: new Date(),
         discordMessageId: null,
         discordChannelId: null,
         user: null,
      } as any);
      vi.mocked(discordService.sendFeedbackToDiscord).mockResolvedValue({
         success: true,
      });

      const ip = "192.168.1.100";
      const validPayload = {
         type: "bug",
         title: "Rate limit test",
         description: "Testing rate limit threshold behavior.",
         url: "https://holdmetoit.com/",
      };

      // 5 allowed attempts
      for (let i = 0; i < 5; i++) {
         const res = await POST(createRequest(validPayload, ip));
         expect(res.status).toBe(201);
      }

      // 6th attempt should be blocked with 429
      const blockedRes = await POST(createRequest(validPayload, ip));
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers.get("Retry-After")).toBeDefined();

      const blockedJson = await blockedRes.json();
      expect(blockedJson.success).toBe(false);
      expect(blockedJson.error).toContain("Too many feedback submissions");
   });
});
