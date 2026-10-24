import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJiraIssue, resolveJiraConfig } from "./jira-issue.service";

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

function jiraResponse(status: number, body: unknown) {
   return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
      text: async () =>
         typeof body === "string" ? body : JSON.stringify(body),
   };
}

const expectedAuth = `Basic ${Buffer.from(
   "bot@example.com:jira_token"
).toString("base64")}`;

beforeEach(() => {
   process.env = {
      ...originalEnv,
      JIRA_BASE_URL: "https://example.atlassian.net/",
      JIRA_EMAIL: "bot@example.com",
      JIRA_API_TOKEN: "jira_token",
      JIRA_PROJECT_KEY: "HMT",
   };
   delete process.env.JIRA_LABELS;
   delete process.env.JIRA_ASSIGNEE_ACCOUNT_ID;

   vi.clearAllMocks();
   vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
   process.env = originalEnv;
   vi.unstubAllGlobals();
   vi.restoreAllMocks();
});

describe("resolveJiraConfig", () => {
   it("is skipped when nothing is configured", () => {
      delete process.env.JIRA_BASE_URL;
      delete process.env.JIRA_EMAIL;
      delete process.env.JIRA_API_TOKEN;
      delete process.env.JIRA_PROJECT_KEY;

      expect(resolveJiraConfig()).toEqual({
         ok: false,
         reason: "Jira issue sync is not configured.",
      });
   });

   it("reports missing values", () => {
      delete process.env.JIRA_API_TOKEN;
      expect(resolveJiraConfig()).toEqual({
         ok: false,
         reason: "JIRA_API_TOKEN is missing.",
      });
   });

   it("rejects non-https or malformed URLs", () => {
      process.env.JIRA_BASE_URL = "http://example.atlassian.net";
      expect(resolveJiraConfig()).toEqual({
         ok: false,
         reason: "JIRA_BASE_URL must use https.",
      });

      process.env.JIRA_BASE_URL = "not-a-url";
      expect(resolveJiraConfig()).toEqual({
         ok: false,
         reason: "JIRA_BASE_URL is not a valid URL.",
      });
   });

   it("rejects invalid project keys", () => {
      process.env.JIRA_PROJECT_KEY = "hmt";
      expect(resolveJiraConfig()).toMatchObject({
         ok: false,
         reason: expect.stringContaining("JIRA_PROJECT_KEY"),
      });
   });

   it("normalizes the base URL and optional settings", () => {
      process.env.JIRA_LABELS = " holdmetoit , needs triage ,, ";
      process.env.JIRA_ASSIGNEE_ACCOUNT_ID = " account-123 ";

      const result = resolveJiraConfig();
      expect(result.ok).toBe(true);
      if (result.ok) {
         expect(result.config.baseUrl).toBe("https://example.atlassian.net");
         expect(result.config.labels).toEqual(["holdmetoit", "needs-triage"]);
         expect(result.config.assigneeAccountId).toBe("account-123");
      }
   });
});

