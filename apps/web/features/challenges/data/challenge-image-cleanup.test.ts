import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as storage from "@/core/storage/supabase-storage";
import * as imageRepo from "./punishment-pfp.repository";
import { cleanupUnreferencedChallengeImages } from "./challenge-image-cleanup";

vi.mock("@/core/storage/supabase-storage", () => ({
   isManagedChallengeImageUrl: vi.fn(),
   deleteManagedChallengeImage: vi.fn(),
}));

vi.mock("./punishment-pfp.repository", () => ({
   isChallengeImageReferenced: vi.fn(),
}));

const BASE = "https://abc.supabase.co/storage/v1/object/public/holdmetoit";
const BANNER = `${BASE}/event-banners/a.png`;
const PFP = `${BASE}/punishment-pfps/a.png`;

beforeEach(() => {
   vi.resetAllMocks();
   vi.mocked(storage.isManagedChallengeImageUrl).mockImplementation(
      (url) => url === BANNER || url === PFP
   );
   vi.mocked(imageRepo.isChallengeImageReferenced).mockResolvedValue(false);
});

afterEach(() => {
   vi.restoreAllMocks();
});

describe("cleanupUnreferencedChallengeImages", () => {
   it("checks references before deleting unreferenced images from both folders", async () => {
      await expect(
         cleanupUnreferencedChallengeImages([BANNER, PFP])
      ).resolves.toBeUndefined();
      expect(
         vi.mocked(imageRepo.isChallengeImageReferenced).mock.calls
      ).toEqual([[BANNER], [PFP]]);
      expect(vi.mocked(storage.deleteManagedChallengeImage).mock.calls).toEqual(
         [[BANNER], [PFP]]
      );
      for (let index = 0; index < 2; index++) {
         expect(
            vi.mocked(imageRepo.isChallengeImageReferenced).mock
               .invocationCallOrder[index]
         ).toBeLessThan(
            vi.mocked(storage.deleteManagedChallengeImage).mock
               .invocationCallOrder[index]
         );
      }
   });

   it("deduplicates before the managed guard, reference check and deletion", async () => {
      await cleanupUnreferencedChallengeImages([
         BANNER,
         BANNER,
         PFP,
         PFP,
         BANNER,
      ]);
      expect(vi.mocked(storage.isManagedChallengeImageUrl).mock.calls).toEqual([
         [BANNER],
         [PFP],
      ]);
      expect(
         vi.mocked(imageRepo.isChallengeImageReferenced).mock.calls
      ).toEqual([[BANNER], [PFP]]);
      expect(vi.mocked(storage.deleteManagedChallengeImage).mock.calls).toEqual(
         [[BANNER], [PFP]]
      );
   });

   it("ignores empty, null, undefined, legacy and unmanaged URLs", async () => {
      await expect(
         cleanupUnreferencedChallengeImages([
            null,
            undefined,
            "",
            "/prototype/assets/pfp.jpg",
            "https://example.com/banner.png",
         ])
      ).resolves.toBeUndefined();
      expect(vi.mocked(storage.isManagedChallengeImageUrl).mock.calls).toEqual([
         ["/prototype/assets/pfp.jpg"],
         ["https://example.com/banner.png"],
      ]);
      expect(imageRepo.isChallengeImageReferenced).not.toHaveBeenCalled();
      expect(storage.deleteManagedChallengeImage).not.toHaveBeenCalled();
   });

   it("does nothing for an empty candidate array", async () => {
      await expect(
         cleanupUnreferencedChallengeImages([])
      ).resolves.toBeUndefined();
      expect(storage.isManagedChallengeImageUrl).not.toHaveBeenCalled();
      expect(imageRepo.isChallengeImageReferenced).not.toHaveBeenCalled();
      expect(storage.deleteManagedChallengeImage).not.toHaveBeenCalled();
   });

   it.each([BANNER, PFP])(
      "retains shared references in either image column (%s)",
      async (shared) => {
         vi.mocked(imageRepo.isChallengeImageReferenced).mockImplementation(
            async (url) => url === shared
         );
         await cleanupUnreferencedChallengeImages([BANNER, PFP]);
         expect(
            vi.mocked(imageRepo.isChallengeImageReferenced).mock.calls
         ).toEqual([[BANNER], [PFP]]);
         expect(
            storage.deleteManagedChallengeImage
         ).toHaveBeenCalledExactlyOnceWith(shared === BANNER ? PFP : BANNER);
      }
   );

   it("retains the file on a failed reference query, logs and continues cleanup", async () => {
      const error = new Error("database unavailable");
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(imageRepo.isChallengeImageReferenced)
         .mockRejectedValueOnce(error)
         .mockResolvedValueOnce(false);
      await expect(
         cleanupUnreferencedChallengeImages([BANNER, BANNER, PFP])
      ).resolves.toBeUndefined();
      expect(
         vi.mocked(imageRepo.isChallengeImageReferenced).mock.calls
      ).toEqual([[BANNER], [PFP]]);
      expect(
         storage.deleteManagedChallengeImage
      ).toHaveBeenCalledExactlyOnceWith(PFP);
      expect(log).toHaveBeenCalledTimes(1);
      expect(String(log.mock.calls[0]?.[0])).toContain(
         "storage.cleanup_skipped"
      );
      expect(String(log.mock.calls[0]?.[0])).toContain(error.message);
   });

   it("remains best effort when every reference query fails", async () => {
      const error = new Error("database unavailable");
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(imageRepo.isChallengeImageReferenced).mockRejectedValue(error);
      await expect(
         cleanupUnreferencedChallengeImages([BANNER, PFP])
      ).resolves.toBeUndefined();
      expect(imageRepo.isChallengeImageReferenced).toHaveBeenCalledTimes(2);
      expect(storage.deleteManagedChallengeImage).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledTimes(2);
   });

   it("logs a deletion failure and continues with the next candidate", async () => {
      const error = new Error("storage unavailable");
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(storage.deleteManagedChallengeImage)
         .mockRejectedValueOnce(error)
         .mockResolvedValueOnce(undefined);
      await expect(
         cleanupUnreferencedChallengeImages([BANNER, PFP])
      ).resolves.toBeUndefined();
      expect(vi.mocked(storage.deleteManagedChallengeImage).mock.calls).toEqual(
         [[BANNER], [PFP]]
      );
      expect(log).toHaveBeenCalledTimes(1);
      expect(String(log.mock.calls[0]?.[0])).toContain(
         "storage.cleanup_skipped"
      );
      expect(String(log.mock.calls[0]?.[0])).toContain(error.message);
   });
});
