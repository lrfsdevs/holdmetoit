import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/core/db";
import {
   findChallengeImageUrls,
   isChallengeImageReferenced,
} from "./punishment-pfp.repository";

vi.mock("@/core/db", () => ({
   prisma: {
      challenge: {
         findUnique: vi.fn(),
         count: vi.fn(),
      },
   },
}));

beforeEach(() => {
   vi.resetAllMocks();
});

describe("findChallengeImageUrls", () => {
   it("selects and returns both distinct image URLs", async () => {
      const images = {
         eventBannerUrl: "https://example.com/banner.webp",
         punishmentPfpUrl: "https://example.com/pfp.png",
      };
      vi.mocked(prisma.challenge.findUnique).mockResolvedValue(images as never);

      await expect(findChallengeImageUrls("challenge-1")).resolves.toEqual(
         images
      );
      expect(prisma.challenge.findUnique).toHaveBeenCalledWith({
         where: { id: "challenge-1" },
         select: { eventBannerUrl: true, punishmentPfpUrl: true },
      });
   });

   it.each([
      { eventBannerUrl: null, punishmentPfpUrl: null },
      { eventBannerUrl: null, punishmentPfpUrl: "https://example.com/pfp.png" },
      {
         eventBannerUrl: "https://example.com/banner.webp",
         punishmentPfpUrl: null,
      },
   ])(
      "preserves nullable fields for an existing challenge (%j)",
      async (images) => {
         vi.mocked(prisma.challenge.findUnique).mockResolvedValue(
            images as never
         );
         await expect(findChallengeImageUrls("challenge-1")).resolves.toEqual(
            images
         );
      }
   );

   it("returns null for a missing challenge", async () => {
      vi.mocked(prisma.challenge.findUnique).mockResolvedValue(null);
      await expect(findChallengeImageUrls("missing")).resolves.toBeNull();
   });
});

describe("isChallengeImageReferenced", () => {
   it.each([0, 1, 2])(
      "checks either image column across all challenges (count %s)",
      async (count) => {
         const url = "https://example.com/shared.png";
         vi.mocked(prisma.challenge.count).mockResolvedValue(count);

         await expect(isChallengeImageReferenced(url)).resolves.toBe(count > 0);
         expect(prisma.challenge.count).toHaveBeenCalledWith({
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
      }
   );

   it.each([
      { savedUrl: "https://example.com/shared.png", referenced: true },
      {
         savedUrl: "https://example.com/shared.png?download=avatar.png",
         referenced: true,
      },
      { savedUrl: "https://example.com/shared.png#preview", referenced: true },
      {
         savedUrl: "https://example.com/shared.png?download=avatar.png#preview",
         referenced: true,
      },
      { savedUrl: "https://example.com/shared.png.backup", referenced: false },
      {
         savedUrl: "https://example.com/shared.png-other.png",
         referenced: false,
      },
      {
         savedUrl: "https://example.com/shared.png/other.png",
         referenced: false,
      },
      { savedUrl: "https://example.com/shared.png2", referenced: false },
   ])(
      "bounds query/fragment matches to the same file (%j)",
      async ({ savedUrl, referenced }) => {
         vi.mocked(prisma.challenge.count).mockResolvedValue(0);
         await isChallengeImageReferenced("https://example.com/shared.png");

         const query = vi.mocked(prisma.challenge.count).mock.calls[0][0];
         const filters = query?.where?.OR as unknown as Array<
            Record<string, string | { startsWith: string }>
         >;
         for (const column of ["eventBannerUrl", "punishmentPfpUrl"]) {
            const matches = filters.some((filter) => {
               const condition = filter[column];
               return typeof condition === "string"
                  ? savedUrl === condition
                  : condition !== undefined &&
                       savedUrl.startsWith(condition.startsWith);
            });
            expect(matches).toBe(referenced);
         }
      }
   );

   it("propagates lookup failures instead of treating images as unreferenced", async () => {
      vi.mocked(prisma.challenge.count).mockRejectedValue(
         new Error("Database unavailable")
      );
      await expect(
         isChallengeImageReferenced("https://example.com/shared.png")
      ).rejects.toThrow("Database unavailable");
   });
});
