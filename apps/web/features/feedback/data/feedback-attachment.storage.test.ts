import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
   getStorageObjectInfo,
   getStoragePublicUrl,
   deleteStorageObject,
   isFeedbackAttachmentReferenced,
} = vi.hoisted(() => ({
   getStorageObjectInfo: vi.fn(),
   getStoragePublicUrl: vi.fn(),
   deleteStorageObject: vi.fn(),
   isFeedbackAttachmentReferenced: vi.fn(),
}));

vi.mock("@/core/storage/supabase-storage", () => ({
   getFeedbackAttachmentsUrlConfig: () => ({
      supabaseUrl: "https://abc.supabase.co",
      bucket: "holdmetoit-bucket",
      folder: "feedback-attachments",
   }),
   getStorageObjectInfo,
   getStoragePublicUrl,
   deleteStorageObject,
}));

vi.mock("@/features/feedback/data/feedback-attachment.repository", () => ({
   isFeedbackAttachmentReferenced,
}));

import {
   discardFeedbackAttachment,
   verifyFeedbackAttachment,
} from "./feedback-attachment.storage";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const fetchMock = vi.fn();

function rangeResponse(status: number, bytes: Uint8Array) {
   return {
      status,
      arrayBuffer: async () =>
         bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
         ),
      body: { cancel: vi.fn().mockResolvedValue(undefined) },
   };
}

beforeEach(() => {
   vi.clearAllMocks();
   vi.stubGlobal("fetch", fetchMock);
   getStorageObjectInfo.mockResolvedValue({
      sizeBytes: 1024,
      contentType: "image/png",
   });
   getStoragePublicUrl.mockReturnValue(
      "https://abc.supabase.co/storage/v1/object/public/holdmetoit-bucket/feedback-attachments/abc.png"
   );
   deleteStorageObject.mockResolvedValue(undefined);
   isFeedbackAttachmentReferenced.mockResolvedValue(false);
});

afterEach(() => {
   vi.unstubAllGlobals();
});

describe("verifyFeedbackAttachment", () => {
   it("returns verified metadata for a matching image", async () => {
      fetchMock.mockResolvedValue(rangeResponse(206, png));

      await expect(
         verifyFeedbackAttachment("feedback-attachments/abc.png")
      ).resolves.toEqual({
         path: "feedback-attachments/abc.png",
         url: "https://abc.supabase.co/storage/v1/object/public/holdmetoit-bucket/feedback-attachments/abc.png",
         kind: "image",
         mimeType: "image/png",
         sizeBytes: 1024,
      });
      expect(fetchMock).toHaveBeenCalledWith(
         expect.stringContaining("feedback-attachments/abc.png"),
         expect.objectContaining({
            headers: { Range: "bytes=0-31" },
         })
      );
   });

   it("rejects unknown paths without touching storage", async () => {
      await expect(
         verifyFeedbackAttachment("other/abc.png")
      ).resolves.toBeNull();
      expect(getStorageObjectInfo).not.toHaveBeenCalled();
   });

   it("rejects missing, empty or oversized objects", async () => {
      getStorageObjectInfo.mockResolvedValueOnce(null);
      await expect(
         verifyFeedbackAttachment("feedback-attachments/abc.png")
      ).resolves.toBeNull();

      getStorageObjectInfo.mockResolvedValueOnce({
         sizeBytes: 0,
         contentType: "image/png",
      });
      await expect(
         verifyFeedbackAttachment("feedback-attachments/abc.png")
      ).resolves.toBeNull();

      getStorageObjectInfo.mockResolvedValueOnce({
         sizeBytes: 50 * 1024 * 1024 + 1,
         contentType: "video/mp4",
      });
      await expect(
         verifyFeedbackAttachment("feedback-attachments/abc.mp4")
      ).resolves.toBeNull();
   });

   it("rejects magic-byte mismatches", async () => {
      fetchMock.mockResolvedValue(rangeResponse(206, jpg));
      await expect(
         verifyFeedbackAttachment("feedback-attachments/abc.png")
      ).resolves.toBeNull();
   });

   it("rejects responses that are not partial content", async () => {
      const cancel = vi.fn().mockResolvedValue(undefined);
      fetchMock.mockResolvedValue({
         status: 200,
         body: { cancel },
         arrayBuffer: vi.fn(),
      });

      await expect(
         verifyFeedbackAttachment("feedback-attachments/abc.png")
      ).resolves.toBeNull();
      expect(cancel).toHaveBeenCalled();
   });

   it("swallows network failures", async () => {
      fetchMock.mockRejectedValue(new Error("network"));
      await expect(
         verifyFeedbackAttachment("feedback-attachments/abc.png")
      ).resolves.toBeNull();
   });
});

describe("discardFeedbackAttachment", () => {
   it("deletes unreferenced objects", async () => {
      await discardFeedbackAttachment("feedback-attachments/abc.png");
      expect(deleteStorageObject).toHaveBeenCalledWith(
         "feedback-attachments/abc.png"
      );
   });

   it("never deletes persisted or unmanaged paths", async () => {
      isFeedbackAttachmentReferenced.mockResolvedValue(true);
      await discardFeedbackAttachment("feedback-attachments/abc.png");
      expect(deleteStorageObject).not.toHaveBeenCalled();

      isFeedbackAttachmentReferenced.mockResolvedValue(false);
      await discardFeedbackAttachment("../secret.png");
      expect(deleteStorageObject).not.toHaveBeenCalled();
   });

   it("swallows repository failures", async () => {
      isFeedbackAttachmentReferenced.mockRejectedValue(new Error("db down"));
      await expect(
         discardFeedbackAttachment("feedback-attachments/abc.png")
      ).resolves.toBeUndefined();
      expect(deleteStorageObject).not.toHaveBeenCalled();
   });
});
