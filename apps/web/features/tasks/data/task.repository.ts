import { prisma } from "@/core/db";
import { CACHE_REVALIDATE_SECONDS, cacheTags } from "@/core/cache";
import { unstable_cache } from "next/cache";
import {
   Prisma,
   type Category,
   type Task,
   type TaskType,
} from "@prisma/client";
import {
   calculateChallengeStatus,
   ChallengeStateError,
} from "@/features/challenges/domain/challenge-lifecycle";
import { buildCategoryTombstoneName } from "@/features/tasks/domain/task-deletion";
import type {
   CategoryGroup,
   CategoryItem,
   TaskItem,
   TaskStatus,
   UserCategorizedTasks,
} from "@/features/tasks/domain/task.types";

function formatUtcDateKey(date: Date | string): string {
   if (typeof date === "string") return date.slice(0, 10);
   return date.toISOString().slice(0, 10);
}

export const DEFAULT_CATEGORY_NAME = "General";

function isUniqueConstraintError(error: unknown): boolean {
   return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
   );
}

/**
 * Resolves the challenge a newly created task should be linked to (FEAT-TASK-01).
 * Linked while the user is enrolled in a challenge that is not locked/ended
 * (prefer the currently ACTIVE one, else the soonest UPCOMING); otherwise
 * returns null for a standalone task.
 */
