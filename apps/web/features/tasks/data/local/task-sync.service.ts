import {
   deleteLocalCategory,
   deleteLocalTask,
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
} from "@/features/tasks/domain/task-sync.types";
import type {
   CategoryItem,
   TaskItem,
} from "@/features/tasks/domain/task.types";

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
   };
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

      logTaskSync(
         mutations.length > 0
            ? `Flushing ${mutations.length} pending mutations to cloud...`
            : "Pulling latest task changes from cloud..."
      );

      const res = await fetch("/api/tasks/sync", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ mutations }),
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
         const entityIdFor = (mutationId: string): string => {
            const payload = mutationById.get(mutationId)?.payload as
               Record<string, unknown> | undefined;
            return String(
               payload?.id || payload?.taskId || payload?.categoryId || ""
            );
         };

         // Conflicts are accepted by the server; apply the authoritative row now.
         for (const result of results) {
            if (result.status !== "conflict") continue;
            const entityId = entityIdFor(result.id);
            const mutation = mutationById.get(result.id);
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
                  (
                     mutationById.get(result.id)?.payload as
                        { id?: string } | undefined
                  )?.id ?? entityId;

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

         // Reconcile server changes locally without clobbering pending local edits
         if (data.serverChanges) {
            const remainingMutations = mutations.filter(
               (m) => !acknowledgedSet.has(m.id)
            );
            const pendingEntityIds = new Set(
               remainingMutations.map((m) => {
                  const p = m.payload as Record<string, unknown>;
                  return String(p.id || p.taskId || p.categoryId || "");
               })
            );

            const localCategories = data.serverChanges.categories
               .filter((c) => !pendingEntityIds.has(c.id))
               .map((c) => mapCategoryItemToLocal(c, userId));

            const existingTasks = await getAllLocalTasks(userId);
            const existingTaskMap = new Map(
               existingTasks.map((t) => [t.id, t])
            );

            const localTasks = data.serverChanges.tasks
               .filter((t) => {
                  if (pendingEntityIds.has(t.id)) return false;
                  const local = existingTaskMap.get(t.id);
                  if (local && local.syncState === "pending") {
                     const localTime = local.updatedAt
                        ? new Date(local.updatedAt).getTime()
                        : 0;
                     const serverTime = t.updatedAt
                        ? new Date(t.updatedAt).getTime()
                        : 0;
                     if (localTime > serverTime) {
                        return false;
                     }
                  }
                  return true;
               })
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
