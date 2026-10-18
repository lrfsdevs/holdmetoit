import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   lockChallengeResults,
   unlockChallengeResults,
} from "./challenge-admin.repository";
import { prisma } from "@/core/db";
import * as wagerRepo from "@/features/wagers/data/wager.repository";
import * as walletRepo from "@/features/economy/data/wallet.repository";
import * as trophyRepo from "@/features/trophies/data/trophy.repository";

vi.mock("@/core/db", () => ({
   prisma: {
      $transaction: vi.fn(),
      challenge: {
         findUnique: vi.fn(),
         update: vi.fn(),
      },
      task: {
         findMany: vi.fn(),
      },
      auditLog: {
         create: vi.fn(),
      },
   },
}));

vi.mock("@/features/wagers/data/wager.repository", () => ({
   settleChallengeWagers: vi.fn().mockResolvedValue({ settledCount: 1 }),
   refundAllChallengeWagers: vi.fn().mockResolvedValue({ refundedCount: 1 }),
}));

vi.mock("@/features/trophies/data/trophy.repository", () => ({
   settleChallengeTrophies: vi.fn().mockResolvedValue({ settledCount: 2 }),
   reverseChallengeTrophies: vi.fn().mockResolvedValue({ reversedCount: 2 }),
}));

vi.mock("@/features/economy/data/wallet.repository", () => ({
   getOrCreateWallet: vi.fn(),
}));

vi.mock("@/features/audit/data/audit-log.repository", () => ({
   recordAuditEvent: vi.fn().mockResolvedValue({}),
   getAuditTrail: vi.fn().mockResolvedValue([]),
}));

