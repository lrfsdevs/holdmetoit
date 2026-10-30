import { PrismaClient } from "@prisma/client";

function withConnectionTimeouts(rawUrl?: string): string | undefined {
   if (!rawUrl) return undefined;
   try {
      const parsed = new URL(rawUrl);
      if (!parsed.searchParams.has("connect_timeout")) {
         parsed.searchParams.set("connect_timeout", "30");
      }
      if (!parsed.searchParams.has("pool_timeout")) {
         parsed.searchParams.set("pool_timeout", "30");
      }
      return parsed.toString();
   } catch {
      return rawUrl;
   }
}

if (process.env.DATABASE_URL) {
   const hardened = withConnectionTimeouts(process.env.DATABASE_URL);
   if (hardened) {
      process.env.DATABASE_URL = hardened;
   }
}

if (process.env.DIRECT_URL) {
   const hardenedDirect = withConnectionTimeouts(process.env.DIRECT_URL);
   if (hardenedDirect) {
      process.env.DIRECT_URL = hardenedDirect;
   }
}

const globalForPrisma = globalThis as unknown as {
   prisma: PrismaClient | undefined;
};

export const prisma =
   globalForPrisma.prisma ??
   new PrismaClient({
      datasources: process.env.DATABASE_URL
         ? {
              db: {
                 url: withConnectionTimeouts(process.env.DATABASE_URL),
              },
           }
         : undefined,
      log:
         process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
   });

if (process.env.NODE_ENV !== "production") {
   globalForPrisma.prisma = prisma;
}

export type { PrismaClient };
export { buildCategoryTombstoneName } from "./category-tombstone.js";
