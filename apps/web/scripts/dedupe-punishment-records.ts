/**
 * HoldMeToIt — PunishmentRecord dedupe (one-off, operator-run)
 *
 * Removes duplicate (challengeId, participantId) rows before the
 * `PunishmentRecord_challengeId_participantId_key` unique index is applied.
 *
 * Keep rule: pardoned first, then earliest evaluatedAt, then lowest id.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/dedupe-punishment-records.ts
 *   npx tsx --env-file=.env scripts/dedupe-punishment-records.ts --apply
 *   npx tsx --env-file=.env scripts/dedupe-punishment-records.ts --apply --force-host
 *
 * Dry run is the default. `--apply` is required to write. `--force-host` is
 * required when DATABASE_URL is not a local host, so the hosted database stays
 * read-only unless explicitly overridden.
 */

import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface DuplicateRow {
   id: string;
   challengeId: string;
   participantId: string;
   isPardoned: boolean;
   evaluatedAt: Date;
}

const LOCAL_HOSTS = new Set([
   "localhost",
   "127.0.0.1",
   "::1",
   "db",
   "postgres",
   "host.docker.internal",
]);

function isLocalDatabase(url: string | undefined): boolean {
   if (!url) return false;
   try {
      const parsed = new URL(url);
      return LOCAL_HOSTS.has(parsed.hostname);
   } catch {
      return false;
   }
}

async function findDuplicateRows(): Promise<DuplicateRow[]> {
   return prisma.$queryRaw<DuplicateRow[]>(Prisma.sql`
      SELECT id, "challengeId", "participantId", "isPardoned", "evaluatedAt"
      FROM "PunishmentRecord"
      WHERE ("challengeId", "participantId") IN (
         SELECT "challengeId", "participantId"
         FROM "PunishmentRecord"
         GROUP BY 1, 2
         HAVING COUNT(*) > 1
      )
      ORDER BY "challengeId", "participantId",
               "isPardoned" DESC, "evaluatedAt" ASC, "id" ASC
   `);
}

function groupDuplicates(rows: DuplicateRow[]): Map<string, DuplicateRow[]> {
   const groups = new Map<string, DuplicateRow[]>();
   for (const row of rows) {
      const key = `${row.challengeId}:${row.participantId}`;
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
   }
   return groups;
}

async function main() {
   const apply = process.argv.includes("--apply");
   const forceHost = process.argv.includes("--force-host");
   const databaseUrl = process.env.DATABASE_URL;

   if (!databaseUrl) {
      throw new Error("DATABASE_URL is required.");
   }

   if (apply && !isLocalDatabase(databaseUrl) && !forceHost) {
      throw new Error(
         "Refusing to --apply against a non-local database. " +
            "Pass --force-host if you are certain."
      );
   }

   const rows = await findDuplicateRows();
   const groups = groupDuplicates(rows);

   if (groups.size === 0) {
      console.log(
         "No duplicate (challengeId, participantId) rows found. Safe to apply the unique index."
      );
      return;
   }

   console.log(
      `Found ${groups.size} duplicate group(s) across ${rows.length} row(s).`
   );

   groups.forEach((group, key) => {
      const kept = group[0];
      console.log(`\n  ${key}`);
      console.log(
         `    keep   ${kept.id} pardoned=${kept.isPardoned} evaluatedAt=${kept.evaluatedAt.toISOString()}`
      );
      for (const row of group.slice(1)) {
         console.log(
            `    delete ${row.id} pardoned=${row.isPardoned} evaluatedAt=${row.evaluatedAt.toISOString()}`
         );
      }
   });

   if (!apply) {
      console.log(
         "\nDry run only. Re-run with --apply to delete the duplicate rows."
      );
      return;
   }

   await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
         DELETE FROM "PunishmentRecord"
         WHERE ctid NOT IN (
            SELECT DISTINCT ON ("challengeId", "participantId") ctid
            FROM "PunishmentRecord"
            ORDER BY "challengeId", "participantId",
                     "isPardoned" DESC, "evaluatedAt" ASC, "id" ASC
         )
      `);
   });

   const remaining = await findDuplicateRows();
   console.log(`\nApplied. Remaining duplicate rows: ${remaining.length}.`);
}

main()
   .catch((error) => {
      console.error("Dedupe failed:", error);
      process.exitCode = 1;
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
