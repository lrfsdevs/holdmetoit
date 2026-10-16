import { describe, expect, it } from "vitest";
import { EmptyRarityPoolError, selectPokemon } from "./pokemon-selector";
import { PokemonSpeciesWithCounts } from "../../data/pokemon-catalogue.repository";

describe("Server-Side Pokemon Selection Engine", () => {
   function createSpecies(
      partial: Partial<PokemonSpeciesWithCounts> & {
         id: string;
         pokedexNumber: number;
         name: string;
         slug: string;
         rarity: any;
         primaryType: string;
         description: string;
         baseHp: number;
         baseAttack: number;
         baseDefense: number;
      }
   ): PokemonSpeciesWithCounts {
      return {
         secondaryType: null,
         classification: null,
         imageUrl: null,
         spriteUrl: null,
         spriteGifUrl: null,
         generation: 1,
         isLegendary: false,
         isMythical: false,
         isBaby: false,
         isAvailable: true,
         sourceId: null,
         referenceUrl: null,
         createdAt: new Date(),
         updatedAt: new Date(),
         ...partial,
      };
   }

   const mockSpeciesList: PokemonSpeciesWithCounts[] = [
      createSpecies({
         id: "sp_pidgey",
         pokedexNumber: 16,
         name: "Pidgey",
         slug: "pidgey",
         rarity: "NORMAL",
         primaryType: "NORMAL",
         secondaryType: "FLYING",
         description: "A bird.",
         isAvailable: true,
         generation: 1,
         baseHp: 40,
         baseAttack: 45,
         baseDefense: 40,
         isLegendary: false,
         isMythical: false,
      }),
      createSpecies({
         id: "sp_pikachu",
         pokedexNumber: 25,
         name: "Pikachu",
         slug: "pikachu",
         rarity: "UNCOMMON",
         primaryType: "ELECTRIC",
         secondaryType: null,
         description: "Mouse.",
         isAvailable: true,
         generation: 1,
         baseHp: 35,
         baseAttack: 55,
         baseDefense: 40,
         isLegendary: false,
         isMythical: false,
      }),
      createSpecies({
         id: "sp_charizard",
         pokedexNumber: 6,
         name: "Charizard",
         slug: "charizard",
         rarity: "EPIC",
         primaryType: "FIRE",
         secondaryType: "FLYING",
         description: "Flame dragon.",
         isAvailable: true,
         generation: 1,
         baseHp: 78,
         baseAttack: 84,
         baseDefense: 78,
         isLegendary: false,
         isMythical: false,
      }),
      createSpecies({
         id: "sp_mewtwo",
         pokedexNumber: 150,
         name: "Mewtwo",
         slug: "mewtwo",
         rarity: "LEGENDARY",
         primaryType: "PSYCHIC",
         secondaryType: null,
         description: "Genetic psychic.",
         isAvailable: true,
         generation: 1,
         baseHp: 106,
         baseAttack: 110,
         baseDefense: 90,
         isLegendary: true,
         isMythical: false,
      }),
      createSpecies({
         id: "sp_articuno",
         pokedexNumber: 144,
         name: "Articuno",
         slug: "articuno",
         rarity: "LEGENDARY",
         primaryType: "ICE",
         secondaryType: "FLYING",
         description: "Freeze bird.",
         isAvailable: true,
         generation: 1,
         baseHp: 90,
         baseAttack: 85,
         baseDefense: 100,
         isLegendary: true,
         isMythical: false,
      }),
   ];

   const standardRates = {
      NORMAL: 6000, // [0, 5999]
      UNCOMMON: 2500, // [6000, 8499]
      RARE: 1000, // [8500, 9499]
      EPIC: 400, // [9500, 9899]
      LEGENDARY: 90, // [9900, 9989]
      MYTHICAL: 10, // [9990, 9999]
   };

   it("selects NORMAL rarity when roll falls in [0, 5999]", () => {
      // Inject deterministic roll of 1500 for the basis point roll, and 0 for species index
      const result = selectPokemon({
         eligiblePool: mockSpeciesList,
         rarityRates: standardRates,
         pityEvaluation: {
            pityTriggered: false,
            guaranteedRarity: null,
            guaranteedFeatured: false,
         },
         randomSource: (max) => (max === 10000 ? 1500 : 0),
      });

      expect(result.rarity).toBe("NORMAL");
      expect(result.selectedSpecies.id).toBe("sp_pidgey");
      expect(result.pityTriggered).toBe(false);
   });

   it("selects UNCOMMON rarity when roll falls in [6000, 8499]", () => {
      const result = selectPokemon({
         eligiblePool: mockSpeciesList,
         rarityRates: standardRates,
         pityEvaluation: {
            pityTriggered: false,
            guaranteedRarity: null,
            guaranteedFeatured: false,
         },
         randomSource: (max) => (max === 10000 ? 7000 : 0),
      });

      expect(result.rarity).toBe("UNCOMMON");
      expect(result.selectedSpecies.id).toBe("sp_pikachu");
   });

   it("guarantees target rarity when hard pity triggers regardless of probability roll", () => {
      // Even if roll is 100 (NORMAL range), pityTriggered overrides to LEGENDARY
      const result = selectPokemon({
         eligiblePool: mockSpeciesList,
         rarityRates: standardRates,
         pityEvaluation: {
            pityTriggered: true,
            guaranteedRarity: "LEGENDARY",
            guaranteedFeatured: false,
         },
         randomSource: () => 0,
      });

      expect(result.rarity).toBe("LEGENDARY");
      expect(result.pityTriggered).toBe(true);
      expect(["sp_mewtwo", "sp_articuno"]).toContain(result.selectedSpecies.id);
   });

   it("guarantees featured species when guaranteedFeatured is true", () => {
      const result = selectPokemon({
         eligiblePool: mockSpeciesList,
         rarityRates: standardRates,
         featuredSpeciesId: "sp_mewtwo",
         pityEvaluation: {
            pityTriggered: true,
            guaranteedRarity: "LEGENDARY",
            guaranteedFeatured: true,
         },
         randomSource: () => 0,
      });

      expect(result.rarity).toBe("LEGENDARY");
      expect(result.isFeatured).toBe(true);
      expect(result.selectedSpecies.id).toBe("sp_mewtwo");
   });

   it("awards featured species when winning the 50/50 roll", () => {
      // 50/50 roll: randomSource(100) returns 25 (< 50 => win)
      let rollCall = 0;
      const customSource = (max: number) => {
         rollCall++;
         if (max === 10000) return 9950; // Roll LEGENDARY
         if (max === 100) return 25; // 50/50 win
         return 0;
      };

      const result = selectPokemon({
         eligiblePool: mockSpeciesList,
         rarityRates: standardRates,
         featuredSpeciesId: "sp_mewtwo",
         pityEvaluation: {
            pityTriggered: false,
            guaranteedRarity: null,
            guaranteedFeatured: false,
         },
         randomSource: customSource,
      });

      expect(result.rarity).toBe("LEGENDARY");
      expect(result.isFeatured).toBe(true);
      expect(result.selectedSpecies.id).toBe("sp_mewtwo");
   });

   it("awards non-featured species when losing the 50/50 roll", () => {
      // 50/50 roll: randomSource(100) returns 75 (>= 50 => lose)
      const customSource = (max: number) => {
         if (max === 10000) return 9950; // Roll LEGENDARY
         if (max === 100) return 75; // 50/50 lost
         return 0; // Pick first non-featured (Articuno)
      };

      const result = selectPokemon({
         eligiblePool: mockSpeciesList,
         rarityRates: standardRates,
         featuredSpeciesId: "sp_mewtwo",
         pityEvaluation: {
            pityTriggered: false,
            guaranteedRarity: null,
            guaranteedFeatured: false,
         },
         randomSource: customSource,
      });

      expect(result.rarity).toBe("LEGENDARY");
      expect(result.isFeatured).toBe(false);
      expect(result.selectedSpecies.id).toBe("sp_articuno");
   });

   it("throws EmptyRarityPoolError when rolled rarity has 0 species in the pool", () => {
      // Roll 9995 (MYTHICAL), but mockSpeciesList has 0 Mythicals
      expect(() =>
         selectPokemon({
            eligiblePool: mockSpeciesList,
            rarityRates: standardRates,
            pityEvaluation: {
               pityTriggered: false,
               guaranteedRarity: null,
               guaranteedFeatured: false,
            },
            randomSource: () => 9995,
         })
      ).toThrow(EmptyRarityPoolError);
   });

   describe("Study Progression Gating & Redistribution (Section 7 & 8)", () => {
      it("redistributes probability mass when participant has < 500 study hours (Legendary locked)", () => {
         // 499 hours = 1,796,400s
         // Filter mock species to exclude Legendary since server filters pool
         const eligibleMockPool = mockSpeciesList.filter(
            (sp) => sp.rarity !== "LEGENDARY"
         );

         const result = selectPokemon({
            eligiblePool: eligibleMockPool,
            rarityRates: standardRates,
            pityEvaluation: {
               pityTriggered: false,
               guaranteedRarity: null,
               guaranteedFeatured: false,
            },
            cumulativeStudySeconds: 499 * 3600,
            randomSource: (max) => (max === 10000 ? 9950 : 0),
         });

         expect(result.rarity).toBe("EPIC");
         expect(result.selectedSpecies.id).toBe("sp_charizard");
      });

      it("permits Legendary roll when participant reaches exactly 500 hours", () => {
         // 500 hours = 1,800,000s
         const result = selectPokemon({
            eligiblePool: mockSpeciesList,
            rarityRates: standardRates,
            pityEvaluation: {
               pityTriggered: false,
               guaranteedRarity: null,
               guaranteedFeatured: false,
            },
            cumulativeStudySeconds: 500 * 3600,
            randomSource: (max) => (max === 10000 ? 9950 : 0),
         });

         expect(result.rarity).toBe("LEGENDARY");
         expect(["sp_mewtwo", "sp_articuno"]).toContain(
            result.selectedSpecies.id
         );
      });
   });
});