describe("createJiraIssue", () => {
   it("does not call Jira when unconfigured", async () => {
      delete process.env.JIRA_API_TOKEN;

      await expect(createJiraIssue(input)).resolves.toEqual({
         status: "skipped",
         reason: "JIRA_API_TOKEN is missing.",
      });
      expect(fetchMock).not.toHaveBeenCalled();
   });

   it("creates a Task issue with the expected URL, auth and fields", async () => {
      fetchMock.mockResolvedValue(
         jiraResponse(201, { id: "10001", key: "HMT-7" })
      );

      await expect(createJiraIssue(input)).resolves.toEqual({
         status: "created",
         issueKey: "HMT-7",
         issueUrl: "https://example.atlassian.net/browse/HMT-7",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://example.atlassian.net/rest/api/3/issue");
      expect(init).toMatchObject({
         method: "POST",
         headers: {
            Authorization: expectedAuth,
            Accept: "application/json",
            "Content-Type": "application/json",
         },
      });

      const body = JSON.parse(init.body);
      expect(body.fields.project).toEqual({ key: "HMT" });
      expect(body.fields.issuetype).toEqual({ name: "Task" });
      expect(body.fields.summary).toBe("[FB-42] Submit button unresponsive");
      expect(body.fields.labels).toEqual([
         "holdmetoit",
         "feedback",
         "frontend",
         "challenges",
         "bug",
      ]);
      expect(body.fields.description.type).toBe("doc");
      expect(body.fields.assignee).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain("jira_token");
   });

   it("maps suggestions to the Story issue type", async () => {
      fetchMock.mockResolvedValue(jiraResponse(201, { key: "HMT-8" }));

      await createJiraIssue({ ...input, type: "enhancement" });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.fields.issuetype).toEqual({ name: "Story" });
      expect(body.fields.labels).toEqual([
         "holdmetoit",
         "feedback",
         "frontend",
         "challenges",
         "enhancement",
      ]);
   });

   it("applies custom labels and an assignee", async () => {
      process.env.JIRA_LABELS = "support, needs triage";
      process.env.JIRA_ASSIGNEE_ACCOUNT_ID = "account-123";
      fetchMock.mockResolvedValue(jiraResponse(201, { key: "HMT-9" }));

      await createJiraIssue(input);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.fields.labels).toEqual([
         "support",
         "needs-triage",
         "frontend",
         "challenges",
         "bug",
      ]);
      expect(body.fields.assignee).toEqual({ accountId: "account-123" });
   });

   it("creates a remote link and formats summary with GitHub issue number when present", async () => {
      fetchMock
         .mockResolvedValueOnce(
            jiraResponse(201, { id: "10001", key: "HMT-10" })
         )
         .mockResolvedValueOnce(jiraResponse(201, { id: "remotelink_1" }));

      const result = await createJiraIssue({
         ...input,
         githubIssueNumber: 167,
         githubIssueUrl: "https://github.com/lrfsdevs/holdmetoit/issues/167",
      });

      expect(result).toEqual({
         status: "created",
         issueKey: "HMT-10",
         issueUrl: "https://example.atlassian.net/browse/HMT-10",
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [issueUrl, issueInit] = fetchMock.mock.calls[0];
      const issueBody = JSON.parse(issueInit.body);
      expect(issueBody.fields.summary).toBe(
         "[GH-#167] [FB-42] Submit button unresponsive"
      );

      const [linkUrl, linkInit] = fetchMock.mock.calls[1];
      expect(linkUrl).toBe(
         "https://example.atlassian.net/rest/api/3/issue/HMT-10/remotelink"
      );
      const linkBody = JSON.parse(linkInit.body);
      expect(linkBody.object).toEqual({
         url: "https://github.com/lrfsdevs/holdmetoit/issues/167",
         title: "GitHub Issue #167",
         icon: {
            url16x16: "https://github.githubassets.com/favicons/favicon.png",
            title: "GitHub",
         },
      });
   });

   it("logs warning and preserves created status when remote link returns non-2xx", async () => {
      fetchMock
         .mockResolvedValueOnce(
            jiraResponse(201, { id: "10001", key: "HMT-10" })
         )
         .mockResolvedValueOnce(
            jiraResponse(500, { errorMessages: ["Internal server error"] })
         );

      const result = await createJiraIssue({
         ...input,
         githubIssueNumber: 167,
         githubIssueUrl: "https://github.com/lrfsdevs/holdmetoit/issues/167",
      });

      expect(result).toEqual({
         status: "created",
         issueKey: "HMT-10",
         issueUrl: "https://example.atlassian.net/browse/HMT-10",
      });
   });

   it("logs warning and preserves created status when remote link network request fails", async () => {
      fetchMock
         .mockResolvedValueOnce(
            jiraResponse(201, { id: "10001", key: "HMT-10" })
         )
         .mockRejectedValueOnce(new Error("Remote link connection timed out"));

      const result = await createJiraIssue({
         ...input,
         githubIssueNumber: 167,
         githubIssueUrl: "https://github.com/lrfsdevs/holdmetoit/issues/167",
      });

      expect(result).toEqual({
         status: "created",
         issueKey: "HMT-10",
         issueUrl: "https://example.atlassian.net/browse/HMT-10",
      });
   });

   it("surfaces Jira field errors on a 400", async () => {
      fetchMock.mockResolvedValue(
         jiraResponse(400, {
            errorMessages: ["Bad request"],
            errors: { summary: "Summary is required" },
         })
      );

      const result = await createJiraIssue(input);
      expect(result.status).toBe("failed");
      if (result.status === "failed") {
         expect(result.error).toContain("Jira API error (400)");
         expect(result.error).toContain("Bad request");
         expect(result.error).toContain("summary: Summary is required");
      }
   });

   it("fails without throwing on auth errors", async () => {
      fetchMock.mockResolvedValue(
         jiraResponse(401, { errorMessages: ["Unauthorized"] })
      );

      const result = await createJiraIssue(input);
      expect(result.status).toBe("failed");
      if (result.status === "failed") {
         expect(result.error).toContain("(401)");
      }
   });

   it("fails without throwing on network errors", async () => {
      fetchMock.mockRejectedValue(new Error("network down"));

      const result = await createJiraIssue(input);
      expect(result.status).toBe("failed");
      if (result.status === "failed") {
         expect(result.error).toContain("network down");
      }
   });

   it("fails without throwing on an unexpected 201 shape", async () => {
      fetchMock.mockResolvedValue(jiraResponse(201, { id: "10001" }));

      const result = await createJiraIssue(input);
      expect(result.status).toBe("failed");
   });
});
