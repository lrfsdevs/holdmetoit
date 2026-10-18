import { describe, expect, it } from "vitest";
import { calculateCollectionProgress } from "./collection-progress";

describe("Collection Progress Domain Logic", () => {
   it("handles empty catalogue (0 available) safely without division by zero", () => {
      const result = calculateCollectionProgress(0, 0);
      expect(result.completionPercentage).toBe(0);
      expect(result.uniqueOwnedCount).toBe(0);
      expect(result.totalAvailableCount).toBe(0);
      expect(result.tier).toBe("NOVICE");
   });

   it("handles 0 unique owned with available catalogue items", () => {
      const result = calculateCollectionProgress(0, 50);
      expect(result.completionPercentage).toBe(0);
      expect(result.uniqueOwnedCount).toBe(0);
      expect(result.totalAvailableCount).toBe(50);
      expect(result.tier).toBe("NOVICE");
   });

   it("calculates accurate percentage rounded to 1 decimal place", () => {
      const result = calculateCollectionProgress(1, 3);
      // 1 / 3 = 33.333% -> 33.3%
      expect(result.completionPercentage).toBe(33.3);
      expect(result.tier).toBe("NOVICE");
   });

   it("assigns COLLECTOR tier at 35%+", () => {
      const result = calculateCollectionProgress(18, 50); // 36%
      expect(result.completionPercentage).toBe(36);
      expect(result.tier).toBe("COLLECTOR");
   });

   it("assigns MASTER tier at 75%+", () => {
      const result = calculateCollectionProgress(75, 100); // 75%
      expect(result.completionPercentage).toBe(75);
      expect(result.tier).toBe("MASTER");
   });

   it("assigns CHAMPION tier at 100%", () => {
      const result = calculateCollectionProgress(100, 100);
      expect(result.completionPercentage).toBe(100);
      expect(result.tier).toBe("CHAMPION");
   });

   it("clamps percentage to 100% even if unique owned exceeds available", () => {
      const result = calculateCollectionProgress(105, 100);
      expect(result.completionPercentage).toBe(100);
      expect(result.tier).toBe("CHAMPION");
   });

   it("handles negative numbers defensively by clamping to 0", () => {
      const result = calculateCollectionProgress(-5, 20);
      expect(result.uniqueOwnedCount).toBe(0);
      expect(result.completionPercentage).toBe(0);
   });

   it("tracks totalInstancesCount alongside uniqueOwnedCount", () => {
      const result = calculateCollectionProgress(10, 50, 25);
      expect(result.uniqueOwnedCount).toBe(10);
      expect(result.totalInstancesCount).toBe(25);
      expect(result.totalAvailableCount).toBe(50);
      expect(result.completionPercentage).toBe(20);
   });
});
