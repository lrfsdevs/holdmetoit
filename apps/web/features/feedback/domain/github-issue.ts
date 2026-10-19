import { formatFeedbackCode } from "@/features/feedback/domain/feedback-code";
import type { FeedbackType } from "@/features/feedback/domain/feedback.types";

export const GITHUB_ISSUE_TITLE_MAX = 256;
export const GITHUB_ISSUE_BODY_MAX = 65_536;
export const FEEDBACK_ISSUE_MARKER_PREFIX = "holdmetoit-feedback";

export interface GitHubAttachmentRef {
   url: string;
   kind: "image" | "video";
}

export interface GitHubIssueInput {
   feedbackNumber: number;
   type: FeedbackType;
   title: string;
   description: string;
   url: string;
   logrocketSessionId?: string | null;
   reporter?: {
      username?: string | null;
      displayName?: string | null;
      discordId?: string | null;
   } | null;
   attachments?: GitHubAttachmentRef[];
   createdAt?: Date;
}

export interface GitHubIssueOptions {
   bugLabels: string[];
   enhancementLabels: string[];
   assignees?: string[];
}

export interface GitHubIssuePayload {
   title: string;
   body: string;
   labels: string[];
   assignees?: string[];
}

function clean(value: string): string {
   return value.replace(/\u0000/g, "").trim();
}

function formatReporter(reporter: GitHubIssueInput["reporter"]): string {
   if (!reporter) return "Guest / Anonymous";
   if (reporter.discordId) return `<@${reporter.discordId}>`;
   if (reporter.displayName) return reporter.displayName;
   if (reporter.username) return reporter.username;
   return "Guest / Anonymous";
}

function formatAttachments(attachments: GitHubAttachmentRef[]): string {
   return attachments
      .map((attachment, index) =>
         attachment.kind === "image"
            ? `![Image ${index + 1}](${attachment.url})`
            : `[Video ${index + 1}](${attachment.url})`
      )
      .join("\n");
}

function truncateBody(body: string): string {
   if (body.length <= GITHUB_ISSUE_BODY_MAX) return body;
   const suffix = "\n\n… _(truncated)_";
   return `${body
      .slice(0, GITHUB_ISSUE_BODY_MAX - suffix.length)
      .trimEnd()}${suffix}`;
}

export function formatGitHubIssueTitle(
   input: Pick<GitHubIssueInput, "feedbackNumber" | "title">
): string {
   const prefix = `[${formatFeedbackCode(input.feedbackNumber)}] `;
   const available = GITHUB_ISSUE_TITLE_MAX - prefix.length;
   const title = clean(input.title);

   if (title.length <= available) {
      return `${prefix}${title}`;
   }

   const ellipsis = "…";
   const sliceLength = Math.max(0, available - ellipsis.length);
   return `${prefix}${title.slice(0, sliceLength).trimEnd()}${ellipsis}`;
}

export function buildGitHubIssueBody(input: GitHubIssueInput): string {
   const code = formatFeedbackCode(input.feedbackNumber);
   const attachments = input.attachments ?? [];

   const lines = [
      `<!-- ${FEEDBACK_ISSUE_MARKER_PREFIX}:${code} -->`,
      "",
      `**Type:** ${
         input.type === "bug" ? "Bug report" : "Enhancement suggestion"
      }`,
      `**Page:** ${clean(input.url) || "/"}`,
      `**Reported by:** ${formatReporter(input.reporter)}`,
   ];

   if (input.logrocketSessionId) {
      lines.push(
         `**LogRocket:** [View session replay](${input.logrocketSessionId})`
      );
   }

   lines.push(
      "",
      "### Description",
      "",
      clean(input.description) || "_No description provided._"
   );

   if (attachments.length > 0) {
      lines.push("", "### Attachments", "", formatAttachments(attachments));
   }

   lines.push(
      "",
      "---",
      "",
      `_Submitted via HoldMeToIt feedback (\`${code}\`) on ${(
         input.createdAt ?? new Date()
      ).toISOString()}._`
   );

   return truncateBody(lines.join("\n"));
}

export function normalizeGitHubList(values: string[] | undefined): string[] {
   return Array.from(
      new Set((values ?? []).map((value) => value.trim()).filter(Boolean))
   );
}

export function selectGitHubLabels(
   type: FeedbackType,
   options: GitHubIssueOptions
): string[] {
   return normalizeGitHubList(
      type === "bug" ? options.bugLabels : options.enhancementLabels
   );
}

export function buildGitHubIssuePayload(
   input: GitHubIssueInput,
   options: GitHubIssueOptions
): GitHubIssuePayload {
   const labels = selectGitHubLabels(input.type, options);
   const assignees = normalizeGitHubList(options.assignees);

   return {
      title: formatGitHubIssueTitle(input),
      body: buildGitHubIssueBody(input),
      labels,
      ...(assignees.length > 0 ? { assignees } : {}),
   };
}
