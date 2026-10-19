// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
   requestFeedbackAttachmentUploadAction,
   confirmFeedbackAttachmentAction,
} = vi.hoisted(() => ({
   requestFeedbackAttachmentUploadAction: vi.fn(),
   confirmFeedbackAttachmentAction: vi.fn(),
}));

vi.mock("@/features/feedback/api/feedback-attachments.actions", () => ({
   requestFeedbackAttachmentUploadAction,
   confirmFeedbackAttachmentAction,
}));

import { uploadFeedbackAttachment } from "./upload-feedback-attachment";

const verified = {
   path: "feedback-attachments/abc.png",
   url: "https://cdn.example.com/feedback-attachments/abc.png",
   kind: "image" as const,
   mimeType: "image/png",
   sizeBytes: 4,
};

class FakeXhr {
   static nextStatus = 200;
   upload: {
      onprogress:
         | ((event: {
              lengthComputable: boolean;
              loaded: number;
              total: number;
           }) => void)
         | null;
   } = { onprogress: null };
   status = 0;
   onload: (() => void) | null = null;
   onerror: (() => void) | null = null;
   onabort: (() => void) | null = null;
   open = vi.fn();
   setRequestHeader = vi.fn();
   send = vi.fn(() => {
      this.status = FakeXhr.nextStatus;
      this.upload.onprogress?.({
         lengthComputable: true,
         loaded: 25,
         total: 100,
      });
      this.onload?.();
   });
}

const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "shot.png", {
   type: "image/png",
});

beforeEach(() => {
   vi.clearAllMocks();
   FakeXhr.nextStatus = 200;
   vi.stubGlobal("XMLHttpRequest", FakeXhr);
   requestFeedbackAttachmentUploadAction.mockResolvedValue({
      ok: true,
      data: {
         path: "feedback-attachments/abc.png",
         token: "token",
         signedUrl: "https://abc.supabase.co/storage/v1/object/upload/sign/abc",
         publicUrl: verified.url,
      },
   });
   confirmFeedbackAttachmentAction.mockResolvedValue({
      ok: true,
      data: verified,
   });
});

afterEach(() => {
   vi.unstubAllGlobals();
});

describe("uploadFeedbackAttachment", () => {
   it("requests a signed URL, PUTs the file, then confirms it", async () => {
      const onProgress = vi.fn();
      const onUploaded = vi.fn();

      await expect(
         uploadFeedbackAttachment(file, { onProgress, onUploaded })
      ).resolves.toEqual(verified);

      expect(requestFeedbackAttachmentUploadAction).toHaveBeenCalledWith({
         mimeType: "image/png",
         sizeBytes: file.size,
      });
      expect(onProgress).toHaveBeenCalledWith(25);
      expect(onUploaded).toHaveBeenCalledTimes(1);
      expect(confirmFeedbackAttachmentAction).toHaveBeenCalledWith({
         path: "feedback-attachments/abc.png",
      });
   });

   it("rejects invalid files before requesting an upload", async () => {
      const invalid = new File(["hello"], "notes.txt", { type: "text/plain" });
      await expect(uploadFeedbackAttachment(invalid)).rejects.toThrow(
         /Only PNG, JPEG, WebP, GIF/
      );
      expect(requestFeedbackAttachmentUploadAction).not.toHaveBeenCalled();
   });

   it("propagates request failures", async () => {
      requestFeedbackAttachmentUploadAction.mockResolvedValue({
         ok: false,
         code: "UPLOAD_FAILED",
         message: "Could not start the upload.",
      });

      await expect(uploadFeedbackAttachment(file)).rejects.toThrow(
         /Could not start the upload/
      );
   });

   it("rejects when Supabase returns a non-success status", async () => {
      FakeXhr.nextStatus = 500;
      await expect(uploadFeedbackAttachment(file)).rejects.toThrow(
         /Could not upload the file/
      );
      expect(confirmFeedbackAttachmentAction).not.toHaveBeenCalled();
   });

   it("rejects when verification fails", async () => {
      confirmFeedbackAttachmentAction.mockResolvedValue({
         ok: false,
         code: "INVALID_INPUT",
         message: "The uploaded file could not be verified.",
      });

      await expect(uploadFeedbackAttachment(file)).rejects.toThrow(
         /could not be verified/
      );
   });
});
