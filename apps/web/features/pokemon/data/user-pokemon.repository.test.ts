import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   getUserCollectionSummary,
   getUserPokemonById,
   getUserPokemonCollection,
   grantUserPokemon,
} from "./user-pokemon.repository";
import { prisma } from "@/core/db";
import * as catalogueRepo from "./pokemon-catalogue.repository";

vi.mock("@/core/db", () => ({
   prisma: {
      userPokemon: {
         findMany: vi.fn(),
         findFirst: vi.fn(),
         findUnique: vi.fn(),
         create: vi.fn(),
      },
      pokemonSpecies: {
         findUnique: vi.fn(),
         count: vi.fn(),
      },
   },
}));

vi.mock("./pokemon-catalogue.repository", () => ({
   countAvailablePokemonSpecies: vi.fn(),
}));

describe("User Pokemon Repository", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   describe("getUserPokemonCollection", () => {
      it("returns empty array when userId is empty", async () => {
         const result = await getUserPokemonCollection("");
         expect(result).toEqual([]);
         expect(prisma.userPokemon.findMany).not.toHaveBeenCalled();
      });

      it("queries database strictly with the provided userId", async () => {
         const mockInstances = [
            {
               id: "inst_1",
               userId: "user_123",
               speciesId: "sp_1",
               obtainedAt: new Date("2026-10-15T12:00:00Z"),
               source: "STARTER",
               sourceReferenceId: null,
               idempotencyKey: "key_1",
               nickname: "Bulby",
               isFavorite: false,
               metadata: {},
               createdAt: new Date(),
               updatedAt: new Date(),
               species: {
                  id: "sp_1",
                  pokedexNumber: 1,
                  name: "Bulbasaur",
                  slug: "bulbasaur",
                  rarity: "UNCOMMON",
                  primaryType: "GRASS",
                  secondaryType: "POISON",
               },
            },
         ];

         vi.mocked(prisma.userPokemon.findMany).mockResolvedValue(
            mockInstances as any
         );

         const result = await getUserPokemonCollection("user_123", {
            sortBy: "pokedex",
         });

         expect(result).toHaveLength(1);
         expect(prisma.userPokemon.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
               where: { userId: "user_123" },
            })
         );
      });

      it("isolates participants and does not leak other participants' entries", async () => {
         vi.mocked(prisma.userPokemon.findMany).mockResolvedValue([]);

         await getUserPokemonCollection("user_alice");
         expect(prisma.userPokemon.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
               where: { userId: "user_alice" },
            })
         );
      });
   });

   describe("getUserPokemonById", () => {
      it("returns null if instance does not belong to the user", async () => {
         vi.mocked(prisma.userPokemon.findFirst).mockResolvedValue(null);

         const result = await getUserPokemonById("inst_999", "user_attacker");
         expect(result).toBeNull();
         expect(prisma.userPokemon.findFirst).toHaveBeenCalledWith({
            where: { id: "inst_999", userId: "user_attacker" },
            include: { species: true },
         });
      });

      it("returns instance when id and userId match", async () => {
         const mockInstance = {
            id: "inst_100",
            userId: "user_owner",
            speciesId: "sp_4",
            species: { name: "Charmander" },
         };
         vi.mocked(prisma.userPokemon.findFirst).mockResolvedValue(
            mockInstance as any
         );

         const result = await getUserPokemonById("inst_100", "user_owner");
         expect(result?.id).toBe("inst_100");
      });
   });

   describe("getUserCollectionSummary", () => {
      it("calculates unique counts, duplicates, and completion progress correctly", async () => {
         const mockOwned = [
            { speciesId: "sp_1", obtainedAt: new Date("2026-10-01T00:00:00Z") },
            { speciesId: "sp_1", obtainedAt: new Date("2026-10-02T00:00:00Z") }, // duplicate of sp_1
            {
               speciesId: "sp_25",
               obtainedAt: new Date("2026-10-03T00:00:00Z"),
            },
         ];

         vi.mocked(prisma.userPokemon.findMany).mockResolvedValue(
            mockOwned as any
         );
         vi.mocked(
            catalogueRepo.countAvailablePokemonSpecies
         ).mockResolvedValue(10);

         const summary = await getUserCollectionSummary("user_trainer");

         expect(summary.userId).toBe("user_trainer");
         expect(summary.progress.uniqueOwnedCount).toBe(2);
         expect(summary.progress.totalInstancesCount).toBe(3);
         expect(summary.progress.totalAvailableCount).toBe(10);
         expect(summary.progress.completionPercentage).toBe(20); // 2 / 10 = 20%
         expect(summary.speciesOwnershipCounts["sp_1"]).toBe(2);
         expect(summary.speciesOwnershipCounts["sp_25"]).toBe(1);
      });

      it("handles zero owned items safely", async () => {
         vi.mocked(prisma.userPokemon.findMany).mockResolvedValue([]);
         vi.mocked(
            catalogueRepo.countAvailablePokemonSpecies
         ).mockResolvedValue(50);

         const summary = await getUserCollectionSummary("user_newbie");
         expect(summary.progress.uniqueOwnedCount).toBe(0);
         expect(summary.progress.totalInstancesCount).toBe(0);
         expect(summary.progress.completionPercentage).toBe(0);
         expect(summary.progress.tier).toBe("NOVICE");
      });
   });

   describe("grantUserPokemon", () => {
      it("throws error if species does not exist", async () => {
         vi.mocked(prisma.pokemonSpecies.findUnique).mockResolvedValue(null);

         await expect(
            grantUserPokemon({
               userId: "u1",
               speciesId: "nonexistent",
               source: "STARTER",
               idempotencyKey: "key_err",
            })
         ).rejects.toThrow("PokemonSpecies not found: nonexistent");
      });

      it("returns existing record if idempotency key was already processed", async () => {
         vi.mocked(prisma.pokemonSpecies.findUnique).mockResolvedValue({
            id: "sp_1",
         } as any);

         const existingRecord = {
            id: "inst_existing",
            userId: "u1",
            speciesId: "sp_1",
            idempotencyKey: "key_replay",
            species: { name: "Bulbasaur" },
         };
         vi.mocked(prisma.userPokemon.findUnique).mockResolvedValue(
            existingRecord as any
         );

         const result = await grantUserPokemon({
            userId: "u1",
            speciesId: "sp_1",
            source: "STARTER",
            idempotencyKey: "key_replay",
         });

         expect(result.id).toBe("inst_existing");
         expect(prisma.userPokemon.create).not.toHaveBeenCalled();
      });

      it("creates new record when species exists and idempotency key is fresh", async () => {
         vi.mocked(prisma.pokemonSpecies.findUnique).mockResolvedValue({
            id: "sp_1",
         } as any);
         vi.mocked(prisma.userPokemon.findUnique).mockResolvedValue(null);

         const createdRecord = {
            id: "inst_new",
            userId: "u1",
            speciesId: "sp_1",
            source: "ACHIEVEMENT",
            idempotencyKey: "key_fresh",
            species: { name: "Bulbasaur" },
         };
         vi.mocked(prisma.userPokemon.create).mockResolvedValue(
            createdRecord as any
         );

         const result = await grantUserPokemon({
            userId: "u1",
            speciesId: "sp_1",
            source: "ACHIEVEMENT",
            idempotencyKey: "key_fresh",
         });

         expect(result.id).toBe("inst_new");
         expect(prisma.userPokemon.create).toHaveBeenCalledWith(
            expect.objectContaining({
               data: expect.objectContaining({
                  userId: "u1",
                  speciesId: "sp_1",
                  idempotencyKey: "key_fresh",
                  source: "ACHIEVEMENT",
               }),
            })
         );
      });
   });
});
