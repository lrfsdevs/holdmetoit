import {
   deleteLocalCategory,
   deleteLocalTask,
   enqueueMutation,
   getAllLocalCategories,
   getAllLocalTasks,
   getAllQueuedMutations,
   logTaskSync,
   migrateGuestDataToUser,
   putLocalCategories,
   putLocalCategory,
   putLocalTask,
   putLocalTasks,
   remapLocalCategoryId,
   removeQueuedMutations,
} from "./task-idb";
import type {
   BatchSyncResponse,
   LocalCategoryRecord,
   LocalTaskRecord,
   MutationResult,
   QueuedMutation,
} from "@/features/tasks/domain/task-sync.types";
import type {
   CategoryItem,
   TaskItem,
   TaskStatus,
} from "@/features/tasks/domain/task.types";
import { sortMutationsChronologically } from "@/features/tasks/domain/task-sync.schema";

/** Options controlling sync execution behavior. */
export interface SyncOptions {
   /** When true, fetches remote server changes even if the local mutation queue is empty. */
   forcePull?: boolean;
}

/** Custom DOM event dispatched when task synchronization reconciles server changes. */
export const TASKS_SYNCED_EVENT = "holdmetoit:task-synced";

let isSyncing = false;
let syncTimeout: NodeJS.Timeout | null = null;
let retryAttempts = 0;
const INITIAL_RETRY_DELAY_MS = 2000;
const MAX_RETRY_DELAY_MS = 30000;

function mapTaskItemToLocal(task: TaskItem, userId: string): LocalTaskRecord {
   return {
      id: task.id,
      userId,
      categoryId: task.categoryId,
      challengeId: task.challengeId ?? null,
      title: task.title,
      taskType: task.taskType,
      sortOrder: task.sortOrder ?? 0,
      isComplete: task.isComplete,
      status: task.status || (task.isComplete ? "COMPLETED" : "TODO"),
      dueDate: task.dueDate
         ? typeof task.dueDate === "string"
            ? task.dueDate.slice(0, 10)
            : new Date(task.dueDate).toISOString().slice(0, 10)
         : null,
      createdAt: new Date(task.createdAt).toISOString(),
      updatedAt: new Date(task.updatedAt).toISOString(),
      completedAt: task.completedAt
         ? new Date(task.completedAt).toISOString()
         : null,
      syncState: "synced",
      revision: task.revision,
   };
}

function mapCategoryItemToLocal(
   category: CategoryItem,
   userId: string
): LocalCategoryRecord {
   return {
      id: category.id,
      userId,
      name: category.name,
      taskType: category.taskType,
      sortOrder: category.sortOrder ?? 0,
      createdAt: new Date(category.createdAt).toISOString(),
      updatedAt: new Date(category.updatedAt).toISOString(),
      syncState: "synced",
      revision: category.revision,
   };
}

const REBASE_LIMIT = 2;

function entityIdOf(mutation: QueuedMutation | undefined): string {
   if (!mutation) return "";
   const payload = mutation.payload as Record<string, unknown>;
   return String(payload.id || payload.taskId || payload.categoryId || "");
}

/**
 * Re-applies a rejected task mutation's own fields on top of the authoritative
 * server row, so the rebased mutation preserves the user's intent.
 */
function applyTaskPayloadToLocal(
   local: LocalTaskRecord,
   payload: Record<string, unknown>
): LocalTaskRecord {
   const next: LocalTaskRecord = {
      ...local,
      syncState: "pending",
      updatedAt: new Date().toISOString(),
   };

   if (typeof payload.title === "string" && payload.title.trim()) {
      next.title = payload.title.trim();
   }
   if (typeof payload.categoryId === "string") {
      next.categoryId = payload.categoryId;
   }
   if (payload.taskType === "DAILY" || payload.taskType === "WEEKLY") {
      next.taskType = payload.taskType;
   }
   if (typeof payload.sortOrder === "number") {
      next.sortOrder = payload.sortOrder;
   }
   if (payload.dueDate !== undefined) {
      next.dueDate = payload.dueDate
         ? String(payload.dueDate).slice(0, 10)
         : null;
   }
   if (payload.challengeId !== undefined) {
      next.challengeId = payload.challengeId as string | null;
   }
   if (typeof payload.isComplete === "boolean") {
      next.isComplete = payload.isComplete;
      next.status = payload.isComplete ? "COMPLETED" : "TODO";
      next.completedAt = payload.isComplete ? new Date().toISOString() : null;
   }
   if (typeof payload.status === "string") {
      next.status = payload.status as TaskStatus;
      next.isComplete = payload.status === "COMPLETED";
      next.completedAt =
         payload.status === "COMPLETED" ? new Date().toISOString() : null;
   }

   return next;
}

