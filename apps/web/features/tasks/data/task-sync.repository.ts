import { prisma } from "@/core/db";

import { compactMutationQueue } from "@/features/tasks/domain/task-sync.schema";
import type {
   BatchSyncResponse,
   MutationResult,
   QueuedMutation,
} from "@/features/tasks/domain/task-sync.types";
import { buildCategoryTombstoneName } from "@/features/tasks/domain/task-deletion";
import {
   DEFAULT_CATEGORY_NAME,
   assertChallengeWritable,
   getUserCategorizedTasks,
   getUserCategorizedTasksFromDatabase,
   resolveTaskChallengeId,
   toCategoryItem,
   toTaskItem,
   validateTaskChallengeId,
} from "@/features/tasks/data/task.repository";
import { ChallengeStateError } from "@/features/challenges/domain/challenge-lifecycle";
import { Prisma, type TaskStatus, type TaskType } from "@prisma/client";
import { createLogger, logEvents } from "@/core/observability/logger";

const logger = createLogger("tasks.sync");

type Outcome = Omit<MutationResult, "id">;

const APPLIED: Outcome = { status: "applied" };

function isP2002(error: unknown): boolean {
   return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
   );
}

async function resolveWritableChallengeLink(
   tx: Prisma.TransactionClient,
   userId: string,
   requestedChallengeId: string | null | undefined,
   options: { resolveCurrent?: boolean; onRejected?: "unlink" | "omit" } = {}
): Promise<string | null | undefined> {
   const onRejected = options.onRejected ?? "omit";
   const reject = () => (onRejected === "unlink" ? null : undefined);

   try {
      if (requestedChallengeId === undefined) {
         if (!options.resolveCurrent) return undefined;
         const resolved = await resolveTaskChallengeId(userId, tx);
         if (!resolved) return null;
         await assertChallengeWritable(tx, resolved);
         return resolved;
      }

      if (requestedChallengeId === null) return null;

      const validated = await validateTaskChallengeId(
         userId,
         requestedChallengeId,
         tx
      );
      if (!validated || validated !== requestedChallengeId) return reject();

      await assertChallengeWritable(tx, validated);
      return validated;
   } catch (error) {
      if (error instanceof ChallengeStateError) {
         logger.warn(logEvents.tasksSyncFailed, {
            context: {
               userId,
               challengeId: requestedChallengeId ?? "auto",
               reason: "challenge_locked",
            },
         });
         return reject();
      }
      throw error;
   }
}

