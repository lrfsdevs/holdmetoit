import { describe, expect, it } from "vitest";

import {
   PUNISHMENT_PFP_MAX_BYTES,
   buildChallengeImageObjectPath,
   extractManagedObjectPath,
   isChallengeImagePurpose,
   toDownloadUrl,
   validatePunishmentPfpFile,
} from "./punishment-pfp";

const config = {
   supabaseUrl: "https://abc.supabase.co",
   bucket: "holdmetoit",
   folder: "event-banners",
};
const base =
   "https://abc.supabase.co/storage/v1/object/public/holdmetoit/event-banners";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP = Uint8Array.from([
   0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
]);
const GIF = Uint8Array.from([
   0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0,
]);

describe("validatePunishmentPfpFile", () => {
   it("accepts PNG, JPEG and WebP", () => {
      expect(
         validatePunishmentPfpFile({
            type: "image/png",
            size: 100,
            headerBytes: PNG,
         })
      ).toEqual({ ok: true, ext: "png", contentType: "image/png" });
      expect(
         validatePunishmentPfpFile({
            type: "image/jpeg",
            size: 100,
            headerBytes: JPG,
         })
      ).toEqual({ ok: true, ext: "jpg", contentType: "image/jpeg" });
      expect(
         validatePunishmentPfpFile({
            type: "image/webp",
            size: 100,
            headerBytes: WEBP,
         })
      ).toEqual({ ok: true, ext: "webp", contentType: "image/webp" });
   });

   it("accepts exactly 3 MB and rejects 3 MB + 1 byte", () => {
      expect(
         validatePunishmentPfpFile({
            type: "image/png",
            size: PUNISHMENT_PFP_MAX_BYTES,
            headerBytes: PNG,
         }).ok
      ).toBe(true);
      expect(
         validatePunishmentPfpFile({
            type: "image/png",
            size: PUNISHMENT_PFP_MAX_BYTES + 1,
            headerBytes: PNG,
         }).ok
      ).toBe(false);
   });

   it("rejects empty files", () => {
      expect(
         validatePunishmentPfpFile({
            type: "image/png",
            size: 0,
            headerBytes: PNG,
         }).ok
      ).toBe(false);
   });

   it("rejects GIF by MIME type and by magic bytes", () => {
      expect(
         validatePunishmentPfpFile({
            type: "image/gif",
            size: 100,
            headerBytes: GIF,
         }).ok
      ).toBe(false);
      expect(
         validatePunishmentPfpFile({
            type: "image/png",
            size: 100,
            headerBytes: GIF,
         }).ok
      ).toBe(false);
   });

   it("rejects a declared type that does not match the contents", () => {
      expect(
         validatePunishmentPfpFile({
            type: "image/jpeg",
            size: 100,
            headerBytes: PNG,
         }).ok
      ).toBe(false);
   });
});

describe("buildChallengeImageObjectPath", () => {
   it("builds folder/id.ext and normalises slashes", () => {
      expect(buildChallengeImageObjectPath("event-banners", "abc", "png")).toBe(
         "event-banners/abc.png"
      );
      expect(
         buildChallengeImageObjectPath("/event-banners/", "abc", "webp")
      ).toBe("event-banners/abc.webp");
   });
});

describe("extractManagedObjectPath", () => {
   it("returns the object path for managed URLs", () => {
      expect(extractManagedObjectPath(`${base}/1a2b-3c.png`, config)).toBe(
         "event-banners/1a2b-3c.png"
      );
   });

   it("returns null for legacy, external, look-alike and traversal URLs", () => {
      expect(
         extractManagedObjectPath(
            "/prototype/assets/punishment_pfp.jpg",
            config
         )
      ).toBeNull();
      expect(
         extractManagedObjectPath("https://example.com/pfp.png", config)
      ).toBeNull();
      expect(
         extractManagedObjectPath(
            "https://abc.supabase.co.evil.com/storage/v1/object/public/holdmetoit/event-banners/a.png",
            config
         )
      ).toBeNull();
      expect(
         extractManagedObjectPath(`${base}/../secret.png`, config)
      ).toBeNull();
      expect(
         extractManagedObjectPath(`${base}/nested/a.png`, config)
      ).toBeNull();
      expect(extractManagedObjectPath(`${base}/a.png?x=1`, config)).toBeNull();
      expect(extractManagedObjectPath(`${base}/a.gif`, config)).toBeNull();
      expect(extractManagedObjectPath(null, config)).toBeNull();
   });
});

describe("image purposes and folder guards", () => {
   it("accepts only the two defined purposes", () => {
      expect(isChallengeImagePurpose("event-banner")).toBe(true);
      expect(isChallengeImagePurpose("punishment-pfp")).toBe(true);
      expect(isChallengeImagePurpose("event-banners")).toBe(false);
      expect(isChallengeImagePurpose("../other-folder")).toBe(false);
      expect(isChallengeImagePurpose(null)).toBe(false);
   });

   it("does not accept a banner as a new punishment PFP", () => {
      const pfpConfig = { ...config, folder: "punishment-pfps" };
      expect(extractManagedObjectPath(`${base}/a.png`, pfpConfig)).toBeNull();
      const pfpUrl =
         base.replace("event-banners", "punishment-pfps") + "/a.png";
      expect(extractManagedObjectPath(pfpUrl, pfpConfig)).toBe(
         "punishment-pfps/a.png"
      );
      expect(extractManagedObjectPath(pfpUrl, config)).toBeNull();
   });
});

describe("toDownloadUrl", () => {
   it("appends ?download= for Supabase public URLs", () => {
      expect(toDownloadUrl(`${base}/a.png`, "pfp.png")).toBe(
         `${base}/a.png?download=pfp.png`
      );
   });

   it("leaves local and external URLs unchanged", () => {
      expect(
         toDownloadUrl("/prototype/assets/punishment_pfp.jpg", "pfp.jpg")
      ).toBe("/prototype/assets/punishment_pfp.jpg");
      expect(toDownloadUrl("https://example.com/pfp.png", "pfp.png")).toBe(
         "https://example.com/pfp.png"
      );
   });
});
