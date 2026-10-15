import { describe, it, expect } from "vitest";
import {
   isRarityEligible,
   getEligibleRarities,
   calculateEffectiveProbabilities,
   RARITY_STUDY_SECOND_THRESHOLDS,
   SECONDS_PER_HOUR,
} from "./study-eligibility";

describe("Study Eligibility Gates (Section 7)", () => {
   it("grants NORMAL, UNCOMMON, RARE, and EPIC eligibility with 0 study hours", () => {
      const zeroSeconds = 0;
      expect(isRarityEligible("NORMAL", zeroSeconds)).toBe(true);
      expect(isRarityEligible("UNCOMMON", zeroSeconds)).toBe(true);
      expect(isRarityEligible("RARE", zeroSeconds)).toBe(true);
      expect(isRarityEligible("EPIC", zeroSeconds)).toBe(true);
      expect(isRarityEligible("LEGENDARY", zeroSeconds)).toBe(false);
      expect(isRarityEligible("MYTHICAL", zeroSeconds)).toBe(false);
   });

   it("strictly enforces 499-hour vs 500-hour boundary for LEGENDARY", () => {
      const hours499Seconds = 499 * SECONDS_PER_HOUR;
      const hours499And59MinSeconds = 500 * SECONDS_PER_HOUR - 1; // 1,799,999s
      const exact500HoursSeconds = 500 * SECONDS_PER_HOUR; // 1,800,000s
      const hours501Seconds = 501 * SECONDS_PER_HOUR;

      // Below 500h
      expect(isRarityEligible("LEGENDARY", hours499Seconds)).toBe(false);
      expect(isRarityEligible("LEGENDARY", hours499And59MinSeconds)).toBe(
         false
      );

      // Exactly 500h
      expect(isRarityEligible("LEGENDARY", exact500HoursSeconds)).toBe(true);

      // Above 500h
      expect(isRarityEligible("LEGENDARY", hours501Seconds)).toBe(true);

      // Still not eligible for Mythical at 500h
      expect(isRarityEligible("MYTHICAL", exact500HoursSeconds)).toBe(false);
   });

   it("strictly enforces 999-hour vs 1000-hour boundary for MYTHICAL", () => {
      const hours999Seconds = 999 * SECONDS_PER_HOUR;
      const hours999And59MinSeconds = 1000 * SECONDS_PER_HOUR - 1; // 3,599,999s
      const exact1000HoursSeconds = 1000 * SECONDS_PER_HOUR; // 3,600,000s
      const hours1001Seconds = 1001 * SECONDS_PER_HOUR;

      // Below 1000h
      expect(isRarityEligible("MYTHICAL", hours999Seconds)).toBe(false);
      expect(isRarityEligible("MYTHICAL", hours999And59MinSeconds)).toBe(false);

      // Exactly 1000h
      expect(isRarityEligible("MYTHICAL", exact1000HoursSeconds)).toBe(true);

      // Above 1000h
      expect(isRarityEligible("MYTHICAL", hours1001Seconds)).toBe(true);
   });

   it("rejects negative or invalid cumulative seconds safely", () => {
      expect(isRarityEligible("NORMAL", -100)).toBe(false);
      expect(isRarityEligible("LEGENDARY", -5000)).toBe(false);
      expect(isRarityEligible("LEGENDARY", NaN as any)).toBe(false);
      expect(isRarityEligible("LEGENDARY", 1.5 as any)).toBe(false);
   });

   it("returns the exact set of eligible rarities per tier", () => {
      const lowTier = getEligibleRarities(100 * SECONDS_PER_HOUR);
      expect(lowTier.has("NORMAL")).toBe(true);
      expect(lowTier.has("UNCOMMON")).toBe(true);
      expect(lowTier.has("RARE")).toBe(true);
      expect(lowTier.has("EPIC")).toBe(true);
      expect(lowTier.has("LEGENDARY")).toBe(false);
      expect(lowTier.has("MYTHICAL")).toBe(false);

      const midTier = getEligibleRarities(500 * SECONDS_PER_HOUR);
      expect(midTier.has("LEGENDARY")).toBe(true);
      expect(midTier.has("MYTHICAL")).toBe(false);

      const masterTier = getEligibleRarities(1000 * SECONDS_PER_HOUR);
      expect(masterTier.has("LEGENDARY")).toBe(true);
      expect(masterTier.has("MYTHICAL")).toBe(true);
   });
});

describe("Effective Probabilities Redistribution (Section 8)", () => {
   const standardRates = {
      NORMAL: 5000, // 50.00%
      UNCOMMON: 3000, // 30.00%
      RARE: 1400, // 14.00%
      EPIC: 500, // 5.00%
      LEGENDARY: 100, // 1.00%
   };

   it("calculates effective rates for a beginner (< 500 hours)", () => {
      const result = calculateEffectiveProbabilities(
         standardRates,
         50 * SECONDS_PER_HOUR
      );

      expect(result.ineligibleRarities).toContain("LEGENDARY");
      expect(result.effectiveRates["LEGENDARY"]).toBe(0);
      expect(result.effectivePercentages["LEGENDARY"]).toBe("0.00%");

      // Sum of eligible rates: 5000 + 3000 + 1400 + 500 = 9900 bps
      expect(result.sumEligibleBasisPoints).toBe(9900);

      // Normal was 5000/9900 = ~50.51%
      expect(result.effectivePercentages["NORMAL"]).toBe("50.51%");
      expect(result.effectivePercentages["UNCOMMON"]).toBe("30.30%");
      expect(result.effectivePercentages["RARE"]).toBe("14.14%");
      expect(result.effectivePercentages["EPIC"]).toBe("5.05%");
   });

   it("preserves exact configured rates for a veteran (>= 500 hours)", () => {
      const result = calculateEffectiveProbabilities(
         standardRates,
         500 * SECONDS_PER_HOUR
      );

      expect(result.ineligibleRarities).toHaveLength(0);
      expect(result.effectiveRates["LEGENDARY"]).toBe(100);
      expect(result.effectivePercentages["LEGENDARY"]).toBe("1.00%");
      expect(result.effectivePercentages["NORMAL"]).toBe("50.00%");
      expect(result.sumEligibleBasisPoints).toBe(10000);
   });
});
