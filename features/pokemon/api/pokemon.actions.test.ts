import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   adminUpsertPokemonSpeciesAction,
   getPokemonCatalogueAction,
   getPokemonSpeciesDetailAction,
   getUserCollectionSummaryAction,
   getUserPokemonCollectionAction,
} from "./pokemon.actions";
import * as catalogueRepo from "../data/pokemon-catalogue.repository";
import * as userPokemonRepo from "../data/user-pokemon.repository";
import * as coreAuth from "@/core/auth";
import * as adminAuth from "@/features/auth/api/require-admin";

vi.mock("../data/pokemon-catalogue.repository", () => ({
   listPokemonSpecies: vi.fn(),
   findPokemonSpeciesById: vi.fn(),
   findPokemonSpeciesBySlug: vi.fn(),
   countAvailablePokemonSpecies: vi.fn(),
   adminUpsertPokemonSpecies: vi.fn(),
}));

vi.mock("../data/user-pokemon.repository", () => ({
   getUserPokemonCollection: vi.fn(),
   getUserPokemonById: vi.fn(),
   getUserCollectionSummary: vi.fn(),
   grantUserPokemon: vi.fn(),
}));

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
}));

vi.mock("@/features/auth/api/require-admin", () => ({
   requireAdminUser: vi.fn(),
   AdminAccessError: class AdminAccessError extends Error {
      code = "FORBIDDEN_NOT_ADMIN";
      constructor(msg = "Admin required") {
         super(msg);
         this.name = "AdminAccessError";
      }
   },
}));

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
}));

