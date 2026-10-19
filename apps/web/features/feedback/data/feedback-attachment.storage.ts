import {
   deleteStorageObject,
   getFeedbackAttachmentsUrlConfig,
   getStorageObjectInfo,
   getStoragePublicUrl,
} from "@/core/storage/supabase-storage";
import {
   maxBytesForKind,
   parseFeedbackAttachmentPath,
   sniffFeedbackAttachmentExt,
} from "@/features/feedback/domain/feedback-attachment";
import type { VerifiedFeedbackAttachment } from "@/features/feedback/domain/feedback.types";
import { isFeedbackAttachmentReferenced } from "@/features/feedback/data/feedback-attachment.repository";

const SNIFF_BYTES = 32;

/**
 * Verifies an uploaded object exists, respects the per-kind size cap, and its
 * magic bytes match the claimed extension. Returns `null` for anything invalid.
 */
export async function verifyFeedbackAttachment(
   path: string
): Promise<VerifiedFeedbackAttachment | null> {
   try {
      const { folder } = getFeedbackAttachmentsUrlConfig();
      const parsed = parseFeedbackAttachmentPath(path, folder);
      if (!parsed) return null;

      const info = await getStorageObjectInfo(path);
      if (!info || info.sizeBytes <= 0) return null;
      if (info.sizeBytes > maxBytesForKind(parsed.kind)) return null;

      const url = getStoragePublicUrl(path);
      const response = await fetch(url, {
         headers: { Range: `bytes=0-${SNIFF_BYTES - 1}` },
         cache: "no-store",
      });

      if (response.status !== 206) {
         await response.body?.cancel().catch(() => {});
         return null;
      }

      const header = new Uint8Array(await response.arrayBuffer());
      if (sniffFeedbackAttachmentExt(header) !== parsed.ext) return null;

      return {
         path,
         url,
         kind: parsed.kind,
         mimeType: parsed.mimeType,
         sizeBytes: info.sizeBytes,
      };
   } catch {
      return null;
   }
}

/**
 * Deletes an uploaded-but-unreferenced attachment. Persisted attachment rows
 * always win, so a leaked path can never remove submitted feedback media.
 */
export async function discardFeedbackAttachment(path: string): Promise<void> {
   try {
      const { folder } = getFeedbackAttachmentsUrlConfig();
      if (!parseFeedbackAttachmentPath(path, folder)) return;
      if (await isFeedbackAttachmentReferenced(path)) return;
      await deleteStorageObject(path);
   } catch {
      // Cleanup is best-effort.
   }
}