function applyCategoryPayloadToLocal(
   local: LocalCategoryRecord,
   payload: Record<string, unknown>
): LocalCategoryRecord {
   const next: LocalCategoryRecord = {
      ...local,
      syncState: "pending",
      updatedAt: new Date().toISOString(),
   };

   if (typeof payload.name === "string" && payload.name.trim()) {
      next.name = payload.name.trim();
   }
   if (payload.taskType === "DAILY" || payload.taskType === "WEEKLY") {
      next.taskType = payload.taskType;
   }
   if (typeof payload.sortOrder === "number") {
      next.sortOrder = payload.sortOrder;
   }

   return next;
}

/**
 * Schedules an exponential-backoff retry attempt for synchronization failures.
 *
 * @param userId - Authenticated user identifier.
 * @param options - Optional sync configuration flags preserving forcePull across retries.
 */
function scheduleRetry(userId: string | null, options?: SyncOptions): void {
   if (!userId || typeof window === "undefined") return;
   retryAttempts++;
   const delayMs = Math.min(
      MAX_RETRY_DELAY_MS,
      INITIAL_RETRY_DELAY_MS * Math.pow(1.5, retryAttempts - 1)
   );
   logTaskSync(
      `Scheduling sync retry #${retryAttempts} in ${Math.round(delayMs)}ms${options?.forcePull ? " (forced pull)" : ""}`
   );
   scheduleSync(userId, delayMs, options);
}

/**
 * Executes immediate batch synchronization between client IndexedDB and server.
 * Flushes queued mutations or pulls fresh server changes when forcePull is enabled.
 * Reconciles remote updates and cleans up remotely deleted entities without clobbering pending local edits.
 *
 * @param userId - Authenticated user identifier.
 * @param options - Configuration options controlling forcePull behavior.
 * @returns BatchSyncResponse if successful, or null on rejection/network failure.
 */
