import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as requireAdminModule from "@/features/auth/api/require-admin";
import * as storage from "@/core/storage/supabase-storage";
import * as pfpRepo from "@/features/challenges/data/punishment-pfp.repository";
import {
   discardChallengeImageUploadAction,
   uploadChallengeImageAction,
} from "@/features/challenges/api/punishment-pfp.actions";
import type { ChallengeImagePurpose } from "@/features/challenges/domain/punishment-pfp";

vi.mock("@/features/auth/api/require-admin", () => ({
   AdminAccessError: class AdminAccessError extends Error {
      readonly code = "FORBIDDEN_NOT_ADMIN";
   },
   requireAdminUser: vi.fn(),
}));

vi.mock("@/core/storage/supabase-storage", () => ({
   uploadChallengeImage: vi.fn(),
   deleteManagedChallengeImage: vi.fn(),
   isManagedChallengeImageUrl: vi.fn(),
}));

vi.mock("@/features/challenges/data/punishment-pfp.repository", () => ({
   isChallengeImageReferenced: vi.fn(),
}));

const BASE = "https://abc.supabase.co/storage/v1/object/public/holdmetoit";
const BANNER = `${BASE}/event-banners/a.png`;
const PFP = `${BASE}/punishment-pfps/a.png`;
const PURPOSES: ChallengeImagePurpose[] = ["event-banner", "punishment-pfp"];
const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];

function formWith(
   bytes: number[],
   type: string,
   purpose: ChallengeImagePurpose,
   size = 64
) {
   const data = new Uint8Array(size);
   data.set(bytes);
   const form = new FormData();
   form.set("file", new File([data], "image", { type }));
   form.set("purpose", purpose);
   return form;
}

beforeEach(() => {
   vi.resetAllMocks();
   vi.mocked(requireAdminModule.requireAdminUser).mockResolvedValue({
      id: "admin_1",
      username: "HostAdmin",
   } as never);
   vi.mocked(storage.isManagedChallengeImageUrl).mockReturnValue(true);
   vi.mocked(pfpRepo.isChallengeImageReferenced).mockResolvedValue(false);
});

afterEach(() => {
   vi.restoreAllMocks();
});

describe.each(PURPOSES)("uploadChallengeImageAction (%s)", (purpose) => {
   it.each([
      { bytes: PNG, type: "image/png", ext: "png" },
      { bytes: JPEG, type: "image/jpeg", ext: "jpg" },
      { bytes: WEBP, type: "image/webp", ext: "webp" },
   ])(
      "uploads a valid $type to the selected purpose",
      async ({ bytes, type, ext }) => {
         const url = purpose === "event-banner" ? BANNER : PFP;
         vi.mocked(storage.uploadChallengeImage).mockResolvedValue({
            url,
            path: "image",
         });
         const form = formWith(bytes, type, purpose);
         await expect(uploadChallengeImageAction(form)).resolves.toEqual({
            ok: true,
            data: { url },
         });
         expect(storage.uploadChallengeImage).toHaveBeenCalledExactlyOnceWith(
            {
               bytes: await (form.get("file") as File).arrayBuffer(),
               contentType: type,
               ext,
            },
            purpose
         );
      }
   );

   it.each([
      { label: "GIF", bytes: GIF, type: "image/gif", size: 64 },
      {
         label: "oversize",
         bytes: PNG,
         type: "image/png",
         size: 3 * 1024 * 1024 + 1,
      },
      { label: "empty", bytes: [], type: "image/png", size: 0 },
      { label: "mismatched MIME", bytes: JPEG, type: "image/png", size: 64 },
      {
         label: "invalid magic bytes",
         bytes: [0, 0, 0, 0],
         type: "image/png",
         size: 64,
      },
   ])("rejects $label files before upload", async ({ bytes, type, size }) => {
      await expect(
         uploadChallengeImageAction(formWith(bytes, type, purpose, size))
      ).resolves.toMatchObject({ ok: false, code: "INVALID_INPUT" });
      expect(storage.uploadChallengeImage).not.toHaveBeenCalled();
   });

   it.each([null, "not a file"])(
      "rejects missing/non-file input (%s)",
      async (file) => {
         const form = new FormData();
         form.set("purpose", purpose);
         if (file !== null) form.set("file", file);
         await expect(uploadChallengeImageAction(form)).resolves.toMatchObject({
            ok: false,
            code: "INVALID_INPUT",
         });
         expect(storage.uploadChallengeImage).not.toHaveBeenCalled();
      }
   );

   it("rejects non-admin callers", async () => {
      vi.mocked(requireAdminModule.requireAdminUser).mockRejectedValue(
         new requireAdminModule.AdminAccessError()
      );
      await expect(
         uploadChallengeImageAction(formWith(PNG, "image/png", purpose))
      ).resolves.toMatchObject({ ok: false, code: "FORBIDDEN_NOT_ADMIN" });
      expect(storage.uploadChallengeImage).not.toHaveBeenCalled();
   });

   it("returns UPLOAD_FAILED and logs storage failures", async () => {
      const error = new Error("storage unavailable");
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(storage.uploadChallengeImage).mockRejectedValue(error);
      await expect(
         uploadChallengeImageAction(formWith(PNG, "image/png", purpose))
      ).resolves.toMatchObject({ ok: false, code: "UPLOAD_FAILED" });
      expect(log).toHaveBeenCalledTimes(1);
      expect(String(log.mock.calls[0]?.[0])).toContain("storage.upload_failed");
      expect(String(log.mock.calls[0]?.[0])).toContain(error.message);
   });
});

