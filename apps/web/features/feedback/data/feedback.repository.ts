import { prisma } from "@/core/db";
import { DiscordDeliveryStatus, FeedbackType } from "@prisma/client";
import type { CreateFeedbackInput } from "@/features/feedback/domain/feedback.types";

export interface CreateFeedbackParams extends CreateFeedbackInput {
   userId?: string | null;
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
      },
   });
}
