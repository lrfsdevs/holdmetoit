import { prisma } from "@/core/db";
import { Prisma } from "@prisma/client";
import {
   applyCredit,
   applyDebit,
   applyRelease,
   applyReservation,
   applyReversal,
   applySettlement,
   toWalletSummary,
   validateWalletInvariants,
   type WalletState,
   type WalletSummary,
} from "../domain/wallet-accounting";
import { TransactionTypeValue } from "../domain/economy-constants";

const MAX_SERIALIZATION_RETRIES = 3;

function isSerializationConflict(error: unknown): boolean {
   return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
   );
}

export async function getOrCreateWallet(
   userId: string,
   client: Prisma.TransactionClient | typeof prisma = prisma
) {
   let wallet = await client.wallet.findUnique({
      where: { userId },
   });

   if (!wallet) {
      try {
         wallet = await client.wallet.create({
            data: {
               userId,
               totalBalance: 0,
               reservedBalance: 0,
               rewardProgressSeconds: 0,
               lifetimeEarned: 0,
               lifetimeSpent: 0,
            },
         });
      } catch (error) {
         // Handle concurrent creation conflict gracefully
         if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
         ) {
            wallet = await client.wallet.findUniqueOrThrow({
               where: { userId },
            });
         } else {
            throw error;
         }
      }
   }

   return wallet;
}

export async function getWalletSummary(userId: string): Promise<WalletSummary> {
   const wallet = await getOrCreateWallet(userId);
   return toWalletSummary({
      totalBalance: wallet.totalBalance,
      reservedBalance: wallet.reservedBalance,
      rewardProgressSeconds: wallet.rewardProgressSeconds,
      lifetimeEarned: wallet.lifetimeEarned,
      lifetimeSpent: wallet.lifetimeSpent,
   });
}

export interface CreditWalletParams {
   userId: string;
   amount: number;
   type: TransactionTypeValue;
   description: string;
   idempotencyKey: string;
   sourceType?: string;
   sourceId?: string;
   metadata?: Record<string, any>;
}

export async function executeWalletCredit(params: CreditWalletParams) {
   for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
         return await prisma.$transaction(
            async (tx) => {
               // 1. Check idempotency
               const existingTx = await tx.ledgerTransaction.findUnique({
                  where: { idempotencyKey: params.idempotencyKey },
               });
               if (existingTx) {
                  const currentWallet = await tx.wallet.findUniqueOrThrow({
                     where: { id: existingTx.walletId },
                  });
                  return {
                     wallet: currentWallet,
                     ledgerTransaction: existingTx,
                     isDuplicate: true,
                  };
               }

               // 2. Fetch or create wallet
               const wallet = await getOrCreateWallet(params.userId, tx);

               // 3. Apply pure domain math
               const { nextState, totalDelta, reservedDelta } = applyCredit(
                  {
                     totalBalance: wallet.totalBalance,
                     reservedBalance: wallet.reservedBalance,
                     rewardProgressSeconds: wallet.rewardProgressSeconds,
                     lifetimeEarned: wallet.lifetimeEarned,
                     lifetimeSpent: wallet.lifetimeSpent,
                  },
                  params.amount
               );

               // 4. Update wallet
               const updatedWallet = await tx.wallet.update({
                  where: { id: wallet.id },
                  data: {
                     totalBalance: nextState.totalBalance,
                     lifetimeEarned: nextState.lifetimeEarned,
                  },
               });

               // 5. Append immutable ledger transaction
               const ledgerTransaction = await tx.ledgerTransaction.create({
                  data: {
                     walletId: wallet.id,
                     userId: params.userId,
                     type: params.type as any,
                     amount: params.amount,
                     totalDelta,
                     reservedDelta,
                     sourceType: params.sourceType,
                     sourceId: params.sourceId,
                     idempotencyKey: params.idempotencyKey,
                     description: params.description,
                     metadata: params.metadata,
                  },
               });

               return {
                  wallet: updatedWallet,
                  ledgerTransaction,
                  isDuplicate: false,
               };
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
         );
      } catch (error) {
         if (
            !isSerializationConflict(error) ||
            attempt === MAX_SERIALIZATION_RETRIES - 1
         ) {
            throw error;
         }
      }
   }

   throw new Error("Failed to execute wallet credit after maximum retries.");
}

