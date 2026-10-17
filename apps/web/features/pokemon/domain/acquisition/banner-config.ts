/**
 * HoldMeToIt — Pokemon Banner Configuration & Validation Engine
 * Law L7: Pure domain isolation (zero framework, database, or UI imports).
 */

import { PokemonRarity, isValidPokemonRarity } from "../pokemon-rarity";

export const TOTAL_BASIS_POINTS = 10000; // 100.00% precision

export type BannerStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED" | "DISABLED";

export interface PityConfig {
   hardPityThreshold: number; // e.g. 50 pulls
   targetRarity: PokemonRarity; // e.g. LEGENDARY
   resetOnRarities: PokemonRarity[]; // e.g. ["LEGENDARY", "MYTHICAL"]
   resetRarities?: PokemonRarity[]; // Optional alias for resetOnRarities
   featuredGuarantee?: boolean; // 50/50 mechanic if featured species exists
}

export interface BannerPoolFilter {
   generations?: number[];
   primaryTypes?: string[];
   rarities?: PokemonRarity[];
   includedSpeciesIds?: string[];
   excludedSpeciesIds?: string[];
}

export type DuplicatePolicy = "ADD_COPY" | "COIN_COMPENSATION" | "DISALLOW";

export interface BannerConfig {
   id?: string;
   name: string;
   slug: string;
   description: string;
   bannerType?: string;
   status: BannerStatus;
   startAt: Date | string;
   endAt?: Date | string | null;
   pullCost: number; // in HoldMeToIt Coins
   allowedQuantities?: number[];
   version?: number;
   featuredSpeciesId?: string | null;
   rarityRates: Record<string, number>; // Rarity -> basis points (0..10000)
   poolFilter?: BannerPoolFilter | null;
   pityConfig?: PityConfig | null;
   duplicatePolicy?: DuplicatePolicy;
}

export class InvalidBannerConfigError extends Error {
   readonly code = "INVALID_BANNER_CONFIG";
   readonly validationErrors: string[];

   constructor(errors: string[]) {
      super(`Invalid Banner Configuration: ${errors.join("; ")}`);
      this.name = "InvalidBannerConfigError";
      this.validationErrors = errors;
   }
}

/**
 * Validates a banner configuration.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
export function validateBannerConfig(config: BannerConfig): {
   valid: boolean;
   errors: string[];
} {
   const errors: string[] = [];

   // 1. Basic text fields
   if (!config.name || typeof config.name !== "string" || !config.name.trim()) {
      errors.push("Banner name is required.");
   } else if (config.name.length > 128) {
      errors.push("Banner name cannot exceed 128 characters.");
   }

   if (!config.slug || typeof config.slug !== "string" || !config.slug.trim()) {
      errors.push("Banner slug is required.");
   } else if (!/^[a-z0-9-]+$/.test(config.slug)) {
      errors.push(
         "Banner slug must contain only lowercase alphanumeric characters and hyphens."
      );
   }

   // 2. Financial pull cost
   if (
      typeof config.pullCost !== "number" ||
      !Number.isSafeInteger(config.pullCost) ||
      config.pullCost <= 0
   ) {
      errors.push(
         `Pull cost must be a positive integer (received: ${config.pullCost}).`
      );
   }

   // 3. Status and timestamps
   const validStatuses: BannerStatus[] = [
      "DRAFT",
      "ACTIVE",
      "PAUSED",
      "ENDED",
      "DISABLED",
   ];
   if (!validStatuses.includes(config.status)) {
      errors.push(`Invalid banner status: ${config.status}`);
   }

   const startDate = new Date(config.startAt);
   if (isNaN(startDate.getTime())) {
      errors.push("Valid startAt timestamp is required.");
   }

   if (config.endAt) {
      const endDate = new Date(config.endAt);
      if (isNaN(endDate.getTime())) {
         errors.push("Invalid endAt timestamp.");
      } else if (endDate <= startDate) {
         errors.push(
            "endAt timestamp must be strictly after startAt timestamp."
         );
      }
   }

   // 4. Probability basis points validation
   if (!config.rarityRates || typeof config.rarityRates !== "object") {
      errors.push("rarityRates object is required.");
   } else {
      let totalBasisPoints = 0;
      for (const [rarity, rate] of Object.entries(config.rarityRates)) {
         if (!isValidPokemonRarity(rarity)) {
            errors.push(`Invalid rarity in rates table: ${rarity}`);
         }
         if (
            typeof rate !== "number" ||
            !Number.isSafeInteger(rate) ||
            rate < 0
         ) {
            errors.push(
               `Rate for ${rarity} must be a non-negative integer (received: ${rate}).`
            );
         } else {
            totalBasisPoints += rate;
         }
      }

      if (totalBasisPoints !== TOTAL_BASIS_POINTS) {
         errors.push(
            `Total rarity probability must sum to exactly ${TOTAL_BASIS_POINTS} basis points (100.00%). Current total: ${totalBasisPoints}.`
         );
      }
   }

   // 5. Pity configuration validation
   if (config.pityConfig) {
      const { hardPityThreshold, targetRarity, resetOnRarities } =
         config.pityConfig;
      if (
         typeof hardPityThreshold !== "number" ||
         !Number.isSafeInteger(hardPityThreshold) ||
         hardPityThreshold <= 0
      ) {
         errors.push(
            `Pity hard threshold must be a positive integer (received: ${hardPityThreshold}).`
         );
      }

      if (!targetRarity || !isValidPokemonRarity(targetRarity)) {
         errors.push(`Pity targetRarity is invalid: ${targetRarity}`);
      }

      if (!Array.isArray(resetOnRarities) || resetOnRarities.length === 0) {
         errors.push(
            "Pity resetOnRarities must be a non-empty array of rarities."
         );
      } else {
         for (const r of resetOnRarities) {
            if (!isValidPokemonRarity(r)) {
               errors.push(`Invalid rarity in pity resetOnRarities: ${r}`);
            }
         }
      }
   }

   // 6. Allowed quantities
   if (config.allowedQuantities) {
      if (
         !Array.isArray(config.allowedQuantities) ||
         config.allowedQuantities.length === 0
      ) {
         errors.push(
            "allowedQuantities must be a non-empty array of integers."
         );
      } else {
         for (const q of config.allowedQuantities) {
            if (!Number.isSafeInteger(q) || q <= 0) {
               errors.push(
                  `Allowed pull quantity must be a positive integer (received: ${q}).`
               );
            }
         }
      }
   }

   return {
      valid: errors.length === 0,
      errors,
   };
}

/**
 * Asserts that a banner configuration is valid, throwing an explicit domain error if not.
 */
export function assertValidBannerConfig(config: BannerConfig): void {
   const result = validateBannerConfig(config);
   if (!result.valid) {
      throw new InvalidBannerConfigError(result.errors);
   }
}

/**
 * Evaluates whether a banner is currently active and eligible for pulls at timestamp `now`.
 */
export function isBannerActiveNow(
   banner: {
      status: BannerStatus | string;
      startAt: Date | string;
      endAt?: Date | string | null;
   },
   now: Date = new Date()
): boolean {
   if (banner.status !== "ACTIVE") {
      return false;
   }

   const currentTime = now.getTime();
   const startTime = new Date(banner.startAt).getTime();

   if (currentTime < startTime) {
      return false;
   }

   if (banner.endAt) {
      const endTime = new Date(banner.endAt).getTime();
      if (currentTime > endTime) {
         return false;
      }
   }

   return true;
}
