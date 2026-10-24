import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import * as feedbackRepo from "@/features/feedback/data/feedback.repository";
import * as discordService from "@/features/feedback/data/discord-feedback.service";
import { clearRateLimitStore } from "@/core/security/rate-limiter";

const {
   verifyFeedbackAttachment,
   deleteStorageObject,
   getFeedbackAttachmentsUrlConfig,
   createGitHubIssue,
   createJiraIssue,
} = vi.hoisted(() => ({
   verifyFeedbackAttachment: vi.fn(),
   deleteStorageObject: vi.fn(),
   getFeedbackAttachmentsUrlConfig: vi.fn(),
   createGitHubIssue: vi.fn(),
   createJiraIssue: vi.fn(),
}));

vi.mock("@/features/feedback/data/github-issue.service", () => ({
   createGitHubIssue,
}));

vi.mock("@/features/feedback/data/jira-issue.service", () => ({
   createJiraIssue,
}));

vi.mock("@/features/feedback/data/feedback-attachment.storage", () => ({
   verifyFeedbackAttachment,
}));

vi.mock("@/core/storage/supabase-storage", () => ({
   deleteStorageObject,
   getFeedbackAttachmentsUrlConfig,
}));

vi.mock("@/core/auth", () => ({
   auth: vi.fn().mockResolvedValue({
      user: { id: "usr_1", name: "Tester", role: "PARTICIPANT" },
   }),
}));

vi.mock("@/features/feedback/data/feedback.repository", () => ({
   createFeedbackRecord: vi.fn(),
   updateFeedbackDiscordStatus: vi.fn(),
   updateFeedbackGitHubStatus: vi.fn(),
   updateFeedbackJiraStatus: vi.fn(),
}));

vi.mock("@/features/feedback/data/discord-feedback.service", () => ({
   sendFeedbackToDiscord: vi.fn(),
}));