export interface DebitWalletParams {
   userId: string;
   amount: number;
   type: TransactionTypeValue;
   description: string;
   idempotencyKey: string;
   sourceType?: string;
   sourceId?: string;
   metadata?: Record<string, any>;
}

export async function executeWalletDebit(params: DebitWalletParams) {
   for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
         return await prisma.$transaction(
            async (tx) => {
               // 1. Check idempotency
               const existingTx = await tx.ledgerTransaction.findUnique({
                  where: { idempotencyKey: params.idempotencyKey },
               });
               if (existingTx) {
                  const currentWallet = await tx.wallet.findUniqueOrThrow({
                     where: { id: existingTx.walletId },
                  });
                  return {
                     wallet: currentWallet,
                     ledgerTransaction: existingTx,
                     isDuplicate: true,
                  };
               }

               // 2. Fetch wallet
               const wallet = await getOrCreateWallet(params.userId, tx);

               // 3. Apply pure domain debit
               const { nextState, totalDelta, reservedDelta } = applyDebit(
                  {
                     totalBalance: wallet.totalBalance,
                     reservedBalance: wallet.reservedBalance,
                     rewardProgressSeconds: wallet.rewardProgressSeconds,
                     lifetimeEarned: wallet.lifetimeEarned,
                     lifetimeSpent: wallet.lifetimeSpent,
                  },
                  params.amount
               );

               // 4. Update wallet
               const updatedWallet = await tx.wallet.update({
                  where: { id: wallet.id },
                  data: {
                     totalBalance: nextState.totalBalance,
                     lifetimeSpent: nextState.lifetimeSpent,
                  },
               });

               // 5. Append ledger transaction
               const ledgerTransaction = await tx.ledgerTransaction.create({
                  data: {
                     walletId: wallet.id,
                     userId: params.userId,
                     type: params.type as any,
                     amount: -params.amount,
                     totalDelta,
                     reservedDelta,
                     sourceType: params.sourceType,
                     sourceId: params.sourceId,
                     idempotencyKey: params.idempotencyKey,
                     description: params.description,
                     metadata: params.metadata,
                  },
               });

               return {
                  wallet: updatedWallet,
                  ledgerTransaction,
                  isDuplicate: false,
               };
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
         );
      } catch (error) {
         if (
            !isSerializationConflict(error) ||
            attempt === MAX_SERIALIZATION_RETRIES - 1
         ) {
            throw error;
         }
      }
   }

   throw new Error("Failed to execute wallet debit after maximum retries.");
}

export interface ReservationParams {
   userId: string;
   amount: number;
   type: TransactionTypeValue;
   description: string;
   idempotencyKey: string;
   sourceType?: string;
   sourceId?: string;
   metadata?: Record<string, any>;
}

export async function executeWalletReservation(params: ReservationParams) {
   for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
         return await prisma.$transaction(
            async (tx) => {
               const existingTx = await tx.ledgerTransaction.findUnique({
                  where: { idempotencyKey: params.idempotencyKey },
               });
               if (existingTx) {
                  const currentWallet = await tx.wallet.findUniqueOrThrow({
                     where: { id: existingTx.walletId },
                  });
                  return {
                     wallet: currentWallet,
                     ledgerTransaction: existingTx,
                     isDuplicate: true,
                  };
               }

               const wallet = await getOrCreateWallet(params.userId, tx);
               const { nextState, totalDelta, reservedDelta } =
                  applyReservation(
                     {
                        totalBalance: wallet.totalBalance,
                        reservedBalance: wallet.reservedBalance,
                        rewardProgressSeconds: wallet.rewardProgressSeconds,
                        lifetimeEarned: wallet.lifetimeEarned,
                        lifetimeSpent: wallet.lifetimeSpent,
                     },
                     params.amount
                  );

               const updatedWallet = await tx.wallet.update({
                  where: { id: wallet.id },
                  data: {
                     reservedBalance: nextState.reservedBalance,
                  },
               });

               const ledgerTransaction = await tx.ledgerTransaction.create({
                  data: {
                     walletId: wallet.id,
                     userId: params.userId,
                     type: params.type as any,
                     amount: params.amount,
                     totalDelta,
                     reservedDelta,
                     sourceType: params.sourceType,
                     sourceId: params.sourceId,
                     idempotencyKey: params.idempotencyKey,
                     description: params.description,
                     metadata: params.metadata,
                  },
               });

               return {
                  wallet: updatedWallet,
                  ledgerTransaction,
                  isDuplicate: false,
               };
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
         );
      } catch (error) {
         if (
            !isSerializationConflict(error) ||
            attempt === MAX_SERIALIZATION_RETRIES - 1
         ) {
            throw error;
         }
      }
   }

   throw new Error(
      "Failed to execute wallet reservation after maximum retries."
   );
}