export async function resolveTaskChallengeId(
   userId: string,
   client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string | null> {
   const now = new Date();
   const participations = await client.challengeParticipant.findMany({
      where: {
         userId,
         challenge: {
            isDeleted: false,
            resultsLockedAt: null,
            endAt: { gt: now },
         },
      },
      select: {
         challenge: { select: { id: true, startAt: true, endAt: true } },
      },
   });

   const ranked = participations.map((entry) => ({
      id: entry.challenge.id,
      status: calculateChallengeStatus(entry.challenge, now),
      startAt: entry.challenge.startAt,
   }));

   const active = ranked.find((entry) => entry.status === "ACTIVE");
   if (active) {
      return active.id;
   }

   const upcoming = ranked
      .filter((entry) => entry.status === "UPCOMING")
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

   return upcoming[0]?.id ?? null;
}

/**
 * Validates a client-sent challenge linkage: the user must be enrolled in that
 * challenge and it must not be locked/ended. Falls back to the current
 * challenge resolution when the requested id is invalid.
 */
export async function validateTaskChallengeId(
   userId: string,
   requestedChallengeId: string,
   client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string | null> {
   const now = new Date();
   const participation = await client.challengeParticipant.findFirst({
      where: {
         userId,
         challengeId: requestedChallengeId,
         challenge: {
            isDeleted: false,
            resultsLockedAt: null,
            endAt: { gt: now },
         },
      },
      select: { challengeId: true },
   });

   if (participation) {
      return participation.challengeId;
   }

   return resolveTaskChallengeId(userId, client);
}

/**
 * Rejects task goal changes once the challenge results are locked.
 * Takes FOR SHARE so a concurrent lock (FOR UPDATE) serialises with this write.
 */
export async function assertChallengeWritable(
   client: Prisma.TransactionClient | typeof prisma,
   challengeId: string | null | undefined
): Promise<void> {
   if (!challengeId) return;

   const rows = await client.$queryRaw<
      { resultsLockedAt: Date | null; isDeleted: boolean }[]
   >`SELECT "resultsLockedAt", "isDeleted" FROM "Challenge" WHERE "id" = ${challengeId} FOR SHARE`;

   const row = rows[0];
   if (!row || row.isDeleted || row.resultsLockedAt != null) {
      throw new ChallengeStateError(
         "Challenge results are locked; task goals can no longer be changed."
      );
   }
}

export function toCategoryItem(category: Category): CategoryItem {
   return {
      id: category.id,
      userId: category.userId,
      name: category.name,
      taskType: category.taskType,
      sortOrder: category.sortOrder,
      isDeleted: category.isDeleted,
      deletionTime: category.deletionTime,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
   };
}

export function toTaskItem(task: Task, taskType: TaskType): TaskItem {
   return {
      id: task.id,
      userId: task.userId,
      categoryId: task.categoryId,
      challengeId: task.challengeId,
      title: task.title,
      taskType: taskType as TaskItem["taskType"],
      sortOrder: task.sortOrder,
      isComplete: task.isComplete,
      status:
         (task.status as TaskStatus) ??
         (task.isComplete ? "COMPLETED" : "TODO"),
      dueDate: task.dueDate
         ? formatUtcDateKey(task.dueDate)
         : taskType === "DAILY"
           ? formatUtcDateKey(task.createdAt)
           : null,
      isDeleted: task.isDeleted,
      deletionTime: task.deletionTime,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
   };
}

export async function getUserCategorizedTasks(
   userId: string
): Promise<UserCategorizedTasks> {
   const read = unstable_cache(
      () => getUserCategorizedTasksFromDatabase(userId),
      ["user-categorized-tasks", userId],
      {
         revalidate: CACHE_REVALIDATE_SECONDS.stable,
         tags: [cacheTags.userTasks(userId)],
      }
   );

   return read();
}

export async function getUserCategorizedTasksFromDatabase(
   userId: string
): Promise<UserCategorizedTasks> {
   const categories = await prisma.category.findMany({
      where: { userId, isDeleted: false },
      include: {
         tasks: {
            where: { isDeleted: false },
            orderBy: [
               { sortOrder: "asc" },
               { createdAt: "asc" },
               { id: "asc" },
            ],
         },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
   });

   const categoryItems: CategoryItem[] = categories.map(toCategoryItem);

   const dailyCategories: CategoryGroup[] = categories
      .filter(
         (c) =>
            c.taskType === "DAILY" ||
            c.tasks.some((t) => t.taskType === "DAILY")
      )
      .map((c) => {
         const dailyTasks: TaskItem[] = c.tasks
            .filter((t) => t.taskType === "DAILY")
            .map((t) => toTaskItem(t, "DAILY"));

         return {
            id: c.id,
            name: c.name,
            taskType: "DAILY" as const,
            sortOrder: c.sortOrder,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            isCollapsed: false,
            isDeleted: c.isDeleted,
            deletionTime: c.deletionTime,
            tasks: dailyTasks,
         };
      });

   const weeklyCategories: CategoryGroup[] = categories
      .filter((c) => c.taskType === "WEEKLY")
      .map((c) => {
         const weeklyTasks: TaskItem[] = c.tasks
            .filter((t) => t.taskType === "WEEKLY")
            .map((t) => toTaskItem(t, "WEEKLY"));

         return {
            id: c.id,
            name: c.name,
            taskType: "WEEKLY" as const,
            sortOrder: c.sortOrder,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            isCollapsed: false,
            isDeleted: c.isDeleted,
            deletionTime: c.deletionTime,
            tasks: weeklyTasks,
         };
      });

   const allTasks = categories.flatMap((c) => c.tasks);
   const dailyAll = allTasks.filter((t) => t.taskType === "DAILY");
   const weeklyAll = allTasks.filter((t) => t.taskType === "WEEKLY");

   return {
      categories: categoryItems,
      dailyCategories,
      weeklyCategories,
      totalDailyTasks: dailyAll.length,
      completedDailyTasks: dailyAll.filter((t) => t.isComplete).length,
      totalWeeklyTasks: weeklyAll.length,
      completedWeeklyTasks: weeklyAll.filter((t) => t.isComplete).length,
   };
}

export async function createTask(params: {
   userId: string;
   title: string;
   taskType: TaskType;
   categoryId?: string;
   newCategoryName?: string;
   isComplete?: boolean;
   status?: TaskStatus;
   dueDate?: string | Date | null;
   challengeId?: string | null;
}) {
   return prisma.$transaction(async (tx) => {
      let resolvedCategoryId = params.categoryId;

      if (params.newCategoryName && params.newCategoryName.trim()) {
         const trimmedName = params.newCategoryName.trim();
         let existing = await tx.category.findFirst({
            where: {
               userId: params.userId,
               taskType: params.taskType,
               isDeleted: false,
               name: { equals: trimmedName, mode: "insensitive" },
            },
         });

         if (!existing && params.taskType === "DAILY") {
            existing = await tx.category.findFirst({
               where: {
                  userId: params.userId,
                  taskType: "WEEKLY",
                  isDeleted: false,
                  name: { equals: trimmedName, mode: "insensitive" },
               },
            });
         }

         if (existing) {
            resolvedCategoryId = existing.id;
         } else {
            const created = await tx.category.create({
               data: {
                  userId: params.userId,
                  name: trimmedName,
                  taskType: params.taskType,
               },
            });
            resolvedCategoryId = created.id;
         }
      }

      if (!resolvedCategoryId) {
         let fallback = await tx.category.findFirst({
            where: {
               userId: params.userId,
               taskType: params.taskType,
               isDeleted: false,
            },
            orderBy: { createdAt: "asc" },
         });

         if (!fallback && params.taskType === "DAILY") {
            fallback = await tx.category.findFirst({
               where: {
                  userId: params.userId,
                  taskType: "WEEKLY",
                  isDeleted: false,
               },
               orderBy: { createdAt: "asc" },
            });
         }

         if (fallback) {
            resolvedCategoryId = fallback.id;
         } else {
            const created = await tx.category.create({
               data: {
                  userId: params.userId,
                  name: DEFAULT_CATEGORY_NAME,
                  taskType: params.taskType,
               },
            });
            resolvedCategoryId = created.id;
         }
      }

      const status: TaskStatus =
         params.status ?? (params.isComplete ? "COMPLETED" : "TODO");
      const isComplete = status === "COMPLETED";
      const dueDate = params.dueDate ? new Date(params.dueDate) : null;
      const challengeId =
         params.challengeId !== undefined
            ? params.challengeId
            : await resolveTaskChallengeId(params.userId, tx);

      if (challengeId !== null && challengeId !== undefined) {
         await assertChallengeWritable(tx, challengeId);
         const validated = await validateTaskChallengeId(
            params.userId,
            challengeId,
            tx
         );
         if (!validated || validated !== challengeId) {
            throw new ChallengeStateError(
               "You are not an active participant in this challenge."
            );
         }
      }

      return tx.task.create({
         data: {
            userId: params.userId,
            categoryId: resolvedCategoryId,
            challengeId,
            title: params.title.trim(),
            taskType: params.taskType,
            isComplete,
            status,
            dueDate,
            completedAt: isComplete ? new Date() : null,
         },
         include: {
            category: true,
         },
      });
   });
}

export async function toggleTask(params: {
   taskId: string;
   userId: string;
   isComplete?: boolean;
   status?: TaskStatus;
}) {
   const existing = await prisma.task.findFirst({
      where: {
         id: params.taskId,
         userId: params.userId,
         isDeleted: false,
      },
   });

   if (!existing) {
      return null;
   }

   const nextStatus: TaskStatus =
      params.status ??
      (params.isComplete !== undefined
         ? params.isComplete
            ? "COMPLETED"
            : "TODO"
         : existing.isComplete
           ? "TODO"
           : "COMPLETED");
   const nextIsComplete = nextStatus === "COMPLETED";

   return prisma.task.update({
      where: { id: params.taskId },
      data: {
         isComplete: nextIsComplete,
         status: nextStatus,
         completedAt: nextIsComplete ? new Date() : null,
      },
      include: {
         category: true,
      },
   });
}

export async function deleteTask(params: { taskId: string; userId: string }) {
   const existing = await prisma.task.findFirst({
      where: {
         id: params.taskId,
         userId: params.userId,
         isDeleted: false,
      },
   });

   if (!existing) {
      return null;
   }

   return prisma.task.update({
      where: { id: params.taskId },
      data: {
         isDeleted: true,
         deletionTime: new Date(),
      },
   });
}

export async function createCategory(params: {
   userId: string;
   name: string;
   taskType?: TaskType;
}) {
   const trimmedName = params.name.trim();
   const taskType = params.taskType ?? "DAILY";
   const existing = await prisma.category.findFirst({
      where: {
         userId: params.userId,
         taskType,
         name: { equals: trimmedName, mode: "insensitive" },
         isDeleted: false,
      },
   });

   if (existing) {
      return existing;
   }

   try {
      return await prisma.category.create({
         data: {
            userId: params.userId,
            name: trimmedName,
            taskType,
         },
      });
   } catch (error) {
      if (isUniqueConstraintError(error)) {
         const winner = await prisma.category.findFirst({
            where: {
               userId: params.userId,
               taskType,
               isDeleted: false,
               name: { equals: trimmedName, mode: "insensitive" },
            },
         });
         if (winner) return winner;
      }
      throw error;
   }
}

export async function updateTask(params: {
   taskId: string;
   userId: string;
   title?: string;
   isComplete?: boolean;
   status?: TaskStatus;
   dueDate?: string | Date | null;
   challengeId?: string | null;
}) {
   return prisma.$transaction(async (tx) => {
      const existing = await tx.task.findFirst({
         where: {
            id: params.taskId,
            userId: params.userId,
            isDeleted: false,
         },
         select: {
            id: true,
            taskType: true,
            challengeId: true,
         },
      });

      if (!existing) {
         return null;
      }

      const dataToUpdate: {
         title?: string;
         isComplete?: boolean;
         status?: TaskStatus;
         dueDate?: Date | null;
         completedAt?: Date | null;
         challengeId?: string | null;
      } = {};

      if (params.title !== undefined) {
         dataToUpdate.title = params.title.trim();
      }
      if (params.status !== undefined) {
         dataToUpdate.status = params.status;
         dataToUpdate.isComplete = params.status === "COMPLETED";
         dataToUpdate.completedAt =
            params.status === "COMPLETED" ? new Date() : null;
      } else if (params.isComplete !== undefined) {
         dataToUpdate.isComplete = params.isComplete;
         dataToUpdate.status = params.isComplete ? "COMPLETED" : "TODO";
         dataToUpdate.completedAt = params.isComplete ? new Date() : null;
      }
      if (params.dueDate !== undefined) {
         dataToUpdate.dueDate = params.dueDate
            ? new Date(params.dueDate)
            : null;
      }
      if (params.challengeId !== undefined) {
         if (params.challengeId !== null) {
            if (existing.taskType !== "WEEKLY") {
               throw new Error(
                  "Only weekly tasks can be scoped to a challenge"
               );
            }
            const validatedChallengeId = await validateTaskChallengeId(
               params.userId,
               params.challengeId,
               tx
            );
            if (
               !validatedChallengeId ||
               validatedChallengeId !== params.challengeId
            ) {
               throw new ChallengeStateError(
                  "Invalid challenge ID: user is not an active participant in this challenge"
               );
            }
            await assertChallengeWritable(tx, validatedChallengeId);
            dataToUpdate.challengeId = validatedChallengeId;
         } else {
            // Unlinking is also a goal change: the current challenge must be unlocked.
            await assertChallengeWritable(tx, existing.challengeId);
            dataToUpdate.challengeId = null;
         }
      }

      return tx.task.update({
         where: { id: params.taskId },
         data: dataToUpdate,
         include: {
            category: true,
         },
      });
   });
}

export async function rolloverIncompleteTasks(params: {
   userId: string;
   taskIds: string[];
   targetDateKey: string;
}) {
   const targetDate = new Date(params.targetDateKey);
   return prisma.task.updateMany({
      where: {
         id: { in: params.taskIds },
         userId: params.userId,
         taskType: "DAILY",
         isComplete: false,
         status: {
            notIn: ["COMPLETED", "CROSSED_OUT"],
         },
         isDeleted: false,
      },
      data: {
         dueDate: targetDate,
      },
   });
}

export async function updateCategory(params: {
   categoryId: string;
   userId: string;
   name: string;
}) {
   const existing = await prisma.category.findFirst({
      where: {
         id: params.categoryId,
         userId: params.userId,
         isDeleted: false,
      },
   });

   if (!existing) {
      return null;
   }

   const trimmedName = params.name.trim();

   // If name is unchanged, return existing
   if (existing.name.toLowerCase() === trimmedName.toLowerCase()) {
      if (existing.name !== trimmedName) {
         return prisma.category.update({
            where: { id: params.categoryId },
            data: { name: trimmedName },
         });
      }
      return existing;
   }

   // Check if target name is already used by another category of this user in the same taskType
   const duplicate = await prisma.category.findFirst({
      where: {
         userId: params.userId,
         taskType: existing.taskType,
         name: { equals: trimmedName, mode: "insensitive" },
         id: { not: params.categoryId },
         isDeleted: false,
      },
   });

   if (duplicate) {
      throw new Error(`Category "${trimmedName}" already exists.`);
   }

   try {
      return await prisma.category.update({
         where: { id: params.categoryId },
         data: {
            name: trimmedName,
         },
      });
   } catch (error) {
      if (isUniqueConstraintError(error)) {
         throw new Error(`Category "${trimmedName}" already exists.`);
      }
      throw error;
   }
}

export async function deleteCategory(params: {
   categoryId: string;
   userId: string;
}) {
   const existing = await prisma.category.findFirst({
      where: {
         id: params.categoryId,
         userId: params.userId,
         isDeleted: false,
      },
   });

   if (!existing) {
      return null;
   }

   const now = new Date();

   return prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
         where: {
            categoryId: params.categoryId,
            userId: params.userId,
            isDeleted: false,
         },
         data: {
            isDeleted: true,
            deletionTime: now,
         },
      });

      return tx.category.update({
         where: { id: params.categoryId },
         data: {
            isDeleted: true,
            deletionTime: now,
            name: buildCategoryTombstoneName(existing.name, existing.id),
         },
      });
   });
}
