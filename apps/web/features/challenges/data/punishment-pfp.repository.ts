import { prisma } from "@/core/db";

export async function findChallengeImageUrls(
   challengeId: string
): Promise<{
   eventBannerUrl: string | null;
   punishmentPfpUrl: string | null;
} | null> {
   return prisma.challenge.findUnique({
      where: { id: challengeId },
      select: { eventBannerUrl: true, punishmentPfpUrl: true },
   });
}

export async function isChallengeImageReferenced(
   url: string
): Promise<boolean> {
   const count = await prisma.challenge.count({
      where: {
         OR: [
            { eventBannerUrl: url },
            { eventBannerUrl: { startsWith: `${url}?` } },
            { eventBannerUrl: { startsWith: `${url}#` } },
            { punishmentPfpUrl: url },
            { punishmentPfpUrl: { startsWith: `${url}?` } },
            { punishmentPfpUrl: { startsWith: `${url}#` } },
         ],
      },
   });
   return count > 0;
}
