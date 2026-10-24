import type { ChallengeImagePurpose } from "./punishment-pfp";

export interface ImageSize {
   width: number;
   height: number;
}

/**
 * Crop rectangle in source-image pixels.
 */
export interface CropRect {
   x: number;
   y: number;
   width: number;
   height: number;
}

export interface ChallengeImageSpec {
   aspectRatio: number;
   minWidth: number;
   minHeight: number;
   maxOutputWidth: number;
}

/**
 * Target shape and resolution limits per upload purpose.
 */
export const CHALLENGE_IMAGE_SPECS: Record<
   ChallengeImagePurpose,
   ChallengeImageSpec
> = {
   "event-banner": {
      aspectRatio: 5,
      minWidth: 1000,
      minHeight: 200,
      maxOutputWidth: 2500,
   },
   "punishment-pfp": {
      aspectRatio: 1,
      minWidth: 256,
      minHeight: 256,
      maxOutputWidth: 1024,
   },
};

/**
 * Whether the source image is large enough to crop without visible blur.
 */
export function meetsMinResolution(
   image: ImageSize,
   spec: ChallengeImageSpec
): boolean {
   return image.width >= spec.minWidth && image.height >= spec.minHeight;
}

function clamp(value: number, min: number, max: number): number {
   return Math.min(Math.max(value, min), max);
}

/**
 * Largest crop of the target aspect ratio inside the image, shrunk by `zoom`
 * (>= 1) and centered on `focus` (0-1 per axis), kept fully inside the image.
 */
export function getCropRect(
   image: ImageSize,
   aspectRatio: number,
   zoom = 1,
   focus: { x: number; y: number } = { x: 0.5, y: 0.5 }
): CropRect {
   const fitWidth = Math.min(image.width, image.height * aspectRatio);
   const width = fitWidth / Math.max(1, zoom);
   const height = width / aspectRatio;

   return {
      x: clamp(focus.x * image.width - width / 2, 0, image.width - width),
      y: clamp(focus.y * image.height - height / 2, 0, image.height - height),
      width,
      height,
   };
}

/**
 * Exported pixel size: capped at `maxOutputWidth`, never upscaled.
 */
export function getOutputSize(
   crop: CropRect,
   aspectRatio: number,
   maxOutputWidth: number
): ImageSize {
   const width = Math.round(Math.min(crop.width, maxOutputWidth));
   return { width, height: Math.round(width / aspectRatio) };
}
