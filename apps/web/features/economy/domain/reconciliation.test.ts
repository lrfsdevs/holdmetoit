import { describe, expect, it } from "vitest";
import {
   reconcileWalletState,
   type MinimalLedgerTx,
   type MinimalRewardRecord,
} from "./reconciliation";

describe("reconciliation domain audits", () => {
   const baseWallet = {
      id: "wallet_123",
      userId: "user_123",
      totalBalance: 100,
      reservedBalance: 25,
      rewardProgressSeconds: 0,
      lifetimeEarned: 100,
      lifetimeSpent: 0,
   };

   const validTxs: MinimalLedgerTx[] = [
      {
         id: "tx_1",
         type: "STUDY_REWARD",
         amount: 100,
         totalDelta: 100,
         reservedDelta: 0,
         sourceType: "DAILY_STUDY_LOG",
         sourceId: "session_abc",
         idempotencyKey: "study-log:session_abc",
      },
      {
         id: "tx_2",
         type: "WAGER_RESERVATION",
         amount: 25,
         totalDelta: 0,
         reservedDelta: 25,
         sourceType: "WAGER",
         sourceId: "wager_xyz",
         idempotencyKey: "wager-res:wager_xyz",
      },
   ];

   const validRewards: MinimalRewardRecord[] = [
      {
         id: "reward_1",
         studySessionId: "session_abc",
         sourceType: "DAILY_STUDY_LOG",
         coinsCredited: 100,
         status: "PROCESSED",
         idempotencyKey: "study-log:session_abc",
      },
   ];

   it("1. passes clean audit for a perfectly reconciled wallet", () => {
      const report = reconcileWalletState({
         wallet: baseWallet,
         ledgerTransactions: validTxs,
         studyRewardRecords: validRewards,
      });

      expect(report.isReconciled).toBe(true);
      expect(report.discrepancies).toHaveLength(0);
      expect(report.walletTotal).toBe(100);
      expect(report.ledgerTotal).toBe(100);
      expect(report.walletReserved).toBe(25);
      expect(report.ledgerReserved).toBe(25);
      expect(report.availableBalance).toBe(75);
   });

   it("2. detects mismatched total balance between wallet and ledger", () => {
      const report = reconcileWalletState({
         wallet: { ...baseWallet, totalBalance: 150 }, // Discrepancy!
         ledgerTransactions: validTxs,
         studyRewardRecords: validRewards,
      });

      expect(report.isReconciled).toBe(false);
      expect(
         report.discrepancies.some((d) => d.code === "TOTAL_BALANCE_MISMATCH")
      ).toBe(true);
   });

   it("3. detects mismatched reserved balance between wallet and ledger", () => {
      const report = reconcileWalletState({
         wallet: { ...baseWallet, reservedBalance: 10 }, // Ledger has 25!
         ledgerTransactions: validTxs,
         studyRewardRecords: validRewards,
      });

      expect(report.isReconciled).toBe(false);
      expect(
         report.discrepancies.some(
            (d) => d.code === "RESERVED_BALANCE_MISMATCH"
         )
      ).toBe(true);
   });

   it("4. detects reserved balance exceeding total balance", () => {
      const report = reconcileWalletState({
         wallet: { ...baseWallet, totalBalance: 20, reservedBalance: 50 },
         ledgerTransactions: [],
         studyRewardRecords: [],
      });

      expect(report.isReconciled).toBe(false);
      expect(
         report.discrepancies.some((d) => d.code === "RESERVED_EXCEEDS_TOTAL")
      ).toBe(true);
      expect(
         report.discrepancies.some(
            (d) => d.code === "NEGATIVE_AVAILABLE_BALANCE"
         )
      ).toBe(true);
   });

   it("5. detects duplicate reward records for the same source session", () => {
      const duplicateRewards: MinimalRewardRecord[] = [
         ...validRewards,
         {
            id: "reward_duplicate",
            studySessionId: "session_abc", // duplicate!
            sourceType: "DAILY_STUDY_LOG",
            coinsCredited: 100,
            status: "PROCESSED",
            idempotencyKey: "duplicate_key",
         },
      ];

      const report = reconcileWalletState({
         wallet: baseWallet,
         ledgerTransactions: validTxs,
         studyRewardRecords: duplicateRewards,
      });

      expect(report.isReconciled).toBe(false);
      expect(
         report.discrepancies.some((d) => d.code === "DUPLICATE_REWARD_RECORD")
      ).toBe(true);
   });

   it("6. detects study reward lacking an associated ledger entry", () => {
      const orphanRewards: MinimalRewardRecord[] = [
         {
            id: "reward_orphan",
            studySessionId: "session_orphan",
            sourceType: "DAILY_STUDY_LOG",
            coinsCredited: 50,
            status: "PROCESSED",
            idempotencyKey: "orphan_key",
         },
      ];

      const report = reconcileWalletState({
         wallet: { ...baseWallet, totalBalance: 100, reservedBalance: 25 },
         ledgerTransactions: validTxs, // No session_orphan transaction
         studyRewardRecords: orphanRewards,
      });

      expect(report.isReconciled).toBe(false);
      expect(
         report.discrepancies.some(
            (d) => d.code === "MISSING_LEDGER_FOR_REWARD"
         )
      ).toBe(true);
   });

   it("7. detects reversal referencing nonexistent original transaction", () => {
      const invalidReversalTx: MinimalLedgerTx[] = [
         ...validTxs,
         {
            id: "rev_1",
            type: "REVERSAL",
            amount: -50,
            totalDelta: -50,
            reservedDelta: 0,
            idempotencyKey: "rev:fake",
            relatedTransactionId: "nonexistent_tx_999",
         },
      ];

      const report = reconcileWalletState({
         wallet: { ...baseWallet, totalBalance: 50 },
         ledgerTransactions: invalidReversalTx,
         studyRewardRecords: validRewards,
      });

      expect(report.isReconciled).toBe(false);
      expect(
         report.discrepancies.some(
            (d) => d.code === "INVALID_REVERSAL_RELATIONSHIP"
         )
      ).toBe(true);
   });

   it("8. detects duplicate reversal on the same transaction", () => {
      const duplicateReversals: MinimalLedgerTx[] = [
         ...validTxs,
         {
            id: "rev_1",
            type: "REVERSAL",
            amount: -50,
            totalDelta: -50,
            reservedDelta: 0,
            idempotencyKey: "rev:1",
            relatedTransactionId: "tx_1",
         },
         {
            id: "rev_2",
            type: "REVERSAL",
            amount: -50,
            totalDelta: -50,
            reservedDelta: 0,
            idempotencyKey: "rev:2",
            relatedTransactionId: "tx_1", // Duplicate reversal of tx_1!
         },
      ];

      const report = reconcileWalletState({
         wallet: { ...baseWallet, totalBalance: 0 },
         ledgerTransactions: duplicateReversals,
         studyRewardRecords: validRewards,
      });

      expect(report.isReconciled).toBe(false);
      expect(
         report.discrepancies.some((d) => d.code === "DUPLICATE_REVERSAL")
      ).toBe(true);
   });

   it("9. detects wallet invariant violations (progress out of bounds or negative lifetime)", () => {
      const report = reconcileWalletState({
         wallet: {
            ...baseWallet,
            rewardProgressSeconds: 45,
            lifetimeEarned: -10,
         },
         ledgerTransactions: validTxs,
         studyRewardRecords: validRewards,
      });

      expect(report.isReconciled).toBe(false);
      expect(
         report.discrepancies.some((d) => d.code === "INVARIANT_VIOLATION")
      ).toBe(true);
   });
});