async function applyCategoryMutation(
   tx: Prisma.TransactionClient,
   userId: string,
   m: QueuedMutation
): Promise<Outcome> {
   const payload = m.payload as Record<string, unknown>;
   const catId = String(payload.id || payload.categoryId || "");
   const explicitName =
      typeof payload.name === "string" && payload.name.trim() !== ""
         ? payload.name.trim()
         : undefined;
   const taskType: TaskType =
      payload.taskType === "WEEKLY" ? "WEEKLY" : "DAILY";

   if (m.action === "CREATE") {
      if (!catId || !explicitName) return APPLIED;

      const byId = await tx.category.findUnique({ where: { id: catId } });
      if (byId) {
         if (byId.userId !== userId) {
            return {
               status: "conflict",
               reason: "foreign_row",
               currentCategory: null,
            };
         }

         if (!byId.isDeleted) {
            if (byId.name !== explicitName) {
               try {
                  await tx.category.update({
                     where: { id: byId.id },
                     data: { name: explicitName },
                  });
               } catch (error) {
                  if (isP2002(error)) {
                     const winner = await tx.category.findFirst({
                        where: {
                           userId,
                           taskType,
                           isDeleted: false,
                           name: { equals: explicitName, mode: "insensitive" },
                        },
                     });
                     return {
                        status: "conflict",
                        reason: "category_name_taken",
                        currentCategory: winner
                           ? toCategoryItem(winner)
                           : undefined,
                     };
                  }
                  throw error;
               }
            }
            return APPLIED;
         }
      }

      const liveByName = await tx.category.findFirst({
         where: {
            userId,
            taskType,
            isDeleted: false,
            name: { equals: explicitName, mode: "insensitive" },
         },
      });

      if (liveByName) {
         if (liveByName.id !== catId) {
            return {
               status: "conflict",
               reason: "category_name_taken",
               currentCategory: toCategoryItem(liveByName),
            };
         }
         return APPLIED;
      }

      const tombstoned = await tx.category.findFirst({
         where: {
            userId,
            taskType,
            isDeleted: true,
            name: { equals: explicitName, mode: "insensitive" },
         },
         orderBy: { updatedAt: "desc" },
      });

      if (tombstoned) {
         const revived = await tx.category.update({
            where: { id: tombstoned.id },
            data: { name: explicitName, isDeleted: false, deletionTime: null },
         });

         if (revived.id !== catId) {
            return {
               status: "conflict",
               reason: "category_name_taken",
               currentCategory: toCategoryItem(revived),
            };
         }
         return APPLIED;
      }

      const initialSortOrder =
         typeof payload.sortOrder === "number" ? payload.sortOrder : 0;

      try {
         await tx.category.create({
            data: {
               id: catId,
               userId,
               name: explicitName,
               taskType,
               sortOrder: initialSortOrder,
            },
         });
         return APPLIED;
      } catch (error) {
         if (isP2002(error)) {
            const winner = await tx.category.findFirst({
               where: {
                  userId,
                  taskType,
                  isDeleted: false,
                  name: { equals: explicitName, mode: "insensitive" },
               },
            });
            return {
               status: "conflict",
               reason: "category_name_taken",
               currentCategory: winner ? toCategoryItem(winner) : undefined,
            };
         }
         throw error;
      }
   }

   if (m.action === "UPDATE" || m.action === "MOVE") {
      const dataToUpdate: Record<string, unknown> = {};
      if (explicitName) {
         dataToUpdate.name = explicitName;
      }
      if (typeof payload.sortOrder === "number") {
         dataToUpdate.sortOrder = payload.sortOrder;
      }

      if (catId) {
         if (payload.taskType) {
            const currentCat = await tx.category.findUnique({
               where: { id: catId },
            });

            if (currentCat && currentCat.userId === userId) {
               const targetName = explicitName || currentCat.name;
               if (currentCat.taskType !== taskType) {
                  const nameCollision = await tx.category.findFirst({
                     where: {
                        userId,
                        taskType,
                        name: { equals: targetName, mode: "insensitive" },
                        id: { not: catId },
                        isDeleted: false,
                     },
                  });

                  if (nameCollision) {
                     dataToUpdate.name = `${targetName} (Moved)`;
                  } else if (explicitName) {
                     dataToUpdate.name = explicitName;
                  }
                  dataToUpdate.taskType = taskType;
               }
            }
         }

         if (Object.keys(dataToUpdate).length > 0) {
            try {
               const { count } = await tx.category.updateMany({
                  where: { id: catId, userId, isDeleted: false },
                  data: dataToUpdate,
               });

               if (count === 0) {
                  const current = await tx.category.findFirst({
                     where: { id: catId, userId, isDeleted: false },
                  });
                  return {
                     status: "conflict",
                     reason: "zero_rows",
                     currentCategory: current ? toCategoryItem(current) : null,
                  };
               }
            } catch (error) {
               if (isP2002(error)) {
                  const collidingName =
                     typeof dataToUpdate.name === "string"
                        ? dataToUpdate.name
                        : explicitName;
                  const winner = collidingName
                     ? await tx.category.findFirst({
                          where: {
                             userId,
                             taskType,
                             isDeleted: false,
                             name: {
                                equals: collidingName,
                                mode: "insensitive",
                             },
                          },
                       })
                     : null;
                  return {
                     status: "conflict",
                     reason: "category_name_taken",
                     currentCategory: winner
                        ? toCategoryItem(winner)
                        : undefined,
                  };
               }
               throw error;
            }

            if (payload.taskType) {
               await tx.task.updateMany({
                  where: { categoryId: catId, userId },
                  data: { taskType },
               });
            }
         }
      }

      return APPLIED;
   }

   if (m.action === "REORDER") {
      const categoryIds = (payload.categoryIds as string[]) || [];
      for (let i = 0; i < categoryIds.length; i++) {
         await tx.category.updateMany({
            where: { id: categoryIds[i], userId },
            data: { sortOrder: i },
         });
      }
      return APPLIED;
   }

   if (m.action === "DELETE") {
      if (!catId) return APPLIED;

      const currentCategory = await tx.category.findFirst({
         where: { id: catId, userId },
      });

      if (!currentCategory || currentCategory.isDeleted) return APPLIED;

      const now = new Date();

      await tx.task.updateMany({
         where: { categoryId: catId, userId, isDeleted: false },
         data: { isDeleted: true, deletionTime: now },
      });

      await tx.category.updateMany({
         where: { id: catId, userId },
         data: {
            isDeleted: true,
            deletionTime: now,
            name: buildCategoryTombstoneName(
               currentCategory.name,
               currentCategory.id
            ),
         },
      });

      return APPLIED;
   }

   return { status: "error", reason: "invalid_payload" };
}

