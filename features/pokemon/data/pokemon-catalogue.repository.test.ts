import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   adminUpsertPokemonSpecies,
   countAvailablePokemonSpecies,
   findPokemonSpeciesById,
   findPokemonSpeciesBySlug,
   listPokemonSpecies,
} from "./pokemon-catalogue.repository";
import { prisma } from "@/core/db";

vi.mock("@/core/db", () => ({
   prisma: {
      pokemonSpecies: {
         findMany: vi.fn(),
         findUnique: vi.fn(),
         count: vi.fn(),
         upsert: vi.fn(),
      },
   },
}));

describe("Pokemon Catalogue Repository", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   describe("listPokemonSpecies", () => {
      it("returns species list and total count", async () => {
         const mockSpecies = [
            {
               id: "sp_1",
               pokedexNumber: 1,
               name: "Bulbasaur",
               slug: "bulbasaur",
               rarity: "UNCOMMON",
               primaryType: "GRASS",
               secondaryType: "POISON",
               description: "A seed on its back.",
               classification: "Seed Pokémon",
               isAvailable: true,
            },
         ];

         vi.mocked(prisma.pokemonSpecies.findMany).mockResolvedValue(
            mockSpecies as any
         );
         vi.mocked(prisma.pokemonSpecies.count).mockResolvedValue(1);

         const result = await listPokemonSpecies({ isAvailable: true });
         expect(result.species).toHaveLength(1);
         expect(result.totalCount).toBe(1);
         expect(prisma.pokemonSpecies.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
               where: { isAvailable: true },
               orderBy: { pokedexNumber: "asc" },
            })
         );
      });

      it("applies type filtering to primary or secondary type", async () => {
         vi.mocked(prisma.pokemonSpecies.findMany).mockResolvedValue([]);
         vi.mocked(prisma.pokemonSpecies.count).mockResolvedValue(0);

         await listPokemonSpecies({ type: "FIRE" });

         expect(prisma.pokemonSpecies.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
               where: expect.objectContaining({
                  OR: [{ primaryType: "FIRE" }, { secondaryType: "FIRE" }],
               }),
            })
         );
      });

      it("sorts by custom rarity hierarchy descending in memory", async () => {
         const mockList = [
            { id: "1", pokedexNumber: 1, rarity: "NORMAL", name: "Pidgey" },
            {
               id: "2",
               pokedexNumber: 150,
               rarity: "LEGENDARY",
               name: "Mewtwo",
            },
            { id: "3", pokedexNumber: 151, rarity: "MYTHICAL", name: "Mew" },
         ];

         vi.mocked(prisma.pokemonSpecies.findMany).mockResolvedValue(
            mockList as any
         );
         vi.mocked(prisma.pokemonSpecies.count).mockResolvedValue(3);

         const result = await listPokemonSpecies({ sortBy: "rarity_desc" });
         expect(result.species[0].rarity).toBe("MYTHICAL");
         expect(result.species[1].rarity).toBe("LEGENDARY");
         expect(result.species[2].rarity).toBe("NORMAL");
      });
   });

   describe("findPokemonSpeciesById and findPokemonSpeciesBySlug", () => {
      it("finds by id", async () => {
         vi.mocked(prisma.pokemonSpecies.findUnique).mockResolvedValue({
            id: "sp_1",
            name: "Bulbasaur",
         } as any);

         const result = await findPokemonSpeciesById("sp_1");
         expect(result?.name).toBe("Bulbasaur");
         expect(prisma.pokemonSpecies.findUnique).toHaveBeenCalledWith({
            where: { id: "sp_1" },
         });
      });

      it("finds by slug", async () => {
         vi.mocked(prisma.pokemonSpecies.findUnique).mockResolvedValue({
            id: "sp_4",
            slug: "charmander",
            name: "Charmander",
         } as any);

         const result = await findPokemonSpeciesBySlug("charmander");
         expect(result?.slug).toBe("charmander");
         expect(prisma.pokemonSpecies.findUnique).toHaveBeenCalledWith({
            where: { slug: "charmander" },
         });
      });
   });

   describe("countAvailablePokemonSpecies", () => {
      it("queries count of available species", async () => {
         vi.mocked(prisma.pokemonSpecies.count).mockResolvedValue(151);

         const count = await countAvailablePokemonSpecies();
         expect(count).toBe(151);
         expect(prisma.pokemonSpecies.count).toHaveBeenCalledWith({
            where: { isAvailable: true },
         });
      });
   });

   describe("adminUpsertPokemonSpecies", () => {
      it("upserts by slug with audit log", async () => {
         const input = {
            pokedexNumber: 25,
            name: "Pikachu",
            slug: "pikachu",
            rarity: "RARE" as const,
            primaryType: "ELECTRIC" as const,
            description: "Mouse Pokémon",
         };

         vi.mocked(prisma.pokemonSpecies.upsert).mockResolvedValue({
            id: "sp_25",
            ...input,
            primaryType: "ELECTRIC",
            secondaryType: null,
            classification: null,
            imageUrl: null,
            spriteUrl: null,
            baseHp: 50,
            baseAttack: 50,
            baseDefense: 50,
            generation: 1,
            isAvailable: true,
            referenceUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
         } as any);

         const res = await adminUpsertPokemonSpecies(input, "admin_user");
         expect(res.slug).toBe("pikachu");
         expect(prisma.pokemonSpecies.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
               where: { slug: "pikachu" },
            })
         );
      });
   });
});
