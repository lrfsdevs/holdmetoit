import {
   getAllQueuedMutations,
   logTaskSync,
   migrateGuestDataToUser,
   putLocalCategories,
   putLocalTasks,
   removeQueuedMutations,
} from "./task-idb";
import type { BatchSyncResponse } from "@/features/tasks/domain/task-sync.types";

let isSyncing = false;
let syncTimeout: NodeJS.Timeout | null = null;

export async function syncNow(
   userId: string | null
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
      if (mutations.length === 0) {
         isSyncing = false;
         return null;
      }

      logTaskSync(`Flushing ${mutations.length} pending mutations to cloud...`);

      const res = await fetch("/api/tasks/sync", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ mutations }),
      });

      if (!res.ok) {
         const errorData = await res.json().catch(() => ({}));
         const errorMsg = errorData.error || `HTTP ${res.status}`;
         logTaskSync(`Batch sync error: ${errorMsg}`);
         return null;
      }

      const data: BatchSyncResponse = await res.json();
      const durationMs = Date.now() - startTime;

      if (data.success) {
         if (data.processedMutationIds.length > 0) {
            await removeQueuedMutations(data.processedMutationIds);
         }

         // Reconcile server changes locally
         if (data.serverChanges) {
            const localCategories = data.serverChanges.categories.map((c) => ({
               id: c.id,
               userId,
               name: c.name,
               taskType: c.taskType,
               sortOrder: c.sortOrder ?? 0,
               createdAt: new Date(c.createdAt).toISOString(),
               updatedAt: new Date(c.updatedAt).toISOString(),
               syncState: "synced" as const,
            }));

            const localTasks = data.serverChanges.tasks.map((t) => ({
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
         }

         logTaskSync(
            `Batch sync completed in ${durationMs}ms: ${data.processedMutationIds.length} mutations processed.`
         );
         return data;
      } else {
         logTaskSync(`Batch sync rejected: ${data.error || "Unknown error"}`);
         return null;
      }
   } catch (err) {
      logTaskSync("Network error during sync flush:", err);
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
      if (userId) {
         syncNow(userId).catch(() => {});
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
         syncNow(userId).catch(() => {});
      }
   };

   window.addEventListener("online", handleOnline);
   window.addEventListener("offline", handleOffline);
   document.addEventListener("visibilitychange", handleVisibility);

   // Initial trigger & guest data migration check
   if (userId) {
      migrateGuestDataToUser(userId)
         .then(() => syncNow(userId))
         .catch((err) => {
            logTaskSync("Initial sync error:", err);
         });
   }

   return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (syncTimeout) {
         clearTimeout(syncTimeout);
      }
   };
}
