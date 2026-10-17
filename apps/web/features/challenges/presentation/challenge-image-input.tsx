"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { AlertCircle, ImagePlus, Loader2, RefreshCw } from "lucide-react";

import {
   discardChallengeImageUploadAction,
   uploadChallengeImageAction,
} from "@/features/challenges/api/punishment-pfp.actions";
import {
   type ChallengeImagePurpose,
   PUNISHMENT_PFP_ACCEPT,
   PUNISHMENT_PFP_MAX_BYTES,
   PUNISHMENT_PFP_MIME_TO_EXT,
} from "@/features/challenges/domain/punishment-pfp";

interface ChallengeImageInputProps {
   purpose: ChallengeImagePurpose;
   value: string | null;
   onChange: (url: string) => void;
   /** URL persisted on the challenge. Uploads other than this are discardable. */
   savedValue?: string | null;
   onBusyChange?: (busy: boolean) => void;
   disabled?: boolean;
   error?: string | null;
   label?: string;
}

function ImagePreview({
   src,
   label,
   sizes,
}: {
   src: string;
   label: string;
   sizes: string;
}) {
   const [status, setStatus] = useState<"loading" | "loaded" | "error">(
      "loading"
   );

   if (status === "error") {
      return (
         <button
            type="button"
            onClick={() => setStatus("loading")}
            aria-label={`Retry ${label} preview`}
            className="flex min-h-[44px] w-full flex-col items-center gap-1 p-1 text-[10px] text-[#d1d1d1]"
         >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Retry
         </button>
      );
   }

   return (
      <>
         {status === "loading" && (
            <div
               role="status"
               aria-label={`Loading ${label} preview`}
               className="absolute inset-0 animate-pulse bg-[#292929]"
            />
         )}
         <Image
            src={src}
            alt={`${label} preview`}
            fill
            sizes={sizes}
            unoptimized
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("error")}
            className="object-cover"
         />
      </>
   );
}