async function applyTaskMutation(
   tx: Prisma.TransactionClient,
   userId: string,
   m: QueuedMutation
): Promise<Outcome> {
   const payload = m.payload as Record<string, unknown>;
   const taskId = String(payload.id || payload.taskId || "");
   let categoryId = String(payload.categoryId || "");
   const title = String(payload.title || "").trim();
   const taskType: TaskType =
      payload.taskType === "WEEKLY" ? "WEEKLY" : "DAILY";
   const isComplete = Boolean(payload.isComplete);
   const sortOrder =
      typeof payload.sortOrder === "number" ? payload.sortOrder : 0;

   if (m.action === "CREATE") {
      if (!taskId || !title) return APPLIED;

      let categoryMissing = false;
      let cat = null;

      if (categoryId) {
         cat = await tx.category.findFirst({
            where: { id: categoryId, userId, isDeleted: false },
         });
      }

      if (!cat) {
         categoryMissing = Boolean(payload.categoryId);
         cat = await tx.category.findFirst({
            where: { userId, taskType, isDeleted: false },
         });
         if (!cat) {
            cat = await tx.category.create({
               data: {
                  userId,
                  name: DEFAULT_CATEGORY_NAME,
                  taskType,
                  sortOrder: 0,
               },
            });
         }
         categoryId = cat.id;
      }

      const status: TaskStatus =
         (payload.status as TaskStatus) || (isComplete ? "COMPLETED" : "TODO");
      const finalIsComplete = status === "COMPLETED";
      const dueDate = payload.dueDate
         ? new Date(String(payload.dueDate))
         : null;

      const rawChallengeId = payload.challengeId;
      const linkedChallengeId = await resolveWritableChallengeLink(
         tx,
         userId,
         typeof rawChallengeId === "string" || rawChallengeId === null
            ? rawChallengeId
            : undefined,
         { resolveCurrent: true, onRejected: "unlink" }
      );
      const challengeId = linkedChallengeId ?? null;

      const existing = await tx.task.findUnique({
         where: { id: taskId },
         select: { userId: true },
      });

      if (existing && existing.userId !== userId) {
         return {
            status: "conflict",
            reason: "foreign_row",
            currentTask: null,
         };
      }

      if (existing) {
         await tx.task.update({
            where: { id: taskId },
            data: {
               title,
               isComplete: finalIsComplete,
               status,
               dueDate,
               completedAt: finalIsComplete ? new Date() : null,
               categoryId,
               sortOrder,
            },
         });
         return categoryMissing
            ? { status: "applied", reason: "category_missing" }
            : APPLIED;
      }

      try {
         await tx.task.create({
            data: {
               id: taskId,
               userId,
               categoryId,
               challengeId,
               title,
               taskType,
               sortOrder,
               isComplete: finalIsComplete,
               status,
               dueDate,
               completedAt: finalIsComplete ? new Date() : null,
            },
         });
         return categoryMissing
            ? { status: "applied", reason: "category_missing" }
            : APPLIED;
      } catch (error) {
         if (isP2002(error)) {
            const winner = await tx.task.findUnique({
               where: { id: taskId },
               select: { userId: true },
            });
            if (winner?.userId === userId) return APPLIED;
            return {
               status: "conflict",
               reason: "foreign_row",
               currentTask: null,
            };
         }
         throw error;
      }
   }

   if (m.action === "UPDATE" || m.action === "MOVE") {
      if (!taskId) return APPLIED;

      const dataToUpdate: Record<string, unknown> = {};
      let categoryMissing = false;

      if (title) dataToUpdate.title = title;
      if (categoryId) {
         const targetCat = await tx.category.findFirst({
            where: { id: categoryId, userId, isDeleted: false },
         });
         if (targetCat) {
            dataToUpdate.categoryId = categoryId;
         } else {
            categoryMissing = true;
         }
      }
      if (payload.taskType) dataToUpdate.taskType = taskType;
      if (typeof payload.sortOrder === "number")
         dataToUpdate.sortOrder = payload.sortOrder;
      if (payload.dueDate !== undefined) {
         dataToUpdate.dueDate = payload.dueDate
            ? new Date(String(payload.dueDate))
            : null;
      }
      if (payload.challengeId !== undefined) {
         const rawChalId = payload.challengeId;
         const linked = await resolveWritableChallengeLink(
            tx,
            userId,
            typeof rawChalId === "string" ? rawChalId.trim() || null : null,
            { onRejected: "omit" }
         );
         if (linked !== undefined) {
            dataToUpdate.challengeId = linked;
         }
      }
      if (payload.status) {
         const status = payload.status as TaskStatus;
         dataToUpdate.status = status;
         dataToUpdate.isComplete = status === "COMPLETED";
         dataToUpdate.completedAt = status === "COMPLETED" ? new Date() : null;
      } else if (typeof payload.isComplete === "boolean") {
         dataToUpdate.isComplete = payload.isComplete;
         dataToUpdate.status = payload.isComplete ? "COMPLETED" : "TODO";
         dataToUpdate.completedAt = payload.isComplete ? new Date() : null;
      }

      const { count } = await tx.task.updateMany({
         where: { id: taskId, userId, isDeleted: false },
         data: dataToUpdate,
      });

      if (count === 0) {
         const current = await tx.task.findFirst({
            where: { id: taskId, userId, isDeleted: false },
         });
         return {
            status: "conflict",
            reason: "zero_rows",
            currentTask: current ? toTaskItem(current, current.taskType) : null,
         };
      }

      return categoryMissing
         ? { status: "applied", reason: "category_missing" }
         : APPLIED;
   }

   if (m.action === "REORDER") {
      const taskIds = (payload.taskIds as string[]) || [];
      for (let i = 0; i < taskIds.length; i++) {
         await tx.task.updateMany({
            where: { id: taskIds[i], userId, isDeleted: false },
            data: { sortOrder: i },
         });
      }
      return APPLIED;
   }

   if (m.action === "TOGGLE") {
      if (!taskId) return APPLIED;

      const status: TaskStatus =
         (payload.status as TaskStatus) || (isComplete ? "COMPLETED" : "TODO");
      const finalIsComplete = status === "COMPLETED";

      const { count } = await tx.task.updateMany({
         where: { id: taskId, userId, isDeleted: false },
         data: {
            isComplete: finalIsComplete,
            status,
            completedAt: finalIsComplete ? new Date() : null,
         },
      });

      if (count === 0) {
         const current = await tx.task.findFirst({
            where: { id: taskId, userId, isDeleted: false },
         });
         return {
            status: "conflict",
            reason: "zero_rows",
            currentTask: current ? toTaskItem(current, current.taskType) : null,
         };
      }

      return APPLIED;
   }

   if (m.action === "DELETE") {
      if (!taskId) return APPLIED;

      await tx.task.updateMany({
         where: { id: taskId, userId, isDeleted: false },
         data: { isDeleted: true, deletionTime: new Date() },
      });

      return APPLIED;
   }

   return { status: "error", reason: "invalid_payload" };
}

