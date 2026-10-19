"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
   AlertCircle,
   Film,
   ImageIcon,
   Loader2,
   Paperclip,
   RefreshCw,
   X,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { discardFeedbackAttachmentAction } from "@/features/feedback/api/feedback-attachments.actions";
import {
   FEEDBACK_ATTACHMENT_ACCEPT,
   FEEDBACK_ATTACHMENT_MAX_FILES,
   FEEDBACK_ATTACHMENT_MIME_TO_EXT,
   validateFeedbackAttachmentMeta,
   type FeedbackAttachmentKind,
} from "@/features/feedback/domain/feedback-attachment";
import { uploadFeedbackAttachment } from "@/features/feedback/presentation/upload-feedback-attachment";

export interface DraftFeedbackAttachment {
   id: string;
   fileName: string;
   sizeBytes: number;
   kind: FeedbackAttachmentKind;
   localUrl: string | null;
   path: string | null;
   url: string | null;
   status: "uploading" | "verifying" | "ready" | "error";
   progress: number;
   error: string | null;
   file: File;
}

interface FeedbackAttachmentInputProps {
   attachments: DraftFeedbackAttachment[];
   onChange: React.Dispatch<React.SetStateAction<DraftFeedbackAttachment[]>>;
   disabled?: boolean;
   maxFiles?: number;
}

