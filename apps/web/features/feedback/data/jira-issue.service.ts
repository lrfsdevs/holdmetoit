import { createLogger, logEvents } from "@/core/observability/logger";
import {
   buildJiraIssueFields,
   type JiraIssueFields,
   type JiraIssueInput,
} from "@/features/feedback/domain/jira-issue";

const logger = createLogger("feedback.jira");

const REQUEST_TIMEOUT_MS = 10_000;
const ERROR_TEXT_MAX = 500;
const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export interface JiraConfig {
   baseUrl: string;
   email: string;
   apiToken: string;
   projectKey: string;
   assigneeAccountId?: string;
   labels: string[];
}

export type JiraConfigResolution =
   { ok: true; config: JiraConfig } | { ok: false; reason: string };

export type JiraIssueResult =
   | { status: "created"; issueKey: string; issueUrl: string }
   | { status: "skipped"; reason: string }
   | { status: "failed"; error: string };

function parseLabels(value: string | undefined): string[] {
   const source = value?.trim() || "holdmetoit,feedback";
   return Array.from(
      new Set(
         source
            .split(",")
            .map((label) => label.trim().replace(/\s+/g, "-"))
            .filter(Boolean)
      )
   );
}

/** Resolves the Jira Cloud API-token configuration. Never throws. */
export function resolveJiraConfig(): JiraConfigResolution {
   const baseUrl = process.env.JIRA_BASE_URL?.trim();
   const email = process.env.JIRA_EMAIL?.trim();
   const apiToken = process.env.JIRA_API_TOKEN?.trim();
   const projectKey = process.env.JIRA_PROJECT_KEY?.trim();

   if (!baseUrl && !email && !apiToken && !projectKey) {
      return { ok: false, reason: "Jira issue sync is not configured." };
   }

   const missing = [
      ["JIRA_BASE_URL", baseUrl],
      ["JIRA_EMAIL", email],
      ["JIRA_API_TOKEN", apiToken],
      ["JIRA_PROJECT_KEY", projectKey],
   ].find(([, value]) => !value);

   if (missing) {
      return {
         ok: false,
         reason: `${missing[0]} is missing.`,
      };
   }

   let normalizedBaseUrl: string;
   try {
      const parsed = new URL(baseUrl!);
      if (parsed.protocol !== "https:") {
         return {
            ok: false,
            reason: "JIRA_BASE_URL must use https.",
         };
      }
      normalizedBaseUrl = parsed.origin;
   } catch {
      return {
         ok: false,
         reason: "JIRA_BASE_URL is not a valid URL.",
      };
   }

   if (!PROJECT_KEY_PATTERN.test(projectKey!)) {
      return {
         ok: false,
         reason:
            "JIRA_PROJECT_KEY must start with an uppercase letter and contain only uppercase letters, digits, or underscores.",
      };
   }

   const assigneeAccountId =
      process.env.JIRA_ASSIGNEE_ACCOUNT_ID?.trim() || undefined;

   return {
      ok: true,
      config: {
         baseUrl: normalizedBaseUrl,
         email: email!,
         apiToken: apiToken!,
         projectKey: projectKey!,
         assigneeAccountId,
         labels: parseLabels(process.env.JIRA_LABELS),
      },
   };
}

type PostOutcome =
   | { kind: "success"; issueKey: string }
   | { kind: "http-error"; status: number; text: string }
   | { kind: "network-error"; error: string };

async function readJiraError(response: Response): Promise<string> {
   try {
      const data = (await response.json()) as {
         errorMessages?: unknown;
         errors?: unknown;
      };
      const messages: string[] = [];

      if (Array.isArray(data.errorMessages)) {
         for (const message of data.errorMessages) {
            if (typeof message === "string" && message.trim()) {
               messages.push(message.trim());
            }
         }
      }

      if (data.errors && typeof data.errors === "object") {
         for (const [field, message] of Object.entries(
            data.errors as Record<string, unknown>
         )) {
            if (typeof message === "string" && message.trim()) {
               messages.push(`${field}: ${message.trim()}`);
            }
         }
      }

      return messages.length > 0 ? messages.join("; ") : "Unknown Jira error.";
   } catch {
      return "Unknown Jira error.";
   }
}

async function postIssue(
   config: JiraConfig,
   fields: JiraIssueFields
): Promise<PostOutcome> {
   try {
      const response = await fetch(`${config.baseUrl}/rest/api/3/issue`, {
         method: "POST",
         headers: {
            Authorization: `Basic ${Buffer.from(
               `${config.email}:${config.apiToken}`
            ).toString("base64")}`,
            Accept: "application/json",
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ fields }),
         signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.status === 201) {
         const data = (await response.json()) as { key?: unknown };
         if (typeof data.key === "string" && data.key.trim()) {
            return { kind: "success", issueKey: data.key.trim() };
         }
         return {
            kind: "http-error",
            status: response.status,
            text: "Unexpected Jira response shape.",
         };
      }

      const details = await readJiraError(response);
      return {
         kind: "http-error",
         status: response.status,
         text: `Jira API error (${response.status}): ${details}`.slice(
            0,
            ERROR_TEXT_MAX
         ),
      };
   } catch (error) {
      return {
         kind: "network-error",
         error: error instanceof Error ? error.message : String(error),
      };
   }
}

/**
 * Creates a Jira Cloud issue for a feedback submission. Fail-soft: config,
 * HTTP, and network problems return a result instead of throwing.
 */
export async function createJiraIssue(
   input: JiraIssueInput
): Promise<JiraIssueResult> {
   const resolution = resolveJiraConfig();
   if (!resolution.ok) {
      if (resolution.reason === "Jira issue sync is not configured.") {
         logger.debug(logEvents.feedbackJiraDispatchSkipped, {
            context: { reason: resolution.reason },
         });
      } else {
         logger.warn(logEvents.feedbackJiraDispatchSkipped, {
            context: { reason: resolution.reason },
         });
      }
      return { status: "skipped", reason: resolution.reason };
   }

   const { config } = resolution;
   const fields = buildJiraIssueFields(input, {
      projectKey: config.projectKey,
      baseLabels: config.labels,
      assigneeAccountId: config.assigneeAccountId,
   });

   const outcome = await postIssue(config, fields);

   if (outcome.kind === "success") {
      const issueUrl = `${config.baseUrl}/browse/${outcome.issueKey}`;
      logger.info(logEvents.feedbackJiraIssueCreated, {
         context: {
            baseUrl: config.baseUrl,
            projectKey: config.projectKey,
            issueKey: outcome.issueKey,
         },
      });
      return {
         status: "created",
         issueKey: outcome.issueKey,
         issueUrl,
      };
   }

   const error =
      outcome.kind === "http-error"
         ? outcome.text
         : `Jira request failed: ${outcome.error}`;

   logger.warn(logEvents.feedbackJiraDispatchFailed, {
      context: {
         baseUrl: config.baseUrl,
         projectKey: config.projectKey,
         error: error.slice(0, ERROR_TEXT_MAX),
      },
   });

   return { status: "failed", error };
}