/**
 * Processes a queued batch of offline task and category mutations for a user.
 * Each mutation is isolated in its own transaction so individual failures do not
 * prevent remaining valid mutations from committing.
 *
 * @param userId - ID of the authenticated user performing the sync.
 * @param rawMutations - Array of pending offline mutations to apply.
 * @returns BatchSyncResponse with per-mutation results, the authenticated user ID, and latest server changes.
 */
export async function processBatchSync(
   userId: string,
   rawMutations: QueuedMutation[]
): Promise<BatchSyncResponse> {
   const mutations = compactMutationQueue(rawMutations);
   const mutationResults: MutationResult[] = [];

   for (const m of mutations) {
      try {
         const outcome = await prisma.$transaction((tx) =>
            m.entityType === "CATEGORY"
               ? applyCategoryMutation(tx, userId, m)
               : applyTaskMutation(tx, userId, m)
         );

         mutationResults.push({ id: m.id, ...outcome });
      } catch (err) {
         logger.error(logEvents.tasksSyncFailed, {
            context: { userId, mutationId: m.id, action: m.action },
            error: err,
         });
         mutationResults.push({
            id: m.id,
            status: "error",
            reason: "invalid_payload",
         });
      }
   }

   // Acknowledge mutations that compaction pruned from the batch.
   const seenMutationIds = new Set(mutationResults.map((r) => r.id));
   for (const raw of rawMutations) {
      if (!seenMutationIds.has(raw.id)) {
         mutationResults.push({ id: raw.id, status: "applied" });
      }
   }

   const processedMutationIds = mutationResults
      .filter((r) => r.status !== "error")
      .map((r) => r.id);

   const latest =
      typeof getUserCategorizedTasksFromDatabase === "function"
         ? await getUserCategorizedTasksFromDatabase(userId)
         : await getUserCategorizedTasks(userId);

   const flatTasks = [
      ...latest.dailyCategories.flatMap((c) => c.tasks),
      ...latest.weeklyCategories.flatMap((c) => c.tasks),
   ];

   return {
      success: true,
      processedMutationIds,
      mutationResults,
      authenticatedUserId: userId,
      serverChanges: {
         categories: latest.categories,
         tasks: flatTasks,
      },
   };
}
