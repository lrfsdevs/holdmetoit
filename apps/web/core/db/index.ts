/**
 * Backwards-compatible re-export of the shared Prisma client.
 * The single source of truth now lives in `@holdmetoit/database`.
 */
export {
   prisma,
   createPrismaClient,
   isLocalDatabaseHost,
   resolveSslConfig,
} from "@holdmetoit/database";
export type {
   PrismaClient,
   CreatePrismaClientOptions,
} from "@holdmetoit/database";
