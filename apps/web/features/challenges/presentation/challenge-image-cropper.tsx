"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@/components/ui/dialog";
import {
   CHALLENGE_IMAGE_SPECS,
   getCropRect,
   getOutputSize,
   meetsMinResolution,
   type ImageSize,
} from "@/features/challenges/domain/challenge-image-crop";
import {
   type ChallengeImagePurpose,
   PUNISHMENT_PFP_MAX_BYTES,
   PUNISHMENT_PFP_MIME_TO_EXT,
} from "@/features/challenges/domain/punishment-pfp";

interface ChallengeImageCropperProps {
   file: File;
   purpose: ChallengeImagePurpose;
   onConfirm: (croppedFile: File) => void;
   onCancel: () => void;
}

const ENCODINGS = [
   ["image/webp", 0.92],
   ["image/webp", 0.8],
   ["image/jpeg", 0.85],
] as const;

function toBlob(
   canvas: HTMLCanvasElement,
   type: string,
   quality: number
): Promise<Blob | null> {
   return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** First encoding the browser really supports that fits the 3 MB limit. */
async function encodeUnderLimit(
   canvas: HTMLCanvasElement
): Promise<Blob | null> {
   for (const [type, quality] of ENCODINGS) {
      const blob = await toBlob(canvas, type, quality);
      if (blob && blob.type === type && blob.size <= PUNISHMENT_PFP_MAX_BYTES) {
         return blob;
      }
   }
   return null;
}

/** Lets the host pan, zoom and preview a fixed-ratio crop before uploading. */
export function ChallengeImageCropper({
   file,
   purpose,
   onConfirm,
   onCancel,
}: ChallengeImageCropperProps) {
   const spec = CHALLENGE_IMAGE_SPECS[purpose];
   const isBanner = purpose === "event-banner";
   const previewWidth = isBanner ? 800 : 400;
   const previewHeight = Math.round(previewWidth / spec.aspectRatio);

   const canvasRef = useRef<HTMLCanvasElement>(null);
   const dragRef = useRef<{ x: number; y: number } | null>(null);
   const [image, setImage] = useState<HTMLImageElement | null>(null);
   const [size, setSize] = useState<ImageSize | null>(null);
   const [loadFailed, setLoadFailed] = useState(false);
   const [zoom, setZoom] = useState(1);
   const [focus, setFocus] = useState({ x: 0.5, y: 0.5 });
   const [exporting, setExporting] = useState(false);
   const [exportError, setExportError] = useState<string | null>(null);

   useEffect(() => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      let cancelled = false;
      img.onload = () => {
         if (cancelled) return;
         setImage(img);
         setSize({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
         if (!cancelled) setLoadFailed(true);
      };
      img.src = url;
      return () => {
         cancelled = true;
         URL.revokeObjectURL(url);
      };
   }, [file]);

   const crop = size ? getCropRect(size, spec.aspectRatio, zoom, focus) : null;
   const selected = crop
      ? { width: Math.round(crop.width), height: Math.round(crop.height) }
      : null;
   const resolutionOk = selected ? meetsMinResolution(selected, spec) : false;

   // Redraw the live preview whenever the crop changes.
   useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !image || !crop) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
         image,
         crop.x,
         crop.y,
         crop.width,
         crop.height,
         0,
         0,
         canvas.width,
         canvas.height
      );
   }, [image, crop?.x, crop?.y, crop?.width, crop?.height]); // eslint-disable-line react-hooks/exhaustive-deps

   const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!dragRef.current || !size || !crop) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const scale = crop.width / rect.width; // screen px -> source px
      const dx = (event.clientX - dragRef.current.x) * scale;
      const dy = (event.clientY - dragRef.current.y) * scale;
      dragRef.current = { x: event.clientX, y: event.clientY };

      // Dragging moves the image, so the focus point moves the opposite way.
      const minX = crop.width / 2 / size.width;
      const minY = crop.height / 2 / size.height;
      setFocus((f) => ({
         x: Math.min(Math.max(f.x - dx / size.width, minX), 1 - minX),
         y: Math.min(Math.max(f.y - dy / size.height, minY), 1 - minY),
      }));
   };

   const handleConfirm = async () => {
      if (!image || !crop || !resolutionOk) return;
      setExporting(true);
      setExportError(null);

      const out = getOutputSize(crop, spec.aspectRatio, spec.maxOutputWidth);
      const canvas = document.createElement("canvas");
      canvas.width = out.width;
      canvas.height = out.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
         setExportError("Your browser could not process this image.");
         setExporting(false);
         return;
      }
      ctx.drawImage(
         image,
         crop.x,
         crop.y,
         crop.width,
         crop.height,
         0,
         0,
         out.width,
         out.height
      );

      const blob = await encodeUnderLimit(canvas);
      setExporting(false);
      if (!blob) {
         setExportError(
            "Could not compress the image under 3 MB. Try zooming in."
         );
         return;
      }
      const ext = PUNISHMENT_PFP_MIME_TO_EXT[blob.type];
      onConfirm(new File([blob], `${purpose}.${ext}`, { type: blob.type }));
   };

   return (
      <Dialog open onOpenChange={(open) => !open && onCancel()}>
         <DialogContent>
            <DialogHeader>
               <DialogTitle>
                  {isBanner ? "Adjust event header" : "Adjust punishment PFP"}
               </DialogTitle>
               <DialogDescription>
                  Drag to reposition and use the slider to zoom. The saved image
                  is cropped to {isBanner ? "5:1" : "1:1"}.
               </DialogDescription>
            </DialogHeader>

            {loadFailed ? (
               <div
                  role="alert"
                  className="flex items-center gap-2 text-xs text-feedback-error-text"
               >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                  This file could not be read as an image.
               </div>
            ) : !image ? (
               <div
                  role="status"
                  aria-label="Loading image"
                  className="aspect-[5/1] w-full animate-pulse rounded-xl bg-surface-nested"
               />
            ) : (
               <div className="space-y-3">
                  <div className={isBanner ? "" : "mx-auto max-w-xs"}>
                     <canvas
                        ref={canvasRef}
                        width={previewWidth}
                        height={previewHeight}
                        aria-label="Crop preview. Drag to reposition."
                        className="h-auto w-full cursor-grab touch-none rounded-xl border border-border-strong"
                        onPointerDown={(e) => {
                           e.currentTarget.setPointerCapture(e.pointerId);
                           dragRef.current = { x: e.clientX, y: e.clientY };
                        }}
                        onPointerMove={handlePointerMove}
                        onPointerUp={() => (dragRef.current = null)}
                        onPointerCancel={() => (dragRef.current = null)}
                     />
                  </div>

                  <input
                     type="range"
                     min={1}
                     max={4}
                     step={0.01}
                     value={zoom}
                     onChange={(e) => setZoom(Number(e.target.value))}
                     aria-label="Zoom"
                     className="w-full"
                  />

                  {selected && (
                     <p
                        className={`flex items-center gap-2 text-xs ${
                           resolutionOk
                              ? "text-text-secondary"
                              : "text-feedback-error-text"
                        }`}
                     >
                        {resolutionOk ? (
                           <CheckCircle2 className="h-4 w-4" aria-hidden />
                        ) : (
                           <AlertCircle className="h-4 w-4" aria-hidden />
                        )}
                        Selected area {selected.width}×{selected.height}px
                        {resolutionOk
                           ? " · resolution OK"
                           : ` · too small, minimum ${spec.minWidth}×${spec.minHeight}px`}
                     </p>
                  )}
               </div>
            )}

            {exportError && (
               <p role="alert" className="text-xs text-feedback-error-text">
                  {exportError}
               </p>
            )}

            <DialogFooter>
               <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={exporting}
               >
                  Cancel
               </Button>
               <Button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={!image || !resolutionOk || exporting}
               >
                  {exporting && (
                     <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden
                     />
                  )}
                  Use image
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
}
