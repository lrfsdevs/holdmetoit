import {
   confirmFeedbackAttachmentAction,
   requestFeedbackAttachmentUploadAction,
} from "@/features/feedback/api/feedback-attachments.actions";
import { validateFeedbackAttachmentMeta } from "@/features/feedback/domain/feedback-attachment";
import type { VerifiedFeedbackAttachment } from "@/features/feedback/domain/feedback.types";

const UPLOAD_TIMEOUT_MS = 30_000;

function putToSignedUrl(
   signedUrl: string,
   file: File,
   contentType: string,
   onProgress?: (percent: number) => void
): Promise<void> {
   return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("PUT", signedUrl);
      request.setRequestHeader("Content-Type", contentType);
      request.setRequestHeader("x-upsert", "false");
      request.timeout = UPLOAD_TIMEOUT_MS;

      request.upload.onprogress = (event) => {
         if (event.lengthComputable) {
            onProgress?.(Math.round((event.loaded / event.total) * 100));
         }
      };

      request.onload = () => {
         if (request.status >= 200 && request.status < 300) {
            resolve();
         } else {
            reject(new Error("Could not upload the file. Please try again."));
         }
      };
      request.onerror = () => {
         reject(
            new Error(
               "Could not upload the file. Please check your connection."
            )
         );
      };
      request.ontimeout = () => {
         reject(
            new Error(
               "The upload timed out. Please check your connection and try again."
            )
         );
      };
      request.onabort = () => reject(new Error("Upload cancelled."));

      request.send(file);
   });
}

/** Validates, uploads directly to Supabase, then verifies the stored object. */
export async function uploadFeedbackAttachment(
   file: File,
   handlers: {
      onProgress?: (percent: number) => void;
      onUploaded?: () => void;
   } = {}
): Promise<VerifiedFeedbackAttachment> {
   const validation = validateFeedbackAttachmentMeta({
      mimeType: file.type,
      sizeBytes: file.size,
   });
   if (!validation.ok) {
      throw new Error(validation.reason);
   }

   const request = await requestFeedbackAttachmentUploadAction({
      mimeType: file.type,
      sizeBytes: file.size,
   });
   if (!request.ok) {
      throw new Error(request.message);
   }

   await putToSignedUrl(
      request.data.signedUrl,
      file,
      validation.contentType,
      handlers.onProgress
   );
   handlers.onUploaded?.();

   const confirmation = await confirmFeedbackAttachmentAction({
      path: request.data.path,
   });
   if (!confirmation.ok) {
      throw new Error(confirmation.message);
   }

   return confirmation.data;
}
