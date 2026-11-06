"use server";

import {
   createSignedStorageUpload,
   deleteStorageObject,
   getFeedbackAttachmentsUrlConfig,
} from "@/core/storage/supabase-storage";
import { createLogger, logEvents } from "@/core/observability/logger";
import {
   parseFeedbackAttachmentPath,
   validateFeedbackAttachmentMeta,
} from "@/features/feedback/domain/feedback-attachment";
import type { VerifiedFeedbackAttachment } from "@/features/feedback/domain/feedback.types";
import {
   discardFeedbackAttachment,
   verifyFeedbackAttachment,
} from "@/features/feedback/data/feedback-attachment.storage";

const logger = createLogger("feedback.attachments");

export type FeedbackAttachmentActionResult<T = undefined> =
   | { ok: true; data: T }
   | {
        ok: false;
        code: "INVALID_INPUT" | "UPLOAD_FAILED";
        message: string;
     };

export interface RequestFeedbackAttachmentUploadInput {
   mimeType: string;
   sizeBytes: number;
}

export interface FeedbackAttachmentUploadTarget {
   path: string;
   token: string;
   signedUrl: string;
   publicUrl: string;
}

/** Validates declared metadata and issues a short-lived signed upload URL. */
export async function requestFeedbackAttachmentUploadAction(
   input: RequestFeedbackAttachmentUploadInput
): Promise<FeedbackAttachmentActionResult<FeedbackAttachmentUploadTarget>> {
   try {
      if (
         !input ||
         typeof input.mimeType !== "string" ||
         typeof input.sizeBytes !== "number"
      ) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: "Invalid attachment.",
         };
      }

      const validation = validateFeedbackAttachmentMeta(input);
      if (!validation.ok) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: validation.reason,
         };
      }

      const { folder } = getFeedbackAttachmentsUrlConfig();
      const target = await createSignedStorageUpload({
         folder,
         ext: validation.ext,
      });

      logger.info(logEvents.feedbackAttachmentUploadRequested, {
         context: {
            ext: validation.ext,
            kind: validation.kind,
            sizeBytes: input.sizeBytes,
         },
      });

      return { ok: true, data: target };
   } catch (error) {
      logger.error(logEvents.storageUploadFailed, { error });
      return {
         ok: false,
         code: "UPLOAD_FAILED",
         message: "Could not start the upload. Please try again.",
      };
   }
}

/** Verifies an uploaded object and deletes it when validation fails. */
export async function confirmFeedbackAttachmentAction(input: {
   path: string;
}): Promise<FeedbackAttachmentActionResult<VerifiedFeedbackAttachment>> {
   try {
      if (!input || typeof input.path !== "string") {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: "Invalid attachment.",
         };
      }

      const verified = await verifyFeedbackAttachment(input.path);
      if (!verified) {
         const { folder } = getFeedbackAttachmentsUrlConfig();
         if (parseFeedbackAttachmentPath(input.path, folder)) {
            await deleteStorageObject(input.path);
         }
         logger.warn(logEvents.feedbackAttachmentRejected, {
            context: { path: input.path },
         });
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: "The uploaded file could not be verified.",
         };
      }

      logger.info(logEvents.feedbackAttachmentConfirmed, {
         context: {
            kind: verified.kind,
            mimeType: verified.mimeType,
            sizeBytes: verified.sizeBytes,
         },
      });

      return { ok: true, data: verified };
   } catch (error) {
      logger.error(logEvents.storageUploadFailed, { error });
      return {
         ok: false,
         code: "UPLOAD_FAILED",
         message: "Could not verify the upload. Please try again.",
      };
   }
}

/** Best-effort cleanup for uploads that were never attached to feedback. */
export async function discardFeedbackAttachmentAction(input: {
   path: string;
}): Promise<FeedbackAttachmentActionResult> {
   try {
      if (!input || typeof input.path !== "string") {
         return { ok: true, data: undefined };
      }

      const { folder } = getFeedbackAttachmentsUrlConfig();
      if (!parseFeedbackAttachmentPath(input.path, folder)) {
         return { ok: true, data: undefined };
      }

      await discardFeedbackAttachment(input.path);
      logger.info(logEvents.feedbackAttachmentDiscarded, {
         context: { path: input.path },
      });

      return { ok: true, data: undefined };
   } catch (error) {
      logger.error(logEvents.storageCleanupSkipped, { error });
      return {
         ok: false,
         code: "UPLOAD_FAILED",
         message: "Could not discard the attachment.",
      };
   }
}
