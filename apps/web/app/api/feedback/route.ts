import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/auth";
import {
   createFeedbackRecord,
   updateFeedbackDiscordStatus,
   updateFeedbackGitHubStatus,
   updateFeedbackJiraStatus,
} from "@/features/feedback/data/feedback.repository";
import {
   sendFeedbackToDiscord,
   type DiscordSendResult,
} from "@/features/feedback/data/discord-feedback.service";
import {
   createGitHubIssue,
   type GitHubIssueResult,
} from "@/features/feedback/data/github-issue.service";
import {
   createJiraIssue,
   type JiraIssueResult,
} from "@/features/feedback/data/jira-issue.service";
import { GitHubDeliveryStatus, JiraDeliveryStatus } from "@prisma/client";
import { verifyFeedbackAttachment } from "@/features/feedback/data/feedback-attachment.storage";
import { formatFeedbackCode } from "@/features/feedback/domain/feedback-code";
import { createFeedbackSchema } from "@/features/feedback/domain/feedback.schema";
import type { VerifiedFeedbackAttachment } from "@/features/feedback/domain/feedback.types";
import { parseFeedbackAttachmentPath } from "@/features/feedback/domain/feedback-attachment";
import {
   deleteStorageObject,
   getFeedbackAttachmentsUrlConfig,
} from "@/core/storage/supabase-storage";
import { createLogger, logEvents } from "@/core/observability/logger";
import { checkRateLimit } from "@/core/security/rate-limiter";
import { getClientIp } from "@/core/security/client-ip";

const logger = createLogger("feedback");

/**
 * Configure max duration for serverless deployment environments to cover
 * worst-case sequential GitHub, Jira, and remote-link dispatch attempts.
 */
export const maxDuration = 30;

