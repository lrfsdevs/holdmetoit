/**
 * HoldMeToIt — Category dedupe (operator-run, before the partial CI index)
 *
 * Merges active categories that collide case-insensitively per
 * (userId, LOWER(name), taskType). Tasks move to the surviving category; the
 * duplicate is soft-deleted with a tombstone name so the original name is free.
 *
 * Usage (from apps/web):
 *   npx tsx --env-file=.env scripts/dedupe-categories.ts
 *   npx tsx --env-file=.env scripts/dedupe-categories.ts --apply
 *   npx tsx --env-file=.env scripts/dedupe-categories.ts --apply --force-host
 *
 * Dry run is the default. `--apply` is required to write. `--force-host` is
 * required when DATABASE_URL is not a local host, so the hosted database stays
 * read-only unless explicitly overridden.
 */

import { PrismaClient, type TaskType } from "@prisma/client";
import { buildCategoryTombstoneName } from "../features/tasks/domain/task-deletion";

const prisma = new PrismaClient();

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
   userId: string;
   normalized: string;
   taskType: TaskType;
   count: bigint;
}

async function findDuplicateGroups(): Promise<DuplicateGroup[]> {
   return prisma.$queryRaw<DuplicateGroup[]>`
      SELECT "userId", LOWER("name") AS normalized, "taskType", COUNT(*) AS count
      FROM "Category"
      WHERE "isDeleted" = false
      GROUP BY 1, 2, 3
      HAVING COUNT(*) > 1
      ORDER BY 1, 2, 3
   `;
}

async function main() {
   const apply = process.argv.includes("--apply");
   const forceHost = process.argv.includes("--force-host");

   if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required.");
   }

   if (apply && !isLocalDatabase(process.env.DATABASE_URL) && !forceHost) {
      throw new Error(
         "Refusing to --apply against a non-local database. Pass --force-host if certain."
      );
   }

   const groups = await findDuplicateGroups();

   if (groups.length === 0) {
      console.log(
         "No case-insensitive duplicate active categories found. Safe to apply the unique index."
      );
      return;
   }

   console.log(`Found ${groups.length} duplicate group(s).`);

   const plan: {
      keeperId: string;
      keeperName: string;
      duplicateId: string;
      duplicateName: string;
      taskCount: number;
   }[] = [];

   for (const group of groups) {
      const categories = await prisma.category.findMany({
         where: {
            userId: group.userId,
            taskType: group.taskType,
            isDeleted: false,
            name: { equals: group.normalized, mode: "insensitive" },
         },
         orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      if (categories.length < 2) continue;

      const [keeper, ...duplicates] = categories;

      for (const duplicate of duplicates) {
         const taskCount = await prisma.task.count({
            where: { categoryId: duplicate.id },
         });
         plan.push({
            keeperId: keeper.id,
            keeperName: keeper.name,
            duplicateId: duplicate.id,
            duplicateName: duplicate.name,
            taskCount,
         });
      }
   }

   for (const item of plan) {
      console.log(
         `  keep ${item.keeperId} "${item.keeperName}" <- ${item.taskCount} task(s) from ${item.duplicateId} "${item.duplicateName}"`
      );
   }

   if (!apply) {
      console.log(
         "\nDry run only. Re-run with --apply to merge the duplicate categories."
      );
      return;
   }

   const now = new Date();

   await prisma.$transaction(async (tx) => {
      for (const item of plan) {
         await tx.task.updateMany({
            where: { categoryId: item.duplicateId },
            data: { categoryId: item.keeperId },
         });

         await tx.category.update({
            where: { id: item.duplicateId },
            data: {
               isDeleted: true,
               deletionTime: now,
               name: buildCategoryTombstoneName(
                  item.duplicateName,
                  item.duplicateId
               ),
            },
         });
      }
   });

   const remaining = await findDuplicateGroups();
   console.log(
      `\nApplied ${plan.length} merge(s). Remaining duplicate groups: ${remaining.length}.`
   );
}

main()
   .catch((error) => {
      console.error("Category dedupe failed:", error);
      process.exitCode = 1;
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
