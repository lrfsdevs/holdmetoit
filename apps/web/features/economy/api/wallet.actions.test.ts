import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   getWalletSummaryAction,
   getTransactionHistoryAction,
   adminAdjustBalanceAction,
   reconcileWalletAction,
   reverseTransactionAction,
} from "./wallet.actions";
import * as requireSessionModule from "@/features/auth/api/require-session";
import * as requireAdminModule from "@/features/auth/api/require-admin";
import * as walletRepo from "../data/wallet.repository";
import * as ledgerRepo from "../data/ledger.repository";
import * as rewardRepo from "../data/study-reward.repository";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";

vi.mock("@/features/feature-flags/api/server", () => ({
   isFeatureEnabled: vi.fn(),
}));

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/api/require-session", () => ({
   requireSessionUser: vi.fn(),
}));

vi.mock("@/features/auth/api/require-admin", () => ({
   requireAdminUser: vi.fn(),
   AdminAccessError: class AdminAccessError extends Error {
      readonly code = "FORBIDDEN_NOT_ADMIN";
   },
}));

vi.mock("../data/wallet.repository", () => ({
   getOrCreateWallet: vi.fn(),
   getWalletSummary: vi.fn(),
   executeWalletCredit: vi.fn(),
   executeWalletDebit: vi.fn(),
   executeWalletReversal: vi.fn(),
}));

vi.mock("../data/ledger.repository", () => ({
   findTransactionsByUserId: vi.fn(),
   getAllTransactionsForWallet: vi.fn(),
   findTransactionById: vi.fn(),
}));

vi.mock("../data/study-reward.repository", () => ({
   getAllRewardRecordsForWallet: vi.fn(),
}));

