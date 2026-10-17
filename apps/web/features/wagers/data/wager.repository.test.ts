import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   placeWager,
   settleChallengeWagers,
   refundAllChallengeWagers,
} from "./wager.repository";
import { prisma } from "@/core/db";
import {
   WagerValidationError,
   BettingClosedError,
} from "@/features/economy/domain/economy-settings";

vi.mock("@/core/db", () => ({
   prisma: {
      $transaction: vi.fn(),
      wager: {
         findMany: vi.fn(),
         findUnique: vi.fn(),
      },
   },
}));

describe("placeWager", () => {
   const mockTx = {
      wager: {
         findUnique: vi.fn(),
         create: vi.fn(),
      },
      challenge: {
         findUnique: vi.fn(),
      },
      wallet: {
         findUnique: vi.fn(),
         create: vi.fn(),
         update: vi.fn(),
      },
      ledgerTransaction: {
         create: vi.fn(),
      },
   };

   beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) =>
         callback(mockTx)
      );
   });

   it("rejects wager when challenge does not exist", async () => {
      mockTx.wager.findUnique.mockResolvedValue(null);
      mockTx.challenge.findUnique.mockResolvedValue(null);

      await expect(
         placeWager({
            userId: "usr_1",
            challengeId: "nonexistent",
            targetTeamId: "team_1",
            stake: 50,
         })
      ).rejects.toThrow(WagerValidationError);
   });

   it("rejects wager when betting is disabled on challenge", async () => {
      mockTx.wager.findUnique.mockResolvedValue(null);
      mockTx.challenge.findUnique.mockResolvedValue({
         id: "chal_1",
         isBettingEnabled: false,
         resultsLockedAt: null,
         startAt: new Date(Date.now() + 86400000),
         endAt: new Date(Date.now() + 172800000),
         teams: [{ id: "team_1", name: "Alpha" }],
      });
      mockTx.wallet.findUnique.mockResolvedValue({
         id: "wal_1",
         totalBalance: 500,
         reservedBalance: 0,
         rewardProgressSeconds: 0,
         lifetimeEarned: 500,
         lifetimeSpent: 0,
      });

      await expect(
         placeWager({
            userId: "usr_1",
            challengeId: "chal_1",
            targetTeamId: "team_1",
            stake: 50,
         })
      ).rejects.toThrow(WagerValidationError);
   });

   it("rejects wager when stake exceeds available balance", async () => {
      mockTx.wager.findUnique.mockResolvedValue(null);
      mockTx.challenge.findUnique.mockResolvedValue({
         id: "chal_1",
         isBettingEnabled: true,
         resultsLockedAt: null,
         startAt: new Date(Date.now() + 86400000),
         endAt: new Date(Date.now() + 172800000),
         teams: [{ id: "team_1", name: "Alpha" }],
      });
      mockTx.wallet.findUnique.mockResolvedValue({
         id: "wal_1",
         totalBalance: 100,
         reservedBalance: 80, // available = 20
         rewardProgressSeconds: 0,
         lifetimeEarned: 100,
         lifetimeSpent: 0,
      });

      await expect(
         placeWager({
            userId: "usr_1",
            challengeId: "chal_1",
            targetTeamId: "team_1",
            stake: 50, // 50 > 20
         })
      ).rejects.toThrow(WagerValidationError);
   });

   it("successfully places wager and reserves funds atomically", async () => {
      mockTx.wager.findUnique.mockResolvedValue(null);
      mockTx.challenge.findUnique.mockResolvedValue({
         id: "chal_1",
         isBettingEnabled: true,
         resultsLockedAt: null,
         startAt: new Date(Date.now() + 86400000),
         endAt: new Date(Date.now() + 172800000),
         teams: [{ id: "team_1", name: "Alpha" }],
      });
      mockTx.wallet.findUnique.mockResolvedValue({
         id: "wal_1",
         totalBalance: 500,
         reservedBalance: 50, // available = 450
         rewardProgressSeconds: 0,
         lifetimeEarned: 500,
         lifetimeSpent: 0,
      });
      mockTx.wager.create.mockResolvedValue({
         id: "wag_101",
         challengeId: "chal_1",
         userId: "usr_1",
         targetTeamId: "team_1",
         stake: 100,
         status: "ACCEPTED",
      });

      const result = await placeWager({
         userId: "usr_1",
         challengeId: "chal_1",
         targetTeamId: "team_1",
         stake: 100,
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.wager.id).toBe("wag_101");
      expect(mockTx.wallet.update).toHaveBeenCalledWith({
         where: { id: "wal_1" },
         data: { reservedBalance: 150 }, // 50 + 100
      });
      expect(mockTx.ledgerTransaction.create).toHaveBeenCalledWith(
         expect.objectContaining({
            data: expect.objectContaining({
               type: "WAGER_RESERVATION",
               amount: 100,
               totalDelta: 0,
               reservedDelta: 100,
            }),
         })
      );
   });
});

