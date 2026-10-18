import { WalletSummary } from "./wallet-accounting";

export type DiscrepancyCode =
   | "TOTAL_BALANCE_MISMATCH"
   | "RESERVED_BALANCE_MISMATCH"
   | "NEGATIVE_AVAILABLE_BALANCE"
   | "RESERVED_EXCEEDS_TOTAL"
   | "MISSING_LEDGER_FOR_REWARD"
   | "DUPLICATE_REWARD_RECORD"
   | "INVALID_REVERSAL_RELATIONSHIP"
   | "DUPLICATE_REVERSAL"
   | "LIFETIME_COUNTER_MISMATCH"
   | "INVARIANT_VIOLATION";

export interface ReconciliationDiscrepancy {
   code: DiscrepancyCode;
   message: string;
   expected?: number | string;
   actual?: number | string;
}

export interface MinimalLedgerTx {
   id: string;
   type: string;
   amount: number;
   totalDelta: number;
   reservedDelta: number;
   sourceType?: string | null;
   sourceId?: string | null;
   idempotencyKey: string;
   relatedTransactionId?: string | null;
}

export interface MinimalRewardRecord {
   id: string;
   studySessionId: string;
   sourceType: string;
   coinsCredited: number;
   status: string;
   idempotencyKey: string;
}

export interface ReconciliationReport {
   isReconciled: boolean;
   walletId: string;
   userId: string;
   walletTotal: number;
   ledgerTotal: number;
   walletReserved: number;
   ledgerReserved: number;
   availableBalance: number;
   discrepancies: ReconciliationDiscrepancy[];
   auditedAt: Date;
}

/**
 * Pure domain engine for auditing and reconciling a wallet's accounting state against
 * its append-only ledger transactions and study reward records.
 */