describe("POST /api/feedback", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      clearRateLimitStore();
      verifyFeedbackAttachment.mockResolvedValue(null);
      deleteStorageObject.mockResolvedValue(undefined);
      getFeedbackAttachmentsUrlConfig.mockReturnValue({
         supabaseUrl: "https://abc.supabase.co",
         bucket: "holdmetoit-bucket",
         folder: "feedback-attachments",
      });
      createGitHubIssue.mockResolvedValue({
         status: "skipped",
         reason: "GitHub issue sync is not configured.",
      });
      vi.mocked(feedbackRepo.updateFeedbackGitHubStatus).mockResolvedValue(
         {} as any
      );
      createJiraIssue.mockResolvedValue({
         status: "skipped",
         reason: "Jira issue sync is not configured.",
      });
      vi.mocked(feedbackRepo.updateFeedbackJiraStatus).mockResolvedValue(
         {} as any
      );
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

   const baseFeedback = {
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
   };

   const attachment = {
      path: "feedback-attachments/abc.png",
      url: "https://abc.supabase.co/storage/v1/object/public/holdmetoit-bucket/feedback-attachments/abc.png",
      kind: "image" as const,
      mimeType: "image/png",
      sizeBytes: 1024,
   };

   it("verifies and persists attachments, then sends them to Discord", async () => {
      vi.mocked(feedbackRepo.createFeedbackRecord).mockResolvedValue(
         baseFeedback as any
      );
      vi.mocked(discordService.sendFeedbackToDiscord).mockResolvedValue({
         success: true,
         messageId: "msg_999",
         channelId: "chan_888",
      });
      verifyFeedbackAttachment.mockResolvedValue(attachment);

      const res = await POST(
         createRequest({
            type: "bug",
            title: "Button alignment issue",
            description: "The submit button is slightly off-center on mobile.",
            url: "https://holdmetoit.com/",
            attachments: [attachment.path],
         })
      );

      expect(res.status).toBe(201);
      expect(verifyFeedbackAttachment).toHaveBeenCalledWith(attachment.path);
      expect(feedbackRepo.createFeedbackRecord).toHaveBeenCalledWith(
         expect.objectContaining({
            attachments: [attachment],
         })
      );
      expect(discordService.sendFeedbackToDiscord).toHaveBeenCalledWith(
         expect.objectContaining({
            attachments: [{ url: attachment.url, kind: "image" }],
         })
      );
   });

   it("rejects attachments on enhancement suggestions", async () => {
      const res = await POST(
         createRequest({
            type: "enhancement",
            title: "Add a dark mode toggle",
            description: "A toggle would be nice for late-night sessions.",
            url: "/",
            attachments: [attachment.path],
         })
      );

      expect(res.status).toBe(400);
      expect(verifyFeedbackAttachment).not.toHaveBeenCalled();
   });

   it("rejects duplicate attachment paths", async () => {
      const res = await POST(
         createRequest({
            type: "bug",
            title: "Button alignment issue",
            description: "The submit button is slightly off-center on mobile.",
            url: "/",
            attachments: [attachment.path, attachment.path],
         })
      );

      expect(res.status).toBe(400);
      expect(verifyFeedbackAttachment).not.toHaveBeenCalled();
   });

   it("rejects invalid attachments and cleans up the object", async () => {
      verifyFeedbackAttachment.mockResolvedValue(null);

      const res = await POST(
         createRequest({
            type: "bug",
            title: "Button alignment issue",
            description: "The submit button is slightly off-center on mobile.",
            url: "/",
            attachments: [attachment.path],
         })
      );

      expect(res.status).toBe(400);
      expect(deleteStorageObject).toHaveBeenCalledWith(attachment.path);
      expect(feedbackRepo.createFeedbackRecord).not.toHaveBeenCalled();
   });

   it("creates a GitHub issue and records its link", async () => {
      vi.mocked(feedbackRepo.createFeedbackRecord).mockResolvedValue(
         baseFeedback as any
      );
      vi.mocked(discordService.sendFeedbackToDiscord).mockResolvedValue({
         success: true,
         messageId: "msg_999",
         channelId: "chan_888",
      });
      createGitHubIssue.mockResolvedValue({
         status: "created",
         issueNumber: 7,
         issueUrl: "https://github.com/Afnanpathan2004/holdmetoit/issues/7",
      });

      const res = await POST(
         createRequest({
            type: "bug",
            title: "Button alignment issue",
            description: "The submit button is slightly off-center on mobile.",
            url: "https://holdmetoit.com/",
         })
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.githubDelivered).toBe(true);
      expect(json.data.githubIssueUrl).toBe(
         "https://github.com/Afnanpathan2004/holdmetoit/issues/7"
      );

      expect(createGitHubIssue).toHaveBeenCalledWith(
         expect.objectContaining({
            feedbackNumber: 42,
            type: "bug",
            title: "Button alignment issue",
            url: "https://holdmetoit.com/",
            attachments: [],
         })
      );
      expect(feedbackRepo.updateFeedbackGitHubStatus).toHaveBeenCalledWith(
         "fb_123",
         expect.objectContaining({
            status: "CREATED",
            issueNumber: 7,
            issueUrl: "https://github.com/Afnanpathan2004/holdmetoit/issues/7",
            syncedAt: expect.any(Date),
         })
      );
   });

   it("records SKIPPED when GitHub issue sync is disabled", async () => {
      vi.mocked(feedbackRepo.createFeedbackRecord).mockResolvedValue(
         baseFeedback as any
      );
      vi.mocked(discordService.sendFeedbackToDiscord).mockResolvedValue({
         success: true,
         messageId: "msg_999",
         channelId: "chan_888",
      });

      const res = await POST(
         createRequest({
            type: "bug",
            title: "Button alignment issue",
            description: "The submit button is slightly off-center on mobile.",
            url: "https://holdmetoit.com/",
         })
      );

      expect(res.status).toBe(201);
      expect(feedbackRepo.updateFeedbackGitHubStatus).toHaveBeenCalledWith(
         "fb_123",
         expect.objectContaining({ status: "SKIPPED" })
      );
   });

   it("keeps the submission successful when GitHub dispatch fails", async () => {
      vi.mocked(feedbackRepo.createFeedbackRecord).mockResolvedValue(
         baseFeedback as any
      );
      vi.mocked(discordService.sendFeedbackToDiscord).mockResolvedValue({
         success: true,
         messageId: "msg_999",
         channelId: "chan_888",
      });
      createGitHubIssue.mockResolvedValue({
         status: "failed",
         error: "GitHub API error (401): Bad credentials",
      });

      const res = await POST(
         createRequest({
            type: "bug",
            title: "Button alignment issue",
            description: "The submit button is slightly off-center on mobile.",
            url: "https://holdmetoit.com/",
         })
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.githubDelivered).toBe(false);
      expect(json.data.githubIssueUrl).toBeNull();
      expect(feedbackRepo.updateFeedbackGitHubStatus).toHaveBeenCalledWith(
         "fb_123",
         expect.objectContaining({ status: "FAILED" })
      );
      expect(discordService.sendFeedbackToDiscord).toHaveBeenCalled();
   });

   it("keeps the submission successful when GitHub dispatch rejects", async () => {
      vi.mocked(feedbackRepo.createFeedbackRecord).mockResolvedValue(
         baseFeedback as any
      );
      vi.mocked(discordService.sendFeedbackToDiscord).mockResolvedValue({
         success: true,
         messageId: "msg_999",
         channelId: "chan_888",
      });
      createGitHubIssue.mockRejectedValue(new Error("unexpected"));

      const res = await POST(
         createRequest({
            type: "bug",
            title: "Button alignment issue",
            description: "The submit button is slightly off-center on mobile.",
            url: "https://holdmetoit.com/",
         })
      );

      expect(res.status).toBe(201);
      expect(feedbackRepo.updateFeedbackGitHubStatus).toHaveBeenCalledWith(
         "fb_123",
         expect.objectContaining({ status: "FAILED" })
      );
   });

   it("creates a Jira issue and records its key and URL", async () => {
      vi.mocked(feedbackRepo.createFeedbackRecord).mockResolvedValue(
         baseFeedback as any
      );
      vi.mocked(discordService.sendFeedbackToDiscord).mockResolvedValue({
         success: true,
         messageId: "msg_999",
         channelId: "chan_888",
      });
      createJiraIssue.mockResolvedValue({
         status: "created",
         issueKey: "HMT-7",
         issueUrl: "https://example.atlassian.net/browse/HMT-7",
      });

      const res = await POST(
         createRequest({
            type: "bug",
            title: "Button alignment issue",
            description: "The submit button is slightly off-center on mobile.",
            url: "https://holdmetoit.com/",
         })
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.jiraDelivered).toBe(true);
      expect(json.data.jiraIssueKey).toBe("HMT-7");
      expect(json.data.jiraIssueUrl).toBe(
         "https://example.atlassian.net/browse/HMT-7"
      );

      expect(createJiraIssue).toHaveBeenCalledWith(
         expect.objectContaining({
            feedbackNumber: 42,
            type: "bug",
            title: "Button alignment issue",
            url: "https://holdmetoit.com/",
            attachments: [],
         })
      );
      expect(feedbackRepo.updateFeedbackJiraStatus).toHaveBeenCalledWith(
         "fb_123",
         expect.objectContaining({
            status: "CREATED",
            issueKey: "HMT-7",
            issueUrl: "https://example.atlassian.net/browse/HMT-7",
            syncedAt: expect.any(Date),
         })
      );
   });

   it("passes created GitHub issue number and URL into Jira dispatch", async () => {
      vi.mocked(feedbackRepo.createFeedbackRecord).mockResolvedValue(
         baseFeedback as any
      );
      vi.mocked(discordService.sendFeedbackToDiscord).mockResolvedValue({
         success: true,
         messageId: "msg_999",
         channelId: "chan_888",
      });
      createGitHubIssue.mockResolvedValue({
         status: "created",
         issueNumber: 167,
         issueUrl: "https://github.com/lrfsdevs/holdmetoit/issues/167",
      });
      createJiraIssue.mockResolvedValue({
         status: "created",
         issueKey: "KAN-53",
         issueUrl: "https://example.atlassian.net/browse/KAN-53",
      });

      const res = await POST(
         createRequest({
            type: "enhancement",
            title: "Proper issue tags and github link",
            description:
               "Jira tickets should link to github issues and have tags",
            url: "https://holdmetoit.com/",
         })
      );

      expect(res.status).toBe(201);
      expect(createJiraIssue).toHaveBeenCalledWith(
         expect.objectContaining({
            feedbackNumber: 42,
            type: "enhancement",
            githubIssueNumber: 167,
            githubIssueUrl: "https://github.com/lrfsdevs/holdmetoit/issues/167",
         })
      );
   });

   it("records SKIPPED when Jira issue sync is disabled", async () => {
      vi.mocked(feedbackRepo.createFeedbackRecord).mockResolvedValue(
         baseFeedback as any
      );
      vi.mocked(discordService.sendFeedbackToDiscord).mockResolvedValue({
         success: true,
         messageId: "msg_999",
         channelId: "chan_888",
      });

      const res = await POST(
         createRequest({
            type: "bug",
            title: "Button alignment issue",
            description: "The submit button is slightly off-center on mobile.",
            url: "https://holdmetoit.com/",
         })
      );

      expect(res.status).toBe(201);
      expect(feedbackRepo.updateFeedbackJiraStatus).toHaveBeenCalledWith(
         "fb_123",
         expect.objectContaining({ status: "SKIPPED" })
      );
   });

   it("keeps the submission successful when Jira dispatch fails", async () => {
      vi.mocked(feedbackRepo.createFeedbackRecord).mockResolvedValue(
         baseFeedback as any
      );
      vi.mocked(discordService.sendFeedbackToDiscord).mockResolvedValue({
         success: true,
         messageId: "msg_999",
         channelId: "chan_888",
      });
      createJiraIssue.mockResolvedValue({
         status: "failed",
         error: "Jira API error (401): Unauthorized",
      });

      const res = await POST(
         createRequest({
            type: "bug",
            title: "Button alignment issue",
            description: "The submit button is slightly off-center on mobile.",
            url: "https://holdmetoit.com/",
         })
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.jiraDelivered).toBe(false);
      expect(json.data.jiraIssueKey).toBeNull();
      expect(json.data.jiraIssueUrl).toBeNull();
      expect(feedbackRepo.updateFeedbackJiraStatus).toHaveBeenCalledWith(
         "fb_123",
         expect.objectContaining({ status: "FAILED" })
      );
      expect(discordService.sendFeedbackToDiscord).toHaveBeenCalled();
      expect(createGitHubIssue).toHaveBeenCalled();
   });

   it("keeps the submission successful when Jira dispatch rejects", async () => {
      vi.mocked(feedbackRepo.createFeedbackRecord).mockResolvedValue(
         baseFeedback as any
      );
      vi.mocked(discordService.sendFeedbackToDiscord).mockResolvedValue({
         success: true,
         messageId: "msg_999",
         channelId: "chan_888",
      });
      createJiraIssue.mockRejectedValue(new Error("unexpected"));

      const res = await POST(
         createRequest({
            type: "bug",
            title: "Button alignment issue",
            description: "The submit button is slightly off-center on mobile.",
            url: "https://holdmetoit.com/",
         })
      );

      expect(res.status).toBe(201);
      expect(feedbackRepo.updateFeedbackJiraStatus).toHaveBeenCalledWith(
         "fb_123",
         expect.objectContaining({ status: "FAILED" })
      );
   });
});
