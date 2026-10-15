/**
 * HoldMeToIt — Pokemon Bundle Importer Unit Tests
 * Law L7: Pure Domain Isolation & Test Coverage.
 */

import { describe, it, expect } from "vitest";
import {
   parsePokemonBundle,
   runPokemonBundleImport,
   RawPokemonBundleItem,
} from "./pokemon-bundle-importer";
import { calculateHoldMeToItRarity } from "../domain/pokemon-rarity";

const mockSampleRawItems: RawPokemonBundleItem[] = [
   // 1. Bulbasaur (Default Form, Gen 1, BST 318 -> NORMAL)
   {
      pokemon_id: 1,
      pokemon_name: "Bulbasaur",
      pokemon_slug: "bulbasaur",
      species_id: 1,
      species_name: "Bulbasaur",
      genus: "Seed Pokémon",
      is_default_form: true,
      generation_id: 1,
      types: ["grass", "poison"],
      type_1: "grass",
      type_2: "poison",
      abilities: [{ name: "overgrow", is_hidden: false, slot: 1 }],
      base_stats: { hp: 45, attack: 49, defense: 49 },
      hp: 45,
      attack: 49,
      defense: 49,
      special_attack: 65,
      special_defense: 65,
      speed: 45,
      base_stat_total: 318,
      height_decimetres: 7,
      weight_hectograms: 69,
      base_experience: 64,
      color: "green",
      capture_rate: 45,
      base_happiness: 70,
      hatch_counter: 20,
      is_baby: false,
      is_legendary: false,
      is_mythical: false,
      evolves_from_species_id: null,
      evolution_chain_id: 1,
      growth_rate_id: 4,
      sprite_gif_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/1.gif",
      sprite_png_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png",
      official_artwork_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png",
   },
   // 2. Ivysaur (Default Form, Gen 1, BST 405 -> UNCOMMON)
   {
      pokemon_id: 2,
      pokemon_name: "Ivysaur",
      pokemon_slug: "ivysaur",
      species_id: 2,
      species_name: "Ivysaur",
      genus: "Seed Pokémon",
      is_default_form: true,
      generation_id: 1,
      types: ["grass", "poison"],
      type_1: "grass",
      type_2: "poison",
      abilities: [{ name: "overgrow", is_hidden: false, slot: 1 }],
      base_stats: { hp: 60, attack: 62, defense: 63 },
      hp: 60,
      attack: 62,
      defense: 63,
      special_attack: 80,
      special_defense: 80,
      speed: 60,
      base_stat_total: 405,
      height_decimetres: 10,
      weight_hectograms: 130,
      base_experience: 142,
      color: "green",
      capture_rate: 45,
      base_happiness: 70,
      hatch_counter: 20,
      is_baby: false,
      is_legendary: false,
      is_mythical: false,
      evolves_from_species_id: 1,
      evolution_chain_id: 1,
      growth_rate_id: 4,
      sprite_gif_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/2.gif",
      sprite_png_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/2.png",
      official_artwork_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/2.png",
   },
   // 3. Venusaur (Default Form, Gen 1, BST 525 -> RARE)
   {
      pokemon_id: 3,
      pokemon_name: "Venusaur",
      pokemon_slug: "venusaur",
      species_id: 3,
      species_name: "Venusaur",
      genus: "Seed Pokémon",
      is_default_form: true,
      generation_id: 1,
      types: ["grass", "poison"],
      type_1: "grass",
      type_2: "poison",
      abilities: [{ name: "overgrow", is_hidden: false, slot: 1 }],
      base_stats: { hp: 80, attack: 82, defense: 83 },
      hp: 80,
      attack: 82,
      defense: 83,
      special_attack: 100,
      special_defense: 100,
      speed: 80,
      base_stat_total: 525,
      height_decimetres: 20,
      weight_hectograms: 1000,
      base_experience: 263,
      color: "green",
      capture_rate: 45,
      base_happiness: 70,
      hatch_counter: 20,
      is_baby: false,
      is_legendary: false,
      is_mythical: false,
      evolves_from_species_id: 2,
      evolution_chain_id: 1,
      growth_rate_id: 4,
      sprite_gif_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/3.gif",
      sprite_png_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/3.png",
      official_artwork_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/3.png",
   },
   // 4. Mega Venusaur (Alternate Form for species 3, is_default_form: false, BST 625)
   {
      pokemon_id: 10033,
      pokemon_name: "Venusaur Mega",
      pokemon_slug: "venusaur-mega",
      species_id: 3,
      species_name: "Venusaur",
      genus: "Seed Pokémon",
      is_default_form: false,
      generation_id: 1,
      types: ["grass", "poison"],
      type_1: "grass",
      type_2: "poison",
      abilities: [{ name: "thick-fat", is_hidden: false, slot: 1 }],
      base_stats: { hp: 80, attack: 100, defense: 123 },
      hp: 80,
      attack: 100,
      defense: 123,
      special_attack: 122,
      special_defense: 120,
      speed: 80,
      base_stat_total: 625,
      height_decimetres: 24,
      weight_hectograms: 1555,
      base_experience: 313,
      color: "green",
      capture_rate: 45,
      base_happiness: 70,
      hatch_counter: 20,
      is_baby: false,
      is_legendary: false,
      is_mythical: false,
      evolves_from_species_id: 2,
      evolution_chain_id: 1,
      growth_rate_id: 4,
      sprite_gif_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/10033.gif",
      sprite_png_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/10033.png",
      official_artwork_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10033.png",
   },
   // 5. Dragonite (Default Form, BST 600 -> EPIC)
   {
      pokemon_id: 149,
      pokemon_name: "Dragonite",
      pokemon_slug: "dragonite",
      species_id: 149,
      species_name: "Dragonite",
      genus: "Dragon Pokémon",
      is_default_form: true,
      generation_id: 1,
      types: ["dragon", "flying"],
      type_1: "dragon",
      type_2: "flying",
      abilities: [{ name: "inner-focus", is_hidden: false, slot: 1 }],
      base_stats: { hp: 91, attack: 134, defense: 95 },
      hp: 91,
      attack: 134,
      defense: 95,
      special_attack: 100,
      special_defense: 100,
      speed: 80,
      base_stat_total: 600,
      height_decimetres: 22,
      weight_hectograms: 2100,
      base_experience: 300,
      color: "yellow",
      capture_rate: 45,
      base_happiness: 35,
      hatch_counter: 40,
      is_baby: false,
      is_legendary: false,
      is_mythical: false,
      evolves_from_species_id: 148,
      evolution_chain_id: 76,
      growth_rate_id: 5,
      sprite_gif_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/149.gif",
      sprite_png_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/149.png",
      official_artwork_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/149.png",
   },
   // 6. Mewtwo (Default Form, is_legendary: true -> LEGENDARY)
   {
      pokemon_id: 150,
      pokemon_name: "Mewtwo",
      pokemon_slug: "mewtwo",
      species_id: 150,
      species_name: "Mewtwo",
      genus: "Genetic Pokémon",
      is_default_form: true,
      generation_id: 1,
      types: ["psychic"],
      type_1: "psychic",
      type_2: null,
      abilities: [{ name: "pressure", is_hidden: false, slot: 1 }],
      base_stats: { hp: 106, attack: 110, defense: 90 },
      hp: 106,
      attack: 110,
      defense: 90,
      special_attack: 154,
      special_defense: 90,
      speed: 130,
      base_stat_total: 680,
      height_decimetres: 20,
      weight_hectograms: 1220,
      base_experience: 340,
      color: "purple",
      capture_rate: 3,
      base_happiness: 0,
      hatch_counter: 120,
      is_baby: false,
      is_legendary: true,
      is_mythical: false,
      evolves_from_species_id: null,
      evolution_chain_id: 77,
      growth_rate_id: 5,
      sprite_gif_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/150.gif",
      sprite_png_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/150.png",
      official_artwork_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png",
   },
   // 7. Mew (Default Form, is_mythical: true -> MYTHICAL)
   {
      pokemon_id: 151,
      pokemon_name: "Mew",
      pokemon_slug: "mew",
      species_id: 151,
      species_name: "Mew",
      genus: "New Species Pokémon",
      is_default_form: true,
      generation_id: 1,
      types: ["psychic"],
      type_1: "psychic",
      type_2: null,
      abilities: [{ name: "synchronize", is_hidden: false, slot: 1 }],
      base_stats: { hp: 100, attack: 100, defense: 100 },
      hp: 100,
      attack: 100,
      defense: 100,
      special_attack: 100,
      special_defense: 100,
      speed: 100,
      base_stat_total: 600,
      height_decimetres: 4,
      weight_hectograms: 40,
      base_experience: 300,
      color: "pink",
      capture_rate: 45,
      base_happiness: 100,
      hatch_counter: 120,
      is_baby: false,
      is_legendary: false,
      is_mythical: true,
      evolves_from_species_id: null,
      evolution_chain_id: 78,
      growth_rate_id: 4,
      sprite_gif_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/151.gif",
      sprite_png_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/151.png",
      official_artwork_url:
         "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/151.png",
   },
];

