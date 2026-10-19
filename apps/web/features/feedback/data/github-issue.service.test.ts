import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGitHubIssue, resolveGitHubConfig } from "./github-issue.service";

const originalEnv = process.env;
const fetchMock = vi.fn();

const input = {
   feedbackNumber: 42,
   type: "bug" as const,
   title: "Submit button unresponsive",
   description: "Clicking submit on mobile does nothing.",
   url: "/challenge/demo",
   createdAt: new Date("2026-10-19T12:00:00.000Z"),
};

function githubResponse(status: number, body: unknown) {
   return {
      status,
      json: async () => body,
      text: async () =>
         typeof body === "string" ? body : JSON.stringify(body),
   };
}

beforeEach(() => {
   process.env = {
      ...originalEnv,
      GITHUB_TOKEN: "ghp_test_token",
      GITHUB_REPO: "owner/repo",
   };
   delete process.env.GITHUB_API_URL;
   delete process.env.GITHUB_ISSUE_LABELS_BUG;
   delete process.env.GITHUB_ISSUE_LABELS_ENHANCEMENT;
   delete process.env.GITHUB_ISSUE_ASSIGNEES;

   vi.clearAllMocks();
   vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
   process.env = originalEnv;
   vi.unstubAllGlobals();
   vi.restoreAllMocks();
});

describe("resolveGitHubConfig", () => {
   it("is skipped when nothing is configured", () => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.GITHUB_REPO;

      expect(resolveGitHubConfig()).toEqual({
         ok: false,
         reason: "GitHub issue sync is not configured.",
      });
   });

   it("reports missing values and invalid repo formats", () => {
      delete process.env.GITHUB_TOKEN;
      expect(resolveGitHubConfig()).toEqual({
         ok: false,
         reason: "GITHUB_TOKEN is missing.",
      });

      process.env.GITHUB_TOKEN = "token";
      delete process.env.GITHUB_REPO;
      expect(resolveGitHubConfig()).toEqual({
         ok: false,
         reason: "GITHUB_REPO is missing.",
      });

      process.env.GITHUB_REPO = "not-a-repo";
      expect(resolveGitHubConfig()).toEqual({
         ok: false,
         reason: "GITHUB_REPO must use the owner/repo format.",
      });
   });

   it("uses defaults and normalizes optional lists", () => {
      process.env.GITHUB_ISSUE_ASSIGNEES = " afnan, , octocat ";
      process.env.GITHUB_API_URL = "https://github.example.com/";

      const result = resolveGitHubConfig();
      expect(result.ok).toBe(true);
      if (result.ok) {
         expect(result.config.apiUrl).toBe("https://github.example.com");
         expect(result.config.bugLabels).toEqual(["bug"]);
         expect(result.config.enhancementLabels).toEqual(["enhancement"]);
         expect(result.config.assignees).toEqual(["afnan", "octocat"]);
      }
   });
});

describe("createGitHubIssue", () => {
   it("does not call GitHub when unconfigured", async () => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.GITHUB_REPO;

      await expect(createGitHubIssue(input)).resolves.toEqual({
         status: "skipped",
         reason: "GitHub issue sync is not configured.",
      });
      expect(fetchMock).not.toHaveBeenCalled();
   });

   it("creates an issue with the expected URL, headers and body", async () => {
      fetchMock.mockResolvedValue(
         githubResponse(201, {
            number: 7,
            html_url: "https://github.com/owner/repo/issues/7",
         })
      );

      await expect(createGitHubIssue(input)).resolves.toEqual({
         status: "created",
         issueNumber: 7,
         issueUrl: "https://github.com/owner/repo/issues/7",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.github.com/repos/owner/repo/issues");
      expect(init).toMatchObject({
         method: "POST",
         headers: {
            Authorization: "Bearer ghp_test_token",
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
         },
      });

      const body = JSON.parse(init.body);
      expect(body.title).toBe("[FB-42] Submit button unresponsive");
      expect(body.labels).toEqual(["bug"]);
      expect(body.body).toContain("<!-- holdmetoit-feedback:FB-42 -->");
      expect(body.assignees).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain("ghp_test_token");
   });

   it("applies configured labels and assignees", async () => {
      process.env.GITHUB_ISSUE_LABELS_BUG = "bug, needs-triage";
      process.env.GITHUB_ISSUE_ASSIGNEES = "afnan,octocat";
      fetchMock.mockResolvedValue(
         githubResponse(201, {
            number: 1,
            html_url: "https://github.com/owner/repo/issues/1",
         })
      );

      await createGitHubIssue(input);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.labels).toEqual(["bug", "needs-triage"]);
      expect(body.assignees).toEqual(["afnan", "octocat"]);
   });

   it("retries once without labels on a 422", async () => {
      fetchMock
         .mockResolvedValueOnce(githubResponse(422, "Validation Failed"))
         .mockResolvedValueOnce(
            githubResponse(201, {
               number: 2,
               html_url: "https://github.com/owner/repo/issues/2",
            })
         );

      await expect(createGitHubIssue(input)).resolves.toEqual({
         status: "created",
         issueNumber: 2,
         issueUrl: "https://github.com/owner/repo/issues/2",
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(retryBody.labels).toEqual([]);
      expect(retryBody.title).toBe("[FB-42] Submit button unresponsive");
   });

   it("fails without throwing when the label retry also fails", async () => {
      fetchMock
         .mockResolvedValueOnce(githubResponse(422, "Validation Failed"))
         .mockResolvedValueOnce(githubResponse(422, "Validation Failed"));

      const result = await createGitHubIssue(input);
      expect(result.status).toBe("failed");
      if (result.status === "failed") {
         expect(result.error).toContain("GitHub API error (422)");
      }
   });

   it("fails without throwing on auth and server errors", async () => {
      fetchMock.mockResolvedValueOnce(githubResponse(401, "Bad credentials"));
      const unauthorized = await createGitHubIssue(input);
      expect(unauthorized.status).toBe("failed");
      if (unauthorized.status === "failed") {
         expect(unauthorized.error).toContain("GitHub API error (401)");
      }

      fetchMock.mockResolvedValueOnce(githubResponse(500, "Internal error"));
      const serverError = await createGitHubIssue(input);
      expect(serverError.status).toBe("failed");
   });

   it("fails without throwing on network errors", async () => {
      fetchMock.mockRejectedValue(new Error("network down"));

      const result = await createGitHubIssue(input);
      expect(result.status).toBe("failed");
      if (result.status === "failed") {
         expect(result.error).toContain("network down");
      }
   });

   it("fails without throwing on an unexpected 201 payload", async () => {
      fetchMock.mockResolvedValue(githubResponse(201, { unexpected: true }));

      const result = await createGitHubIssue(input);
      expect(result.status).toBe("failed");
   });
});