describe("uploadChallengeImageAction purpose validation", () => {
   it.each([null, "", "banner", "EVENT_BANNER", "punishment-pfps"])(
      "rejects invalid/missing purpose (%s)",
      async (purpose) => {
         const form = formWith(PNG, "image/png", "event-banner");
         if (purpose === null) form.delete("purpose");
         else form.set("purpose", purpose);
         await expect(uploadChallengeImageAction(form)).resolves.toMatchObject({
            ok: false,
            code: "INVALID_INPUT",
         });
         expect(storage.uploadChallengeImage).not.toHaveBeenCalled();
      }
   );

   it("rejects a file supplied as the purpose", async () => {
      const form = formWith(PNG, "image/png", "event-banner");
      form.set("purpose", new File(["event-banner"], "purpose.txt"));
      await expect(uploadChallengeImageAction(form)).resolves.toMatchObject({
         ok: false,
         code: "INVALID_INPUT",
      });
      expect(storage.uploadChallengeImage).not.toHaveBeenCalled();
   });
});

describe("discardChallengeImageUploadAction", () => {
   it.each([BANNER, PFP])(
      "deletes an unreferenced managed upload (%s)",
      async (url) => {
         await expect(discardChallengeImageUploadAction(url)).resolves.toEqual({
            ok: true,
         });
         expect(storage.isManagedChallengeImageUrl).toHaveBeenCalledWith(url);
         expect(
            pfpRepo.isChallengeImageReferenced
         ).toHaveBeenCalledExactlyOnceWith(url);
         expect(
            storage.deleteManagedChallengeImage
         ).toHaveBeenCalledExactlyOnceWith(url);
         expect(
            vi.mocked(pfpRepo.isChallengeImageReferenced).mock
               .invocationCallOrder[0]
         ).toBeLessThan(
            vi.mocked(storage.deleteManagedChallengeImage).mock
               .invocationCallOrder[0]
         );
      }
   );

   it.each([BANNER, PFP])(
      "retains an image referenced in either column (%s)",
      async (url) => {
         vi.mocked(pfpRepo.isChallengeImageReferenced).mockResolvedValue(true);
         await expect(discardChallengeImageUploadAction(url)).resolves.toEqual({
            ok: true,
         });
         expect(pfpRepo.isChallengeImageReferenced).toHaveBeenCalledWith(url);
         expect(storage.deleteManagedChallengeImage).not.toHaveBeenCalled();
      }
   );

   it.each(["https://example.com/x.png", "/prototype/assets/pfp.jpg", ""])(
      "ignores unmanaged URLs (%s)",
      async (url) => {
         vi.mocked(storage.isManagedChallengeImageUrl).mockReturnValue(false);
         await expect(discardChallengeImageUploadAction(url)).resolves.toEqual({
            ok: true,
         });
         expect(pfpRepo.isChallengeImageReferenced).not.toHaveBeenCalled();
         expect(storage.deleteManagedChallengeImage).not.toHaveBeenCalled();
      }
   );

   it("rejects non-admin callers before checking or deleting an image", async () => {
      vi.mocked(requireAdminModule.requireAdminUser).mockRejectedValue(
         new requireAdminModule.AdminAccessError()
      );
      await expect(
         discardChallengeImageUploadAction(BANNER)
      ).resolves.toMatchObject({ ok: false, code: "FORBIDDEN_NOT_ADMIN" });
      expect(storage.isManagedChallengeImageUrl).not.toHaveBeenCalled();
      expect(pfpRepo.isChallengeImageReferenced).not.toHaveBeenCalled();
      expect(storage.deleteManagedChallengeImage).not.toHaveBeenCalled();
   });

   it("retains the upload and returns DISCARD_FAILED if the reference query fails", async () => {
      vi.mocked(pfpRepo.isChallengeImageReferenced).mockRejectedValue(
         new Error("db down")
      );
      await expect(
         discardChallengeImageUploadAction(PFP)
      ).resolves.toMatchObject({ ok: false, code: "DISCARD_FAILED" });
      expect(storage.deleteManagedChallengeImage).not.toHaveBeenCalled();
   });

   it("returns DISCARD_FAILED if deletion throws", async () => {
      vi.mocked(storage.deleteManagedChallengeImage).mockRejectedValue(
         new Error("storage down")
      );
      await expect(
         discardChallengeImageUploadAction(BANNER)
      ).resolves.toMatchObject({ ok: false, code: "DISCARD_FAILED" });
   });
});