export function reconcileWalletState(input: {
   wallet: {
      id: string;
      userId: string;
      totalBalance: number;
      reservedBalance: number;
      rewardProgressSeconds: number;
      lifetimeEarned: number;
      lifetimeSpent: number;
   };
   ledgerTransactions: MinimalLedgerTx[];
   studyRewardRecords: MinimalRewardRecord[];
   auditedAt?: Date;
}): ReconciliationReport {
   const {
      wallet,
      ledgerTransactions,
      studyRewardRecords,
      auditedAt = new Date(),
   } = input;
   const discrepancies: ReconciliationDiscrepancy[] = [];

   // 1. Calculate ledger-derived totals
   const ledgerTotal = ledgerTransactions.reduce(
      (sum, tx) => sum + tx.totalDelta,
      0
   );
   const ledgerReserved = ledgerTransactions.reduce(
      (sum, tx) => sum + tx.reservedDelta,
      0
   );
   const availableBalance = wallet.totalBalance - wallet.reservedBalance;

   // 2. Validate total balance equality
   if (wallet.totalBalance !== ledgerTotal) {
      discrepancies.push({
         code: "TOTAL_BALANCE_MISMATCH",
         message: `Wallet total balance (${wallet.totalBalance}) does not match cumulative ledger delta (${ledgerTotal}).`,
         expected: ledgerTotal,
         actual: wallet.totalBalance,
      });
   }

   // 3. Validate reserved balance equality
   if (wallet.reservedBalance !== ledgerReserved) {
      discrepancies.push({
         code: "RESERVED_BALANCE_MISMATCH",
         message: `Wallet reserved balance (${wallet.reservedBalance}) does not match cumulative ledger reserved delta (${ledgerReserved}).`,
         expected: ledgerReserved,
         actual: wallet.reservedBalance,
      });
   }

   // 4. Validate available balance invariant
   if (availableBalance < 0) {
      discrepancies.push({
         code: "NEGATIVE_AVAILABLE_BALANCE",
         message: `Wallet available balance is negative (${availableBalance}).`,
         expected: ">= 0",
         actual: availableBalance,
      });
   }

   // 5. Validate reserved does not exceed total
   if (wallet.reservedBalance > wallet.totalBalance) {
      discrepancies.push({
         code: "RESERVED_EXCEEDS_TOTAL",
         message: `Reserved balance (${wallet.reservedBalance}) exceeds total balance (${wallet.totalBalance}).`,
         expected: `<= ${wallet.totalBalance}`,
         actual: wallet.reservedBalance,
      });
   }

   // 6. Check for duplicate study reward records for the same source session
   const sessionCounts = new Map<string, number>();
   for (const reward of studyRewardRecords) {
      const key = `${reward.sourceType}:${reward.studySessionId}`;
      const count = (sessionCounts.get(key) ?? 0) + 1;
      sessionCounts.set(key, count);
      if (count === 2) {
         discrepancies.push({
            code: "DUPLICATE_REWARD_RECORD",
            message: `Multiple reward records found for study source: ${key}.`,
            expected: 1,
            actual: count,
         });
      }
   }

   // 7. Verify every study reward with coinsCredited > 0 has an associated ledger entry
   for (const reward of studyRewardRecords) {
      if (reward.coinsCredited > 0 && reward.status === "PROCESSED") {
         const matchingTx = ledgerTransactions.find(
            (tx) =>
               tx.type === "STUDY_REWARD" &&
               (tx.sourceId === reward.studySessionId ||
                  tx.idempotencyKey.includes(reward.studySessionId))
         );

         if (!matchingTx) {
            discrepancies.push({
               code: "MISSING_LEDGER_FOR_REWARD",
               message: `Study reward for session ${reward.studySessionId} (+${reward.coinsCredited} coins) lacks a matching STUDY_REWARD ledger entry.`,
               expected: reward.studySessionId,
               actual: "None",
            });
         } else if (matchingTx.amount !== reward.coinsCredited) {
            discrepancies.push({
               code: "TOTAL_BALANCE_MISMATCH",
               message: `Ledger transaction amount (${matchingTx.amount}) does not match reward credited amount (${reward.coinsCredited}).`,
               expected: reward.coinsCredited,
               actual: matchingTx.amount,
            });
         }
      }
   }

   // 8. Reversal relationship checks
   const reversedCounts = new Map<string, number>();
   for (const tx of ledgerTransactions) {
      if (tx.type === "REVERSAL") {
         if (tx.relatedTransactionId) {
            const originalExists = ledgerTransactions.some(
               (t) => t.id === tx.relatedTransactionId
            );
            if (!originalExists) {
               discrepancies.push({
                  code: "INVALID_REVERSAL_RELATIONSHIP",
                  message: `Reversal transaction (${tx.id}) references nonexistent original transaction (${tx.relatedTransactionId}).`,
                  expected: tx.relatedTransactionId,
                  actual: "Not found",
               });
            }
            const count =
               (reversedCounts.get(tx.relatedTransactionId) ?? 0) + 1;
            reversedCounts.set(tx.relatedTransactionId, count);
            if (count > 1) {
               discrepancies.push({
                  code: "DUPLICATE_REVERSAL",
                  message: `Original transaction (${tx.relatedTransactionId}) has been reversed multiple times.`,
                  expected: 1,
                  actual: count,
               });
            }
         }
      }
   }

   // 9. Wallet state invariant bounds check
   if (wallet.rewardProgressSeconds < 0 || wallet.rewardProgressSeconds >= 36) {
      discrepancies.push({
         code: "INVARIANT_VIOLATION",
         message: `Wallet rewardProgressSeconds (${wallet.rewardProgressSeconds}) is out of bounds [0, 35].`,
         expected: "0 <= s < 36",
         actual: wallet.rewardProgressSeconds,
      });
   }
   if (wallet.lifetimeEarned < 0 || wallet.lifetimeSpent < 0) {
      discrepancies.push({
         code: "INVARIANT_VIOLATION",
         message: `Negative lifetime counter detected (earned: ${wallet.lifetimeEarned}, spent: ${wallet.lifetimeSpent}).`,
         expected: ">= 0",
         actual: `earned: ${wallet.lifetimeEarned}, spent: ${wallet.lifetimeSpent}`,
      });
   }

   return {
      isReconciled: discrepancies.length === 0,
      walletId: wallet.id,
      userId: wallet.userId,
      walletTotal: wallet.totalBalance,
      ledgerTotal,
      walletReserved: wallet.reservedBalance,
      ledgerReserved,
      availableBalance,
      discrepancies,
      auditedAt,
   };
}