/** Renders image selection, preview, and upload controls for challenge assets. */
export function ChallengeImageInput({
   purpose,
   value,
   onChange,
   savedValue = null,
   onBusyChange,
   disabled = false,
   error = null,
   label = purpose === "event-banner"
      ? "Event Header Image"
      : "Assigned Punishment PFP",
}: ChallengeImageInputProps) {
   const inputId = useId();
   const fileRef = useRef<HTMLInputElement>(null);
   const busyRef = useRef(false);
   const [uploading, setUploading] = useState(false);
   const [localPreview, setLocalPreview] = useState<string | null>(null);
   const [localError, setLocalError] = useState<string | null>(null);
   const [lastFile, setLastFile] = useState<File | null>(null);
   const isBanner = purpose === "event-banner";

   useEffect(() => {
      return () => {
         if (localPreview) URL.revokeObjectURL(localPreview);
      };
   }, [localPreview]);

   const setBusy = (busy: boolean) => {
      busyRef.current = busy;
      setUploading(busy);
      onBusyChange?.(busy);
   };

   const upload = async (file: File) => {
      if (disabled || busyRef.current) return;
      setLocalError(null);
      setLastFile(null);

      if (!(file.type in PUNISHMENT_PFP_MIME_TO_EXT)) {
         setLocalError("Only PNG, JPEG or WebP images are allowed.");
         return;
      }
      if (!file.size) {
         setLocalError("The selected file is empty.");
         return;
      }
      if (file.size > PUNISHMENT_PFP_MAX_BYTES) {
         setLocalError("Image must be 3 MB or smaller.");
         return;
      }

      setLastFile(file);
      setLocalPreview(URL.createObjectURL(file));
      setBusy(true);

      try {
         const formData = new FormData();
         formData.set("file", file);
         formData.set("purpose", purpose);
         const result = await uploadChallengeImageAction(formData);

         if (!result.ok || !result.data?.url) {
            setLocalError(
               result.ok ? "Upload failed. Please try again." : result.message
            );
            setLocalPreview(null);
            return;
         }

         // Saved images remain referenced until the parent successfully saves a replacement.
         if (value && value !== savedValue && value !== result.data.url) {
            void discardChallengeImageUploadAction(value).catch(() => {});
         }

         onChange(result.data.url);
         setLocalPreview(null);
         setLastFile(null);
      } catch {
         setLocalError("Upload failed. Please try again.");
         setLocalPreview(null);
      } finally {
         setBusy(false);
      }
   };

   const handleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) void upload(file);
   };

   const previewSrc = localPreview ?? value;
   const shownError = localError ?? error;

   return (
      <div className="min-w-0 space-y-2" data-image-purpose={purpose}>
         <p
            id={`${inputId}-help`}
            className="text-xs leading-relaxed text-[#868686]"
         >
            {isBanner
               ? "Displayed as the challenge banner and event thumbnail in the admin console."
               : "The avatar assigned to participants who fail the challenge’s accountability requirements."}
         </p>
         <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div
               className={`relative flex shrink-0 items-center justify-center overflow-hidden border bg-[#171717] ${
                  isBanner
                     ? "aspect-[5/1] w-full rounded-xl sm:w-56"
                     : "h-14 w-14 rounded-full"
               } ${previewSrc ? "border-[#333333]" : "border-dashed border-[#484848]"}`}
            >
               {previewSrc ? (
                  <ImagePreview
                     key={previewSrc}
                     src={previewSrc}
                     label={label}
                     sizes={
                        isBanner ? "(min-width: 640px) 224px, 100vw" : "56px"
                     }
                  />
               ) : (
                  <ImagePlus className="h-5 w-5 text-[#868686]" aria-hidden />
               )}
               {uploading && (
                  <div
                     role="status"
                     aria-label={`Uploading ${label}`}
                     className="absolute inset-0 flex items-center justify-center bg-black/60"
                  >
                     <Loader2
                        className="h-5 w-5 animate-spin text-white"
                        aria-hidden
                     />
                  </div>
               )}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
               <label htmlFor={inputId} className="sr-only">
                  {label}
               </label>
               <input
                  id={inputId}
                  ref={fileRef}
                  type="file"
                  accept={PUNISHMENT_PFP_ACCEPT}
                  onChange={handleSelect}
                  disabled={disabled || uploading}
                  className="sr-only"
                  aria-describedby={`${inputId}-help ${inputId}-format${shownError ? ` ${inputId}-error` : ""}`}
                  aria-invalid={!!shownError}
               />
               <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={disabled || uploading}
                  aria-label={`${uploading ? "Uploading" : value ? "Replace" : "Upload"} ${label}`}
                  className="inline-flex min-h-[44px] max-w-full items-center gap-2 rounded-xl border border-[#484848] bg-[#545454] px-4 text-xs font-semibold text-[#f4f3f6] transition-colors hover:bg-[#656565] disabled:cursor-not-allowed disabled:opacity-50"
               >
                  {uploading ? (
                     <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                     <ImagePlus className="h-4 w-4" aria-hidden />
                  )}
                  {uploading
                     ? "Uploading..."
                     : value
                       ? "Replace image"
                       : "Upload image"}
               </button>
               <p
                  id={`${inputId}-format`}
                  className="text-[11px] text-[#868686]"
               >
                  PNG, JPEG or WebP · up to 3 MB
               </p>
            </div>
         </div>

         {shownError && (
            <div
               id={`${inputId}-error`}
               role="alert"
               className="flex flex-wrap items-center gap-2 rounded-xl border border-[#ff5757]/40 bg-[#381717] p-2.5 text-xs text-[#ff5757]"
            >
               <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
               <span className="min-w-0 flex-1 break-words">{shownError}</span>
               {localError && lastFile && !uploading && (
                  <button
                     type="button"
                     onClick={() => void upload(lastFile)}
                     disabled={disabled}
                     aria-label={`Retry ${label} upload`}
                     className="inline-flex min-h-[44px] items-center gap-1 font-semibold underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                     <RefreshCw className="h-3 w-3" aria-hidden /> Retry
                  </button>
               )}
            </div>
         )}
      </div>
   );
}
