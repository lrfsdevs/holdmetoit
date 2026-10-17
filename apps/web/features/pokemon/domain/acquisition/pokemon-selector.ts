/**
 * HoldMeToIt — Server-Side Pokemon Selection Engine
 * Law L7: Pure domain isolation.
 * Uses Node.js crypto.randomInt (CSPRNG) by default to prevent client manipulation.
 * Supports dependency-injected RandomSource for deterministic unit testing.
 */

import { randomInt } from "node:crypto";
import { PokemonRarity, isValidPokemonRarity } from "../pokemon-rarity";
import { PokemonSpeciesWithCounts } from "../../data/pokemon-catalogue.repository";
import { PityEvaluationResult } from "./pity-engine";
import { TOTAL_BASIS_POINTS } from "./banner-config";
import { calculateEffectiveProbabilities } from "@/features/study-logs/domain/study-eligibility";

export type RandomSource = (maxExclusive: number) => number;

/** Default cryptographically secure pseudo-random number generator (CSPRNG) */
export const defaultCsprng: RandomSource = (maxExclusive: number) => {
   if (maxExclusive <= 1) return 0;
   return randomInt(0, maxExclusive);
};

export class EmptyRarityPoolError extends Error {
   readonly code = "EMPTY_RARITY_POOL";
   constructor(rarity: string) {
      super(
         `No eligible Pokemon found in catalogue pool for rarity: ${rarity}`
      );
      this.name = "EmptyRarityPoolError";
   }
}

export class SelectionEngineError extends Error {
   readonly code = "SELECTION_ENGINE_ERROR";
   constructor(message: string) {
      super(message);
      this.name = "SelectionEngineError";
   }
}

export interface SelectPokemonParams {
   eligiblePool: PokemonSpeciesWithCounts[];
   rarityRates: Record<string, number>;
   featuredSpeciesId?: string | null;
   pityEvaluation: PityEvaluationResult;
   randomSource?: RandomSource;
   cumulativeStudySeconds?: number;
}

export interface SelectionResult {
   selectedSpecies: PokemonSpeciesWithCounts;
   rarity: PokemonRarity;
   isFeatured: boolean;
   pityTriggered: boolean;
}

/**
 * Authoritatively rolls and selects a Pokemon according to banner probabilities, pity, and featured guarantees.
 */
export function selectPokemon(params: SelectPokemonParams): SelectionResult {
   const {
      eligiblePool,
      rarityRates,
      featuredSpeciesId,
      pityEvaluation,
      randomSource = defaultCsprng,
      cumulativeStudySeconds,
   } = params;

   if (!eligiblePool || eligiblePool.length === 0) {
      throw new SelectionEngineError("Eligible Pokemon pool cannot be empty.");
   }

   // Calculate effective rates taking into account study-hour eligibility (Section 8)
   const effectiveRates =
      cumulativeStudySeconds !== undefined
         ? calculateEffectiveProbabilities(rarityRates, cumulativeStudySeconds)
              .effectiveRates
         : rarityRates;

   // 1. Determine target rarity
   let targetRarity: PokemonRarity;

   if (pityEvaluation.pityTriggered && pityEvaluation.guaranteedRarity) {
      targetRarity = pityEvaluation.guaranteedRarity;
   } else {
      // Roll against basis-point probability table [0, 9999]
      const roll = randomSource(TOTAL_BASIS_POINTS);
      let cumulative = 0;
      let selectedRateRarity: PokemonRarity | null = null;

      for (const [rarityStr, rate] of Object.entries(effectiveRates)) {
         if (rate > 0) {
            cumulative += rate;
            if (roll < cumulative) {
               selectedRateRarity = rarityStr as PokemonRarity;
               break;
            }
         }
      }

      if (!selectedRateRarity) {
         // Fallback: use first rarity with positive rate
         const available = Object.keys(effectiveRates).find(
            (k) => (effectiveRates[k] ?? 0) > 0
         );
         selectedRateRarity = (available as PokemonRarity) || "NORMAL";
      }

      targetRarity = selectedRateRarity;
   }

   // 2. Filter pool by target rarity
   const poolByRarity = eligiblePool.filter((sp) => sp.rarity === targetRarity);
   if (poolByRarity.length === 0) {
      throw new EmptyRarityPoolError(targetRarity);
   }

   // 3. Featured check
   let isFeatured = false;
   let selectedSpecies: PokemonSpeciesWithCounts;

   const featuredInPool = featuredSpeciesId
      ? poolByRarity.find((sp) => sp.id === featuredSpeciesId)
      : null;

   if (featuredInPool) {
      // If guaranteed featured applies
      if (pityEvaluation.guaranteedFeatured) {
         isFeatured = true;
         selectedSpecies = featuredInPool;
      } else {
         // 50/50 roll for featured
         const roll5050 = randomSource(100);
         if (roll5050 < 50) {
            isFeatured = true;
            selectedSpecies = featuredInPool;
         } else {
            // Lost 50/50: pick from remaining species in pool
            const nonFeatured = poolByRarity.filter(
               (sp) => sp.id !== featuredSpeciesId
            );
            if (nonFeatured.length > 0) {
               const idx = randomSource(nonFeatured.length);
               selectedSpecies = nonFeatured[idx]!;
            } else {
               // If featured is the only species in this rarity, we must return it
               isFeatured = true;
               selectedSpecies = featuredInPool;
            }
         }
      }
   } else {
      // Standard uniform selection across matching rarity species
      const idx = randomSource(poolByRarity.length);
      selectedSpecies = poolByRarity[idx]!;
   }

   return {
      selectedSpecies,
      rarity: targetRarity,
      isFeatured,
      pityTriggered: pityEvaluation.pityTriggered,
   };
}