export async function executeWalletRelease(params: ReservationParams) {
   for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
         return await prisma.$transaction(
            async (tx) => {
               const existingTx = await tx.ledgerTransaction.findUnique({
                  where: { idempotencyKey: params.idempotencyKey },
               });
               if (existingTx) {
                  const currentWallet = await tx.wallet.findUniqueOrThrow({
                     where: { id: existingTx.walletId },
                  });
                  return {
                     wallet: currentWallet,
                     ledgerTransaction: existingTx,
                     isDuplicate: true,
                  };
               }

               const wallet = await getOrCreateWallet(params.userId, tx);
               const { nextState, totalDelta, reservedDelta } = applyRelease(
                  {
                     totalBalance: wallet.totalBalance,
                     reservedBalance: wallet.reservedBalance,
                     rewardProgressSeconds: wallet.rewardProgressSeconds,
                     lifetimeEarned: wallet.lifetimeEarned,
                     lifetimeSpent: wallet.lifetimeSpent,
                  },
                  params.amount
               );

               const updatedWallet = await tx.wallet.update({
                  where: { id: wallet.id },
                  data: {
                     reservedBalance: nextState.reservedBalance,
                  },
               });

               const ledgerTransaction = await tx.ledgerTransaction.create({
                  data: {
                     walletId: wallet.id,
                     userId: params.userId,
                     type: params.type as any,
                     amount: params.amount,
                     totalDelta,
                     reservedDelta,
                     sourceType: params.sourceType,
                     sourceId: params.sourceId,
                     idempotencyKey: params.idempotencyKey,
                     description: params.description,
                     metadata: params.metadata,
                  },
               });

               return {
                  wallet: updatedWallet,
                  ledgerTransaction,
                  isDuplicate: false,
               };
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
         );
      } catch (error) {
         if (
            !isSerializationConflict(error) ||
            attempt === MAX_SERIALIZATION_RETRIES - 1
         ) {
            throw error;
         }
      }
   }

   throw new Error("Failed to execute wallet release after maximum retries.");
}

export async function executeWalletSettlement(params: ReservationParams) {
   for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
         return await prisma.$transaction(
            async (tx) => {
               const existingTx = await tx.ledgerTransaction.findUnique({
                  where: { idempotencyKey: params.idempotencyKey },
               });
               if (existingTx) {
                  const currentWallet = await tx.wallet.findUniqueOrThrow({
                     where: { id: existingTx.walletId },
                  });
                  return {
                     wallet: currentWallet,
                     ledgerTransaction: existingTx,
                     isDuplicate: true,
                  };
               }

               const wallet = await getOrCreateWallet(params.userId, tx);
               const { nextState, totalDelta, reservedDelta } = applySettlement(
                  {
                     totalBalance: wallet.totalBalance,
                     reservedBalance: wallet.reservedBalance,
                     rewardProgressSeconds: wallet.rewardProgressSeconds,
                     lifetimeEarned: wallet.lifetimeEarned,
                     lifetimeSpent: wallet.lifetimeSpent,
                  },
                  params.amount
               );

               const updatedWallet = await tx.wallet.update({
                  where: { id: wallet.id },
                  data: {
                     totalBalance: nextState.totalBalance,
                     reservedBalance: nextState.reservedBalance,
                     lifetimeSpent: nextState.lifetimeSpent,
                  },
               });

               const ledgerTransaction = await tx.ledgerTransaction.create({
                  data: {
                     walletId: wallet.id,
                     userId: params.userId,
                     type: params.type as any,
                     amount: -params.amount,
                     totalDelta,
                     reservedDelta,
                     sourceType: params.sourceType,
                     sourceId: params.sourceId,
                     idempotencyKey: params.idempotencyKey,
                     description: params.description,
                     metadata: params.metadata,
                  },
               });

               return {
                  wallet: updatedWallet,
                  ledgerTransaction,
                  isDuplicate: false,
               };
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
         );
      } catch (error) {
         if (
            !isSerializationConflict(error) ||
            attempt === MAX_SERIALIZATION_RETRIES - 1
         ) {
            throw error;
         }
      }
   }

   throw new Error(
      "Failed to execute wallet settlement after maximum retries."
   );
}