describe("Pokemon Rarity Calculation Domain Rule", () => {
   it("assigns MYTHICAL when isMythical is true regardless of BST", () => {
      expect(
         calculateHoldMeToItRarity({ isMythical: true, baseStatTotal: 300 })
      ).toBe("MYTHICAL");
      expect(
         calculateHoldMeToItRarity({
            isMythical: true,
            isLegendary: true,
            baseStatTotal: 680,
         })
      ).toBe("MYTHICAL");
   });

   it("assigns LEGENDARY when isLegendary is true and not mythical", () => {
      expect(
         calculateHoldMeToItRarity({
            isLegendary: true,
            isMythical: false,
            baseStatTotal: 580,
         })
      ).toBe("LEGENDARY");
   });

   it("assigns EPIC for non-legendary with BST >= 540", () => {
      expect(calculateHoldMeToItRarity({ baseStatTotal: 600 })).toBe("EPIC");
      expect(calculateHoldMeToItRarity({ baseStatTotal: 540 })).toBe("EPIC");
   });

   it("assigns RARE for BST between 450 and 539", () => {
      expect(calculateHoldMeToItRarity({ baseStatTotal: 525 })).toBe("RARE");
      expect(calculateHoldMeToItRarity({ baseStatTotal: 450 })).toBe("RARE");
   });

   it("assigns UNCOMMON for BST between 320 and 449", () => {
      expect(calculateHoldMeToItRarity({ baseStatTotal: 405 })).toBe(
         "UNCOMMON"
      );
      expect(calculateHoldMeToItRarity({ baseStatTotal: 320 })).toBe(
         "UNCOMMON"
      );
   });

   it("assigns NORMAL for BST < 320", () => {
      expect(calculateHoldMeToItRarity({ baseStatTotal: 318 })).toBe("NORMAL");
      expect(calculateHoldMeToItRarity({ baseStatTotal: 195 })).toBe("NORMAL");
   });
});

