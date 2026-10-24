import { describe, expect, it } from "vitest";
import {
   JIRA_DESCRIPTION_TEXT_MAX,
   JIRA_FEEDBACK_MARKER_PREFIX,
   JIRA_SUMMARY_MAX,
   buildJiraDescriptionAdf,
   buildJiraIssueFields,
   formatJiraSummary,
   inferFeedbackTags,
   normalizeJiraLabels,
   type AdfNode,
} from "./jira-issue";

const baseInput = {
   feedbackNumber: 42,
   type: "bug" as const,
   title: "Submit button unresponsive",
   description: "Clicking submit on mobile does nothing.",
   url: "/challenge/demo",
   createdAt: new Date("2026-10-19T12:00:00.000Z"),
};

function walk(node: AdfNode, visit: (node: AdfNode) => void): void {
   visit(node);
   for (const child of (node.content as AdfNode[] | undefined) ?? []) {
      walk(child, visit);
   }
}

function allText(node: AdfNode): string {
   let text = "";
   walk(node, (current) => {
      if (current.type === "text" && typeof current.text === "string") {
         text += current.text;
      }
   });
   return text;
}

function findNodes(node: AdfNode, type: string): AdfNode[] {
   const matches: AdfNode[] = [];
   walk(node, (current) => {
      if (current.type === type) matches.push(current);
   });
   return matches;
}

function linkHref(node: AdfNode): string | undefined {
   const marks = node.marks as
      { type: string; attrs?: { href?: string } }[] | undefined;
   return marks?.find((mark) => mark.type === "link")?.attrs?.href;
}

function linkNodes(node: AdfNode): AdfNode[] {
   const links: AdfNode[] = [];
   walk(node, (current) => {
      if (linkHref(current) !== undefined) {
         links.push(current);
      }
   });
   return links;
}

describe("formatJiraSummary", () => {
   it("prefixes the feedback code", () => {
      expect(formatJiraSummary(baseInput)).toBe(
         "[FB-42] Submit button unresponsive"
      );
   });

   it("prefixes both GitHub issue number and feedback code when available", () => {
      expect(
         formatJiraSummary({
            ...baseInput,
            githubIssueNumber: 167,
         })
      ).toBe("[GH-#167] [FB-42] Submit button unresponsive");
   });

   it("truncates long summaries with GitHub issue number intact", () => {
      const summary = formatJiraSummary({
         ...baseInput,
         githubIssueNumber: 167,
         title: "a".repeat(400),
      });

      expect(summary.length).toBe(JIRA_SUMMARY_MAX);
      expect(summary.startsWith("[GH-#167] [FB-42] ")).toBe(true);
      expect(summary.endsWith("…")).toBe(true);
   });

   it("truncates long summaries to 255 characters", () => {
      const summary = formatJiraSummary({
         ...baseInput,
         title: "a".repeat(400),
      });

      expect(summary.length).toBe(JIRA_SUMMARY_MAX);
      expect(summary.startsWith("[FB-42] ")).toBe(true);
      expect(summary.endsWith("…")).toBe(true);
   });

   it("keeps an exactly sized title intact", () => {
      const available = JIRA_SUMMARY_MAX - "[FB-42] ".length;
      const summary = formatJiraSummary({
         ...baseInput,
         title: "a".repeat(available),
      });

      expect(summary.length).toBe(JIRA_SUMMARY_MAX);
      expect(summary.endsWith("…")).toBe(false);
   });

   it("strips NUL characters", () => {
      expect(formatJiraSummary({ ...baseInput, title: "bad\u0000title" })).toBe(
         "[FB-42] badtitle"
      );
   });
});