export interface ReversalParams {
   userId: string;
   originalTransactionId: string;
   reason: string;
   idempotencyKey: string;
}

export async function executeWalletReversal(params: ReversalParams) {
   for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
         return await prisma.$transaction(
            async (tx) => {
               // 1. Check idempotency
               const existingReversal = await tx.ledgerTransaction.findUnique({
                  where: { idempotencyKey: params.idempotencyKey },
               });
               if (existingReversal) {
                  const currentWallet = await tx.wallet.findUniqueOrThrow({
                     where: { id: existingReversal.walletId },
                  });
                  return {
                     wallet: currentWallet,
                     ledgerTransaction: existingReversal,
                     isDuplicate: true,
                  };
               }

               // 2. Fetch original transaction
               const original = await tx.ledgerTransaction.findUnique({
                  where: { id: params.originalTransactionId },
                  include: { reversals: true },
               });

               if (!original) {
                  throw new Error("Original transaction to reverse not found.");
               }

               if (original.userId !== params.userId) {
                  throw new Error(
                     "Transaction does not belong to the specified user."
                  );
               }

               if (original.type === "REVERSAL") {
                  throw new Error("Cannot reverse a reversal transaction.");
               }

               if (original.reversals.length > 0) {
                  throw new Error(
                     "This transaction has already been reversed."
                  );
               }

               // 3. Fetch wallet
               const wallet = await getOrCreateWallet(params.userId, tx);

               // 4. Invert effect using pure domain math
               const { nextState, totalDelta, reservedDelta } = applyReversal(
                  {
                     totalBalance: wallet.totalBalance,
                     reservedBalance: wallet.reservedBalance,
                     rewardProgressSeconds: wallet.rewardProgressSeconds,
                     lifetimeEarned: wallet.lifetimeEarned,
                     lifetimeSpent: wallet.lifetimeSpent,
                  },
                  {
                     totalDelta: original.totalDelta,
                     reservedDelta: original.reservedDelta,
                  }
               );

               // 5. Update wallet
               const updatedWallet = await tx.wallet.update({
                  where: { id: wallet.id },
                  data: {
                     totalBalance: nextState.totalBalance,
                     reservedBalance: nextState.reservedBalance,
                     lifetimeEarned: nextState.lifetimeEarned,
                     lifetimeSpent: nextState.lifetimeSpent,
                  },
               });

               // 6. Record reversal transaction
               const ledgerTransaction = await tx.ledgerTransaction.create({
                  data: {
                     walletId: wallet.id,
                     userId: params.userId,
                     type: "REVERSAL",
                     amount: totalDelta !== 0 ? totalDelta : reservedDelta,
                     totalDelta,
                     reservedDelta,
                     sourceType: "REVERSAL",
                     sourceId: original.id,
                     relatedTransactionId: original.id,
                     idempotencyKey: params.idempotencyKey,
                     description: `Reversal of ${original.type} (${original.id}): ${params.reason}`,
                     metadata: {
                        originalTransactionId: original.id,
                        originalType: original.type,
                        originalAmount: original.amount,
                        reason: params.reason,
                     },
                  },
               });

               return {
                  wallet: updatedWallet,
                  ledgerTransaction,
                  isDuplicate: false,
               };
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
         );
      } catch (error) {
         if (
            !isSerializationConflict(error) ||
            attempt === MAX_SERIALIZATION_RETRIES - 1
         ) {
            throw error;
         }
      }
   }

   throw new Error("Failed to execute wallet reversal after maximum retries.");
}
