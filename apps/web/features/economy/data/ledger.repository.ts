import { prisma } from "@/core/db";
import { TransactionTypeValue } from "../domain/economy-constants";

export interface FindTransactionsOptions {
   page?: number;
   limit?: number;
   type?: TransactionTypeValue;
}

export async function findTransactionsByUserId(
   userId: string,
   options: FindTransactionsOptions = {}
) {
   const page = Math.max(1, options.page ?? 1);
   const limit = Math.min(100, Math.max(1, options.limit ?? 20));
   const skip = (page - 1) * limit;

   const where = {
      userId,
      ...(options.type ? { type: options.type as any } : {}),
   };

   const [transactions, totalCount] = await Promise.all([
      prisma.ledgerTransaction.findMany({
         where,
         orderBy: { createdAt: "desc" },
         skip,
         take: limit,
      }),
      prisma.ledgerTransaction.count({ where }),
   ]);

   return {
      transactions,
      pagination: {
         page,
         limit,
         totalCount,
         totalPages: Math.ceil(totalCount / limit),
      },
   };
}

export async function findTransactionById(id: string) {
   return prisma.ledgerTransaction.findUnique({
      where: { id },
      include: {
         relatedTransaction: true,
         reversals: true,
      },
   });
}

export async function findTransactionByIdempotencyKey(idempotencyKey: string) {
   return prisma.ledgerTransaction.findUnique({
      where: { idempotencyKey },
   });
}

export async function getAllTransactionsForWallet(walletId: string) {
   return prisma.ledgerTransaction.findMany({
      where: { walletId },
      orderBy: { createdAt: "asc" },
   });
}
