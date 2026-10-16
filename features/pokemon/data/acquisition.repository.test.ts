import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   executePokemonAcquisition,
   BannerInactiveError,
   BannerNotFoundError,
} from "./acquisition.repository";
import { prisma } from "@/core/db";
import { InsufficientFundsError } from "@/features/economy/domain/wallet-accounting";

vi.mock("@/core/db", () => ({
   prisma: {
      $transaction: vi.fn(),
      pokemonBanner: {
         findMany: vi.fn(),
         findUnique: vi.fn(),
         findFirst: vi.fn(),
         create: vi.fn(),
         update: vi.fn(),
      },
      pokemonAcquisition: {
         findUnique: vi.fn(),
         findMany: vi.fn(),
         create: vi.fn(),
         count: vi.fn(),
      },
      userBannerPity: {
         findUnique: vi.fn(),
         upsert: vi.fn(),
      },
      wallet: {
         findUnique: vi.fn(),
         update: vi.fn(),
         create: vi.fn(),
      },
      ledgerTransaction: {
         findUnique: vi.fn(),
         create: vi.fn(),
      },
      pokemonSpecies: {
         findMany: vi.fn(),
         findUnique: vi.fn(),
      },
      userPokemon: {
         count: vi.fn(),
         create: vi.fn(),
      },
      dailyStudyLog: {
         findMany: vi.fn().mockResolvedValue([]),
      },
   },
}));