/** Persists feedback and attempts fail-soft Discord delivery. */
export async function POST(req: NextRequest) {
   try {
      const clientIp = getClientIp(req.headers);

      const rateLimit = checkRateLimit(`feedback:${clientIp}`, {
         maxAttempts: 5,
         windowMs: 5 * 60 * 1000,
      });

      if (!rateLimit.allowed) {
         const retryAfter = Math.ceil(rateLimit.resetMs / 1000);
         return NextResponse.json(
            {
               success: false,
               error: "Too many feedback submissions. Please wait a few minutes before trying again.",
            },
            {
               status: 429,
               headers: {
                  "Retry-After": String(retryAfter),
               },
            }
         );
      }

      const json = await req.json();
      const parsed = createFeedbackSchema.safeParse(json);

      if (!parsed.success) {
         const errorMessage =
            parsed.error.issues[0]?.message ?? "Invalid feedback submission";
         return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 400 }
         );
      }

      if (
         parsed.data.type === "enhancement" &&
         parsed.data.attachments.length > 0
      ) {
         return NextResponse.json(
            {
               success: false,
               error: "Attachments are only available for bug reports.",
            },
            { status: 400 }
         );
      }

      const attachmentPaths = parsed.data.attachments;
      if (new Set(attachmentPaths).size !== attachmentPaths.length) {
         return NextResponse.json(
            {
               success: false,
               error: "Duplicate attachments are not allowed.",
            },
            { status: 400 }
         );
      }

      const attachments: VerifiedFeedbackAttachment[] = [];
      for (const path of attachmentPaths) {
         const verified = await verifyFeedbackAttachment(path);
         if (!verified) {
            try {
               const { folder } = getFeedbackAttachmentsUrlConfig();
               if (parseFeedbackAttachmentPath(path, folder)) {
                  await deleteStorageObject(path);
               }
            } catch {
               // Cleanup is best-effort.
            }
            return NextResponse.json(
               {
                  success: false,
                  error: "One or more attachments are invalid or expired. Please re-upload them.",
               },
               { status: 400 }
            );
         }
         attachments.push(verified);
      }

      const session = await auth();
      const userId = session?.user?.id ?? null;

      // Persist to PostgreSQL first (Source of Truth)
      const feedback = await createFeedbackRecord({
         type: parsed.data.type,
         title: parsed.data.title,
         description: parsed.data.description,
         url: parsed.data.url,
         logrocketSessionId: parsed.data.logrocketSessionId ?? null,
         userId,
         attachments,
      });

      const code = formatFeedbackCode(feedback.feedbackNumber);

      // Build reporter identity for Discord notification
      const reporter = session?.user
         ? {
              username: session.user.name ?? null,
              displayName:
                 session.user.displayName ?? session.user.name ?? null,
              discordId: session.user.discordId ?? null,
           }
         : null;

      const dispatchPayload = {
         feedbackNumber: feedback.feedbackNumber,
         type: parsed.data.type,
         title: feedback.title,
         description: feedback.description,
         url: feedback.url,
         logrocketSessionId: feedback.logrocketSessionId,
         reporter,
         createdAt: feedback.createdAt,
         attachments: attachments.map((attachment) => ({
            url: attachment.url,
            kind: attachment.kind,
         })),
      };

      // Dispatch side effects: Discord in parallel, GitHub first so Jira can reference it
      const discordPromise = sendFeedbackToDiscord(dispatchPayload).catch(
         (error) =>
            ({
               success: false,
               error:
                  error instanceof Error
                     ? error.message
                     : "Discord dispatch rejected.",
            }) as DiscordSendResult
      );

      let githubResult: GitHubIssueResult;
      try {
         githubResult = await createGitHubIssue(dispatchPayload);
      } catch (error) {
         githubResult = {
            status: "failed",
            error:
               error instanceof Error
                  ? error.message
                  : "GitHub dispatch rejected.",
         };
      }

      let jiraResult: JiraIssueResult;
      try {
         const jiraPayload = {
            ...dispatchPayload,
            githubIssueNumber:
               githubResult.status === "created"
                  ? githubResult.issueNumber
                  : undefined,
            githubIssueUrl:
               githubResult.status === "created"
                  ? githubResult.issueUrl
                  : undefined,
         };
         jiraResult = await createJiraIssue(jiraPayload);
      } catch (error) {
         jiraResult = {
            status: "failed",
            error:
               error instanceof Error
                  ? error.message
                  : "Jira dispatch rejected.",
         };
      }

      const discordResult = await discordPromise;
      if (discordResult.success && discordResult.messageId) {
         await updateFeedbackDiscordStatus(feedback.id, {
            status: "SENT",
            discordMessageId: discordResult.messageId,
            discordChannelId: discordResult.channelId,
         });
      } else {
         await updateFeedbackDiscordStatus(feedback.id, {
            status: "FAILED",
            discordChannelId: discordResult.channelId ?? null,
         });
         logger.warn(logEvents.feedbackDiscordDispatchFailed, {
            context: {
               code,
               feedbackId: feedback.id,
               discordError: discordResult.error,
            },
         });
      }

      try {
         if (githubResult.status === "created") {
            await updateFeedbackGitHubStatus(feedback.id, {
               status: GitHubDeliveryStatus.CREATED,
               issueNumber: githubResult.issueNumber,
               issueUrl: githubResult.issueUrl,
               syncedAt: new Date(),
            });
         } else {
            await updateFeedbackGitHubStatus(feedback.id, {
               status:
                  githubResult.status === "skipped"
                     ? GitHubDeliveryStatus.SKIPPED
                     : GitHubDeliveryStatus.FAILED,
               syncedAt: new Date(),
            });
         }
      } catch (error) {
         logger.warn(logEvents.feedbackGitHubDispatchFailed, {
            context: { code, feedbackId: feedback.id },
            error,
         });
      }

      try {
         if (jiraResult.status === "created") {
            await updateFeedbackJiraStatus(feedback.id, {
               status: JiraDeliveryStatus.CREATED,
               issueKey: jiraResult.issueKey,
               issueUrl: jiraResult.issueUrl,
               syncedAt: new Date(),
            });
         } else {
            await updateFeedbackJiraStatus(feedback.id, {
               status:
                  jiraResult.status === "skipped"
                     ? JiraDeliveryStatus.SKIPPED
                     : JiraDeliveryStatus.FAILED,
               syncedAt: new Date(),
            });
         }
      } catch (error) {
         logger.warn(logEvents.feedbackJiraDispatchFailed, {
            context: { code, feedbackId: feedback.id },
            error,
         });
      }

      const githubDelivered = githubResult.status === "created";
      const githubIssueUrl =
         githubResult.status === "created" ? githubResult.issueUrl : null;
      const githubIssueNumber =
         githubResult.status === "created" ? githubResult.issueNumber : null;
      const jiraDelivered = jiraResult.status === "created";
      const jiraIssueKey =
         jiraResult.status === "created" ? jiraResult.issueKey : null;
      const jiraIssueUrl =
         jiraResult.status === "created" ? jiraResult.issueUrl : null;

      logger.info(logEvents.feedbackSubmitted, {
         context: {
            code,
            feedbackId: feedback.id,
            type: parsed.data.type,
            userId,
            attachmentCount: attachments.length,
            discordDelivered: discordResult.success,
            githubDelivered,
            githubStatus: githubResult.status,
            githubIssueNumber,
            jiraDelivered,
            jiraStatus: jiraResult.status,
            jiraIssueKey,
         },
      });

      return NextResponse.json(
         {
            success: true,
            data: {
               id: feedback.id,
               feedbackNumber: feedback.feedbackNumber,
               code,
               type: parsed.data.type,
               status: feedback.status,
               discordDelivered: discordResult.success,
               githubDelivered,
               githubIssueUrl,
               jiraDelivered,
               jiraIssueKey,
               jiraIssueUrl,
            },
         },
         { status: 201 }
      );
   } catch (error) {
      const message =
         error instanceof Error ? error.message : "Internal server error";
      logger.error(logEvents.feedbackSubmitted, { error });
      return NextResponse.json(
         { success: false, error: message },
         { status: 500 }
      );
   }
}
