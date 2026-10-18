import { describe, expect, it } from "vitest";
import {
   getPokemonTypeConfig,
   isValidPokemonType,
   POKEMON_ELEMENTAL_TYPES,
   POKEMON_TYPE_CONFIGS,
} from "./pokemon-types";

describe("Pokemon Elemental Types Domain", () => {
   it("includes all 18 official elemental types", () => {
      expect(POKEMON_ELEMENTAL_TYPES.length).toBe(18);
      expect(POKEMON_ELEMENTAL_TYPES).toContain("FIRE");
      expect(POKEMON_ELEMENTAL_TYPES).toContain("WATER");
      expect(POKEMON_ELEMENTAL_TYPES).toContain("GRASS");
      expect(POKEMON_ELEMENTAL_TYPES).toContain("DRAGON");
      expect(POKEMON_ELEMENTAL_TYPES).toContain("FAIRY");
   });

   it("has config for every elemental type", () => {
      POKEMON_ELEMENTAL_TYPES.forEach((type) => {
         const config = POKEMON_TYPE_CONFIGS[type];
         expect(config).toBeDefined();
         expect(config.label).toBeDefined();
         expect(config.textColor).toBeDefined();
         expect(config.badgeBg).toBeDefined();
      });
   });

   it("validates type strings case-insensitively", () => {
      expect(isValidPokemonType("FIRE")).toBe(true);
      expect(isValidPokemonType("fire")).toBe(true);
      expect(isValidPokemonType("Water")).toBe(true);
      expect(isValidPokemonType("UNKNOWN")).toBe(false);
      expect(isValidPokemonType(null)).toBe(false);
      expect(isValidPokemonType(undefined)).toBe(false);
   });

   it("returns null for invalid types in getPokemonTypeConfig", () => {
      expect(getPokemonTypeConfig(null)).toBeNull();
      expect(getPokemonTypeConfig("")).toBeNull();
      expect(getPokemonTypeConfig("INVALID")).toBeNull();
      expect(getPokemonTypeConfig("GRASS")?.label).toBe("Grass");
   });
});