describe("Challenge Economy & Wager Settlement upon Lock", () => {
   const mockActor = { id: "admin_1", username: "HostAdmin" };

   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("settles challenge bonus rewards for saved participants and settles wagers", async () => {
      const mockChallenge = {
         id: "chal_bonus_1",
         title: "Autumn League",
         format: "TEAM_VS_TEAM",
         status: "ACTIVE",
         startAt: new Date("2026-10-01"),
         endAt: new Date("2026-10-07"),
         resultsLockedAt: null,
         rewardCoins: 500,
         isRewardSettled: false,
         teams: [
            { id: "team_alpha", name: "Alpha", isDeleted: false },
            { id: "team_beta", name: "Beta", isDeleted: false },
         ],
         participants: [
            {
               id: "part_winner",
               userId: "usr_winner",
               teamId: "team_alpha",
               targetSeconds: 3600,
               status: "NORMAL",
               dailyStudyLogs: [{ durationSeconds: 7200 }],
               punishmentRecords: [],
            },
            {
               id: "part_loser",
               userId: "usr_loser",
               teamId: "team_beta",
               targetSeconds: 3600,
               status: "NORMAL",
               dailyStudyLogs: [{ durationSeconds: 1800 }],
               punishmentRecords: [],
            },
         ],
      };

      vi.mocked(prisma.challenge.findUnique).mockResolvedValue(
         mockChallenge as any
      );
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);

      const mockTx = {
         challenge: {
            update: vi.fn().mockResolvedValue({
               ...mockChallenge,
               resultsLockedAt: new Date(),
            }),
         },
         challengeParticipant: {
            updateMany: vi.fn(),
         },
         punishmentRecord: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
         },
         wallet: {
            update: vi.fn(),
         },
         ledgerTransaction: {
            create: vi.fn(),
         },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) =>
         cb(mockTx)
      );

      vi.mocked(walletRepo.getOrCreateWallet).mockResolvedValue({
         id: "wal_winner",
         totalBalance: 1000,
         reservedBalance: 0,
         lifetimeEarned: 1000,
      } as any);

      await lockChallengeResults("chal_bonus_1", mockActor);

      // Verify winner wallet credited with victory bonus (500 coins)
      expect(mockTx.wallet.update).toHaveBeenCalledWith({
         where: { id: "wal_winner" },
         data: {
            totalBalance: 1500,
            lifetimeEarned: 1500,
         },
      });

      // Verify ledger transaction recorded for challenge reward
      expect(mockTx.ledgerTransaction.create).toHaveBeenCalledWith(
         expect.objectContaining({
            data: expect.objectContaining({
               walletId: "wal_winner",
               userId: "usr_winner",
               type: "CHALLENGE_REWARD",
               amount: 500,
               totalDelta: 500,
            }),
         })
      );

      // Verify challenge reward status updated to settled
      expect(mockTx.challenge.update).toHaveBeenCalledWith({
         where: { id: "chal_bonus_1" },
         data: expect.objectContaining({
            isRewardSettled: true,
         }),
      });

      // Verify wagers were settled
      expect(wagerRepo.settleChallengeWagers).toHaveBeenCalledWith(
         "chal_bonus_1",
         ["team_alpha"],
         mockTx
      );

      // Verify trophies were settled (Phase 5)
      expect(trophyRepo.settleChallengeTrophies).toHaveBeenCalledWith(
         expect.objectContaining({
            challengeId: "chal_bonus_1",
            winningTeamIds: ["team_alpha"],
         }),
         mockTx
      );
   });

   it("skips trophy settlement when settleTrophies is false but still settles wagers", async () => {
      const mockChallenge = {
         id: "chal_bonus_1",
         title: "Autumn League",
         format: "TEAM_VS_TEAM",
         status: "ACTIVE",
         startAt: new Date("2026-10-01"),
         endAt: new Date("2026-10-07"),
         resultsLockedAt: null,
         rewardCoins: 500,
         isRewardSettled: false,
         teams: [
            { id: "team_alpha", name: "Alpha", isDeleted: false },
            { id: "team_beta", name: "Beta", isDeleted: false },
         ],
         participants: [
            {
               id: "part_winner",
               userId: "usr_winner",
               teamId: "team_alpha",
               targetSeconds: 3600,
               status: "NORMAL",
               dailyStudyLogs: [{ durationSeconds: 7200 }],
               punishmentRecords: [],
            },
            {
               id: "part_loser",
               userId: "usr_loser",
               teamId: "team_beta",
               targetSeconds: 3600,
               status: "NORMAL",
               dailyStudyLogs: [{ durationSeconds: 1800 }],
               punishmentRecords: [],
            },
         ],
      };

      vi.mocked(prisma.challenge.findUnique).mockResolvedValue(
         mockChallenge as any
      );
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);

      const mockTx = {
         challenge: {
            update: vi.fn().mockResolvedValue({
               ...mockChallenge,
               resultsLockedAt: new Date(),
            }),
         },
         challengeParticipant: { updateMany: vi.fn() },
         punishmentRecord: { deleteMany: vi.fn(), createMany: vi.fn() },
         wallet: { update: vi.fn() },
         ledgerTransaction: { create: vi.fn() },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) =>
         cb(mockTx)
      );
      vi.mocked(walletRepo.getOrCreateWallet).mockResolvedValue({
         id: "wal_winner",
         totalBalance: 1000,
         reservedBalance: 0,
         lifetimeEarned: 1000,
      } as any);

      await lockChallengeResults("chal_bonus_1", mockActor, {
         settleTrophies: false,
      });

      expect(wagerRepo.settleChallengeWagers).toHaveBeenCalled();
      expect(trophyRepo.settleChallengeTrophies).not.toHaveBeenCalled();
   });

   it("refunds accepted wagers and reverses trophies when challenge results are unlocked", async () => {
      const lockedChallenge = {
         id: "chal_locked",
         title: "Autumn League",
         resultsLockedAt: new Date(),
         endAt: new Date("2026-10-07"),
      };

      vi.mocked(prisma.challenge.findUnique).mockResolvedValue(
         lockedChallenge as any
      );

      const mockTx = {
         challenge: {
            update: vi.fn().mockResolvedValue({
               ...lockedChallenge,
               resultsLockedAt: null,
            }),
         },
         challengeParticipant: {
            updateMany: vi.fn().mockResolvedValue({ count: 2 }),
         },
         punishmentRecord: {
            deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
         },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) =>
         cb(mockTx)
      );

      await unlockChallengeResults("chal_locked", mockActor);

      expect(wagerRepo.refundAllChallengeWagers).toHaveBeenCalledWith(
         "chal_locked",
         mockTx,
         "Challenge results unlocked by admin"
      );

      expect(trophyRepo.reverseChallengeTrophies).toHaveBeenCalledWith(
         "chal_locked",
         mockTx,
         "Challenge results unlocked by admin"
      );
   });
});
