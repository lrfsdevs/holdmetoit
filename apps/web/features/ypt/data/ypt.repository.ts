import { prisma } from "@/core/db";
import { Prisma } from "@prisma/client";

export async function findUserByYptOrDiscordId(identifiers: {
   discordId?: string;
   yptId?: string;
}) {
   const { discordId, yptId } = identifiers;

   if (yptId) {
      const userByYpt = await prisma.user.findUnique({
         where: { yptId },
      });
      if (userByYpt) return userByYpt;
   }

   if (discordId) {
      // First try unique discordId
      const userByDiscordId = await prisma.user.findUnique({
         where: { discordId },
      });
      if (userByDiscordId) return userByDiscordId;

      // Fallback: check if id itself matches
      const userById = await prisma.user.findUnique({
         where: { id: discordId },
      });
      if (userById) return userById;
   }

   return null;
}

export async function getUserYptId(userId: string): Promise<string | null> {
   const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { yptId: true },
   });
   return user?.yptId ?? null;
}

export async function findActiveParticipantForUserOnDate(
   userId: string,
   targetDate: Date
) {
   const startOfDay = new Date(
      Date.UTC(
         targetDate.getUTCFullYear(),
         targetDate.getUTCMonth(),
         targetDate.getUTCDate(),
         0,
         0,
         0
      )
   );
   const endOfDay = new Date(
      Date.UTC(
         targetDate.getUTCFullYear(),
         targetDate.getUTCMonth(),
         targetDate.getUTCDate(),
         23,
         59,
         59,
         999
      )
   );

   // Find participants in active, non-locked challenges where targetDate is within [startAt, endAt]
   const participants = await prisma.challengeParticipant.findMany({
      where: {
         userId,
         challenge: {
            isDeleted: false,
            resultsLockedAt: null,
            startAt: { lte: endOfDay },
            endAt: { gte: startOfDay },
         },
      },
      include: {
         challenge: true,
      },
      orderBy: {
         challenge: {
            startAt: "desc",
         },
      },
   });

   return participants[0] ?? null;
}

export async function findExistingLogByExternalId(
   participantId: string,
   externalActivityId: string
) {
   return prisma.dailyStudyLog.findFirst({
      where: {
         participantId,
         externalActivityId,
      },
   });
}
