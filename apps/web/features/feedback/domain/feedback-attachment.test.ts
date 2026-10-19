import { describe, expect, it } from "vitest";
import {
   FEEDBACK_IMAGE_MAX_BYTES,
   FEEDBACK_VIDEO_MAX_BYTES,
   buildFeedbackAttachmentObjectPath,
   extractFeedbackAttachmentObjectPath,
   parseFeedbackAttachmentPath,
   resolveFeedbackAttachmentKind,
   sniffFeedbackAttachmentExt,
   validateFeedbackAttachmentMeta,
} from "./feedback-attachment";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const webp = new Uint8Array([
   0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00]);
const mp4 = new Uint8Array([
   0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
]);
const mov = new Uint8Array([
   0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20,
]);
const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);

const folder = "feedback-attachments";
const base =
   "https://abc.supabase.co/storage/v1/object/public/holdmetoit-bucket";

describe("validateFeedbackAttachmentMeta", () => {
   it.each([
      ["image/png", "png", "image", "image/png"],
      ["image/jpeg", "jpg", "image", "image/jpeg"],
      ["image/webp", "webp", "image", "image/webp"],
      ["image/gif", "gif", "image", "image/gif"],
      ["video/mp4", "mp4", "video", "video/mp4"],
      ["video/webm", "webm", "video", "video/webm"],
      ["video/quicktime", "mov", "video", "video/quicktime"],
   ] as const)("accepts %s", (mimeType, ext, kind, contentType) => {
      const result = validateFeedbackAttachmentMeta({
         mimeType,
         sizeBytes: 1024,
      });
      expect(result).toEqual({ ok: true, ext, kind, contentType });
   });

   it("rejects empty, unknown and oversized files", () => {
      expect(
         validateFeedbackAttachmentMeta({ mimeType: "image/png", sizeBytes: 0 })
      ).toEqual({ ok: false, reason: "The selected file is empty." });

      expect(
         validateFeedbackAttachmentMeta({
            mimeType: "text/plain",
            sizeBytes: 10,
         })
      ).toMatchObject({ ok: false });

      expect(
         validateFeedbackAttachmentMeta({
            mimeType: "image/png",
            sizeBytes: FEEDBACK_IMAGE_MAX_BYTES,
         }).ok
      ).toBe(true);
      expect(
         validateFeedbackAttachmentMeta({
            mimeType: "image/png",
            sizeBytes: FEEDBACK_IMAGE_MAX_BYTES + 1,
         })
      ).toEqual({ ok: false, reason: "Images must be 5 MB or smaller." });

      expect(
         validateFeedbackAttachmentMeta({
            mimeType: "video/mp4",
            sizeBytes: FEEDBACK_VIDEO_MAX_BYTES,
         }).ok
      ).toBe(true);
      expect(
         validateFeedbackAttachmentMeta({
            mimeType: "video/mp4",
            sizeBytes: FEEDBACK_VIDEO_MAX_BYTES + 1,
         })
      ).toEqual({ ok: false, reason: "Videos must be 50 MB or smaller." });
   });
});

describe("resolveFeedbackAttachmentKind", () => {
   it("maps supported mime types to kinds", () => {
      expect(resolveFeedbackAttachmentKind("image/gif")).toBe("image");
      expect(resolveFeedbackAttachmentKind("video/quicktime")).toBe("video");
      expect(resolveFeedbackAttachmentKind("application/pdf")).toBeNull();
   });
});

describe("sniffFeedbackAttachmentExt", () => {
   it.each([
      [png, "png"],
      [jpg, "jpg"],
      [webp, "webp"],
      [gif, "gif"],
      [mp4, "mp4"],
      [mov, "mov"],
      [webm, "webm"],
   ] as const)("detects %s magic bytes", (header, ext) => {
      expect(sniffFeedbackAttachmentExt(header)).toBe(ext);
   });

   it("returns null for unknown or truncated input", () => {
      expect(
         sniffFeedbackAttachmentExt(new Uint8Array([0x00, 0x01, 0x02, 0x03]))
      ).toBeNull();
      expect(sniffFeedbackAttachmentExt(new Uint8Array([0x89]))).toBeNull();
   });
});

describe("buildFeedbackAttachmentObjectPath", () => {
   it("builds a flat path inside the configured folder", () => {
      expect(
         buildFeedbackAttachmentObjectPath(
            "/feedback-attachments/",
            "abc",
            "mp4"
         )
      ).toBe("feedback-attachments/abc.mp4");
   });
});

describe("parseFeedbackAttachmentPath", () => {
   it("parses managed paths", () => {
      expect(
         parseFeedbackAttachmentPath(
            "feedback-attachments/abc-123.webm",
            folder
         )
      ).toEqual({
         ext: "webm",
         kind: "video",
         mimeType: "video/webm",
      });
   });

   it.each([
      "other-folder/abc.png",
      "feedback-attachments/nested/abc.png",
      "feedback-attachments/../abc.png",
      "feedback-attachments/abc.png?download=1",
      "feedback-attachments/abc.exe",
      "feedback-attachments/",
   ])("rejects unsafe path %s", (path) => {
      expect(parseFeedbackAttachmentPath(path, folder)).toBeNull();
   });
});

describe("extractFeedbackAttachmentObjectPath", () => {
   const config = {
      supabaseUrl: "https://abc.supabase.co",
      bucket: "holdmetoit-bucket",
      folder,
   };

   it("extracts managed object paths", () => {
      expect(
         extractFeedbackAttachmentObjectPath(
            `${base}/feedback-attachments/abc.jpg`,
            config
         )
      ).toBe("feedback-attachments/abc.jpg");
   });

   it.each([
      null,
      `${base}/event-banners/abc.jpg`,
      `${base}/feedback-attachments/nested/abc.jpg`,
      `${base}/feedback-attachments/abc.png?download=1`,
      "https://abc.supabase.co.evil.com/storage/v1/object/public/holdmetoit-bucket/feedback-attachments/abc.png",
   ])("rejects unmanaged url %s", (url) => {
      expect(extractFeedbackAttachmentObjectPath(url, config)).toBeNull();
   });
});
