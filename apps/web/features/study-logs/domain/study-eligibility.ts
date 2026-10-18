/**
 * HoldMeToIt — Study Hour Progression & Rarity Eligibility Gates
 * Law L7: Pure domain isolation (zero framework, database, or UI imports).
 * Exact integer seconds arithmetic — zero floating-point rounding errors.
 */

import {
   PokemonRarity,
   isValidPokemonRarity,
} from "@/features/pokemon/domain/pokemon-rarity";

export const SECONDS_PER_HOUR = 3600;

/**
 * Lifetime cumulative study hour thresholds for HoldMeToIt gameplay rarities.
 * Hidden progression requirements:
 * - NORMAL: 0h
 * - UNCOMMON: 0h
 * - RARE: 0h
 * - EPIC: 0h
 * - LEGENDARY: 500h (1,800,000s)
 * - MYTHICAL: 1,000h (3,600,000s)
 */
export const RARITY_STUDY_HOUR_THRESHOLDS: Readonly<
   Record<PokemonRarity, number>
> = Object.freeze({
   NORMAL: 0,
   UNCOMMON: 0,
   RARE: 0,
   EPIC: 0,
   LEGENDARY: 500,
   MYTHICAL: 1000,
});

export const RARITY_STUDY_SECOND_THRESHOLDS: Readonly<
   Record<PokemonRarity, number>
> = Object.freeze({
   NORMAL: 0,
   UNCOMMON: 0,
   RARE: 0,
   EPIC: 0,
   LEGENDARY: 500 * SECONDS_PER_HOUR, // 1,800,000 seconds
   MYTHICAL: 1000 * SECONDS_PER_HOUR, // 3,600,000 seconds
});

/**
 * Returns the exact integer second threshold required for a given gameplay rarity.
 */
export function getRarityStudySecondThreshold(rarity: PokemonRarity): number {
   return RARITY_STUDY_SECOND_THRESHOLDS[rarity] ?? 0;
}

/**
 * Returns the exact integer hour threshold required for a given gameplay rarity.
 */
export function getRarityStudyHourThreshold(rarity: PokemonRarity): number {
   return RARITY_STUDY_HOUR_THRESHOLDS[rarity] ?? 0;
}

/**
 * Evaluates whether a participant with `cumulativeSeconds` of verified study time
 * is eligible to obtain a Pokemon of `rarity`.
 *
 * Exact boundaries:
 * - At 499 hours (1,796,400s) or 499h 59m 59s (1,799,999s) -> LEGENDARY is false
 * - At exactly 500 hours (1,800,000s) -> LEGENDARY is true
 * - At 999 hours (3,596,400s) or 999h 59m 59s (3,599,999s) -> MYTHICAL is false
 * - At exactly 1,000 hours (3,600,000s) -> MYTHICAL is true
 */
export function isRarityEligible(
   rarity: PokemonRarity,
   cumulativeSeconds: number
): boolean {
   if (!Number.isSafeInteger(cumulativeSeconds) || cumulativeSeconds < 0) {
      return false;
   }
   const threshold = getRarityStudySecondThreshold(rarity);
   return cumulativeSeconds >= threshold;
}

/**
 * Returns the set of all PokemonRarity tiers eligible for a participant
 * with `cumulativeSeconds` of verified study time.
 */
export function getEligibleRarities(
   cumulativeSeconds: number
): Set<PokemonRarity> {
   const eligible = new Set<PokemonRarity>();
   const rarities: PokemonRarity[] = [
      "NORMAL",
      "UNCOMMON",
      "RARE",
      "EPIC",
      "LEGENDARY",
      "MYTHICAL",
   ];

   for (const r of rarities) {
      if (isRarityEligible(r, cumulativeSeconds)) {
         eligible.add(r);
      }
   }

   return eligible;
}

export interface EffectiveProbabilitiesResult {
   /** Configured base rates from banner definition (e.g. basis points summing to 10,000) */
   configuredRates: Record<string, number>;
   /** Effective obtainable rates for this participant, normalized over eligible rarities */
   effectiveRates: Record<string, number>;
   /** Formatted effective percentages e.g. "50.51%" */
   effectivePercentages: Record<string, string>;
   /** Rarities the participant is currently eligible to roll */
   eligibleRarities: PokemonRarity[];
   /** Rarities locked due to progression gates */
   ineligibleRarities: PokemonRarity[];
   /** Sum of basis points among eligible rarities */
   sumEligibleBasisPoints: number;
}

/**
 * Calculates effective obtainable probabilities for a participant based on their
 * cumulative eligible study time and a banner's configured basis-point rates.
 *
 * When a participant is ineligible for Legendary (500h) or Mythical (1000h),
 * probability mass is proportionally redistributed across their eligible rarities
 * so that effective probabilities sum to 100.00% without silently substituting rarities.
 */
export function calculateEffectiveProbabilities(
   configuredRates: Record<string, number>,
   cumulativeSeconds: number
): EffectiveProbabilitiesResult {
   const eligibleSet = getEligibleRarities(cumulativeSeconds);
   const eligibleRarities: PokemonRarity[] = [];
   const ineligibleRarities: PokemonRarity[] = [];

   let sumEligibleBasisPoints = 0;

   for (const [rarityStr, rate] of Object.entries(configuredRates)) {
      if (!isValidPokemonRarity(rarityStr)) continue;
      const rarity = rarityStr as PokemonRarity;

      if (eligibleSet.has(rarity)) {
         eligibleRarities.push(rarity);
         if (rate > 0) {
            sumEligibleBasisPoints += rate;
         }
      } else {
         ineligibleRarities.push(rarity);
      }
   }

   const effectiveRates: Record<string, number> = {};
   const effectivePercentages: Record<string, string> = {};

   for (const [rarityStr, rate] of Object.entries(configuredRates)) {
      if (!isValidPokemonRarity(rarityStr)) continue;
      const rarity = rarityStr as PokemonRarity;

      if (
         !eligibleSet.has(rarity) ||
         sumEligibleBasisPoints === 0 ||
         rate <= 0
      ) {
         effectiveRates[rarity] = 0;
         effectivePercentages[rarity] = "0.00%";
      } else {
         // Proportional redistribution: (rate / sumEligibleBasisPoints) * 10,000
         const normalizedBps = Math.round(
            (rate / sumEligibleBasisPoints) * 10000
         );
         effectiveRates[rarity] = normalizedBps;
         const percentage = ((rate / sumEligibleBasisPoints) * 100).toFixed(2);
         effectivePercentages[rarity] = `${percentage}%`;
      }
   }

   return {
      configuredRates,
      effectiveRates,
      effectivePercentages,
      eligibleRarities,
      ineligibleRarities,
      sumEligibleBasisPoints,
   };
}
