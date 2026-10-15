/**
 * HoldMeToIt — Pity Engine (Pure Domain Logic)
 * Law L7: Zero framework, DB, or UI imports. Fast, isolated mathematical calculations.
 */

import { PokemonRarity } from "../pokemon-rarity";
import { PityConfig } from "./banner-config";
import { isRarityEligible } from "@/features/study-logs/domain/study-eligibility";

export interface PityState {
   pityCount: number;
   guaranteedFeatured: boolean;
}

export interface PityEvaluationResult {
   pityTriggered: boolean;
   guaranteedRarity: PokemonRarity | null;
   guaranteedFeatured: boolean;
}

/**
 * Evaluates whether hard pity or guaranteed featured status triggers for the upcoming pull.
 * If pityConfig is null or undefined, pity is not active for this banner.
 * Law: A pity guarantee must NEVER bypass study-hour eligibility (Section 11.1).
 */
export function evaluatePity(params: {
   currentPityCount: number;
   guaranteedFeatured: boolean;
   pityConfig?: PityConfig | null;
   cumulativeStudySeconds?: number;
   eligibleRarities?: Set<PokemonRarity> | PokemonRarity[];
}): PityEvaluationResult {
   const {
      currentPityCount,
      guaranteedFeatured,
      pityConfig,
      cumulativeStudySeconds,
      eligibleRarities,
   } = params;

   if (!pityConfig) {
      return {
         pityTriggered: false,
         guaranteedRarity: null,
         guaranteedFeatured: false,
      };
   }

   // Check if current pull reaches or exceeds the hard pity threshold (pityCount is 0-indexed before the pull)
   const isHardPity = currentPityCount + 1 >= pityConfig.hardPityThreshold;

   // Validate study-hour eligibility for target rarity
   let isTargetEligible = true;
   if (eligibleRarities) {
      isTargetEligible =
         eligibleRarities instanceof Set
            ? eligibleRarities.has(pityConfig.targetRarity)
            : eligibleRarities.includes(pityConfig.targetRarity);
   } else if (cumulativeStudySeconds !== undefined) {
      isTargetEligible = isRarityEligible(
         pityConfig.targetRarity,
         cumulativeStudySeconds
      );
   }

   if (isHardPity && isTargetEligible) {
      return {
         pityTriggered: true,
         guaranteedRarity: pityConfig.targetRarity,
         guaranteedFeatured: pityConfig.featuredGuarantee
            ? guaranteedFeatured
            : false,
      };
   }

   return {
      pityTriggered: false,
      guaranteedRarity: null,
      guaranteedFeatured: pityConfig.featuredGuarantee
         ? guaranteedFeatured
         : false,
   };
}

/**
 * Calculates the next pity state after a pull outcome.
 *
 * Rules:
 * 1. If pity was triggered OR the rolled rarity matches one of the resetOnRarities,
 *    pityCount resets to 0.
 * 2. If the user reached hard pity threshold but was ineligible, their pity count is
 *    preserved at hardPityThreshold - 1 so progress is never lost.
 * 3. Otherwise, pityCount increments by 1.
 * 4. If featuredGuarantee is active:
 *    - If the rolled rarity is targetRarity:
 *      - If wasFeaturedPulled is true, guaranteedFeatured resets to false.
 *      - If wasFeaturedPulled is false (lost 50/50), guaranteedFeatured becomes true for next time.
 *    - If rolled rarity was not targetRarity, guaranteedFeatured remains unchanged.
 */
export function calculateNextPityState(params: {
   previousPityCount: number;
   previousGuaranteedFeatured: boolean;
   rolledRarity: PokemonRarity;
   wasFeaturedPulled: boolean;
   pityConfig?: PityConfig | null;
   pityTriggered?: boolean;
}): PityState {
   const {
      previousPityCount,
      previousGuaranteedFeatured,
      rolledRarity,
      wasFeaturedPulled,
      pityConfig,
      pityTriggered = false,
   } = params;

   if (!pityConfig) {
      return {
         pityCount: 0,
         guaranteedFeatured: false,
      };
   }

   // 1. Determine if pity resets or increments
   const shouldReset =
      pityConfig.resetOnRarities.includes(rolledRarity) ||
      (pityTriggered && rolledRarity === pityConfig.targetRarity);

   let nextPityCount: number;
   if (shouldReset) {
      nextPityCount = 0;
   } else if (previousPityCount + 1 >= pityConfig.hardPityThreshold) {
      // Hold at threshold - 1 while target rarity is locked so progress is preserved
      nextPityCount = pityConfig.hardPityThreshold - 1;
   } else {
      nextPityCount = previousPityCount + 1;
   }

   // 2. Determine next guaranteedFeatured state
   let nextGuaranteedFeatured = previousGuaranteedFeatured;

   if (
      pityConfig.featuredGuarantee &&
      rolledRarity === pityConfig.targetRarity
   ) {
      if (wasFeaturedPulled) {
         // Won 50/50 or redeemed guarantee
         nextGuaranteedFeatured = false;
      } else {
         // Lost 50/50; next time target rarity is rolled, featured is guaranteed
         nextGuaranteedFeatured = true;
      }
   }

   return {
      pityCount: nextPityCount,
      guaranteedFeatured: nextGuaranteedFeatured,
   };
}