export async function syncNow(
   userId: string | null,
   options?: SyncOptions
): Promise<BatchSyncResponse | null> {
   if (typeof window === "undefined" || !userId) {
      return null;
   }

   if (typeof navigator !== "undefined" && !navigator.onLine) {
      logTaskSync("Network is offline. Changes remain saved locally.");
      return null;
   }

   if (isSyncing) {
      logTaskSync("Sync already in progress. Skipping duplicate run.");
      return null;
   }

   isSyncing = true;
   const startTime = Date.now();

   try {
      const mutations = await getAllQueuedMutations();
      if (mutations.length === 0 && !options?.forcePull) {
         isSyncing = false;
         return null;
      }

      const [localTaskRecords, localCategoryRecords] = await Promise.all([
         getAllLocalTasks(userId),
         getAllLocalCategories(userId),
      ]);

      const tracked = new Map<string, number>();
      for (const task of localTaskRecords) {
         if (typeof task.revision === "number") {
            tracked.set(task.id, task.revision);
         }
      }
      for (const category of localCategoryRecords) {
         if (typeof category.revision === "number") {
            tracked.set(category.id, category.revision);
         }
      }

      const enriched = sortMutationsChronologically(mutations).map((m) => {
         const id = entityIdOf(m);

         if (m.action === "CREATE") {
            // A locally created entity starts at revision 0.
            if (!tracked.has(id)) tracked.set(id, 0);
            return m;
         }

         if (m.action === "REORDER" || m.action === "ROLLOVER") {
            const payload = m.payload as {
               taskIds?: string[];
               categoryIds?: string[];
            };
            const affected =
               m.action === "ROLLOVER" || m.entityType === "TASK"
                  ? (payload.taskIds ?? [])
                  : (payload.categoryIds ?? []);
            for (const affectedId of affected) {
               const revision = tracked.get(affectedId);
               if (typeof revision === "number") {
                  tracked.set(affectedId, revision + 1);
               }
            }
            return m;
         }

         if (m.action === "DELETE") {
            // The row is gone; a later mutation must not match a stale revision.
            const revision = tracked.get(id);
            if (typeof revision === "number") {
               tracked.set(id, revision + 1);
            }
            return m;
         }

         const baseRevision = tracked.get(id);
         if (typeof baseRevision === "number") {
            tracked.set(id, baseRevision + 1);
            return { ...m, baseRevision };
         }

         // Legacy local record: apply unconditionally once, then the snapshot
         // supplies the revision.
         return m;
      });

      logTaskSync(
         mutations.length > 0
            ? `Flushing ${mutations.length} pending mutations to cloud...`
            : "Pulling latest task changes from cloud..."
      );

      const res = await fetch("/api/tasks/sync", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ mutations: enriched }),
      });

      if (!res.ok) {
         const errorData = await res.json().catch(() => ({}));
         const errorMsg = errorData.error || `HTTP ${res.status}`;
         logTaskSync(`Batch sync error: ${errorMsg}`);
         scheduleRetry(userId, options);
         return null;
      }

      const data: BatchSyncResponse = await res.json();
      const durationMs = Date.now() - startTime;

      if (data.success) {
         retryAttempts = 0;

         // Cross-account boundary check: verify authenticated user matches client state
         if (
            data.authenticatedUserId &&
            userId &&
            data.authenticatedUserId !== userId
         ) {
            logTaskSync(
               `Session user mismatch detected (client: ${userId}, server: ${data.authenticatedUserId}). Aborting local mutation write.`
            );
            if (typeof window !== "undefined") {
               window.location.reload();
            }
            return data;
         }

         const results: MutationResult[] =
            data.mutationResults ??
            data.processedMutationIds.map((id) => ({
               id,
               status: "applied" as const,
            }));

         const acknowledged = results.filter((r) => r.status !== "error");
         const acknowledgedSet = new Set(acknowledged.map((r) => r.id));

         if (acknowledged.length > 0) {
            await removeQueuedMutations(acknowledged.map((r) => r.id));
         }

         const mutationById = new Map(mutations.map((m) => [m.id, m]));
         const rebasedEntityIds = new Set<string>();

         // Conflicts with a current row are rebased onto its revision; other
         // conflicts adopt the authoritative row immediately.
         for (const result of results) {
            if (result.status !== "conflict") continue;
            const mutation = mutationById.get(result.id);
            const entityId = entityIdOf(mutation);
            const isCreate = mutation?.action === "CREATE";
            const hasCurrentEntity =
               result.currentTask !== undefined ||
               result.currentCategory !== undefined;

            // A rejected CREATE has no server row to adopt; remove the local one.
            if (isCreate && !hasCurrentEntity) {
               if (mutation?.entityType === "TASK") {
                  if (entityId) await deleteLocalTask(entityId);
               } else if (mutation?.entityType === "CATEGORY") {
                  if (entityId) await deleteLocalCategory(entityId);
               }
               continue;
            }

            const isTaskRevisionConflict =
               result.reason === "zero_rows" &&
               Boolean(result.currentTask) &&
               mutation?.entityType === "TASK" &&
               (mutation.action === "UPDATE" ||
                  mutation.action === "TOGGLE" ||
                  mutation.action === "MOVE");

            if (isTaskRevisionConflict && result.currentTask && mutation) {
               const current = mapTaskItemToLocal(result.currentTask, userId);
               if (!entityId || mutation.retryCount >= REBASE_LIMIT) {
                  await putLocalTask(current);
                  if (entityId && mutation.retryCount >= REBASE_LIMIT) {
                     logTaskSync(
                        "Task conflict rebase limit reached; accepting the server row.",
                        { taskId: entityId }
                     );
                  }
                  continue;
               }

               const rebased = applyTaskPayloadToLocal(
                  current,
                  mutation.payload as Record<string, unknown>
               );
               await putLocalTask(rebased);
               await enqueueMutation({
                  ...mutation,
                  id: crypto.randomUUID(),
                  createdAt: Date.now(),
                  retryCount: mutation.retryCount + 1,
               });
               rebasedEntityIds.add(entityId);
               logTaskSync(
                  "Task conflict rebased onto the current server revision.",
                  { taskId: entityId, retryCount: mutation.retryCount + 1 }
               );
               continue;
            }

            const isCategoryRevisionConflict =
               result.reason === "zero_rows" &&
               Boolean(result.currentCategory) &&
               mutation?.entityType === "CATEGORY" &&
               (mutation.action === "UPDATE" || mutation.action === "MOVE");

            if (
               isCategoryRevisionConflict &&
               result.currentCategory &&
               mutation
            ) {
               const current = mapCategoryItemToLocal(
                  result.currentCategory,
                  userId
               );
               if (!entityId || mutation.retryCount >= REBASE_LIMIT) {
                  await putLocalCategory(current);
                  if (entityId && mutation.retryCount >= REBASE_LIMIT) {
                     logTaskSync(
                        "Category conflict rebase limit reached; accepting the server row.",
                        { categoryId: entityId }
                     );
                  }
                  continue;
               }

               const rebased = applyCategoryPayloadToLocal(
                  current,
                  mutation.payload as Record<string, unknown>
               );
               await putLocalCategory(rebased);
               await enqueueMutation({
                  ...mutation,
                  id: crypto.randomUUID(),
                  createdAt: Date.now(),
                  retryCount: mutation.retryCount + 1,
               });
               rebasedEntityIds.add(entityId);
               logTaskSync(
                  "Category conflict rebased onto the current server revision.",
                  { categoryId: entityId, retryCount: mutation.retryCount + 1 }
               );
               continue;
            }

            // Non-revision conflicts (name taken, challenge locked, row gone)
            // adopt the authoritative row.
            if (result.currentTask === null) {
               if (entityId) await deleteLocalTask(entityId);
            } else if (result.currentTask) {
               await putLocalTask(
                  mapTaskItemToLocal(result.currentTask, userId)
               );
            }

            if (result.currentCategory === null) {
               if (entityId) await deleteLocalCategory(entityId);
            } else if (result.currentCategory) {
               const requestedCategoryId =
                  (mutation?.payload as { id?: string } | undefined)?.id ??
                  entityId;

               if (
                  requestedCategoryId &&
                  requestedCategoryId !== result.currentCategory.id
               ) {
                  await remapLocalCategoryId(
                     requestedCategoryId,
                     result.currentCategory.id
                  );
               }

               await putLocalCategory(
                  mapCategoryItemToLocal(result.currentCategory, userId)
               );
            }
         }

         if (rebasedEntityIds.size > 0) {
            scheduleSync(userId, 100);
         }

         // Reconcile server changes locally without clobbering pending local edits
         if (data.serverChanges) {
            const remainingMutations = mutations.filter(
               (m) => !acknowledgedSet.has(m.id)
            );
            const pendingEntityIds = new Set(
               remainingMutations.map(entityIdOf)
            );
            rebasedEntityIds.forEach((id) => pendingEntityIds.add(id));

            const localCategories = data.serverChanges.categories
               .filter((c) => !pendingEntityIds.has(c.id))
               .map((c) => mapCategoryItemToLocal(c, userId));

            const existingTasks = await getAllLocalTasks(userId);

            const localTasks = data.serverChanges.tasks
               .filter((t) => !pendingEntityIds.has(t.id))
               .map((t) => mapTaskItemToLocal(t, userId));

            await putLocalCategories(localCategories);
            await putLocalTasks(localTasks);

            // Prune local synced tasks that were deleted remotely
            const serverTaskIdSet = new Set(
               data.serverChanges.tasks.map((t) => t.id)
            );
            // existingTasks already populated during local task reconciliation
            for (const lt of existingTasks) {
               if (
                  lt.syncState === "synced" &&
                  !serverTaskIdSet.has(lt.id) &&
                  !pendingEntityIds.has(lt.id)
               ) {
                  await deleteLocalTask(lt.id);
               }
            }

            // Prune local synced categories that were deleted remotely
            const serverCatIdSet = new Set(
               data.serverChanges.categories.map((c) => c.id)
            );
            const existingCats = await getAllLocalCategories(userId);
            for (const lc of existingCats) {
               if (
                  lc.syncState === "synced" &&
                  !serverCatIdSet.has(lc.id) &&
                  !pendingEntityIds.has(lc.id)
               ) {
                  await deleteLocalCategory(lc.id);
               }
            }

            if (typeof window !== "undefined") {
               window.dispatchEvent(
                  new CustomEvent(TASKS_SYNCED_EVENT, {
                     detail: data.serverChanges,
                  })
               );
            }
         }

         logTaskSync(
            `Batch sync completed in ${durationMs}ms: ${acknowledged.length} mutations processed.`
         );
         return data;
      } else {
         logTaskSync(`Batch sync rejected: ${data.error || "Unknown error"}`);
         scheduleRetry(userId, options);
         return null;
      }
   } catch (err) {
      logTaskSync("Network error during sync flush:", err);
      scheduleRetry(userId, options);
      return null;
   } finally {
      isSyncing = false;
   }
}