describe("wallet.actions", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);
   });

   it("returns FEATURE_DISABLED for all wallet actions when the flag is off", async () => {
      vi.mocked(isFeatureEnabled).mockResolvedValue(false);

      const results = await Promise.all([
         getWalletSummaryAction(),
         getTransactionHistoryAction(),
         adminAdjustBalanceAction({
            targetUserId: "target_usr",
            amount: 50,
            reason: "Test adjustment",
         }),
         reconcileWalletAction(),
         reverseTransactionAction({
            transactionId: "tx_1",
            reason: "Test reversal",
         }),
      ]);

      for (const result of results) {
         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("FEATURE_DISABLED");
         }
      }

      expect(requireSessionModule.requireSessionUser).not.toHaveBeenCalled();
      expect(requireAdminModule.requireAdminUser).not.toHaveBeenCalled();
      expect(walletRepo.getWalletSummary).not.toHaveBeenCalled();
      expect(walletRepo.executeWalletCredit).not.toHaveBeenCalled();
      expect(walletRepo.executeWalletDebit).not.toHaveBeenCalled();
      expect(walletRepo.executeWalletReversal).not.toHaveBeenCalled();
      expect(walletRepo.getOrCreateWallet).not.toHaveBeenCalled();
   });

   describe("getWalletSummaryAction", () => {
      it("returns wallet summary for authenticated user", async () => {
         vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
            id: "usr_1",
         } as any);

         vi.mocked(walletRepo.getWalletSummary).mockResolvedValue({
            totalBalance: 150,
            reservedBalance: 25,
            availableBalance: 125,
            rewardProgressSeconds: 10,
            lifetimeEarned: 150,
            lifetimeSpent: 0,
         });

         const result = await getWalletSummaryAction();
         expect(result.ok).toBe(true);
         if (result.ok) {
            expect(result.data.availableBalance).toBe(125);
            expect(result.data.totalBalance).toBe(150);
            expect(result.data.reservedBalance).toBe(25);
         }
      });

      it("fails safely when user is not authenticated", async () => {
         vi.mocked(requireSessionModule.requireSessionUser).mockRejectedValue(
            new Error("You must sign in to continue.")
         );

         const result = await getWalletSummaryAction();
         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.message).toContain("sign in");
         }
      });
   });

   describe("getTransactionHistoryAction", () => {
      it("returns paginated transactions for authenticated user", async () => {
         vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
            id: "usr_1",
         } as any);

         vi.mocked(ledgerRepo.findTransactionsByUserId).mockResolvedValue({
            transactions: [
               {
                  id: "tx_1",
                  type: "STUDY_REWARD",
                  amount: 100,
                  totalDelta: 100,
                  reservedDelta: 0,
                  description: "Study reward",
                  createdAt: new Date(),
               } as any,
            ],
            pagination: { page: 1, limit: 20, totalCount: 1, totalPages: 1 },
         });

         const result = await getTransactionHistoryAction({
            page: 1,
            limit: 20,
         });
         expect(result.ok).toBe(true);
         if (result.ok) {
            expect(result.data.transactions).toHaveLength(1);
         }
      });
   });

   describe("adminAdjustBalanceAction", () => {
      it("allows authorized admin to credit balance with audit reason", async () => {
         vi.mocked(requireAdminModule.requireAdminUser).mockResolvedValue({
            id: "admin_1",
            username: "HostAdmin",
            displayName: "Host Admin",
            role: "ADMIN",
         });

         vi.mocked(walletRepo.executeWalletCredit).mockResolvedValue({
            wallet: { id: "w_1", totalBalance: 150 } as any,
            ledgerTransaction: { id: "tx_1", amount: 50 } as any,
            isDuplicate: false,
         });

         const result = await adminAdjustBalanceAction({
            targetUserId: "target_usr",
            amount: 50,
            reason: "Compensation for crashed timer",
         });

         expect(result.ok).toBe(true);
         expect(walletRepo.executeWalletCredit).toHaveBeenCalledWith(
            expect.objectContaining({
               userId: "target_usr",
               amount: 50,
               type: "ADMIN_ADJUSTMENT",
            })
         );
      });

      it("allows authorized admin to debit balance with audit reason", async () => {
         vi.mocked(requireAdminModule.requireAdminUser).mockResolvedValue({
            id: "admin_1",
            username: "HostAdmin",
            displayName: "Host Admin",
            role: "ADMIN",
         });

         vi.mocked(walletRepo.executeWalletDebit).mockResolvedValue({
            wallet: { id: "w_1", totalBalance: 50 } as any,
            ledgerTransaction: { id: "tx_2", amount: -50 } as any,
            isDuplicate: false,
         });

         const result = await adminAdjustBalanceAction({
            targetUserId: "target_usr",
            amount: -50,
            reason: "Correction of accidental double credit",
         });

         expect(result.ok).toBe(true);
         expect(walletRepo.executeWalletDebit).toHaveBeenCalledWith(
            expect.objectContaining({
               userId: "target_usr",
               amount: 50,
               type: "ADMIN_ADJUSTMENT",
            })
         );
      });

      it("rejects unauthorized participant attempting admin adjustment", async () => {
         vi.mocked(requireAdminModule.requireAdminUser).mockRejectedValue(
            new requireAdminModule.AdminAccessError()
         );

         const result = await adminAdjustBalanceAction({
            targetUserId: "target_usr",
            amount: 100,
            reason: "Unauthorized attempt",
         });

         expect(result.ok).toBe(false);
         expect(walletRepo.executeWalletCredit).not.toHaveBeenCalled();
      });

      it("rejects invalid input (zero amount or reason < 3 chars)", async () => {
         vi.mocked(requireAdminModule.requireAdminUser).mockResolvedValue({
            id: "admin_1",
            username: "HostAdmin",
            displayName: "Host Admin",
            role: "ADMIN",
         });

         const result1 = await adminAdjustBalanceAction({
            targetUserId: "target_usr",
            amount: 0,
            reason: "Valid reason",
         });
         expect(result1.ok).toBe(false);

         const result2 = await adminAdjustBalanceAction({
            targetUserId: "target_usr",
            amount: 50,
            reason: "no",
         });
         expect(result2.ok).toBe(false);
      });
   });

   describe("reconcileWalletAction", () => {
      it("allows user to reconcile their own wallet", async () => {
         vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
            id: "usr_1",
         } as any);

         vi.mocked(walletRepo.getOrCreateWallet).mockResolvedValue({
            id: "w_1",
            userId: "usr_1",
            totalBalance: 100,
            reservedBalance: 0,
            rewardProgressSeconds: 0,
            lifetimeEarned: 100,
            lifetimeSpent: 0,
         } as any);

         vi.mocked(ledgerRepo.getAllTransactionsForWallet).mockResolvedValue([
            {
               id: "tx_1",
               type: "STUDY_REWARD",
               amount: 100,
               totalDelta: 100,
               reservedDelta: 0,
               sourceType: "DAILY_STUDY_LOG",
               sourceId: "log_1",
               idempotencyKey: "key_1",
            } as any,
         ]);

         vi.mocked(rewardRepo.getAllRewardRecordsForWallet).mockResolvedValue([
            {
               id: "rec_1",
               studySessionId: "log_1",
               sourceType: "DAILY_STUDY_LOG",
               coinsCredited: 100,
               status: "PROCESSED",
               idempotencyKey: "key_1",
            } as any,
         ]);

         const result = await reconcileWalletAction();
         expect(result.ok).toBe(true);
         if (result.ok) {
            expect(result.data.isReconciled).toBe(true);
            expect(result.data.discrepancies).toHaveLength(0);
         }
      });

      it("requires admin permissions to audit another user's wallet", async () => {
         vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
            id: "usr_1",
         } as any);

         vi.mocked(requireAdminModule.requireAdminUser).mockRejectedValue(
            new requireAdminModule.AdminAccessError()
         );

         const result = await reconcileWalletAction({
            targetUserId: "other_user_2",
         });

         expect(result.ok).toBe(false);
         expect(walletRepo.getOrCreateWallet).not.toHaveBeenCalled();
      });
   });

   describe("reverseTransactionAction", () => {
      it("allows authorized admin to reverse a transaction with audit reason", async () => {
         vi.mocked(requireAdminModule.requireAdminUser).mockResolvedValue({
            id: "admin_1",
            username: "Admin",
            displayName: "Admin",
            role: "ADMIN",
         });

         vi.mocked(ledgerRepo.findTransactionById).mockResolvedValue({
            id: "tx_target",
            userId: "usr_1",
            type: "STUDY_REWARD",
         } as any);

         vi.mocked(walletRepo.executeWalletReversal).mockResolvedValue({
            wallet: { id: "w_1", totalBalance: 0 } as any,
            ledgerTransaction: { id: "tx_rev", type: "REVERSAL" } as any,
            isDuplicate: false,
         });

         const result = await reverseTransactionAction({
            transactionId: "tx_target",
            reason: "Timer glitch adjustment",
         });

         expect(result.ok).toBe(true);
         expect(walletRepo.executeWalletReversal).toHaveBeenCalledWith(
            expect.objectContaining({
               userId: "usr_1",
               originalTransactionId: "tx_target",
               reason: "Timer glitch adjustment",
               idempotencyKey: "reversal:tx_target",
            })
         );
      });

      it("rejects unauthorized participant attempting transaction reversal", async () => {
         vi.mocked(requireAdminModule.requireAdminUser).mockRejectedValue(
            new requireAdminModule.AdminAccessError()
         );

         const result = await reverseTransactionAction({
            transactionId: "tx_target",
            reason: "Unauthorized reversal attempt",
         });

         expect(result.ok).toBe(false);
         expect(walletRepo.executeWalletReversal).not.toHaveBeenCalled();
      });

      it("returns TRANSACTION_NOT_FOUND when target transaction does not exist", async () => {
         vi.mocked(requireAdminModule.requireAdminUser).mockResolvedValue({
            id: "admin_1",
            username: "Admin",
            displayName: "Admin",
            role: "ADMIN",
         });

         vi.mocked(ledgerRepo.findTransactionById).mockResolvedValue(null);

         const result = await reverseTransactionAction({
            transactionId: "tx_missing",
            reason: "Reversing nonexistent",
         });

         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("TRANSACTION_NOT_FOUND");
         }
      });
   });
});
