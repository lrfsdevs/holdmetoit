/**
 * HoldMeToIt — User Username Deduplication & Pre-Migration Verifier
 *
 * Identifies and resolves case-insensitive duplicate or invalid usernames
 * across the User table prior to applying the unique index User_lower_username_key.
 *
 * Usage (from apps/web):
 *   npx tsx --env-file=.env scripts/dedupe-usernames.ts
 *   npx tsx --env-file=.env scripts/dedupe-usernames.ts --apply
 *   npx tsx --env-file=.env scripts/dedupe-usernames.ts --apply --force-host
 *
 * Dry run is the default. `--apply` is required to write changes.
 */

import { prisma } from "@holdmetoit/database";
import {
   generateSuffixedUsername,
   validateUsername,
} from "../features/auth/domain/username";

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
      return LOCAL_HOSTS.has(new URL(url).hostname);
   } catch {
      return false;
   }
}

interface DuplicateGroup {
   normalized: string;
   count: bigint;
}

async function findDuplicateGroups(): Promise<DuplicateGroup[]> {
   return prisma.$queryRaw<DuplicateGroup[]>`
      SELECT LOWER("username") AS normalized, COUNT(*) AS count
      FROM "User"
      WHERE "username" IS NOT NULL
      GROUP BY 1
      HAVING COUNT(*) > 1
      ORDER BY 1
   `;
}

async function main() {
   const apply = process.argv.includes("--apply");
   const forceHost = process.argv.includes("--force-host");

   const dbUrl = process.env.DATABASE_URL;
   if (!isLocalDatabase(dbUrl) && apply && !forceHost) {
      console.error(
         "Refusing to write to a non-local database without --force-host."
      );
      process.exit(1);
   }

   console.log(
      "Checking User table for case-insensitive duplicate usernames..."
   );
   const duplicateGroups = await findDuplicateGroups();

   if (duplicateGroups.length === 0) {
      console.log("No duplicate usernames found. Index creation is safe.");
   } else {
      console.log(
         `Found ${duplicateGroups.length} case-insensitive duplicate groups:`
      );
      for (const group of duplicateGroups) {
         console.log(`  - "${group.normalized}" (${group.count} occurrences)`);

         const users = await prisma.$queryRaw<
            Array<{ id: string; username: string | null; createdAt: Date }>
         >`
            SELECT "id", "username", "createdAt"
            FROM "User"
            WHERE LOWER("username") = ${group.normalized.toLowerCase()}
            ORDER BY "createdAt" ASC
         `;

         // Oldest user keeps original; subsequent users get suffixed
         const [keeper, ...duplicates] = users;
         console.log(
            `    Keeper: ${keeper.id} ("${keeper.username}", created ${keeper.createdAt.toISOString()})`
         );

         let attempt = 1;
         for (const dup of duplicates) {
            let nextCandidate = generateSuffixedUsername(
               dup.username || group.normalized,
               attempt
            );
            while (true) {
               const collision = await prisma.$queryRaw<Array<{ id: string }>>`
                  SELECT "id" FROM "User"
                  WHERE LOWER("username") = ${nextCandidate.toLowerCase()}
                  LIMIT 1
               `;
               if (collision.length === 0) {
                  break;
               }
               attempt++;
               nextCandidate = generateSuffixedUsername(
                  dup.username || group.normalized,
                  attempt
               );
            }

            console.log(
               `    Duplicate ${dup.id} ("${dup.username}") -> will rename to "${nextCandidate}"`
            );

            if (apply) {
               await prisma.user.update({
                  where: { id: dup.id },
                  data: { username: nextCandidate },
               });
               console.log(`      Updated ${dup.id} to "${nextCandidate}"`);
            }
            attempt++;
         }
      }
   }

   if (!apply) {
      console.log("\nDry run complete. Use --apply to execute changes.");
   } else {
      console.log("\nUsername deduplication applied successfully.");
   }
}

main()
   .catch((err) => {
      console.error("Deduplication error:", err);
      process.exit(1);
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
