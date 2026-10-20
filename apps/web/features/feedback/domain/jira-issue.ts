import { formatFeedbackCode } from "@/features/feedback/domain/feedback-code";
import type { FeedbackType } from "@/features/feedback/domain/feedback.types";

export const JIRA_SUMMARY_MAX = 255;
export const JIRA_DESCRIPTION_TEXT_MAX = 30_000;
export const JIRA_FEEDBACK_MARKER_PREFIX = "holdmetoit-feedback";

export type AdfNode = Record<string, unknown>;

export interface AdfDoc extends AdfNode {
   type: "doc";
   version: 1;
   content: AdfNode[];
}

export interface JiraAttachmentRef {
   url: string;
   kind: "image" | "video";
}

export interface JiraIssueInput {
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
   attachments?: JiraAttachmentRef[];
   createdAt?: Date;
}

export interface JiraIssueOptions {
   projectKey: string;
   baseLabels: string[];
   assigneeAccountId?: string | null;
}

export interface JiraIssueFields {
   project: { key: string };
   issuetype: { name: "Task" | "Story" };
   summary: string;
   description: AdfDoc;
   labels: string[];
   assignee?: { accountId: string };
}

function clean(value: string): string {
   return value.replace(/\u0000/g, "").trim();
}

function truncateText(value: string, max: number): string {
   if (value.length <= max) return value;
   const suffix = "\n…";
   return `${value.slice(0, max - suffix.length).trimEnd()}${suffix}`;
}

function textNode(text: string): AdfNode {
   return { type: "text", text };
}

function linkText(text: string, href: string): AdfNode {
   return {
      type: "text",
      text,
      marks: [{ type: "link", attrs: { href } }],
   };
}

function paragraph(content: AdfNode[]): AdfNode {
   return { type: "paragraph", content };
}

function heading(level: number, text: string): AdfNode {
   return { type: "heading", attrs: { level }, content: [textNode(text)] };
}

function listItem(content: AdfNode[]): AdfNode {
   return { type: "listItem", content };
}

function bulletList(items: AdfNode[]): AdfNode {
   return { type: "bulletList", content: items };
}

function formatReporter(reporter: JiraIssueInput["reporter"]): string {
   if (!reporter) return "Guest / Anonymous";
   if (reporter.discordId) return `<@${reporter.discordId}>`;
   if (reporter.displayName) return reporter.displayName;
   if (reporter.username) return reporter.username;
   return "Guest / Anonymous";
}

export function formatJiraSummary(
   input: Pick<JiraIssueInput, "feedbackNumber" | "title">
): string {
   const prefix = `[${formatFeedbackCode(input.feedbackNumber)}] `;
   const available = JIRA_SUMMARY_MAX - prefix.length;
   const title = clean(input.title);

   if (title.length <= available) {
      return `${prefix}${title}`;
   }

   return `${prefix}${title.slice(0, Math.max(0, available - 1)).trimEnd()}…`;
}

/** Builds an Atlassian Document Format description for Jira Cloud v3. */
export function buildJiraDescriptionAdf(input: JiraIssueInput): AdfDoc {
   const code = formatFeedbackCode(input.feedbackNumber);
   const content: AdfNode[] = [
      paragraph([textNode(`${JIRA_FEEDBACK_MARKER_PREFIX}:${code}`)]),
      paragraph([
         textNode(
            `Type: ${
               input.type === "bug" ? "Bug report" : "Enhancement suggestion"
            }`
         ),
      ]),
      paragraph([textNode(`Page: ${clean(input.url) || "/"}`)]),
      paragraph([textNode(`Reported by: ${formatReporter(input.reporter)}`)]),
   ];

   if (input.logrocketSessionId) {
      content.push(
         paragraph([
            textNode("LogRocket: "),
            linkText("View session replay", input.logrocketSessionId),
         ])
      );
   }

   content.push(heading(3, "Description"));

   const description = truncateText(
      clean(input.description),
      JIRA_DESCRIPTION_TEXT_MAX
   );
   const lines = description
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

   if (lines.length === 0) {
      content.push(paragraph([textNode("No description provided.")]));
   } else {
      for (const line of lines) {
         content.push(paragraph([textNode(line)]));
      }
   }

   const attachments = input.attachments ?? [];
   if (attachments.length > 0) {
      content.push(heading(3, "Attachments"));
      content.push(
         bulletList(
            attachments.map((attachment, index) =>
               listItem([
                  paragraph([
                     linkText(
                        `${
                           attachment.kind === "image" ? "Image" : "Video"
                        } ${index + 1}`,
                        attachment.url
                     ),
                  ]),
               ])
            )
         )
      );
   }

   content.push(
      paragraph([
         textNode(
            `Submitted via HoldMeToIt feedback (${code}) on ${(
               input.createdAt ?? new Date()
            ).toISOString()}.`
         ),
      ])
   );

   return { type: "doc", version: 1, content };
}

export function normalizeJiraLabels(
   baseLabels: string[],
   type: FeedbackType
): string[] {
   const labels = baseLabels
      .map((label) => label.trim().replace(/\s+/g, "-"))
      .filter(Boolean);

   labels.push(type === "bug" ? "bug" : "enhancement");
   return Array.from(new Set(labels));
}

export function buildJiraIssueFields(
   input: JiraIssueInput,
   options: JiraIssueOptions
): JiraIssueFields {
   const assigneeAccountId = options.assigneeAccountId?.trim();

   return {
      project: { key: options.projectKey },
      issuetype: { name: input.type === "bug" ? "Task" : "Story" },
      summary: formatJiraSummary(input),
      description: buildJiraDescriptionAdf(input),
      labels: normalizeJiraLabels(options.baseLabels, input.type),
      ...(assigneeAccountId
         ? { assignee: { accountId: assigneeAccountId } }
         : {}),
   };
}
