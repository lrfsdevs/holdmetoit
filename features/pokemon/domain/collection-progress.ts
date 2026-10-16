/**
 * HoldMeToIt — Pokemon Collection Progress Domain Logic
 * Pure domain logic (Law L7: Pure Domain Isolation, zero framework/ORM imports).
 */

export interface CollectionProgressResult {
   uniqueOwnedCount: number;
   totalAvailableCount: number;
   totalInstancesCount: number;
   completionPercentage: number;
   tier: "NOVICE" | "COLLECTOR" | "MASTER" | "CHAMPION";
}

/**
 * Calculates collection progress metrics safely.
 * Only available species in the catalogue form the denominator.
 * Protects against division by zero and clamps percentage to [0, 100].
 */
export function calculateCollectionProgress(
   uniqueOwnedCount: number,
   totalAvailableCount: number,
   totalInstancesCount: number = uniqueOwnedCount
): CollectionProgressResult {
   const safeUnique = Math.max(0, Math.floor(uniqueOwnedCount));
   const safeAvailable = Math.max(0, Math.floor(totalAvailableCount));
   const safeInstances = Math.max(0, Math.floor(totalInstancesCount));

   if (safeAvailable === 0) {
      return {
         uniqueOwnedCount: safeUnique,
         totalAvailableCount: 0,
         totalInstancesCount: safeInstances,
         completionPercentage: 0,
         tier: "NOVICE",
      };
   }

   // Calculate percentage, capped at 100%, rounded to 1 decimal place
   const rawRatio = safeUnique / safeAvailable;
   const rawPct = Math.min(100, Math.max(0, rawRatio * 100));
   const completionPercentage = Math.round(rawPct * 10) / 10;

   let tier: CollectionProgressResult["tier"] = "NOVICE";
   if (completionPercentage >= 100) {
      tier = "CHAMPION";
   } else if (completionPercentage >= 75) {
      tier = "MASTER";
   } else if (completionPercentage >= 35) {
      tier = "COLLECTOR";
   }

   return {
      uniqueOwnedCount: safeUnique,
      totalAvailableCount: safeAvailable,
      totalInstancesCount: safeInstances,
      completionPercentage,
      tier,
   };
}

/**
 * Filters and sorts collection or catalogue items cleanly.
 */
export interface PokemonFilterCriteria {
   search?: string;
   rarity?: string;
   type?: string;
   generation?: number;
   ownership?: "ALL" | "OWNED" | "UNOWNED";
   sortBy?: "pokedex" | "name" | "rarity_desc" | "rarity_asc" | "recent";
}
