import type { Prisma } from "@prisma/client";

import { prisma } from "@/core/db";
import { calculateChallengeStatus } from "@/features/challenges/domain/challenge-lifecycle";

export type ChallengeWithTeams = Prisma.ChallengeGetPayload<{
   include: { teams: true };
}>;

export async function findChallengeWithTeamsById(
   challengeId: string
): Promise<ChallengeWithTeams | null> {
   return prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
         teams: {
            orderBy: { sortOrder: "asc" },
         },
      },
   });
}

export async function findLatestAvailableChallenge(
   now = new Date()
): Promise<ChallengeWithTeams | null> {
   // First check for UPCOMING challenges that participants can enroll in
   const upcoming = await prisma.challenge.findFirst({
      where: { startAt: { gt: now } },
      include: {
         teams: {
            orderBy: { sortOrder: "asc" },
         },
      },
      orderBy: { startAt: "asc" },
   });

   if (upcoming) {
      return upcoming;
   }

   // Fall back to ACTIVE challenge if one is running
   return prisma.challenge.findFirst({
      where: {
         startAt: { lte: now },
         endAt: { gt: now },
      },
      include: {
         teams: {
            orderBy: { sortOrder: "asc" },
         },
      },
      orderBy: { startAt: "desc" },
   });
}

export async function listAllChallenges() {
   const challenges = await prisma.challenge.findMany({
      include: {
         host: {
            select: {
               id: true,
               displayName: true,
               username: true,
               image: true,
            },
         },
         teams: {
            orderBy: { sortOrder: "asc" },
         },
         _count: {
            select: {
               participants: true,
            },
         },
      },
      orderBy: { createdAt: "desc" },
   });

   return challenges.map((c) => ({
      ...c,
      status: calculateChallengeStatus(c),
   }));
}

export type ChallengeCatalogItem = Awaited<
   ReturnType<typeof listAllChallenges>
>[number];

export async function findLatestCompletedChallengeForWrapped(
   userId?: string,
   now = new Date()
): Promise<ChallengeWithTeams | null> {
   const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

   if (userId) {
      const userParticipation = await prisma.challengeParticipant.findFirst({
         where: {
            userId,
            challenge: {
               OR: [
                  { resultsLockedAt: { not: null, gte: threeDaysAgo } },
                  {
                     resultsLockedAt: null,
                     endAt: { lte: now, gte: threeDaysAgo },
                  },
               ],
            },
         },
         include: {
            challenge: {
               include: {
                  teams: {
                     orderBy: { sortOrder: "asc" },
                  },
               },
            },
         },
         orderBy: [
            { challenge: { resultsLockedAt: "desc" } },
            { challenge: { endAt: "desc" } },
         ],
      });

      if (userParticipation?.challenge) {
         return userParticipation.challenge;
      }
   }

   return prisma.challenge.findFirst({
      where: {
         OR: [
            { resultsLockedAt: { not: null, gte: threeDaysAgo } },
            {
               resultsLockedAt: null,
               endAt: { lte: now, gte: threeDaysAgo },
            },
         ],
      },
      include: {
         teams: {
            orderBy: { sortOrder: "asc" },
         },
      },
      orderBy: [{ resultsLockedAt: "desc" }, { endAt: "desc" }],
   });
}
