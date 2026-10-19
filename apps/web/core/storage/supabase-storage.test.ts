import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn();
const remove = vi.fn();
const getPublicUrl = vi.fn();
const createSignedUploadUrl = vi.fn();
const info = vi.fn();
const from = vi.fn(() => ({
   upload,
   remove,
   getPublicUrl,
   createSignedUploadUrl,
   info,
}));

vi.mock("@supabase/supabase-js", () => ({
   createClient: vi.fn(() => ({ storage: { from } })),
}));

import {
   createSignedStorageUpload,
   deleteManagedChallengeImage,
   deleteStorageObject,
   getFeedbackAttachmentsUrlConfig,
   getStorageConfig,
   getStorageObjectInfo,
   getStoragePublicUrl,
   getStorageUrlConfig,
   isManagedChallengeImageUrl,
   uploadChallengeImage,
} from "./supabase-storage";
import type { ChallengeImagePurpose } from "@/features/challenges/domain/punishment-pfp";

const base = "https://abc.supabase.co/storage/v1/object/public/holdmetoit";

beforeEach(() => {
   vi.clearAllMocks();
   vi.stubEnv("SUPABASE_URL", "https://abc.supabase.co");
   vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
   vi.stubEnv("SUPABASE_STORAGE_BUCKET", "holdmetoit");
   vi.stubEnv("SUPABASE_EVENT_BANNERS_FOLDER", "event-banners");
   vi.stubEnv("SUPABASE_PUNISHMENT_PFPS_FOLDER", "punishment-pfps");
   upload.mockResolvedValue({ error: null });
   remove.mockResolvedValue({ error: null });
   createSignedUploadUrl.mockResolvedValue({
      data: {
         path: "feedback-attachments/abc.mp4",
         token: "token-123",
         signedUrl: "https://abc.supabase.co/storage/v1/object/upload/sign/abc",
      },
      error: null,
   });
   info.mockResolvedValue({
      data: { size: 2048, contentType: "video/mp4" },
      error: null,
   });
   getPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `${base}/${path}` },
   }));
});

afterEach(() => {
   vi.unstubAllEnvs();
   vi.restoreAllMocks();
});

describe("getStorageConfig", () => {
   it("throws naming missing variables including the new PFP folder", () => {
      vi.stubEnv("SUPABASE_PUNISHMENT_PFPS_FOLDER", "");
      expect(() => getStorageConfig()).toThrow(
         /SUPABASE_PUNISHMENT_PFPS_FOLDER/
      );
      vi.stubEnv("SUPABASE_STORAGE_BUCKET", "");
      expect(() => getStorageConfig()).toThrow(/SUPABASE_STORAGE_BUCKET/);
   });

   it("rejects unsafe folders and identical destinations", () => {
      vi.stubEnv("SUPABASE_PUNISHMENT_PFPS_FOLDER", "../private");
      expect(() => getStorageConfig()).toThrow(/Invalid storage folder/);
      vi.stubEnv("SUPABASE_PUNISHMENT_PFPS_FOLDER", "event-banners");
      expect(() => getStorageConfig()).toThrow(/different storage folders/);
   });

   it("uses custom bucket and folder environment values without hardcoded destinations", () => {
      vi.stubEnv("SUPABASE_STORAGE_BUCKET", "custom-bucket");
      vi.stubEnv("SUPABASE_EVENT_BANNERS_FOLDER", "/headers/");
      vi.stubEnv("SUPABASE_PUNISHMENT_PFPS_FOLDER", "forfeits");
      expect(getStorageUrlConfig("event-banner")).toEqual({
         supabaseUrl: "https://abc.supabase.co",
         bucket: "custom-bucket",
         folder: "headers",
      });
      expect(getStorageUrlConfig("punishment-pfp").folder).toBe("forfeits");
   });
});

describe("uploadChallengeImage", () => {
   it.each([
      ["event-banner", "event-banners"],
      ["punishment-pfp", "punishment-pfps"],
   ] as const)(
      "uploads %s to its configured folder",
      async (purpose, folder) => {
         const bytes = new ArrayBuffer(8);
         const result = await uploadChallengeImage(
            { bytes, contentType: "image/png", ext: "png" },
            purpose
         );
         expect(from).toHaveBeenCalledWith("holdmetoit");
         expect(result.path).toMatch(
            new RegExp(`^${folder}/[0-9a-f-]{36}\\.png$`)
         );
         expect(result.url).toBe(`${base}/${result.path}`);
         expect(upload).toHaveBeenCalledWith(result.path, bytes, {
            contentType: "image/png",
            cacheControl: "31536000",
            upsert: false,
         });
      }
   );

   it("rejects an invalid purpose before writing", async () => {
      await expect(
         uploadChallengeImage(
            { bytes: new ArrayBuffer(8), contentType: "image/png", ext: "png" },
            "../other-folder" as ChallengeImagePurpose
         )
      ).rejects.toThrow(/Invalid challenge image purpose/);
      expect(upload).not.toHaveBeenCalled();
   });

   it("throws when Storage returns an error", async () => {
      upload.mockResolvedValue({ error: { message: "boom" } });
      await expect(
         uploadChallengeImage(
            { bytes: new ArrayBuffer(8), contentType: "image/png", ext: "png" },
            "event-banner"
         )
      ).rejects.toThrow(/boom/);
   });
});

