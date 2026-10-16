import { prisma } from "@/core/db";
import { Prisma } from "@prisma/client";
import { calculateStudyReward } from "../domain/reward-calculation";
import { getOrCreateWallet } from "./wallet.repository";

const MAX_SERIALIZATION_RETRIES = 3;

function isSerializationConflict(error: unknown): boolean {
   return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
   );
}

export interface RecordStudyRewardParams {
   userId: string;
   studySessionId: string;
   eligibleSeconds: number;
   sourceType?: string;
   idempotencyKey: string;
   metadata?: Record<string, any>;
}

export interface RecordStudyRewardResult {
   rewardRecord: any;
   coinsCredited: number;
   fractionalSecondsRemaining: number;
   isDuplicate: boolean;
}

export async function findStudyRewardBySource(
   sourceType: string,
   studySessionId: string
) {
   return prisma.studyRewardRecord.findUnique({
      where: {
         sourceType_studySessionId: {
            sourceType,
            studySessionId,
         },
      },
   });
}

export async function getAllRewardRecordsForWallet(walletId: string) {
   return prisma.studyRewardRecord.findMany({
      where: { walletId },
      orderBy: { createdAt: "asc" },
   });
}

export async function recordStudyRewardTransaction(
   params: RecordStudyRewardParams
): Promise<RecordStudyRewardResult> {
   const sourceType = params.sourceType ?? "DAILY_STUDY_LOG";

   for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
         return await prisma.$transaction(
            async (tx) => {
               // 1. Check if this study session was already rewarded (exact-once idempotency with delta support)
               const existingRecord = await tx.studyRewardRecord.findUnique({
                  where: {
                     sourceType_studySessionId: {
                        sourceType,
                        studySessionId: params.studySessionId,
                     },
                  },
               });

               if (existingRecord) {
                  // If eligibleSeconds is greater than previously rewarded seconds, reward the positive delta
                  if (params.eligibleSeconds > existingRecord.eligibleSeconds) {
                     const deltaSeconds =
                        params.eligibleSeconds - existingRecord.eligibleSeconds;
                     const wallet = await getOrCreateWallet(params.userId, tx);

                     const calcResult = calculateStudyReward({
                        eligibleSeconds: deltaSeconds,
                        currentProgressSeconds: wallet.rewardProgressSeconds,
                     });

                     let ledgerTransactionId: string | null = null;

                     if (calcResult.coinsCredited > 0) {
                        await tx.wallet.update({
                           where: { id: wallet.id },
                           data: {
                              totalBalance:
                                 wallet.totalBalance + calcResult.coinsCredited,
                              lifetimeEarned:
                                 wallet.lifetimeEarned +
                                 calcResult.coinsCredited,
                              rewardProgressSeconds:
                                 calcResult.fractionalSecondsRemaining,
                           },
                        });

                        const deltaKey = `${params.idempotencyKey}:delta:${params.eligibleSeconds}`;
                        const ledgerTx = await tx.ledgerTransaction.create({
                           data: {
                              walletId: wallet.id,
                              userId: params.userId,
                              type: "STUDY_REWARD",
                              amount: calcResult.coinsCredited,
                              totalDelta: calcResult.coinsCredited,
                              reservedDelta: 0,
                              sourceType,
                              sourceId: params.studySessionId,
                              idempotencyKey: deltaKey,
                              description: `Study reward delta: +${calcResult.coinsCredited} coin${calcResult.coinsCredited === 1 ? "" : "s"} (${deltaSeconds}s additional)`,
                              metadata: {
                                 eligibleSeconds: params.eligibleSeconds,
                                 previousEligibleSeconds:
                                    existingRecord.eligibleSeconds,
                                 deltaSeconds,
                                 fractionalSecondsConsumed:
                                    calcResult.fractionalSecondsConsumed,
                                 fractionalSecondsRemaining:
                                    calcResult.fractionalSecondsRemaining,
                                 ...params.metadata,
                              },
                           },
                        });

                        ledgerTransactionId = ledgerTx.id;
                     } else {
                        await tx.wallet.update({
                           where: { id: wallet.id },
                           data: {
                              rewardProgressSeconds:
                                 calcResult.fractionalSecondsRemaining,
                           },
                        });
                     }

                     const updatedRecord = await tx.studyRewardRecord.update({
                        where: { id: existingRecord.id },
                        data: {
                           eligibleSeconds: params.eligibleSeconds,
                           coinsCredited:
                              existingRecord.coinsCredited +
                              calcResult.coinsCredited,
                           fractionalSecondsConsumed:
                              existingRecord.fractionalSecondsConsumed +
                              calcResult.fractionalSecondsConsumed,
                           fractionalSecondsRemaining:
                              calcResult.fractionalSecondsRemaining,
                           ledgerTransactionId:
                              ledgerTransactionId ??
                              existingRecord.ledgerTransactionId,
                           metadata: {
                              ...((existingRecord.metadata as Record<
                                 string,
                                 any
                              >) || {}),
                              ...params.metadata,
                              lastIncrementalUpdate: new Date().toISOString(),
                           },
                        },
                     });

                     return {
                        rewardRecord: updatedRecord,
                        coinsCredited: calcResult.coinsCredited,
                        fractionalSecondsRemaining:
                           calcResult.fractionalSecondsRemaining,
                        isDuplicate: false,
                     };
                  }

                  return {
                     rewardRecord: existingRecord,
                     coinsCredited: 0,
                     fractionalSecondsRemaining:
                        existingRecord.fractionalSecondsRemaining,
                     isDuplicate: true,
                  };
               }

               // Check idempotencyKey explicitly as well
               const existingByKey = await tx.studyRewardRecord.findUnique({
                  where: { idempotencyKey: params.idempotencyKey },
               });

               if (existingByKey) {
                  return {
                     rewardRecord: existingByKey,
                     coinsCredited: existingByKey.coinsCredited,
                     fractionalSecondsRemaining:
                        existingByKey.fractionalSecondsRemaining,
                     isDuplicate: true,
                  };
               }

               // 2. Fetch or initialize wallet
               const wallet = await getOrCreateWallet(params.userId, tx);

               // 3. Calculate reward and fractional progress accumulation
               const calcResult = calculateStudyReward({
                  eligibleSeconds: params.eligibleSeconds,
                  currentProgressSeconds: wallet.rewardProgressSeconds,
               });

               let ledgerTransactionId: string | null = null;

               // 4. If whole coins were earned, update balance & append ledger
               if (calcResult.coinsCredited > 0) {
                  await tx.wallet.update({
                     where: { id: wallet.id },
                     data: {
                        totalBalance:
                           wallet.totalBalance + calcResult.coinsCredited,
                        lifetimeEarned:
                           wallet.lifetimeEarned + calcResult.coinsCredited,
                        rewardProgressSeconds:
                           calcResult.fractionalSecondsRemaining,
                     },
                  });

                  const ledgerTx = await tx.ledgerTransaction.create({
                     data: {
                        walletId: wallet.id,
                        userId: params.userId,
                        type: "STUDY_REWARD",
                        amount: calcResult.coinsCredited,
                        totalDelta: calcResult.coinsCredited,
                        reservedDelta: 0,
                        sourceType,
                        sourceId: params.studySessionId,
                        idempotencyKey: params.idempotencyKey,
                        description: `Study reward: +${calcResult.coinsCredited} coin${calcResult.coinsCredited === 1 ? "" : "s"} (${params.eligibleSeconds}s)`,
                        metadata: {
                           eligibleSeconds: params.eligibleSeconds,
                           fractionalSecondsConsumed:
                              calcResult.fractionalSecondsConsumed,
                           fractionalSecondsRemaining:
                              calcResult.fractionalSecondsRemaining,
                           ...params.metadata,
                        },
                     },
                  });

                  ledgerTransactionId = ledgerTx.id;
               } else {
                  // Only update fractional progress remainder
                  await tx.wallet.update({
                     where: { id: wallet.id },
                     data: {
                        rewardProgressSeconds:
                           calcResult.fractionalSecondsRemaining,
                     },
                  });
               }

               // 5. Create immutable study reward record
               const rewardRecord = await tx.studyRewardRecord.create({
                  data: {
                     userId: params.userId,
                     walletId: wallet.id,
                     studySessionId: params.studySessionId,
                     sourceType,
                     eligibleSeconds: params.eligibleSeconds,
                     coinsCredited: calcResult.coinsCredited,
                     fractionalSecondsConsumed:
                        calcResult.fractionalSecondsConsumed,
                     fractionalSecondsRemaining:
                        calcResult.fractionalSecondsRemaining,
                     status: "PROCESSED",
                     idempotencyKey: params.idempotencyKey,
                     ledgerTransactionId,
                     metadata: params.metadata,
                  },
               });

               return {
                  rewardRecord,
                  coinsCredited: calcResult.coinsCredited,
                  fractionalSecondsRemaining:
                     calcResult.fractionalSecondsRemaining,
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

   throw new Error("Failed to record study reward after maximum retries.");
}
