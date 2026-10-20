import { prisma } from "@/core/db";
import {
   DiscordDeliveryStatus,
   FeedbackAttachmentKind,
   FeedbackType,
   GitHubDeliveryStatus,
   JiraDeliveryStatus,
} from "@prisma/client";
import type {
   CreateFeedbackInput,
   VerifiedFeedbackAttachment,
} from "@/features/feedback/domain/feedback.types";

export interface CreateFeedbackParams extends CreateFeedbackInput {
   userId?: string | null;
   attachments?: VerifiedFeedbackAttachment[];
}

export async function createFeedbackRecord(params: CreateFeedbackParams) {
   const prismaType =
      params.type === "bug" ? FeedbackType.BUG : FeedbackType.ENHANCEMENT;

   return prisma.feedback.create({
      data: {
         type: prismaType,
         title: params.title,
         description: params.description,
         url: params.url,
         logrocketSessionId: params.logrocketSessionId ?? null,
         userId: params.userId ?? null,
         attachments: {
            create: (params.attachments ?? []).map((attachment, index) => ({
               url: attachment.url,
               path: attachment.path,
               kind:
                  attachment.kind === "image"
                     ? FeedbackAttachmentKind.IMAGE
                     : FeedbackAttachmentKind.VIDEO,
               mimeType: attachment.mimeType,
               sizeBytes: attachment.sizeBytes,
               sortOrder: index,
            })),
         },
      },
      include: {
         user: {
            select: {
               id: true,
               username: true,
               displayName: true,
               discordId: true,
            },
         },
         attachments: {
            orderBy: { sortOrder: "asc" },
         },
      },
   });
}

export async function updateFeedbackDiscordStatus(
   id: string,
   update: {
      status: DiscordDeliveryStatus;
      discordMessageId?: string | null;
      discordChannelId?: string | null;
   }
) {
   return prisma.feedback.update({
      where: { id },
      data: {
         discordStatus: update.status,
         discordMessageId: update.discordMessageId,
         discordChannelId: update.discordChannelId,
      },
   });
}

export async function updateFeedbackGitHubStatus(
   id: string,
   update: {
      status: GitHubDeliveryStatus;
      issueNumber?: number | null;
      issueUrl?: string | null;
      syncedAt?: Date | null;
   }
) {
   return prisma.feedback.update({
      where: { id },
      data: {
         githubStatus: update.status,
         githubIssueNumber: update.issueNumber,
         githubIssueUrl: update.issueUrl,
         githubSyncedAt: update.syncedAt,
      },
   });
}

export async function updateFeedbackJiraStatus(
   id: string,
   update: {
      status: JiraDeliveryStatus;
      issueKey?: string | null;
      issueUrl?: string | null;
      syncedAt?: Date | null;
   }
) {
   return prisma.feedback.update({
      where: { id },
      data: {
         jiraStatus: update.status,
         jiraIssueKey: update.issueKey,
         jiraIssueUrl: update.issueUrl,
         jiraSyncedAt: update.syncedAt,
      },
   });
}

export async function getFeedbackById(id: string) {
   return prisma.feedback.findUnique({
      where: { id },
      include: {
         user: {
            select: {
               id: true,
               username: true,
               displayName: true,
               discordId: true,
            },
         },
         attachments: {
            orderBy: { sortOrder: "asc" },
         },
      },
   });
}
