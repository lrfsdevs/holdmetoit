import { beforeEach, describe, expect, it, vi } from "vitest";

const {
   createSignedStorageUpload,
   deleteStorageObject,
   verifyFeedbackAttachment,
   discardFeedbackAttachment,
} = vi.hoisted(() => ({
   createSignedStorageUpload: vi.fn(),
   deleteStorageObject: vi.fn(),
   verifyFeedbackAttachment: vi.fn(),
   discardFeedbackAttachment: vi.fn(),
}));

vi.mock("@/core/storage/supabase-storage", () => ({
   createSignedStorageUpload,
   deleteStorageObject,
   getFeedbackAttachmentsUrlConfig: () => ({
      supabaseUrl: "https://abc.supabase.co",
      bucket: "holdmetoit-bucket",
      folder: "feedback-attachments",
   }),
}));

vi.mock("@/features/feedback/data/feedback-attachment.storage", () => ({
   verifyFeedbackAttachment,
   discardFeedbackAttachment,
}));

import {
   confirmFeedbackAttachmentAction,
   discardFeedbackAttachmentAction,
   requestFeedbackAttachmentUploadAction,
} from "./feedback-attachments.actions";

const verified = {
   path: "feedback-attachments/abc.png",
   url: "https://abc.supabase.co/storage/v1/object/public/holdmetoit-bucket/feedback-attachments/abc.png",
   kind: "image" as const,
   mimeType: "image/png",
   sizeBytes: 1024,
};

beforeEach(() => {
   vi.clearAllMocks();
   createSignedStorageUpload.mockResolvedValue({
      path: "feedback-attachments/abc.jpg",
      token: "token",
      signedUrl: "https://abc.supabase.co/storage/v1/object/upload/sign/abc",
      publicUrl:
         "https://abc.supabase.co/storage/v1/object/public/holdmetoit-bucket/feedback-attachments/abc.jpg",
   });
   deleteStorageObject.mockResolvedValue(undefined);
   verifyFeedbackAttachment.mockResolvedValue(verified);
   discardFeedbackAttachment.mockResolvedValue(undefined);
});

describe("requestFeedbackAttachmentUploadAction", () => {
   it("validates metadata and issues a signed upload target", async () => {
      const result = await requestFeedbackAttachmentUploadAction({
         mimeType: "image/jpeg",
         sizeBytes: 1024,
      });

      expect(result.ok).toBe(true);
      expect(createSignedStorageUpload).toHaveBeenCalledWith({
         folder: "feedback-attachments",
         ext: "jpg",
      });
   });

   it("rejects unsupported or oversized files", async () => {
      const unsupported = await requestFeedbackAttachmentUploadAction({
         mimeType: "application/pdf",
         sizeBytes: 10,
      });
      expect(unsupported).toMatchObject({
         ok: false,
         code: "INVALID_INPUT",
      });

      const oversized = await requestFeedbackAttachmentUploadAction({
         mimeType: "video/mp4",
         sizeBytes: 50 * 1024 * 1024 + 1,
      });
      expect(oversized).toMatchObject({
         ok: false,
         code: "INVALID_INPUT",
      });
      expect(createSignedStorageUpload).not.toHaveBeenCalled();
   });

   it("surfaces signing failures", async () => {
      createSignedStorageUpload.mockRejectedValue(new Error("boom"));
      const result = await requestFeedbackAttachmentUploadAction({
         mimeType: "image/png",
         sizeBytes: 10,
      });
      expect(result).toMatchObject({ ok: false, code: "UPLOAD_FAILED" });
   });
});

describe("confirmFeedbackAttachmentAction", () => {
   it("returns verified metadata", async () => {
      const result = await confirmFeedbackAttachmentAction({
         path: verified.path,
      });
      expect(result).toEqual({ ok: true, data: verified });
   });

   it("deletes managed objects that fail verification", async () => {
      verifyFeedbackAttachment.mockResolvedValue(null);
      const result = await confirmFeedbackAttachmentAction({
         path: "feedback-attachments/abc.png",
      });

      expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
      expect(deleteStorageObject).toHaveBeenCalledWith(
         "feedback-attachments/abc.png"
      );
   });

   it("never deletes unmanaged paths", async () => {
      verifyFeedbackAttachment.mockResolvedValue(null);
      await confirmFeedbackAttachmentAction({ path: "../secret.png" });
      expect(deleteStorageObject).not.toHaveBeenCalled();
   });
});

describe("discardFeedbackAttachmentAction", () => {
   it("discards managed paths", async () => {
      const result = await discardFeedbackAttachmentAction({
         path: "feedback-attachments/abc.png",
      });
      expect(result.ok).toBe(true);
      expect(discardFeedbackAttachment).toHaveBeenCalledWith(
         "feedback-attachments/abc.png"
      );
   });

   it("ignores unmanaged paths", async () => {
      const result = await discardFeedbackAttachmentAction({
         path: "../secret.png",
      });
      expect(result.ok).toBe(true);
      expect(discardFeedbackAttachment).not.toHaveBeenCalled();
   });
});
