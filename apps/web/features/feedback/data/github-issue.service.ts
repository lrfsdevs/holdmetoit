import { createLogger, logEvents } from "@/core/observability/logger";
import {
   buildGitHubIssuePayload,
   type GitHubIssueInput,
   type GitHubIssuePayload,
} from "@/features/feedback/domain/github-issue";

const logger = createLogger("feedback.github");

const DEFAULT_API_URL = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 10_000;
const ERROR_TEXT_MAX = 500;
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export interface GitHubConfig {
   token: string;
   repo: string;
   apiUrl: string;
   bugLabels: string[];
   enhancementLabels: string[];
   assignees: string[];
}

export type GitHubConfigResolution =
   { ok: true; config: GitHubConfig } | { ok: false; reason: string };

export type GitHubIssueResult =
   | { status: "created"; issueNumber: number; issueUrl: string }
   | { status: "skipped"; reason: string }
   | { status: "failed"; error: string };

function parseList(
   value: string | undefined,
   fallback: string[] = []
): string[] {
   if (!value) return fallback;
   const items = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
   return items.length > 0 ? Array.from(new Set(items)) : fallback;
}

/** Resolves the fine-grained PAT configuration. Never throws. */
export function resolveGitHubConfig(): GitHubConfigResolution {
   const token = process.env.GITHUB_TOKEN?.trim();
   const repo = process.env.GITHUB_REPO?.trim();

   if (!token && !repo) {
      return { ok: false, reason: "GitHub issue sync is not configured." };
   }
   if (!token) {
      return { ok: false, reason: "GITHUB_TOKEN is missing." };
   }
   if (!repo) {
      return { ok: false, reason: "GITHUB_REPO is missing." };
   }
   if (!REPO_PATTERN.test(repo)) {
      return {
         ok: false,
         reason: "GITHUB_REPO must use the owner/repo format.",
      };
   }

   return {
      ok: true,
      config: {
         token,
         repo,
         apiUrl: (
            process.env.GITHUB_API_URL?.trim() || DEFAULT_API_URL
         ).replace(/\/+$/, ""),
         bugLabels: parseList(process.env.GITHUB_ISSUE_LABELS_BUG, ["bug"]),
         enhancementLabels: parseList(
            process.env.GITHUB_ISSUE_LABELS_ENHANCEMENT,
            ["enhancement"]
         ),
         assignees: parseList(process.env.GITHUB_ISSUE_ASSIGNEES),
      },
   };
}

type PostOutcome =
   | { kind: "success"; issueNumber: number; issueUrl: string }
   | { kind: "http-error"; status: number; text: string }
   | { kind: "network-error"; error: string };

async function postIssue(
   config: GitHubConfig,
   payload: GitHubIssuePayload
): Promise<PostOutcome> {
   try {
      const response = await fetch(
         `${config.apiUrl}/repos/${config.repo}/issues`,
         {
            method: "POST",
            headers: {
               Authorization: `Bearer ${config.token}`,
               Accept: "application/vnd.github+json",
               "X-GitHub-Api-Version": "2022-11-28",
               "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
         }
      );

      if (response.status === 201) {
         const data = (await response.json()) as {
            number?: unknown;
            html_url?: unknown;
         };
         if (
            typeof data.number === "number" &&
            typeof data.html_url === "string"
         ) {
            return {
               kind: "success",
               issueNumber: data.number,
               issueUrl: data.html_url,
            };
         }
         return {
            kind: "http-error",
            status: response.status,
            text: "Unexpected GitHub response shape.",
         };
      }

      const text = await response.text().catch(() => "");
      return {
         kind: "http-error",
         status: response.status,
         text: `GitHub API error (${response.status}): ${text}`.slice(
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
 * Creates a GitHub issue for a feedback submission. Fail-soft: configuration,
 * HTTP, and network problems return a result instead of throwing.
 */
export async function createGitHubIssue(
   input: GitHubIssueInput
): Promise<GitHubIssueResult> {
   const resolution = resolveGitHubConfig();
   if (!resolution.ok) {
      if (resolution.reason === "GitHub issue sync is not configured.") {
         logger.debug(logEvents.feedbackGitHubDispatchSkipped, {
            context: { reason: resolution.reason },
         });
      } else {
         logger.warn(logEvents.feedbackGitHubDispatchSkipped, {
            context: { reason: resolution.reason },
         });
      }
      return { status: "skipped", reason: resolution.reason };
   }

   const { config } = resolution;
   const payload = buildGitHubIssuePayload(input, {
      bugLabels: config.bugLabels,
      enhancementLabels: config.enhancementLabels,
      assignees: config.assignees,
   });

   let outcome = await postIssue(config, payload);

   // A missing label makes GitHub return 422; retry once without labels.
   if (
      outcome.kind === "http-error" &&
      outcome.status === 422 &&
      payload.labels.length > 0
   ) {
      logger.warn(logEvents.feedbackGitHubLabelRetry, {
         context: { repo: config.repo, labels: payload.labels.join(",") },
      });
      outcome = await postIssue(config, {
         title: payload.title,
         body: payload.body,
         labels: [],
         ...(payload.assignees ? { assignees: payload.assignees } : {}),
      });
   }

   if (outcome.kind === "success") {
      logger.info(logEvents.feedbackGitHubIssueCreated, {
         context: {
            repo: config.repo,
            issueNumber: outcome.issueNumber,
            issueUrl: outcome.issueUrl,
         },
      });
      return {
         status: "created",
         issueNumber: outcome.issueNumber,
         issueUrl: outcome.issueUrl,
      };
   }

   const error =
      outcome.kind === "http-error"
         ? outcome.text
         : `GitHub request failed: ${outcome.error}`;

   logger.warn(logEvents.feedbackGitHubDispatchFailed, {
      context: { repo: config.repo, error: error.slice(0, ERROR_TEXT_MAX) },
   });

   return { status: "failed", error };
}