describe("buildJiraDescriptionAdf", () => {
   it("builds a valid ADF document with metadata and marker", () => {
      const doc = buildJiraDescriptionAdf({
         ...baseInput,
         reporter: {
            username: "afnan",
            displayName: "Afnan",
            discordId: "123456789",
         },
      });

      expect(doc.type).toBe("doc");
      expect(doc.version).toBe(1);
      expect(allText(doc)).toContain(`${JIRA_FEEDBACK_MARKER_PREFIX}:FB-42`);
      expect(allText(doc)).toContain("Type: Bug report");
      expect(allText(doc)).toContain("Page: /challenge/demo");
      expect(allText(doc)).toContain("Reported by: <@123456789>");
      expect(allText(doc)).toContain("Clicking submit on mobile does nothing.");
      expect(allText(doc)).toContain(
         "Submitted via HoldMeToIt feedback (FB-42) on 2026-10-19T12:00:00.000Z."
      );
      expect(findNodes(doc, "heading")).toHaveLength(1);
   });

   it("prepends GitHub issue link and horizontal rule when provided", () => {
      const doc = buildJiraDescriptionAdf({
         ...baseInput,
         githubIssueUrl: "https://github.com/lrfsdevs/holdmetoit/issues/167",
      });

      expect(doc.content[0]).toEqual({
         type: "paragraph",
         content: [
            { type: "text", text: "Original GitHub Issue: " },
            {
               type: "text",
               text: "https://github.com/lrfsdevs/holdmetoit/issues/167",
               marks: [
                  {
                     type: "link",
                     attrs: {
                        href: "https://github.com/lrfsdevs/holdmetoit/issues/167",
                     },
                  },
               ],
            },
         ],
      });
      expect(doc.content[1]).toEqual({ type: "rule" });
      expect(allText(doc)).toContain(`${JIRA_FEEDBACK_MARKER_PREFIX}:FB-42`);
   });

   it("labels enhancement suggestions", () => {
      const doc = buildJiraDescriptionAdf({
         ...baseInput,
         type: "enhancement",
      });

      expect(allText(doc)).toContain("Type: Enhancement suggestion");
   });

   it("falls back through the reporter identity chain", () => {
      expect(
         allText(buildJiraDescriptionAdf({ ...baseInput, reporter: null }))
      ).toContain("Reported by: Guest / Anonymous");

      expect(
         allText(
            buildJiraDescriptionAdf({
               ...baseInput,
               reporter: { displayName: "Afnan" },
            })
         )
      ).toContain("Reported by: Afnan");

      expect(
         allText(
            buildJiraDescriptionAdf({
               ...baseInput,
               reporter: { username: "afnan" },
            })
         )
      ).toContain("Reported by: afnan");
   });

   it("adds a LogRocket link mark only when a session exists", () => {
      const withSession = buildJiraDescriptionAdf({
         ...baseInput,
         logrocketSessionId: "https://app.logrocket.com/r/demo123",
      });
      const links = linkNodes(withSession);
      expect(
         links.some(
            (node) =>
               node.text === "View session replay" &&
               linkHref(node) === "https://app.logrocket.com/r/demo123"
         )
      ).toBe(true);

      expect(linkNodes(buildJiraDescriptionAdf(baseInput))).toHaveLength(0);
   });

   it("splits the description into paragraphs and skips blank lines", () => {
      const doc = buildJiraDescriptionAdf({
         ...baseInput,
         description: "First line\n\nSecond line",
      });

      expect(allText(doc)).toContain("First line");
      expect(allText(doc)).toContain("Second line");
   });

   it("renders attachments as a bullet list of links", () => {
      const doc = buildJiraDescriptionAdf({
         ...baseInput,
         attachments: [
            { url: "https://cdn.example.com/one.png", kind: "image" },
            { url: "https://cdn.example.com/clip.mp4", kind: "video" },
         ],
      });

      expect(findNodes(doc, "bulletList")).toHaveLength(1);
      expect(findNodes(doc, "listItem")).toHaveLength(2);

      const links = linkNodes(doc);
      expect(links.map((node) => node.text)).toEqual(["Image 1", "Video 2"]);
      expect(links.map((node) => linkHref(node))).toEqual([
         "https://cdn.example.com/one.png",
         "https://cdn.example.com/clip.mp4",
      ]);
   });

   it("omits the attachments heading when there are none", () => {
      const doc = buildJiraDescriptionAdf(baseInput);
      expect(allText(doc)).not.toContain("Attachments");
      expect(findNodes(doc, "bulletList")).toHaveLength(0);
   });

   it("truncates oversized description text", () => {
      const doc = buildJiraDescriptionAdf({
         ...baseInput,
         description: "x".repeat(JIRA_DESCRIPTION_TEXT_MAX + 5000),
      });

      const textNodes = findNodes(doc, "text");
      const longest = Math.max(
         ...textNodes.map((node) => String(node.text).length)
      );
      expect(longest).toBeLessThanOrEqual(JIRA_DESCRIPTION_TEXT_MAX);
   });
});

describe("inferFeedbackTags", () => {
   it("infers admin and module for admin paths", () => {
      expect(
         inferFeedbackTags("/admin/challenges/new", "broken save", "button")
      ).toEqual(["admin", "challenges"]);
   });

   it("infers frontend, dashboard and contextual keywords", () => {
      expect(
         inferFeedbackTags("/", "add todo modal closes", "cannot add task")
      ).toEqual(["frontend", "dashboard", "study-logs"]);

      expect(
         inferFeedbackTags("/", "jira ticket format", "github link")
      ).toEqual(["frontend", "dashboard", "jira-sync"]);
   });
});

describe("normalizeJiraLabels", () => {
   it("sanitizes, de-duplicates and appends the type label", () => {
      expect(
         normalizeJiraLabels(
            [" holdmetoit ", "needs triage", "needs triage", ""],
            "bug"
         )
      ).toEqual(["holdmetoit", "needs-triage", "bug"]);

      expect(normalizeJiraLabels([], "enhancement")).toEqual(["enhancement"]);
   });
});

describe("buildJiraIssueFields", () => {
   it("maps bugs to Task and suggestions to Story with inferred tags", () => {
      const bug = buildJiraIssueFields(baseInput, {
         projectKey: "HMT",
         baseLabels: ["holdmetoit", "feedback"],
      });

      expect(bug.project).toEqual({ key: "HMT" });
      expect(bug.issuetype).toEqual({ name: "Task" });
      expect(bug.labels).toEqual([
         "holdmetoit",
         "feedback",
         "frontend",
         "challenges",
         "bug",
      ]);
      expect(bug.assignee).toBeUndefined();

      const suggestion = buildJiraIssueFields(
         { ...baseInput, type: "enhancement" },
         { projectKey: "HMT", baseLabels: ["holdmetoit", "feedback"] }
      );
      expect(suggestion.issuetype).toEqual({ name: "Story" });
      expect(suggestion.labels).toEqual([
         "holdmetoit",
         "feedback",
         "frontend",
         "challenges",
         "enhancement",
      ]);
   });

   it("includes an assignee only when configured", () => {
      expect(
         buildJiraIssueFields(baseInput, {
            projectKey: "HMT",
            baseLabels: [],
            assigneeAccountId: "  account-123  ",
         }).assignee
      ).toEqual({ accountId: "account-123" });

      expect(
         buildJiraIssueFields(baseInput, {
            projectKey: "HMT",
            baseLabels: [],
            assigneeAccountId: "   ",
         }).assignee
      ).toBeUndefined();
   });
});