describe("managed challenge images", () => {
   it.each(["event-banners", "punishment-pfps"])(
      "recognizes and removes files in %s",
      async (folder) => {
         const url = `${base}/${folder}/abc.png`;
         expect(isManagedChallengeImageUrl(url)).toBe(true);
         await deleteManagedChallengeImage(url);
         expect(remove).toHaveBeenCalledWith([`${folder}/abc.png`]);
      }
   );

   it("does not recognize or delete legacy, external or other-folder URLs", async () => {
      for (const url of [
         "/prototype/assets/punishment_pfp.jpg",
         "https://example.com/pfp.png",
         `${base}/other/a.png`,
         null,
      ]) {
         expect(isManagedChallengeImageUrl(url)).toBe(false);
         await deleteManagedChallengeImage(url);
      }
      expect(remove).not.toHaveBeenCalled();
   });

   it("swallows storage errors", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      remove.mockRejectedValue(new Error("network"));
      await expect(
         deleteManagedChallengeImage(`${base}/event-banners/abc.png`)
      ).resolves.toBeUndefined();
   });
});

describe("feedback attachment storage", () => {
   it("defaults the folder and allows an override", () => {
      expect(getFeedbackAttachmentsUrlConfig()).toEqual({
         supabaseUrl: "https://abc.supabase.co",
         bucket: "holdmetoit",
         folder: "feedback-attachments",
      });

      vi.stubEnv("SUPABASE_FEEDBACK_ATTACHMENTS_FOLDER", "/feedback-uploads/");
      expect(getFeedbackAttachmentsUrlConfig().folder).toBe("feedback-uploads");
   });

   it("rejects a folder collision", () => {
      vi.stubEnv("SUPABASE_FEEDBACK_ATTACHMENTS_FOLDER", "event-banners");
      expect(() => getStorageConfig()).toThrow(/different storage folder/);
   });

   it("creates a signed upload URL and returns its public URL", async () => {
      const result = await createSignedStorageUpload({
         folder: "feedback-attachments",
         ext: "mp4",
      });

      expect(createSignedUploadUrl).toHaveBeenCalledWith(
         expect.stringMatching(/^feedback-attachments\/[0-9a-f-]{36}\.mp4$/),
         { upsert: false }
      );
      expect(result).toEqual({
         path: "feedback-attachments/abc.mp4",
         token: "token-123",
         signedUrl: "https://abc.supabase.co/storage/v1/object/upload/sign/abc",
         publicUrl: `${base}/feedback-attachments/abc.mp4`,
      });
   });

   it("throws when signing fails", async () => {
      createSignedUploadUrl.mockResolvedValue({
         data: null,
         error: { message: "boom" },
      });
      await expect(
         createSignedStorageUpload({
            folder: "feedback-attachments",
            ext: "mp4",
         })
      ).rejects.toThrow(/boom/);
   });

   it("returns object info and public URLs", async () => {
      expect(
         await getStorageObjectInfo("feedback-attachments/abc.mp4")
      ).toEqual({ sizeBytes: 2048, contentType: "video/mp4" });
      expect(getStoragePublicUrl("feedback-attachments/abc.mp4")).toBe(
         `${base}/feedback-attachments/abc.mp4`
      );
   });

   it("returns null when the object is missing", async () => {
      info.mockResolvedValue({ data: null, error: { message: "not found" } });
      expect(
         await getStorageObjectInfo("feedback-attachments/missing.mp4")
      ).toBeNull();
   });

   it("deletes objects and swallows storage errors", async () => {
      await deleteStorageObject("feedback-attachments/abc.mp4");
      expect(remove).toHaveBeenCalledWith(["feedback-attachments/abc.mp4"]);

      vi.spyOn(console, "error").mockImplementation(() => {});
      remove.mockRejectedValue(new Error("network"));
      await expect(
         deleteStorageObject("feedback-attachments/abc.mp4")
      ).resolves.toBeUndefined();
   });
});
