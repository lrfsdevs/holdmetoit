"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSessionUser } from "@/features/auth/api/require-session";
import { requireAdminUser } from "@/features/auth/api/require-admin";
import {
   getWalletSummary,
   executeWalletCredit,
   executeWalletDebit,
   executeWalletReversal,
   getOrCreateWallet,
} from "../data/wallet.repository";
import {
   findTransactionsByUserId,
   getAllTransactionsForWallet,
   findTransactionById,
} from "../data/ledger.repository";
import { getAllRewardRecordsForWallet } from "../data/study-reward.repository";
import { reconcileWalletState } from "../domain/reconciliation";
import { createLogger, logEvents } from "@/core/observability/logger";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";
import { FEATURE_FLAG_KEYS } from "@/features/feature-flags/domain/feature-flag-keys";
import { TransactionTypeValue } from "../domain/economy-constants";
import { toClientError } from "@/core/errors";

const logger = createLogger("economy.actions");

const WALLET_DISABLED = {
   ok: false as const,
   code: "FEATURE_DISABLED",
   message: "Wallet is currently unavailable.",
};

async function isWalletEnabled(): Promise<boolean> {
   return isFeatureEnabled(FEATURE_FLAG_KEYS.globalLeaderboard);
}

const getHistorySchema = z.object({
   page: z.number().int().min(1).optional().default(1),
   limit: z.number().int().min(1).max(100).optional().default(20),
   type: z.string().optional(),
});

export async function getWalletSummaryAction() {
   try {
      if (!(await isWalletEnabled())) {
         return WALLET_DISABLED;
      }

      const user = await requireSessionUser();
      const summary = await getWalletSummary(user.id);
      return { ok: true as const, data: summary };
   } catch (error) {
      const clientError = toClientError(error, {
         scope: "economy.wallet.summary",
         defaultCode: "WALLET_FETCH_FAILED",
         defaultMessage: "Failed to load wallet summary.",
      });
      return {
         ok: false as const,
         code: clientError.code,
         message: clientError.message,
      };
   }
}

export async function getTransactionHistoryAction(
   rawInput?: z.infer<typeof getHistorySchema>
) {
   try {
      if (!(await isWalletEnabled())) {
         return WALLET_DISABLED;
      }

      const user = await requireSessionUser();
      const parsed = getHistorySchema.safeParse(rawInput ?? {});
      if (!parsed.success) {
         return {
            ok: false as const,
            code: "INVALID_INPUT",
            message: "Invalid pagination options.",
         };
      }

      const { page, limit, type } = parsed.data;
      const result = await findTransactionsByUserId(user.id, {
         page,
         limit,
         type: type as TransactionTypeValue,
      });

      return {
         ok: true as const,
         data: result,
      };
   } catch (error) {
      const clientError = toClientError(error, {
         scope: "economy.wallet.history",
         defaultCode: "HISTORY_FETCH_FAILED",
         defaultMessage: "Failed to load transaction history.",
      });
      return {
         ok: false as const,
         code: clientError.code,
         message: clientError.message,
      };
   }
}

const adminAdjustSchema = z.object({
   targetUserId: z.string().min(1, "Target user ID is required"),
   amount: z
      .number()
      .int()
      .refine((val) => val !== 0, {
         message: "Adjustment amount must not be zero.",
      }),
   reason: z
      .string()
      .min(3, "Adjustment reason must be at least 3 characters."),
   idempotencyKey: z.string().optional(),
});

export async function adminAdjustBalanceAction(
   rawInput: z.infer<typeof adminAdjustSchema>
) {
   try {
      if (!(await isWalletEnabled())) {
         return WALLET_DISABLED;
      }

      const admin = await requireAdminUser();
      const parsed = adminAdjustSchema.safeParse(rawInput);
      if (!parsed.success) {
         return {
            ok: false as const,
            code: "INVALID_INPUT",
            message: parsed.error.issues[0]?.message ?? "Invalid input.",
         };
      }

      const { targetUserId, amount, reason } = parsed.data;
      const idempotencyKey =
         parsed.data.idempotencyKey ||
         `admin-adjust:${admin.id}:${targetUserId}:${Date.now()}`;

      let result;
      if (amount > 0) {
         result = await executeWalletCredit({
            userId: targetUserId,
            amount,
            type: "ADMIN_ADJUSTMENT",
            description: `Admin adjustment (+${amount} coins): ${reason}`,
            idempotencyKey,
            sourceType: "ADMIN_ADJUSTMENT",
            sourceId: admin.id,
            metadata: {
               adminId: admin.id,
               adminUsername: admin.username,
               reason,
            },
         });
      } else {
         result = await executeWalletDebit({
            userId: targetUserId,
            amount: Math.abs(amount),
            type: "ADMIN_ADJUSTMENT",
            description: `Admin adjustment (${amount} coins): ${reason}`,
            idempotencyKey,
            sourceType: "ADMIN_ADJUSTMENT",
            sourceId: admin.id,
            metadata: {
               adminId: admin.id,
               adminUsername: admin.username,
               reason,
            },
         });
      }

      revalidatePath("/wallet");
      revalidatePath("/admin");

      logger.info(logEvents.economyAdminAdjusted, {
         context: {
            adminId: admin.id,
            targetUserId,
            amount,
            reason,
         },
      });

      return {
         ok: true as const,
         data: {
            wallet: result.wallet,
            transaction: result.ledgerTransaction,
         },
      };
   } catch (error) {
      const clientError = toClientError(error, {
         scope: "economy.wallet.admin_adjust",
         defaultCode: "ADMIN_ADJUST_FAILED",
         defaultMessage: "Failed to apply balance adjustment.",
         context: {
            action: "adminAdjustBalanceAction",
            targetUserId: rawInput?.targetUserId,
         },
      });
      return {
         ok: false as const,
         code: clientError.code,
         message: clientError.message,
      };
   }
}