function formatBytes(bytes: number): string {
   if (bytes < 1024) return `${bytes} B`;
   if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
   return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(attachment: DraftFeedbackAttachment): string {
   if (attachment.status === "verifying") return "Verifying…";
   if (attachment.status === "uploading")
      return `Uploading ${attachment.progress}%`;
   if (attachment.status === "ready") return "Uploaded";
   return "Upload failed";
}

export function FeedbackAttachmentInput({
   attachments,
   onChange,
   disabled = false,
   maxFiles = FEEDBACK_ATTACHMENT_MAX_FILES,
}: FeedbackAttachmentInputProps) {
   const fileRef = useRef<HTMLInputElement>(null);
   const removedIds = useRef(new Set<string>());
   const [localError, setLocalError] = useState<string | null>(null);

   const atLimit = attachments.length >= maxFiles;
   const busy = attachments.some(
      (attachment) =>
         attachment.status === "uploading" || attachment.status === "verifying"
   );

   const patch = (
      id: string,
      changes: Partial<DraftFeedbackAttachment>
   ): void => {
      onChange((current) =>
         current.map((attachment) =>
            attachment.id === id ? { ...attachment, ...changes } : attachment
         )
      );
   };

   const uploadDraft = async (
      draft: DraftFeedbackAttachment
   ): Promise<void> => {
      patch(draft.id, { status: "uploading", progress: 0, error: null });
      try {
         const verified = await uploadFeedbackAttachment(draft.file, {
            onProgress: (progress) => patch(draft.id, { progress }),
            onUploaded: () =>
               patch(draft.id, { status: "verifying", progress: 100 }),
         });

         if (removedIds.current.has(draft.id)) {
            void discardFeedbackAttachmentAction({
               path: verified.path,
            }).catch(() => {});
            return;
         }

         patch(draft.id, {
            status: "ready",
            progress: 100,
            kind: verified.kind,
            path: verified.path,
            url: verified.url,
            error: null,
         });
      } catch (error) {
         if (removedIds.current.has(draft.id)) return;
         patch(draft.id, {
            status: "error",
            error: error instanceof Error ? error.message : "Upload failed.",
         });
      }
   };

   const handleSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (files.length === 0) return;

      setLocalError(null);
      const remaining = maxFiles - attachments.length;
      if (remaining <= 0) {
         setLocalError(`You can attach at most ${maxFiles} files.`);
         return;
      }
      if (files.length > remaining) {
         setLocalError(`You can attach at most ${maxFiles} files.`);
      }

      const drafts: DraftFeedbackAttachment[] = files
         .slice(0, remaining)
         .map((file) => {
            const validation = validateFeedbackAttachmentMeta({
               mimeType: file.type,
               sizeBytes: file.size,
            });
            const known = FEEDBACK_ATTACHMENT_MIME_TO_EXT[file.type];

            return {
               id: crypto.randomUUID(),
               fileName: file.name,
               sizeBytes: file.size,
               kind: known?.kind ?? "image",
               localUrl: URL.createObjectURL(file),
               path: null,
               url: null,
               status: validation.ok ? "uploading" : "error",
               progress: 0,
               error: validation.ok ? null : validation.reason,
               file,
            };
         });

      onChange((current) => [...current, ...drafts]);

      for (const draft of drafts) {
         if (draft.status === "uploading") {
            void uploadDraft(draft);
         }
      }
   };

   const handleRemove = (attachment: DraftFeedbackAttachment): void => {
      removedIds.current.add(attachment.id);
      if (attachment.localUrl) URL.revokeObjectURL(attachment.localUrl);
      if (attachment.path) {
         void discardFeedbackAttachmentAction({
            path: attachment.path,
         }).catch(() => {});
      }
      onChange((current) =>
         current.filter((item) => item.id !== attachment.id)
      );
   };

   return (
      <div className="space-y-2">
         <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
               Attachments{" "}
               <span className="normal-case tracking-normal text-zinc-500">
                  (optional)
               </span>
            </Label>
            <span className="text-meta text-zinc-500">
               {attachments.length}/{maxFiles}
            </span>
         </div>

         <input
            ref={fileRef}
            type="file"
            multiple
            accept={FEEDBACK_ATTACHMENT_ACCEPT}
            onChange={handleSelect}
            disabled={disabled || atLimit}
            className="sr-only"
            aria-label="Add images or videos"
         />

         <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || atLimit}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-border-strong bg-surface-elevated text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-surface-nested transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
         >
            <Paperclip className="h-4 w-4" aria-hidden />
            <span>Add image or video</span>
         </button>

         <p className="text-meta text-zinc-500 leading-relaxed">
            PNG, JPEG, WebP, GIF up to 5 MB · MP4, WebM, MOV up to 50 MB · max{" "}
            {maxFiles} files
         </p>

         {attachments.length > 0 && (
            <ul className="space-y-2">
               {attachments.map((attachment) => (
                  <li
                     key={attachment.id}
                     className="flex items-start gap-3 rounded-xl border border-border-strong bg-surface-elevated p-2.5"
                  >
                     <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black/40 flex items-center justify-center">
                        {attachment.kind === "image" && attachment.localUrl ? (
                           <Image
                              src={attachment.localUrl}
                              alt={`Preview of ${attachment.fileName}`}
                              fill
                              sizes="56px"
                              unoptimized
                              className="object-cover"
                           />
                        ) : attachment.localUrl ? (
                           <video
                              src={attachment.localUrl}
                              muted
                              playsInline
                              preload="metadata"
                              aria-label={`Preview of ${attachment.fileName}`}
                              className="h-full w-full object-cover"
                           />
                        ) : attachment.kind === "video" ? (
                           <Film
                              className="h-5 w-5 text-zinc-500"
                              aria-hidden
                           />
                        ) : (
                           <ImageIcon
                              className="h-5 w-5 text-zinc-500"
                              aria-hidden
                           />
                        )}
                     </div>

                     <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-xs font-medium text-zinc-200">
                           {attachment.fileName}
                        </p>
                        <p className="text-meta text-zinc-500">
                           {formatBytes(attachment.sizeBytes)}
                        </p>

                        {attachment.status === "uploading" && (
                           <div
                              role="progressbar"
                              aria-label={`Uploading ${attachment.fileName}`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={attachment.progress}
                              className="h-1.5 w-full overflow-hidden rounded-full bg-surface-nested"
                           >
                              <div
                                 className="h-full bg-white transition-all"
                                 style={{ width: `${attachment.progress}%` }}
                              />
                           </div>
                        )}

                        <p
                           className={`text-meta ${
                              attachment.status === "error"
                                 ? "text-feedback-error-text"
                                 : attachment.status === "ready"
                                   ? "text-emerald-400"
                                   : "text-zinc-400"
                           }`}
                        >
                           {statusLabel(attachment)}
                        </p>

                        {attachment.error && (
                           <div
                              role="alert"
                              className="flex flex-wrap items-center gap-2 text-meta text-feedback-error-text"
                           >
                              <AlertCircle
                                 className="h-3.5 w-3.5 shrink-0"
                                 aria-hidden
                              />
                              <span className="min-w-0 flex-1 break-words">
                                 {attachment.error}
                              </span>
                              <button
                                 type="button"
                                 onClick={() => void uploadDraft(attachment)}
                                 disabled={disabled}
                                 className="inline-flex items-center gap-1 font-semibold underline disabled:opacity-50"
                              >
                                 <RefreshCw className="h-3 w-3" aria-hidden />
                                 Retry
                              </button>
                           </div>
                        )}
                     </div>

                     <button
                        type="button"
                        onClick={() => handleRemove(attachment)}
                        disabled={disabled}
                        aria-label={`Remove ${attachment.fileName}`}
                        className="shrink-0 rounded-lg p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-surface-nested transition-colors disabled:opacity-50"
                     >
                        {attachment.status === "uploading" ||
                        attachment.status === "verifying" ? (
                           <Loader2
                              className="h-4 w-4 animate-spin"
                              aria-hidden
                           />
                        ) : (
                           <X className="h-4 w-4" aria-hidden />
                        )}
                     </button>
                  </li>
               ))}
            </ul>
         )}

         {busy && (
            <p role="status" className="text-meta text-zinc-400">
               Waiting for attachments to finish uploading…
            </p>
         )}

         {localError && (
            <div
               role="alert"
               className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs"
            >
               <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
               <span>{localError}</span>
            </div>
         )}
      </div>
   );
}
