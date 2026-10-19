import { describe, expect, it } from "vitest";
import {
   FEEDBACK_ISSUE_MARKER_PREFIX,
   GITHUB_ISSUE_BODY_MAX,
   GITHUB_ISSUE_TITLE_MAX,
   buildGitHubIssueBody,
   buildGitHubIssuePayload,
   formatGitHubIssueTitle,
   normalizeGitHubList,
   selectGitHubLabels,
} from "./github-issue";

const baseInput = {
   feedbackNumber: 42,
   type: "bug" as const,
   title: "Submit button unresponsive",
   description: "Clicking submit on mobile does nothing.",
   url: "/challenge/demo",
   createdAt: new Date("2026-10-19T12:00:00.000Z"),
};

const options = {
   bugLabels: ["bug", "needs-triage"],
   enhancementLabels: ["enhancement"],
   assignees: ["afnan"],
};

describe("formatGitHubIssueTitle", () => {
   it("prefixes the feedback code", () => {
      expect(formatGitHubIssueTitle(baseInput)).toBe(
         "[FB-42] Submit button unresponsive"
      );
   });

   it("truncates long titles to the GitHub limit", () => {
      const longTitle = "a".repeat(400);
      const title = formatGitHubIssueTitle({ ...baseInput, title: longTitle });

      expect(title.length).toBe(GITHUB_ISSUE_TITLE_MAX);
      expect(title.startsWith("[FB-42] ")).toBe(true);
      expect(title.endsWith("…")).toBe(true);
   });

   it("keeps an exactly-sized title intact", () => {
      const available = GITHUB_ISSUE_TITLE_MAX - "[FB-42] ".length;
      const title = formatGitHubIssueTitle({
         ...baseInput,
         title: "a".repeat(available),
      });

      expect(title.length).toBe(GITHUB_ISSUE_TITLE_MAX);
      expect(title.endsWith("…")).toBe(false);
   });

   it("strips NUL characters", () => {
      expect(
         formatGitHubIssueTitle({ ...baseInput, title: "bad\u0000title" })
      ).toBe("[FB-42] badtitle");
   });
});

describe("buildGitHubIssueBody", () => {
   it("includes the marker, metadata, description and footer", () => {
      const body = buildGitHubIssueBody({
         ...baseInput,
         logrocketSessionId: "https://app.logrocket.com/r/demo123",
         reporter: {
            username: "afnan",
            displayName: "Afnan",
            discordId: "123456789",
         },
      });

      expect(body).toContain(`<!-- ${FEEDBACK_ISSUE_MARKER_PREFIX}:FB-42 -->`);
      expect(body).toContain("**Type:** Bug report");
      expect(body).toContain("**Page:** /challenge/demo");
      expect(body).toContain("**Reported by:** <@123456789>");
      expect(body).toContain(
         "**LogRocket:** [View session replay](https://app.logrocket.com/r/demo123)"
      );
      expect(body).toContain("### Description");
      expect(body).toContain("Clicking submit on mobile does nothing.");
      expect(body).toContain(
         "_Submitted via HoldMeToIt feedback (`FB-42`) on 2026-10-19T12:00:00.000Z._"
      );
   });

   it("falls back through the reporter identity chain", () => {
      expect(buildGitHubIssueBody({ ...baseInput, reporter: null })).toContain(
         "**Reported by:** Guest / Anonymous"
      );

      expect(
         buildGitHubIssueBody({
            ...baseInput,
            reporter: { displayName: "Afnan" },
         })
      ).toContain("**Reported by:** Afnan");

      expect(
         buildGitHubIssueBody({
            ...baseInput,
            reporter: { username: "afnan" },
         })
      ).toContain("**Reported by:** afnan");
   });

   it("labels the type for suggestions", () => {
      expect(
         buildGitHubIssueBody({ ...baseInput, type: "enhancement" })
      ).toContain("**Type:** Enhancement suggestion");
   });

   it("renders images inline and videos as links", () => {
      const body = buildGitHubIssueBody({
         ...baseInput,
         attachments: [
            { url: "https://cdn.example.com/one.png", kind: "image" },
            { url: "https://cdn.example.com/clip.mp4", kind: "video" },
         ],
      });

      expect(body).toContain("### Attachments");
      expect(body).toContain("![Image 1](https://cdn.example.com/one.png)");
      expect(body).toContain("[Video 2](https://cdn.example.com/clip.mp4)");
      expect(body).not.toContain("![Image 2]");
   });

   it("omits the attachments section when there are none", () => {
      expect(buildGitHubIssueBody(baseInput)).not.toContain("### Attachments");
   });

   it("truncates oversized bodies while preserving the marker", () => {
      const body = buildGitHubIssueBody({
         ...baseInput,
         description: "x".repeat(GITHUB_ISSUE_BODY_MAX + 1000),
      });

      expect(body.length).toBeLessThanOrEqual(GITHUB_ISSUE_BODY_MAX);
      expect(body.startsWith(`<!-- ${FEEDBACK_ISSUE_MARKER_PREFIX}`)).toBe(
         true
      );
      expect(body.endsWith("… _(truncated)_")).toBe(true);
   });
});

describe("labels and assignees", () => {
   it("selects labels by feedback type", () => {
      expect(selectGitHubLabels("bug", options)).toEqual([
         "bug",
         "needs-triage",
      ]);
      expect(selectGitHubLabels("enhancement", options)).toEqual([
         "enhancement",
      ]);
   });

   it("normalizes, trims and de-duplicates lists", () => {
      expect(
         normalizeGitHubList([" bug ", "bug", "", "  ", "enhancement"])
      ).toEqual(["bug", "enhancement"]);
      expect(normalizeGitHubList(undefined)).toEqual([]);
   });

   it("includes assignees only when configured", () => {
      expect(buildGitHubIssuePayload(baseInput, options).assignees).toEqual([
         "afnan",
      ]);
      expect(
         buildGitHubIssuePayload(baseInput, {
            ...options,
            assignees: [],
         }).assignees
      ).toBeUndefined();
   });
});
