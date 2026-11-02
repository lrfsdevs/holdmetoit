/**
 * HoldMeToIt — Task invariant audit / repair
 *
 * Report-only by default. `--apply` is required to write.
 *
 * Contract:
 * - A task's `taskType` is its own board column. A category may contain tasks of
 *   either type (weekly parents can hold daily tasks), so task/category type
 *   differences are reported, not rewritten.
 * - `challengeId` is only valid on WEEKLY tasks. Daily tasks are unlinked.
 * - Live tasks in soft-deleted categories are moved to a live category.
 * - Status/isComplete/completedAt disagreements are normalized from `isComplete`.
 * - Duplicate clusters are reported only.
 *
 * Usage (from apps/web):
 *   npx tsx --env-file=packages/database/.env scripts/repair-task-invariants.ts
 *   npx tsx --env-file=packages/database/.env scripts/repair-task-invariants.ts --apply --force-host
 *   ... --apply --force-host --allow-locked-challenges
 *
 * `--force-host` is required for `--apply` against a non-local database.
 * `--allow-locked-challenges` is required to unlink daily challenge links whose
 * challenge is already locked (this changes scoring inputs).
 */

import { PrismaClient, type TaskStatus, type TaskType } from "@prisma/client";

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

function typeKey(userId: string, taskType: TaskType): string {
   return `${userId}:${taskType}`;
}

async function main() {
   const apply = process.argv.includes("--apply");
   const forceHost = process.argv.includes("--force-host");
   const allowLocked = process.argv.includes("--allow-locked-challenges");

   if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required.");
   }

   const url = new URL(process.env.DATABASE_URL);
   console.log(`Database: ${url.hostname}${url.pathname}`);

   if (apply && !isLocalDatabase(process.env.DATABASE_URL) && !forceHost) {
      throw new Error(
         "Refusing to --apply against a non-local database. Pass --force-host if certain."
      );
   }

   const tasks = await prisma.task.findMany({
      where: { isDeleted: false },
      select: {
         id: true,
         userId: true,
         categoryId: true,
         challengeId: true,
         title: true,
         taskType: true,
         status: true,
         isComplete: true,
         completedAt: true,
         dueDate: true,
         createdAt: true,
         category: {
            select: { taskType: true, isDeleted: true },
         },
      },
   });

   const liveCategories = await prisma.category.findMany({
      where: { isDeleted: false },
      select: { id: true, userId: true, taskType: true, sortOrder: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
   });

   const categoryByUserType = new Map<string, string>();
   const categoryByUser = new Map<string, string>();
   for (const category of liveCategories) {
      const key = typeKey(category.userId, category.taskType);
      if (!categoryByUserType.has(key)) {
         categoryByUserType.set(key, category.id);
      }
      if (!categoryByUser.has(category.userId)) {
         categoryByUser.set(category.userId, category.id);
      }
   }

   const dailyChallengeLinks = tasks.filter(
      (t) => t.taskType === "DAILY" && t.challengeId !== null
   );
   const orphans = tasks.filter((t) => t.category.isDeleted);
   const typeMismatches = tasks.filter(
      (t) => t.taskType !== t.category.taskType
   );
   const weeklyInDaily = tasks.filter(
      (t) => t.taskType === "WEEKLY" && t.category.taskType === "DAILY"
   );
   const statusMismatches = tasks.filter((t) => {
      const completed = t.isComplete;
      const statusCompleted = t.status === "COMPLETED";
      return (
         completed !== statusCompleted ||
         (completed && t.completedAt === null) ||
         (!completed && t.completedAt !== null)
      );
   });

   const duplicateClusters = (() => {
      const groups = new Map<
         string,
         { count: number; first: number; last: number }
      >();
      for (const task of tasks) {
         const key = [
            task.userId,
            task.title,
            task.taskType,
            task.dueDate ? task.dueDate.toISOString().slice(0, 10) : "",
         ].join("|");
         const createdAt = task.createdAt.getTime();
         const entry = groups.get(key);
         if (entry) {
            entry.count++;
            entry.first = Math.min(entry.first, createdAt);
            entry.last = Math.max(entry.last, createdAt);
         } else {
            groups.set(key, { count: 1, first: createdAt, last: createdAt });
         }
      }
      return Array.from(groups.values()).filter(
         (group) =>
            group.count > 1 && group.last - group.first <= 10 * 60 * 1000
      );
   })();

   const lockedChallenges =
      dailyChallengeLinks.length > 0
         ? await prisma.challenge.findMany({
              where: {
                 id: {
                    in: Array.from(
                       new Set(
                          dailyChallengeLinks
                             .map((task) => task.challengeId)
                             .filter((id): id is string => Boolean(id))
                       )
                    ),
                 },
                 resultsLockedAt: { not: null },
              },
              select: { id: true },
           })
         : [];

   console.log("\nReport:");
   console.log(
      `  daily tasks with a challengeId: ${dailyChallengeLinks.length}`
   );
   console.log(
      `    of which in locked challenges: ${lockedChallenges.length > 0 ? "yes" : "no"}`
   );
   console.log(`  live tasks in soft-deleted categories: ${orphans.length}`);
   console.log(
      `  task/category type differences (not rewritten): ${typeMismatches.length}`
   );
   console.log(
      `    weekly goals in daily categories (valid, reported): ${weeklyInDaily.length}`
   );
   console.log(
      `  status/isComplete/completedAt mismatches: ${statusMismatches.length}`
   );
   console.log(`  duplicate clusters (<10 min): ${duplicateClusters.length}`);

   if (!apply) {
      console.log(
         "\nReport only. Re-run with --apply --force-host to repair the safe classes."
      );
      return;
   }

   if (lockedChallenges.length > 0 && !allowLocked) {
      throw new Error(
         "Daily challenge links belong to a locked challenge. Pass --allow-locked-challenges to unlink them."
      );
   }

   for (const task of dailyChallengeLinks) {
      await prisma.task.update({
         where: { id: task.id },
         data: { challengeId: null, revision: { increment: 1 } },
      });
   }

   for (const task of orphans) {
      let target =
         categoryByUserType.get(typeKey(task.userId, task.taskType)) ??
         categoryByUser.get(task.userId);

      if (!target) {
         const created = await prisma.category.create({
            data: {
               userId: task.userId,
               name: "General",
               taskType: task.taskType,
               sortOrder: 0,
            },
         });
         target = created.id;
         categoryByUserType.set(
            typeKey(task.userId, task.taskType),
            created.id
         );
         categoryByUser.set(task.userId, created.id);
      }

      await prisma.task.update({
         where: { id: task.id },
         data: { categoryId: target, revision: { increment: 1 } },
      });
   }

   for (const task of statusMismatches) {
      await prisma.task.update({
         where: { id: task.id },
         data: {
            status: (task.isComplete ? "COMPLETED" : "TODO") as TaskStatus,
            isComplete: task.isComplete,
            completedAt: task.isComplete
               ? (task.completedAt ?? new Date())
               : null,
            revision: { increment: 1 },
         },
      });
   }

   console.log(
      `\nApplied: ${dailyChallengeLinks.length} challenge unlinks, ${orphans.length} orphan moves, ${statusMismatches.length} status fixes.`
   );
   console.log(
      `Skipped by design: ${typeMismatches.length} task/category type differences (${weeklyInDaily.length} weekly goals in daily categories), ${duplicateClusters.length} duplicate clusters.`
   );
}

main()
   .catch((error) => {
      console.error("Task invariant repair failed:", error);
      process.exitCode = 1;
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