/**
 * Schedules a debounced sync invocation after a specified delay.
 *
 * @param userId - Authenticated user identifier.
 * @param delayMs - Delay in milliseconds before executing syncNow (default 1500ms).
 * @param options - Optional sync configuration flags such as forcePull.
 */
export function scheduleSync(
   userId: string | null,
   delayMs = 1500,
   options?: SyncOptions
): void {
   if (typeof window === "undefined" || !userId) return;

   if (syncTimeout) {
      clearTimeout(syncTimeout);
   }

   syncTimeout = setTimeout(() => {
      syncNow(userId, options).catch(() => {});
   }, delayMs);
}

/**
 * Initializes browser background sync listeners for network online transitions,
 * tab visibility changes, and periodic polling.
 *
 * @param userId - Current authenticated user ID, or null/undefined if guest.
 * @returns Cleanup function removing all registered event listeners and timers.
 */
export function initTaskSync(userId?: string | null): () => void {
   if (typeof window === "undefined") {
      return () => {};
   }

   const handleOnline = () => {
      logTaskSync("Device transitioned to ONLINE. Checking pending queue...");
      retryAttempts = 0;
      if (userId) {
         syncNow(userId, { forcePull: true }).catch(() => {});
      }
   };

   const handleOffline = () => {
      logTaskSync(
         "Device transitioned to OFFLINE. Offline-first persistence active."
      );
   };

   const handleVisibility = () => {
      if (
         document.visibilityState === "visible" &&
         navigator.onLine &&
         userId
      ) {
         logTaskSync(
            "App tab became visible. Triggering background sync check."
         );
         retryAttempts = 0;
         syncNow(userId, { forcePull: true }).catch(() => {});
      }
   };

   window.addEventListener("online", handleOnline);
   window.addEventListener("offline", handleOffline);
   document.addEventListener("visibilitychange", handleVisibility);

   // Periodic interval ticker: every 15s checks if there are pending mutations
   const SYNC_INTERVAL_MS = 15000;
   const intervalId = setInterval(() => {
      if (
         userId &&
         typeof navigator !== "undefined" &&
         navigator.onLine &&
         !isSyncing
      ) {
         getAllQueuedMutations()
            .then((mutations) => {
               if (mutations.length > 0) {
                  logTaskSync(
                     `Periodic background ticker found ${mutations.length} pending mutations. Syncing...`
                  );
                  syncNow(userId).catch(() => {});
               }
            })
            .catch(() => {});
      }
   }, SYNC_INTERVAL_MS);

   // Initial trigger & guest data migration check
   if (userId) {
      migrateGuestDataToUser(userId)
         .then(() => syncNow(userId, { forcePull: true }))
         .catch((err) => {
            logTaskSync("Initial sync error:", err);
         });
   }

   return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(intervalId);
      if (syncTimeout) {
         clearTimeout(syncTimeout);
      }
   };
}
