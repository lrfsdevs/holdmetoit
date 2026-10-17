import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   getUserTrophyBalance,
   recordTrophyTransaction,
   adminAdjustTrophies,
   getTrophyLeaderboard,
   getUserCompetitiveStats,
} from "./trophy.repository";
import { prisma } from "@/core/db";
import { recordAuditEvent } from "@/features/audit/data/audit-log.repository";

vi.mock("@/core/db", () => ({
   prisma: {
      user: {
         findUnique: vi.fn(),
         findMany: vi.fn(),
         update: vi.fn(),
         count: vi.fn(),
      },
      trophyTransaction: {
         findUnique: vi.fn(),
         findMany: vi.fn(),
         create: vi.fn(),
         count: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(prisma)),
   },
}));

vi.mock("@/features/audit/data/audit-log.repository", () => ({
   recordAuditEvent: vi.fn().mockResolvedValue({}),
}));

describe("Trophy Repository", () => {
   const mockAdmin = { id: "admin_1", username: "HostAdmin" };

   beforeEach(() => {
      vi.clearAllMocks();
   });

   describe("getUserTrophyBalance", () => {
      it("returns user cached trophyBalance", async () => {
         vi.mocked(prisma.user.findUnique).mockResolvedValue({
            trophyBalance: 1250,
         } as any);

         const bal = await getUserTrophyBalance("usr_1");
         expect(bal).toBe(1250);
      });

      it("returns 0 if user not found or balance is null", async () => {
         vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
         const bal = await getUserTrophyBalance("usr_unknown");
         expect(bal).toBe(0);
      });
   });

   describe("recordTrophyTransaction", () => {
      it("records WIN transaction and updates user balance", async () => {
         vi.mocked(prisma.user.findUnique).mockResolvedValue({
            trophyBalance: 100,
            displayName: "Player 1",
            username: "p1",
         } as any);

         vi.mocked(prisma.trophyTransaction.create).mockResolvedValue({
            id: "tx_1",
            userId: "usr_1",
            amount: 25,
            balanceAfter: 125,
            type: "CHALLENGE_WIN",
         } as any);

         const result = await recordTrophyTransaction({
            userId: "usr_1",
            amount: 25,
            type: "CHALLENGE_WIN",
            description: "Challenge Victory",
            idempotencyKey: "chal-1:usr_1",
         });

         expect(result.balanceAfter).toBe(125);
         expect(result.isDuplicate).toBe(false);
         expect(prisma.trophyTransaction.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
               userId: "usr_1",
               amount: 25,
               balanceAfter: 125,
               type: "CHALLENGE_WIN",
            }),
         });
         expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "usr_1" },
            data: { trophyBalance: 125 },
         });
      });

      it("is idempotent: skips duplicate idempotencyKey without double credit", async () => {
         vi.mocked(prisma.trophyTransaction.findUnique).mockResolvedValue({
            id: "tx_existing",
            userId: "usr_1",
            amount: 25,
            balanceAfter: 125,
         } as any);

         const result = await recordTrophyTransaction({
            userId: "usr_1",
            amount: 25,
            type: "CHALLENGE_WIN",
            description: "Challenge Victory",
            idempotencyKey: "chal-1:usr_1",
         });

         expect(result.isDuplicate).toBe(true);
         expect(result.balanceAfter).toBe(125);
         expect(prisma.trophyTransaction.create).not.toHaveBeenCalled();
         expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it("enforces floor at 0 on LOSS", async () => {
         vi.mocked(prisma.user.findUnique).mockResolvedValue({
            trophyBalance: 8,
            displayName: "Player 1",
            username: "p1",
         } as any);

         vi.mocked(prisma.trophyTransaction.create).mockResolvedValue({
            id: "tx_loss",
            userId: "usr_1",
            amount: -15,
            balanceAfter: 0,
            type: "CHALLENGE_LOSS",
         } as any);

         const result = await recordTrophyTransaction({
            userId: "usr_1",
            amount: -15,
            type: "CHALLENGE_LOSS",
            description: "Challenge Defeat",
         });

         expect(result.balanceAfter).toBe(0);
         expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "usr_1" },
            data: { trophyBalance: 0 },
         });
      });

      it("records audit log when rank changes", async () => {
         // Cross 99 -> 125 (Recruit to Bronze)
         vi.mocked(prisma.user.findUnique).mockResolvedValue({
            trophyBalance: 90,
            displayName: "Player 1",
            username: "p1",
         } as any);

         vi.mocked(prisma.trophyTransaction.create).mockResolvedValue({
            id: "tx_rankup",
            userId: "usr_1",
            amount: 25,
            balanceAfter: 115,
            type: "CHALLENGE_WIN",
         } as any);

         const result = await recordTrophyTransaction({
            userId: "usr_1",
            amount: 25,
            type: "CHALLENGE_WIN",
            description: "Challenge Victory",
         });

         expect(result.rankChange.changed).toBe(true);
         expect(result.rankChange.type).toBe("PROMOTED");
         expect(recordAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
               actionType: "RANK_CHANGED",
            })
         );
      });
   });

   describe("adminAdjustTrophies", () => {
      it("creates an audited admin adjustment with mandatory reason", async () => {
         vi.mocked(prisma.user.findUnique).mockResolvedValue({
            trophyBalance: 1200,
            displayName: "Afnan",
            username: "afnan",
         } as any);

         vi.mocked(prisma.trophyTransaction.create).mockResolvedValue({
            id: "tx_admin",
            userId: "usr_1",
            amount: 100,
            balanceAfter: 1300,
            type: "ADMIN_ADJUSTMENT",
         } as any);

         const result = await adminAdjustTrophies(
            "usr_1",
            mockAdmin,
            100,
            "Tournament correction"
         );

         expect(result.balanceAfter).toBe(1300);
         expect(recordAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
               actionType: "ADMIN_TROPHY_ADJUSTMENT",
               auditReason: "Tournament correction",
            })
         );
      });

      it("rejects blank reason", async () => {
         await expect(
            adminAdjustTrophies("usr_1", mockAdmin, 100, "   ")
         ).rejects.toThrow(
            "A justification reason is required for admin trophy adjustments."
         );
      });
   });

   describe("getTrophyLeaderboard", () => {
      it("fetches every user (no skip/take) when all is true", async () => {
         vi.mocked(prisma.user.findMany).mockResolvedValue([] as any);
         vi.mocked(prisma.user.count).mockResolvedValue(0);

         const result = await getTrophyLeaderboard({ all: true });

         expect(prisma.user.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ skip: 0, take: undefined })
         );
         expect(result.entries).toEqual([]);
         expect(result.pagination).toEqual({
            page: 1,
            limit: 0,
            totalCount: 0,
            totalPages: 1,
         });
      });

      it("paginates with skip/take by default", async () => {
         vi.mocked(prisma.user.findMany).mockResolvedValue([] as any);
         vi.mocked(prisma.user.count).mockResolvedValue(120);

         const result = await getTrophyLeaderboard({ page: 3 });

         expect(prisma.user.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ skip: 100, take: 50 })
         );
         expect(result.pagination.totalPages).toBe(3);
      });
   });
});