describe("parsePokemonBundle", () => {
   it("separates canonical default species from alternate forms without creating duplicate Dex entries", () => {
      const result = parsePokemonBundle(mockSampleRawItems);

      expect(result.totalRecords).toBe(7);
      expect(result.validSpecies.length).toBe(6); // 6 default species
      expect(result.formsCount).toBe(1); // 1 alternate form (Mega Venusaur)
      expect(result.rejectedRecords.length).toBe(0);

      // Verify Venusaur contains Mega Venusaur in metadata.forms
      const venusaur = result.validSpecies.find((s) => s.slug === "venusaur");
      expect(venusaur).toBeDefined();
      expect(venusaur?.metadata?.forms).toHaveLength(1);
      expect(venusaur?.metadata?.forms[0].name).toBe("Venusaur Mega");
      expect(venusaur?.metadata?.forms[0].pokemonId).toBe(10033);
   });

   it("maps rarity according to domain heuristic", () => {
      const result = parsePokemonBundle(mockSampleRawItems);
      const bySlug = new Map(result.validSpecies.map((s) => [s.slug, s]));

      expect(bySlug.get("bulbasaur")?.rarity).toBe("NORMAL");
      expect(bySlug.get("ivysaur")?.rarity).toBe("UNCOMMON");
      expect(bySlug.get("venusaur")?.rarity).toBe("RARE");
      expect(bySlug.get("dragonite")?.rarity).toBe("EPIC");
      expect(bySlug.get("mewtwo")?.rarity).toBe("LEGENDARY");
      expect(bySlug.get("mew")?.rarity).toBe("MYTHICAL");
   });

   it("converts elemental types to uppercase domain representations", () => {
      const result = parsePokemonBundle(mockSampleRawItems);
      const bulbasaur = result.validSpecies.find((s) => s.slug === "bulbasaur");

      expect(bulbasaur?.primaryType).toBe("GRASS");
      expect(bulbasaur?.secondaryType).toBe("POISON");
   });

   it("respects limit option", () => {
      const result = parsePokemonBundle(mockSampleRawItems, { limit: 2 });
      expect(result.validSpecies.length).toBe(2);
      expect(result.validSpecies[0].slug).toBe("bulbasaur");
      expect(result.validSpecies[1].slug).toBe("ivysaur");
   });

   it("catches and reports invalid records that violate domain constraints", () => {
      const invalidItem: RawPokemonBundleItem = {
         ...mockSampleRawItems[0],
         pokemon_slug: "INVALID SLUG WITH UPPERCASE AND SPACES!",
      };

      const result = parsePokemonBundle([invalidItem]);
      expect(result.validSpecies.length).toBe(0);
      expect(result.rejectedRecords.length).toBe(1);
      expect(result.rejectedRecords[0].slug).toBe(
         "INVALID SLUG WITH UPPERCASE AND SPACES!"
      );
   });
});

describe("runPokemonBundleImport Dry Run", () => {
   it("executes dry-run against the full repository bundle with zero write errors", async () => {
      const report = await runPokemonBundleImport({
         dryRun: true,
      });

      expect(report.totalSourceRecords).toBe(1351);
      expect(report.canonicalSpeciesCount).toBe(1025);
      expect(report.alternateFormsCount).toBe(326);
      expect(report.validRecordsCount).toBe(1025);
      expect(report.rejectedRecordsCount).toBe(0);

      // Generation breakdown test
      expect(report.generationBreakdown[1]).toBe(151);
      expect(report.generationBreakdown[2]).toBe(100);
      expect(report.generationBreakdown[9]).toBe(120);

      // 100% asset coverage
      expect(report.assetCoverage.officialArtwork).toBe(1025);
      expect(report.assetCoverage.spritePng).toBe(1025);
      expect(report.assetCoverage.spriteGif).toBe(1025);
   });
});
