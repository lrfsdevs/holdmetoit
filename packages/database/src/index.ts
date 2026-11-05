import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type { PoolConfig } from "pg";

import { getDatabaseEnv } from "./env.js";

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

const LOCAL_TEST_DATABASE_URL = "postgresql://localhost:5432/holdmetoit";

export function isLocalDatabaseHost(url: string): boolean {
   try {
      const parsed = new URL(url);
      const host = parsed.hostname;
      return (
         host === "localhost" ||
         host === "127.0.0.1" ||
         host === "::1" ||
         host === "[::1]" ||
         host.endsWith(".local")
      );
   } catch {
      return false;
   }
}

function resolveConnectionString(connectionString?: string): string {
   const env = getDatabaseEnv();
   const resolved = connectionString ?? env.DATABASE_URL ?? env.DIRECT_URL;
   if (resolved) return resolved;

   // Import-time construction happens in tests and local tooling without a DB.
   // Production must fail fast rather than silently targeting a local database.
   if (env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL or DIRECT_URL is not set");
   }

   return LOCAL_TEST_DATABASE_URL;
}

export interface CreatePrismaClientOptions {
   ssl?: PoolConfig["ssl"];
}

export function resolveSslConfig(
   url: string,
   customSsl?: PoolConfig["ssl"]
): PoolConfig["ssl"] | undefined {
   if (customSsl !== undefined) return customSsl;
   if (isLocalDatabaseHost(url)) return undefined;

   const env = getDatabaseEnv();
   if (env.DATABASE_SSL_CA) {
      return {
         rejectUnauthorized: true,
         ca: env.DATABASE_SSL_CA,
      };
   }

   if (env.DATABASE_SSL_REJECT_UNAUTHORIZED) {
      return { rejectUnauthorized: true };
   }

   return undefined;
}

/** Creates an adapter-backed Prisma client for the app, seeds, and scripts. */
export function createPrismaClient(
   connectionString?: string,
   options?: CreatePrismaClientOptions
): PrismaClient {
   const resolved = resolveConnectionString(connectionString);
   const poolConfig: PoolConfig = {
      connectionString: withConnectionTimeouts(resolved) ?? resolved,
      connectionTimeoutMillis: 30_000,
   };

   const ssl = resolveSslConfig(resolved, options?.ssl);
   if (ssl !== undefined) {
      poolConfig.ssl = ssl;
   }

   const adapter = new PrismaPg(poolConfig);

   return new PrismaClient({
      adapter,
      log:
         getDatabaseEnv().NODE_ENV === "development"
            ? ["error", "warn"]
            : ["error"],
   });
}

const globalForPrisma = globalThis as unknown as {
   prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (getDatabaseEnv().NODE_ENV !== "production") {
   globalForPrisma.prisma = prisma;
}

export type { PrismaClient };
export { getDatabaseEnv } from "./env.js";
export { buildCategoryTombstoneName } from "./category-tombstone.js";