describe("Pokemon Server Actions", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   describe("getPokemonCatalogueAction", () => {
      it("is publicly accessible without authentication", async () => {
         vi.mocked(catalogueRepo.listPokemonSpecies).mockResolvedValue({
            species: [
               {
                  id: "sp_1",
                  pokedexNumber: 1,
                  name: "Bulbasaur",
                  slug: "bulbasaur",
                  rarity: "UNCOMMON",
                  primaryType: "GRASS",
                  secondaryType: "POISON",
                  description:
                     "A strange seed was planted on its back at birth.",
                  classification: "Seed Pokémon",
                  imageUrl: null,
                  spriteUrl: null,
                  baseHp: 45,
                  baseAttack: 49,
                  baseDefense: 49,
                  generation: 1,
                  isAvailable: true,
                  referenceUrl: null,
                  createdAt: new Date(),
                  updatedAt: new Date(),
               },
            ],
            totalCount: 1,
         });

         const res = await getPokemonCatalogueAction({ sortBy: "pokedex" });
         expect(res.ok).toBe(true);
         if (res.ok) {
            expect(res.data.species).toHaveLength(1);
            expect(res.data.species[0].name).toBe("Bulbasaur");
         }
         expect(catalogueRepo.listPokemonSpecies).toHaveBeenCalledWith({
            sortBy: "pokedex",
         });
      });

      it("rejects invalid filter parameters", async () => {
         const res = await getPokemonCatalogueAction({
            sortBy: "invalid_sort" as any,
         });
         expect(res.ok).toBe(false);
         if (!res.ok) {
            expect(res.code).toBe("INVALID_INPUT");
         }
      });
   });

   describe("getPokemonSpeciesDetailAction", () => {
      it("looks up species by slug or id", async () => {
         vi.mocked(catalogueRepo.findPokemonSpeciesBySlug).mockResolvedValue({
            id: "sp_25",
            pokedexNumber: 25,
            name: "Pikachu",
            slug: "pikachu",
            rarity: "RARE",
            primaryType: "ELECTRIC",
            secondaryType: null,
            description: "Pikachu that can generate powerful electricity.",
            classification: "Mouse Pokémon",
            imageUrl: null,
            spriteUrl: null,
            baseHp: 35,
            baseAttack: 55,
            baseDefense: 40,
            generation: 1,
            isAvailable: true,
            referenceUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
         });

         const res = await getPokemonSpeciesDetailAction("pikachu");
         expect(res.ok).toBe(true);
         if (res.ok) {
            expect(res.data?.name).toBe("Pikachu");
         }
      });

      it("handles invalid or empty identifier", async () => {
         const res = await getPokemonSpeciesDetailAction("");
         expect(res.ok).toBe(false);
         if (!res.ok) {
            expect(res.code).toBe("INVALID_INPUT");
         }
      });
   });

   describe("getUserPokemonCollectionAction", () => {
      it("rejects unauthenticated requests with UNAUTHORIZED", async () => {
         vi.mocked(coreAuth.auth).mockResolvedValue(null as any);

         const res = await getUserPokemonCollectionAction();
         expect(res.ok).toBe(false);
         if (!res.ok) {
            expect(res.code).toBe("UNAUTHORIZED");
         }
         expect(
            userPokemonRepo.getUserPokemonCollection
         ).not.toHaveBeenCalled();
      });

      it("fetches collection for authenticated session user without relying on client input", async () => {
         vi.mocked(coreAuth.auth).mockResolvedValue({
            user: { id: "user_abc", name: "Ash" },
         } as any);

         vi.mocked(userPokemonRepo.getUserPokemonCollection).mockResolvedValue([
            {
               id: "inst_1",
               userId: "user_abc",
               speciesId: "sp_25",
               obtainedAt: new Date(),
               source: "STARTER",
               sourceReferenceId: null,
               idempotencyKey: "test_key",
               nickname: "Sparky",
               isFavorite: true,
               metadata: {},
               createdAt: new Date(),
               updatedAt: new Date(),
               species: {
                  id: "sp_25",
                  pokedexNumber: 25,
                  name: "Pikachu",
                  slug: "pikachu",
                  rarity: "RARE",
                  primaryType: "ELECTRIC",
                  secondaryType: null,
                  description: "",
                  classification: null,
                  imageUrl: null,
                  spriteUrl: null,
                  baseHp: 35,
                  baseAttack: 55,
                  baseDefense: 40,
                  generation: 1,
                  isAvailable: true,
                  referenceUrl: null,
                  createdAt: new Date(),
                  updatedAt: new Date(),
               },
            },
         ]);

         const res = await getUserPokemonCollectionAction({ sortBy: "recent" });
         expect(res.ok).toBe(true);
         if (res.ok) {
            expect(res.data.instances).toHaveLength(1);
            expect(res.data.instances[0].nickname).toBe("Sparky");
         }
         expect(userPokemonRepo.getUserPokemonCollection).toHaveBeenCalledWith(
            "user_abc",
            { sortBy: "recent" }
         );
      });
   });

   describe("getUserCollectionSummaryAction", () => {
      it("returns spectator state when not logged in", async () => {
         vi.mocked(coreAuth.auth).mockResolvedValue(null as any);

         const res = await getUserCollectionSummaryAction();
         expect(res.ok).toBe(true);
         if (res.ok) {
            expect(res.data.isSpectator).toBe(true);
            expect(res.data.summary).toBeNull();
         }
      });

      it("returns summary when user is logged in", async () => {
         vi.mocked(coreAuth.auth).mockResolvedValue({
            user: { id: "user_trainer", name: "Red" },
         } as any);

         vi.mocked(userPokemonRepo.getUserCollectionSummary).mockResolvedValue({
            userId: "user_trainer",
            progress: {
               uniqueOwnedCount: 5,
               totalAvailableCount: 20,
               totalInstancesCount: 7,
               completionPercentage: 25,
               tier: "NOVICE",
            },
            speciesOwnershipCounts: { sp_1: 2, sp_25: 3 },
            speciesEarliestObtained: {},
         });

         const res = await getUserCollectionSummaryAction();
         expect(res.ok).toBe(true);
         if (res.ok) {
            expect(res.data.isSpectator).toBe(false);
            expect(res.data.summary?.progress.uniqueOwnedCount).toBe(5);
            expect(res.data.summary?.progress.completionPercentage).toBe(25);
         }
      });
   });

   describe("adminUpsertPokemonSpeciesAction", () => {
      it("rejects non-admin users with FORBIDDEN", async () => {
         vi.mocked(adminAuth.requireAdminUser).mockRejectedValue(
            new adminAuth.AdminAccessError("Not admin")
         );

         const res = await adminUpsertPokemonSpeciesAction({
            pokedexNumber: 150,
            name: "Mewtwo",
            slug: "mewtwo",
            rarity: "LEGENDARY",
            primaryType: "PSYCHIC",
            description: "Genetically engineered Pokémon.",
         });

         expect(res.ok).toBe(false);
         if (!res.ok) {
            expect(res.code).toBe("FORBIDDEN");
         }
         expect(catalogueRepo.adminUpsertPokemonSpecies).not.toHaveBeenCalled();
      });

      it("validates input and performs upsert for authorized admin", async () => {
         vi.mocked(adminAuth.requireAdminUser).mockResolvedValue({
            id: "admin_1",
            username: "AdminMod",
            displayName: "Admin Mod",
            role: "ADMIN",
         });

         vi.mocked(catalogueRepo.adminUpsertPokemonSpecies).mockResolvedValue({
            id: "sp_150",
            pokedexNumber: 150,
            name: "Mewtwo",
            slug: "mewtwo",
            rarity: "LEGENDARY",
            primaryType: "PSYCHIC",
            secondaryType: null,
            description: "Genetically engineered Pokémon.",
            classification: "Genetic Pokémon",
            imageUrl: null,
            spriteUrl: null,
            baseHp: 106,
            baseAttack: 110,
            baseDefense: 90,
            generation: 1,
            isAvailable: true,
            referenceUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
         });

         const res = await adminUpsertPokemonSpeciesAction({
            pokedexNumber: 150,
            name: "Mewtwo",
            slug: "mewtwo",
            rarity: "LEGENDARY",
            primaryType: "PSYCHIC",
            description: "Genetically engineered Pokémon.",
            baseHp: 106,
            baseAttack: 110,
            baseDefense: 90,
         });

         expect(res.ok).toBe(true);
         if (res.ok) {
            expect(res.data.name).toBe("Mewtwo");
         }
         expect(catalogueRepo.adminUpsertPokemonSpecies).toHaveBeenCalledWith(
            expect.objectContaining({
               name: "Mewtwo",
               slug: "mewtwo",
               rarity: "LEGENDARY",
            }),
            "admin_1"
         );
      });

      it("rejects invalid input schema (e.g. invalid rarity)", async () => {
         vi.mocked(adminAuth.requireAdminUser).mockResolvedValue({
            id: "admin_1",
            username: "AdminMod",
            displayName: "Admin Mod",
            role: "ADMIN",
         });

         const res = await adminUpsertPokemonSpeciesAction({
            pokedexNumber: 1,
            name: "Bad",
            slug: "bad",
            rarity: "SUPER_GOD" as any,
            primaryType: "GRASS",
            description: "Test",
         });

         expect(res.ok).toBe(false);
         if (!res.ok) {
            expect(res.code).toBe("VALIDATION_FAILED");
         }
      });
   });
});
