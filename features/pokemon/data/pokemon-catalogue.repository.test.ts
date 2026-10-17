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
      userPokemon: {
         groupBy: vi.fn(),
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

      it("orders rarity via DB orderBy (enum order matches rank)", async () => {
         vi.mocked(prisma.pokemonSpecies.findMany).mockResolvedValue([] as any);
         vi.mocked(prisma.pokemonSpecies.count).mockResolvedValue(0);

         await listPokemonSpecies({ sortBy: "rarity_desc" });

         expect(prisma.pokemonSpecies.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
               orderBy: [{ rarity: "desc" }, { pokedexNumber: "asc" }],
            })
         );
      });

      it("defaults to a 24-row page and applies the offset", async () => {
         vi.mocked(prisma.pokemonSpecies.findMany).mockResolvedValue([] as any);
         vi.mocked(prisma.pokemonSpecies.count).mockResolvedValue(0);

         await listPokemonSpecies({ offset: 24 });

         expect(prisma.pokemonSpecies.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ take: 24, skip: 24 })
         );
      });

      it("scopes to owned species when ownedByUserId is provided", async () => {
         vi.mocked(prisma.pokemonSpecies.findMany).mockResolvedValue([] as any);
         vi.mocked(prisma.pokemonSpecies.count).mockResolvedValue(0);

         await listPokemonSpecies({ ownedByUserId: "user_1" });

         expect(prisma.pokemonSpecies.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
               where: expect.objectContaining({
                  instances: { some: { userId: "user_1" } },
               }),
            })
         );
      });

      it("orders recently-obtained collection species by earliest obtainedAt", async () => {
         vi.mocked(prisma.pokemonSpecies.findMany)
            .mockResolvedValueOnce([{ id: "a" }, { id: "b" }] as any)
            .mockResolvedValueOnce([
               { id: "a", name: "A" },
               { id: "b", name: "B" },
            ] as any);
         vi.mocked(prisma.userPokemon.groupBy).mockResolvedValue([
            { speciesId: "a", _min: { obtainedAt: new Date("2026-01-01") } },
            { speciesId: "b", _min: { obtainedAt: new Date("2026-06-01") } },
         ] as any);

         const result = await listPokemonSpecies({
            sortBy: "recent",
            ownedByUserId: "user_1",
            limit: 24,
            offset: 0,
         });

         expect(result.totalCount).toBe(2);
         expect(result.species.map((s) => s.id)).toEqual(["b", "a"]);
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
            include: {
               forms: { orderBy: { pokemonId: "asc" } },
               abilities: { orderBy: { slot: "asc" } },
            },
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
            include: {
               forms: { orderBy: { pokemonId: "asc" } },
               abilities: { orderBy: { slot: "asc" } },
            },
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
