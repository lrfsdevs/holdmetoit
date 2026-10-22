import {
   getAllQueuedMutations,
   logTaskSync,
   migrateGuestDataToUser,
   putLocalCategories,
   putLocalTasks,
   removeQueuedMutations,
} from "./task-idb";
import type { BatchSyncResponse } from "@/features/tasks/domain/task-sync.types";

export interface SyncOptions {
   forcePull?: boolean;
}

export const TASKS_SYNCED_EVENT = "holdmetoit:task-synced";

let isSyncing = false;
let syncTimeout: NodeJS.Timeout | null = null;
let retryAttempts = 0;
const INITIAL_RETRY_DELAY_MS = 2000;
const MAX_RETRY_DELAY_MS = 30000;

function scheduleRetry(userId: string | null): void {
   if (!userId || typeof window === "undefined") return;
   retryAttempts++;
   const delayMs = Math.min(
      MAX_RETRY_DELAY_MS,
      INITIAL_RETRY_DELAY_MS * Math.pow(1.5, retryAttempts - 1)
   );
   logTaskSync(
      `Scheduling sync retry #${retryAttempts} in ${Math.round(delayMs)}ms`
   );
   scheduleSync(userId, delayMs);
}

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
         scheduleRetry(userId);
         return null;
      }

      const data: BatchSyncResponse = await res.json();
      const durationMs = Date.now() - startTime;

      if (data.success) {
         retryAttempts = 0;
         if (data.processedMutationIds.length > 0) {
            await removeQueuedMutations(data.processedMutationIds);
         }

         // Reconcile server changes locally without clobbering pending local edits
         if (data.serverChanges) {
            const acknowledgedSet = new Set(data.processedMutationIds);
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
               .map((c) => ({
                  id: c.id,
                  userId,
                  name: c.name,
                  taskType: c.taskType,
                  sortOrder: c.sortOrder ?? 0,
                  createdAt: new Date(c.createdAt).toISOString(),
                  updatedAt: new Date(c.updatedAt).toISOString(),
                  syncState: "synced" as const,
               }));

            const localTasks = data.serverChanges.tasks
               .filter((t) => !pendingEntityIds.has(t.id))
               .map((t) => ({
                  id: t.id,
                  userId,
                  categoryId: t.categoryId,
                  challengeId: t.challengeId ?? null,
                  title: t.title,
                  taskType: t.taskType,
                  sortOrder: t.sortOrder ?? 0,
                  isComplete: t.isComplete,
                  status: t.status || (t.isComplete ? "COMPLETED" : "TODO"),
                  dueDate: t.dueDate
                     ? typeof t.dueDate === "string"
                        ? t.dueDate.slice(0, 10)
                        : new Date(t.dueDate).toISOString().slice(0, 10)
                     : null,
                  createdAt: new Date(t.createdAt).toISOString(),
                  updatedAt: new Date(t.updatedAt).toISOString(),
                  completedAt: t.completedAt
                     ? new Date(t.completedAt).toISOString()
                     : null,
                  syncState: "synced" as const,
               }));

            await putLocalCategories(localCategories);
            await putLocalTasks(localTasks);

            if (typeof window !== "undefined") {
               window.dispatchEvent(
                  new CustomEvent(TASKS_SYNCED_EVENT, {
                     detail: data.serverChanges,
                  })
               );
            }
         }

         logTaskSync(
            `Batch sync completed in ${durationMs}ms: ${data.processedMutationIds.length} mutations processed.`
         );
         return data;
      } else {
         logTaskSync(`Batch sync rejected: ${data.error || "Unknown error"}`);
         scheduleRetry(userId);
         return null;
      }
   } catch (err) {
      logTaskSync("Network error during sync flush:", err);
      scheduleRetry(userId);
      return null;
   } finally {
      isSyncing = false;
   }
}

export function scheduleSync(userId: string | null, delayMs = 1500): void {
   if (typeof window === "undefined" || !userId) return;

   if (syncTimeout) {
      clearTimeout(syncTimeout);
   }

   syncTimeout = setTimeout(() => {
      syncNow(userId).catch(() => {});
   }, delayMs);
}

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