const reconcileSchema = z.object({
   targetUserId: z.string().optional(),
});

export async function reconcileWalletAction(
   rawInput?: z.infer<typeof reconcileSchema>
) {
   try {
      if (!(await isWalletEnabled())) {
         return WALLET_DISABLED;
      }

      const sessionUser = await requireSessionUser();
      const parsed = reconcileSchema.safeParse(rawInput ?? {});
      const targetUserId =
         parsed.success && parsed.data.targetUserId
            ? parsed.data.targetUserId
            : sessionUser.id;

      // If targeting another user's wallet, verify admin privileges
      if (targetUserId !== sessionUser.id) {
         await requireAdminUser();
      }

      const wallet = await getOrCreateWallet(targetUserId);
      const [ledgerTransactions, studyRewardRecords] = await Promise.all([
         getAllTransactionsForWallet(wallet.id),
         getAllRewardRecordsForWallet(wallet.id),
      ]);

      const report = reconcileWalletState({
         wallet,
         ledgerTransactions,
         studyRewardRecords,
      });

      if (!report.isReconciled) {
         logger.warn(logEvents.economyReconciliationDiscrepancy, {
            context: {
               userId: targetUserId,
               discrepanciesCount: report.discrepancies.length,
            },
         });
      }

      return {
         ok: true as const,
         data: report,
      };
   } catch (error) {
      const clientError = toClientError(error, {
         scope: "economy.wallet.reconcile",
         defaultCode: "RECONCILIATION_FAILED",
         defaultMessage: "Failed to run wallet reconciliation.",
      });
      return {
         ok: false as const,
         code: clientError.code,
         message: clientError.message,
      };
   }
}

const reversalSchema = z.object({
   transactionId: z.string().min(1, "Transaction ID is required"),
   reason: z.string().min(3, "Reversal reason must be at least 3 characters."),
   idempotencyKey: z.string().optional(),
});

export async function reverseTransactionAction(
   rawInput: z.infer<typeof reversalSchema>
) {
   try {
      if (!(await isWalletEnabled())) {
         return WALLET_DISABLED;
      }

      const admin = await requireAdminUser();
      const parsed = reversalSchema.safeParse(rawInput);
      if (!parsed.success) {
         return {
            ok: false as const,
            code: "INVALID_INPUT",
            message: parsed.error.issues[0]?.message ?? "Invalid input.",
         };
      }

      const { transactionId, reason } = parsed.data;
      const idempotencyKey =
         parsed.data.idempotencyKey || `reversal:${transactionId}`;

      // Look up target transaction
      const targetTx = await findTransactionById(transactionId);

      if (!targetTx) {
         return {
            ok: false as const,
            code: "TRANSACTION_NOT_FOUND",
            message: "Transaction to reverse was not found.",
         };
      }

      const result = await executeWalletReversal({
         userId: targetTx.userId,
         originalTransactionId: transactionId,
         reason,
         idempotencyKey,
      });

      revalidatePath("/wallet");
      revalidatePath("/admin");

      logger.info(logEvents.economyReversalApplied, {
         context: {
            adminId: admin.id,
            targetTxId: transactionId,
            userId: targetTx.userId,
            reason,
         },
      });

      return {
         ok: true as const,
         data: result,
      };
   } catch (error) {
      const clientError = toClientError(error, {
         scope: "economy.wallet.reverse",
         defaultCode: "REVERSAL_FAILED",
         defaultMessage: "Failed to reverse transaction.",
         context: { transactionId: rawInput?.transactionId },
      });
      return {
         ok: false as const,
         code: clientError.code,
         message: clientError.message,
      };
   }
}