describe("settleChallengeWagers", () => {
   it("settles winning wager by releasing reservation and crediting profit", async () => {
      const mockTx = {
         wager: {
            findMany: vi.fn().mockResolvedValue([
               {
                  id: "wag_win",
                  walletId: "wal_1",
                  userId: "usr_1",
                  targetTeamId: "team_winner",
                  stake: 100,
               },
            ]),
            update: vi.fn(),
         },
         wallet: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({
               id: "wal_1",
               totalBalance: 500,
               reservedBalance: 100,
               rewardProgressSeconds: 0,
               lifetimeEarned: 500,
               lifetimeSpent: 0,
            }),
            update: vi.fn(),
         },
         ledgerTransaction: {
            create: vi.fn(),
         },
      };

      const result = await settleChallengeWagers(
         "chal_1",
         ["team_winner"],
         mockTx as any
      );

      expect(result.settledCount).toBe(1);
      // Won: totalBalance becomes 500 + 100 = 600, reservedBalance becomes 100 - 100 = 0
      expect(mockTx.wallet.update).toHaveBeenCalledWith({
         where: { id: "wal_1" },
         data: {
            totalBalance: 600,
            reservedBalance: 0,
            lifetimeEarned: 600,
            lifetimeSpent: undefined,
         },
      });
      expect(mockTx.wager.update).toHaveBeenCalledWith({
         where: { id: "wag_win" },
         data: expect.objectContaining({
            status: "WON",
            payout: 200,
         }),
      });
   });

   it("settles losing wager by consuming reserved balance", async () => {
      const mockTx = {
         wager: {
            findMany: vi.fn().mockResolvedValue([
               {
                  id: "wag_lose",
                  walletId: "wal_1",
                  userId: "usr_1",
                  targetTeamId: "team_loser",
                  stake: 100,
               },
            ]),
            update: vi.fn(),
         },
         wallet: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({
               id: "wal_1",
               totalBalance: 500,
               reservedBalance: 100,
               rewardProgressSeconds: 0,
               lifetimeEarned: 500,
               lifetimeSpent: 0,
            }),
            update: vi.fn(),
         },
         ledgerTransaction: {
            create: vi.fn(),
         },
      };

      const result = await settleChallengeWagers(
         "chal_1",
         ["team_winner"],
         mockTx as any
      );

      expect(result.settledCount).toBe(1);
      // Lost: totalBalance becomes 500 - 100 = 400, reservedBalance becomes 100 - 100 = 0
      expect(mockTx.wallet.update).toHaveBeenCalledWith({
         where: { id: "wal_1" },
         data: {
            totalBalance: 400,
            reservedBalance: 0,
            lifetimeEarned: undefined,
            lifetimeSpent: 100,
         },
      });
      expect(mockTx.wager.update).toHaveBeenCalledWith({
         where: { id: "wag_lose" },
         data: expect.objectContaining({
            status: "LOST",
            payout: 0,
         }),
      });
   });

   it("refunds wagers in the event of a tie/draw", async () => {
      const mockTx = {
         wager: {
            findMany: vi.fn().mockResolvedValue([
               {
                  id: "wag_draw",
                  walletId: "wal_1",
                  userId: "usr_1",
                  targetTeamId: "team_a",
                  stake: 100,
               },
            ]),
            update: vi.fn(),
         },
         wallet: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({
               id: "wal_1",
               totalBalance: 500,
               reservedBalance: 100,
               rewardProgressSeconds: 0,
               lifetimeEarned: 500,
               lifetimeSpent: 0,
            }),
            update: vi.fn(),
         },
         ledgerTransaction: {
            create: vi.fn(),
         },
      };

      // Both team_a and team_b tied for first place
      const result = await settleChallengeWagers(
         "chal_1",
         ["team_a", "team_b"],
         mockTx as any
      );

      expect(result.settledCount).toBe(1);
      // Refund: totalBalance remains 500, reservedBalance decreases to 0 (available increases back)
      expect(mockTx.wallet.update).toHaveBeenCalledWith({
         where: { id: "wal_1" },
         data: {
            totalBalance: 500,
            reservedBalance: 0,
            lifetimeEarned: undefined,
            lifetimeSpent: undefined,
         },
      });
      expect(mockTx.wager.update).toHaveBeenCalledWith({
         where: { id: "wag_draw" },
         data: expect.objectContaining({
            status: "REFUNDED",
            payout: 100,
         }),
      });
   });
});