describe("Acquisition Repository & Atomic Pull Transaction", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   const mockBanner = {
      id: "banner_kanto",
      name: "Kanto Starters Summon",
      slug: "kanto-starters",
      description: "Summon classic companions.",
      bannerType: "STANDARD",
      status: "ACTIVE",
      startAt: new Date(Date.now() - 3600000),
      endAt: new Date(Date.now() + 86400000),
      pullCost: 500,
      allowedQuantities: [1],
      version: 1,
      featuredSpeciesId: "sp_mewtwo",
      rarityRates: {
         NORMAL: 6000,
         UNCOMMON: 2500,
         RARE: 1000,
         EPIC: 400,
         LEGENDARY: 90,
         MYTHICAL: 10,
      },
      pityConfig: {
         hardPityThreshold: 50,
         targetRarity: "LEGENDARY",
         resetOnRarities: ["LEGENDARY", "MYTHICAL"],
         featuredGuarantee: true,
      },
      duplicatePolicy: "ADD_COPY",
   };

   const mockSpeciesList = [
      {
         id: "sp_pidgey",
         name: "Pidgey",
         rarity: "NORMAL",
         isAvailable: true,
      },
      {
         id: "sp_pikachu",
         name: "Pikachu",
         rarity: "UNCOMMON",
         isAvailable: true,
      },
      {
         id: "sp_gengar",
         name: "Gengar",
         rarity: "RARE",
         isAvailable: true,
      },
      {
         id: "sp_charizard",
         name: "Charizard",
         rarity: "EPIC",
         isAvailable: true,
      },
      {
         id: "sp_mewtwo",
         name: "Mewtwo",
         rarity: "LEGENDARY",
         isAvailable: true,
      },
      {
         id: "sp_mew",
         name: "Mew",
         rarity: "MYTHICAL",
         isAvailable: true,
      },
   ];

   it("successfully executes pull: debits coins, logs ledger, grants Pokemon, and increments pity", async () => {
      const mockTx = {
         pokemonAcquisition: {
            findUnique: vi.fn().mockResolvedValue(null), // no idempotency collision
            create: vi.fn().mockResolvedValue({
               id: "acq_123",
               createdAt: new Date(),
            }),
         },
         pokemonBanner: {
            findUnique: vi.fn().mockResolvedValue(mockBanner),
         },
         wallet: {
            findUnique: vi.fn().mockResolvedValue({
               id: "wal_1",
               userId: "usr_1",
               totalBalance: 1000,
               reservedBalance: 200, // available = 800 >= 500
               rewardProgressSeconds: 0,
               lifetimeEarned: 1000,
               lifetimeSpent: 0,
            }),
            update: vi.fn().mockResolvedValue({
               id: "wal_1",
               totalBalance: 500,
               reservedBalance: 200, // available = 300
            }),
         },
         pokemonSpecies: {
            findMany: vi.fn().mockResolvedValue(mockSpeciesList),
         },
         userBannerPity: {
            findUnique: vi.fn().mockResolvedValue({
               pityCount: 10,
               guaranteedFeatured: false,
            }),
            upsert: vi.fn().mockResolvedValue({}),
         },
         userPokemon: {
            count: vi.fn().mockResolvedValue(0), // not a duplicate
            create: vi.fn().mockResolvedValue({
               id: "up_123",
            }),
         },
         ledgerTransaction: {
            create: vi.fn().mockResolvedValue({
               id: "ltx_123",
            }),
         },
         dailyStudyLog: {
            findMany: vi.fn().mockResolvedValue([]),
         },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) =>
         cb(mockTx)
      );

      // Force selection of NORMAL species (roll 1000)
      const result = await executePokemonAcquisition({
         userId: "usr_1",
         bannerId: "banner_kanto",
         idempotencyKey: "pull_key_001",
         randomSource: (max) => (max === 10000 ? 1000 : 0),
      });

      expect(result.acquisitionId).toBe("acq_123");
      expect(result.rarity).toBe("NORMAL");
      expect(result.isDuplicate).toBe(false);
      expect(result.duplicateOutcome).toBe("NEW_SPECIES_DISCOVERED");
      expect(result.costPaid).toBe(500);
      expect(result.newBalance).toBe(300);
      expect(result.pityCountBefore).toBe(10);
      expect(result.pityCountAfter).toBe(11);
      expect(result.isIdempotentReplay).toBe(false);

      // Verify wallet debit was called
      expect(mockTx.wallet.update).toHaveBeenCalledWith(
         expect.objectContaining({
            where: { id: "wal_1" },
            data: expect.objectContaining({
               totalBalance: 500,
               lifetimeSpent: 500,
            }),
         })
      );

      // Verify ledger transaction was written
      expect(mockTx.ledgerTransaction.create).toHaveBeenCalledWith(
         expect.objectContaining({
            data: expect.objectContaining({
               type: "GACHA_PURCHASE",
               amount: -500,
               walletId: "wal_1",
               sourceType: "POKEMON_BANNER",
            }),
         })
      );

      // Verify UserPokemon was created
      expect(mockTx.userPokemon.create).toHaveBeenCalledWith(
         expect.objectContaining({
            data: expect.objectContaining({
               userId: "usr_1",
               speciesId: "sp_pidgey",
               source: "GACHA",
            }),
         })
      );
   });

   it("handles duplicate ownership: sets isDuplicate true and increments ownership count", async () => {
      const mockTx = {
         pokemonAcquisition: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi
               .fn()
               .mockResolvedValue({ id: "acq_dup", createdAt: new Date() }),
         },
         pokemonBanner: {
            findUnique: vi.fn().mockResolvedValue(mockBanner),
         },
         wallet: {
            findUnique: vi.fn().mockResolvedValue({
               id: "wal_1",
               userId: "usr_1",
               totalBalance: 1000,
               reservedBalance: 0,
               rewardProgressSeconds: 0,
               lifetimeEarned: 1000,
               lifetimeSpent: 0,
            }),
            update: vi
               .fn()
               .mockResolvedValue({ totalBalance: 500, reservedBalance: 0 }),
         },
         pokemonSpecies: {
            findMany: vi.fn().mockResolvedValue(mockSpeciesList),
         },
         userBannerPity: {
            findUnique: vi.fn().mockResolvedValue(null),
            upsert: vi.fn().mockResolvedValue({}),
         },
         userPokemon: {
            count: vi.fn().mockResolvedValue(2), // Already owns 2 copies!
            create: vi.fn().mockResolvedValue({ id: "up_dup" }),
         },
         ledgerTransaction: {
            create: vi.fn().mockResolvedValue({ id: "ltx_dup" }),
         },
         dailyStudyLog: {
            findMany: vi.fn().mockResolvedValue([]),
         },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) =>
         cb(mockTx)
      );

      const result = await executePokemonAcquisition({
         userId: "usr_1",
         bannerId: "banner_kanto",
         idempotencyKey: "pull_key_dup",
         randomSource: (max) => (max === 10000 ? 1000 : 0),
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.duplicateOutcome).toBe("OWNERSHIP_COUNT_INCREMENTED");
   });

   it("replays existing result idempotently without charging again", async () => {
      const mockExistingAcquisition = {
         id: "acq_already_done",
         bannerId: "banner_kanto",
         rarity: "NORMAL",
         isFeatured: false,
         isDuplicate: false,
         duplicateOutcome: "NEW_SPECIES_DISCOVERED",
         costPaid: 500,
         pityCountBefore: 5,
         pityCountAfter: 6,
         pityTriggered: false,
         createdAt: new Date("2026-10-16T01:00:00Z"),
         species: mockSpeciesList[0],
         banner: { name: "Kanto Starters Summon" },
      };

      const mockTx = {
         pokemonAcquisition: {
            findUnique: vi.fn().mockResolvedValue(mockExistingAcquisition),
            create: vi.fn(),
         },
         wallet: {
            findUnique: vi
               .fn()
               .mockResolvedValue({ totalBalance: 500, reservedBalance: 0 }),
            update: vi.fn(),
         },
         ledgerTransaction: {
            create: vi.fn(),
         },
         userPokemon: {
            create: vi.fn(),
         },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) =>
         cb(mockTx)
      );

      const result = await executePokemonAcquisition({
         userId: "usr_1",
         bannerId: "banner_kanto",
         idempotencyKey: "pull_key_retry",
      });

      expect(result.acquisitionId).toBe("acq_already_done");
      expect(result.isIdempotentReplay).toBe(true);
      // Wallet debit, ledger create, and pokemon create must NOT have been called!
      expect(mockTx.wallet.update).not.toHaveBeenCalled();
      expect(mockTx.ledgerTransaction.create).not.toHaveBeenCalled();
      expect(mockTx.userPokemon.create).not.toHaveBeenCalled();
   });

   it("throws InsufficientFundsError when available balance is below pull cost", async () => {
      const mockTx = {
         pokemonAcquisition: { findUnique: vi.fn().mockResolvedValue(null) },
         pokemonBanner: { findUnique: vi.fn().mockResolvedValue(mockBanner) },
         wallet: {
            findUnique: vi.fn().mockResolvedValue({
               id: "wal_1",
               userId: "usr_1",
               totalBalance: 600,
               reservedBalance: 300, // available = 300 < 500 pull cost!
               rewardProgressSeconds: 0,
               lifetimeEarned: 600,
               lifetimeSpent: 0,
            }),
         },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) =>
         cb(mockTx)
      );

      await expect(
         executePokemonAcquisition({
            userId: "usr_1",
            bannerId: "banner_kanto",
            idempotencyKey: "insufficient_funds_test",
         })
      ).rejects.toThrow(InsufficientFundsError);
   });

   it("throws BannerInactiveError when banner status is not ACTIVE", async () => {
      const inactiveBanner = {
         ...mockBanner,
         status: "PAUSED",
      };

      const mockTx = {
         pokemonAcquisition: { findUnique: vi.fn().mockResolvedValue(null) },
         pokemonBanner: {
            findUnique: vi.fn().mockResolvedValue(inactiveBanner),
         },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) =>
         cb(mockTx)
      );

      await expect(
         executePokemonAcquisition({
            userId: "usr_1",
            bannerId: "banner_kanto",
            idempotencyKey: "inactive_banner_test",
         })
      ).rejects.toThrow(BannerInactiveError);
   });

   it("enforces 499-hour study boundary: filters out Legendary and redistributes probability to eligible pool", async () => {
      const mockTx = {
         pokemonAcquisition: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi
               .fn()
               .mockResolvedValue({ id: "acq_499", createdAt: new Date() }),
         },
         pokemonBanner: { findUnique: vi.fn().mockResolvedValue(mockBanner) },
         wallet: {
            findUnique: vi.fn().mockResolvedValue({
               id: "wal_1",
               userId: "usr_1",
               totalBalance: 1000,
               reservedBalance: 0,
               rewardProgressSeconds: 0,
               lifetimeEarned: 1000,
               lifetimeSpent: 0,
            }),
            update: vi
               .fn()
               .mockResolvedValue({ totalBalance: 500, reservedBalance: 0 }),
         },
         // 499 hours logged (1,796,400s across 21 days <= 86400s/day) -> ineligible for Legendary (requires 1,800,000s)
         dailyStudyLog: {
            findMany: vi.fn().mockResolvedValue(
               Array.from({ length: 21 }, (_, i) => ({
                  durationSeconds: i === 20 ? 68400 : 86400,
                  logDate: new Date(Date.UTC(2026, 0, i + 1)),
                  participant: { challenge: { status: "COMPLETED" } },
                  isLeave: false,
               }))
            ),
         },
         pokemonSpecies: {
            findMany: vi.fn().mockResolvedValue(mockSpeciesList),
         },
         userBannerPity: {
            findUnique: vi
               .fn()
               .mockResolvedValue({ pityCount: 5, guaranteedFeatured: false }),
            upsert: vi.fn().mockResolvedValue({}),
         },
         userPokemon: {
            count: vi.fn().mockResolvedValue(0),
            create: vi.fn().mockResolvedValue({ id: "up_499" }),
         },
         ledgerTransaction: {
            create: vi.fn().mockResolvedValue({ id: "ltx_499" }),
         },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) =>
         cb(mockTx)
      );

      // Even with a roll of 9950 (which would be Legendary in standard rates),
      // effective probabilities redistributed Legendary mass to eligible rarities
      const result = await executePokemonAcquisition({
         userId: "usr_1",
         bannerId: "banner_kanto",
         idempotencyKey: "pull_499h_test",
         randomSource: (max) => (max === 10000 ? 9950 : 0),
      });

      expect(result.rarity).not.toBe("LEGENDARY");
      expect(result.species.rarity).not.toBe("LEGENDARY");
   });

   it("enforces 500-hour study boundary: permits Legendary acquisition at exactly 500 hours (1,800,000s)", async () => {
      const mockTx = {
         pokemonAcquisition: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi
               .fn()
               .mockResolvedValue({ id: "acq_500", createdAt: new Date() }),
         },
         pokemonBanner: { findUnique: vi.fn().mockResolvedValue(mockBanner) },
         wallet: {
            findUnique: vi.fn().mockResolvedValue({
               id: "wal_1",
               userId: "usr_1",
               totalBalance: 1000,
               reservedBalance: 0,
               rewardProgressSeconds: 0,
               lifetimeEarned: 1000,
               lifetimeSpent: 0,
            }),
            update: vi
               .fn()
               .mockResolvedValue({ totalBalance: 500, reservedBalance: 0 }),
         },
         // Exactly 500 hours logged (1,800,000s across 21 days <= 86400s/day) -> eligible for Legendary!
         dailyStudyLog: {
            findMany: vi.fn().mockResolvedValue(
               Array.from({ length: 21 }, (_, i) => ({
                  durationSeconds: i === 20 ? 72000 : 86400,
                  logDate: new Date(Date.UTC(2026, 0, i + 1)),
                  participant: { challenge: { status: "COMPLETED" } },
                  isLeave: false,
               }))
            ),
         },
         pokemonSpecies: {
            findMany: vi.fn().mockResolvedValue(mockSpeciesList),
         },
         userBannerPity: {
            findUnique: vi
               .fn()
               .mockResolvedValue({ pityCount: 5, guaranteedFeatured: false }),
            upsert: vi.fn().mockResolvedValue({}),
         },
         userPokemon: {
            count: vi.fn().mockResolvedValue(0),
            create: vi.fn().mockResolvedValue({ id: "up_500" }),
         },
         ledgerTransaction: {
            create: vi.fn().mockResolvedValue({ id: "ltx_500" }),
         },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) =>
         cb(mockTx)
      );

      // Roll 9950 -> rolls in LEGENDARY range
      const result = await executePokemonAcquisition({
         userId: "usr_1",
         bannerId: "banner_kanto",
         idempotencyKey: "pull_500h_test",
         randomSource: (max) => (max === 10000 ? 9950 : 0),
      });

      expect(result.rarity).toBe("LEGENDARY");
      expect(result.species.id).toBe("sp_mewtwo");
   });

   it("preserves pity counter when reaching hard pity while target rarity is locked", async () => {
      const mockTx = {
         pokemonAcquisition: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi
               .fn()
               .mockResolvedValue({
                  id: "acq_pity_locked",
                  createdAt: new Date(),
               }),
         },
         pokemonBanner: { findUnique: vi.fn().mockResolvedValue(mockBanner) },
         wallet: {
            findUnique: vi.fn().mockResolvedValue({
               id: "wal_1",
               userId: "usr_1",
               totalBalance: 1000,
               reservedBalance: 0,
               rewardProgressSeconds: 0,
               lifetimeEarned: 1000,
               lifetimeSpent: 0,
            }),
            update: vi
               .fn()
               .mockResolvedValue({ totalBalance: 500, reservedBalance: 0 }),
         },
         // 0 study hours: ineligible for Legendary target rarity
         dailyStudyLog: {
            findMany: vi.fn().mockResolvedValue([]),
         },
         pokemonSpecies: {
            findMany: vi.fn().mockResolvedValue(mockSpeciesList),
         },
         // At hard pity threshold (49 completed pulls, threshold is 50)
         userBannerPity: {
            findUnique: vi
               .fn()
               .mockResolvedValue({ pityCount: 49, guaranteedFeatured: false }),
            upsert: vi.fn().mockResolvedValue({}),
         },
         userPokemon: {
            count: vi.fn().mockResolvedValue(0),
            create: vi.fn().mockResolvedValue({ id: "up_pity_locked" }),
         },
         ledgerTransaction: {
            create: vi.fn().mockResolvedValue({ id: "ltx_pity_locked" }),
         },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) =>
         cb(mockTx)
      );

      const result = await executePokemonAcquisition({
         userId: "usr_1",
         bannerId: "banner_kanto",
         idempotencyKey: "pull_pity_locked_test",
         randomSource: (max) => (max === 10000 ? 1000 : 0),
      });

      // Hard pity must NOT grant Legendary because the participant has < 500h
      expect(result.rarity).not.toBe("LEGENDARY");
      expect(result.pityTriggered).toBe(false);
      // Pity counter must be preserved at threshold - 1 (49) so progress is NOT lost!
      expect(result.pityCountAfter).toBe(49);
   });
});
