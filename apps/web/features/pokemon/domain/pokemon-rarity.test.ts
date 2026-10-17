import { describe, expect, it } from "vitest";
import {
   compareRarity,
   getPokemonRarityConfig,
   isValidPokemonRarity,
   POKEMON_RARITIES,
   POKEMON_RARITY_CONFIGS,
} from "./pokemon-rarity";

describe("Pokemon Rarity Domain", () => {
   it("defines the 6 approved rarity tiers in correct order", () => {
      expect(POKEMON_RARITIES).toEqual([
         "NORMAL",
         "UNCOMMON",
         "RARE",
         "EPIC",
         "LEGENDARY",
         "MYTHICAL",
      ]);
   });

   it("assigns strictly increasing ranks from 1 to 6", () => {
      POKEMON_RARITIES.forEach((rarity, idx) => {
         expect(POKEMON_RARITY_CONFIGS[rarity].rank).toBe(idx + 1);
         expect(POKEMON_RARITY_CONFIGS[rarity].stars).toBe(idx + 1);
      });
   });

   it("validates valid and invalid rarity strings", () => {
      expect(isValidPokemonRarity("NORMAL")).toBe(true);
      expect(isValidPokemonRarity("MYTHICAL")).toBe(true);
      expect(isValidPokemonRarity("LEGENDARY")).toBe(true);
      expect(isValidPokemonRarity("INVALID")).toBe(false);
      expect(isValidPokemonRarity("")).toBe(false);
      expect(isValidPokemonRarity(null)).toBe(false);
      expect(isValidPokemonRarity(undefined)).toBe(false);
      expect(isValidPokemonRarity(123)).toBe(false);
   });

   it("sorts rarities descending (highest rarity first)", () => {
      const list = [...POKEMON_RARITIES].reverse(); // MYTHICAL ... NORMAL
      const sorted = [...list].sort((a, b) => compareRarity(a, b, "desc"));
      expect(sorted[0]).toBe("MYTHICAL");
      expect(sorted[1]).toBe("LEGENDARY");
      expect(sorted[2]).toBe("EPIC");
      expect(sorted[3]).toBe("RARE");
      expect(sorted[4]).toBe("UNCOMMON");
      expect(sorted[5]).toBe("NORMAL");
   });

   it("sorts rarities ascending (lowest rarity first)", () => {
      const list = [...POKEMON_RARITIES];
      const sorted = [...list].sort((a, b) => compareRarity(a, b, "asc"));
      expect(sorted[0]).toBe("NORMAL");
      expect(sorted[5]).toBe("MYTHICAL");
   });

   it("returns fallback NORMAL config on invalid or unknown rarity input", () => {
      expect(getPokemonRarityConfig("UNKNOWN").rarity).toBe("NORMAL");
      expect(getPokemonRarityConfig(null).rarity).toBe("NORMAL");
      expect(getPokemonRarityConfig("EPIC").rarity).toBe("EPIC");
   });

   it("contains indicative prices for future planning without modifying wallet balances", () => {
      expect(POKEMON_RARITY_CONFIGS.NORMAL.indicativePrice).toBe(10_000);
      expect(POKEMON_RARITY_CONFIGS.UNCOMMON.indicativePrice).toBe(50_000);
      expect(POKEMON_RARITY_CONFIGS.RARE.indicativePrice).toBe(100_000);
      expect(POKEMON_RARITY_CONFIGS.EPIC.indicativePrice).toBe(250_000);
      expect(POKEMON_RARITY_CONFIGS.LEGENDARY.indicativePrice).toBe(500_000);
      expect(POKEMON_RARITY_CONFIGS.MYTHICAL.indicativePrice).toBe(1_000_000);
   });
});
