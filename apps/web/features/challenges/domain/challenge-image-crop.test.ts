import { describe, expect, it } from "vitest";
import {
   CHALLENGE_IMAGE_SPECS,
   getCropRect,
   getOutputSize,
   meetsMinResolution,
} from "@/features/challenges/domain/challenge-image-crop";

describe("meetsMinResolution", () => {
   const banner = CHALLENGE_IMAGE_SPECS["event-banner"];

   it("accepts images at or above the minimum", () => {
      expect(meetsMinResolution({ width: 1500, height: 300 }, banner)).toBe(
         true
      );
   });

   it("rejects images below the minimum on either side", () => {
      expect(meetsMinResolution({ width: 999, height: 900 }, banner)).toBe(
         false
      );
      expect(meetsMinResolution({ width: 3000, height: 199 }, banner)).toBe(
         false
      );
   });
});

describe("getCropRect", () => {
   it("takes the centered 5:1 strip of a square image", () => {
      expect(getCropRect({ width: 1000, height: 1000 }, 5)).toEqual({
         x: 0,
         y: 400,
         width: 1000,
         height: 200,
      });
   });

   it("uses the full height of an already-wide image", () => {
      expect(getCropRect({ width: 4000, height: 400 }, 5)).toEqual({
         x: 1000,
         y: 0,
         width: 2000,
         height: 400,
      });
   });

   it("halves the crop size at 2x zoom", () => {
      const crop = getCropRect({ width: 1000, height: 1000 }, 1, 2);
      expect(crop.width).toBe(500);
      expect(crop.height).toBe(500);
   });

   it("keeps the crop inside the image at the extremes", () => {
      const topLeft = getCropRect({ width: 1000, height: 1000 }, 1, 2, {
         x: 0,
         y: 0,
      });
      expect(topLeft).toMatchObject({ x: 0, y: 0 });

      const bottomRight = getCropRect({ width: 1000, height: 1000 }, 1, 2, {
         x: 1,
         y: 1,
      });
      expect(bottomRight).toMatchObject({ x: 500, y: 500 });
   });

   it("treats zoom below 1 as 1", () => {
      expect(getCropRect({ width: 1000, height: 1000 }, 1, 0.5).width).toBe(
         1000
      );
   });
});

describe("getOutputSize", () => {
   it("caps wide crops at the maximum output width", () => {
      const crop = { x: 0, y: 0, width: 4000, height: 800 };
      expect(getOutputSize(crop, 5, 2500)).toEqual({
         width: 2500,
         height: 500,
      });
   });

   it("never upscales small crops", () => {
      const crop = { x: 0, y: 0, width: 800, height: 800 };
      expect(getOutputSize(crop, 1, 1024)).toEqual({ width: 800, height: 800 });
   });
});
