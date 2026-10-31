import type {
   LocalCategoryRecord,
   LocalTaskRecord,
   QueuedMutation,
} from "@/features/tasks/domain/task-sync.types";
import { createLogger, logEvents } from "@/core/observability/logger";

const logger = createLogger("tasks.sync.local");

const DB_NAME = "holdmetoit_db";
const DB_VERSION = 1;

export const STORES = {
   TASKS: "tasks",
   CATEGORIES: "categories",
   MUTATIONS: "queued_mutations",
} as const;

export function logTaskSync(message: string, data?: unknown): void {
   if (data instanceof Error) {
      logger.error(logEvents.tasksSyncLocal, {
         context: { message },
         error: data,
      });
      return;
   }

   logger.debug(logEvents.tasksSyncLocal, {
      context: { message },
      ...(data !== undefined ? { error: data } : {}),
   });
}

function openDatabase(): Promise<IDBDatabase | null> {
   if (typeof window === "undefined" || !("indexedDB" in window)) {
      return Promise.resolve(null);
   }

   return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
         const db = (event.target as IDBOpenDBRequest).result;

         // Tasks store
         if (!db.objectStoreNames.contains(STORES.TASKS)) {
            const taskStore = db.createObjectStore(STORES.TASKS, {
               keyPath: "id",
            });
            taskStore.createIndex("userId", "userId", { unique: false });
            taskStore.createIndex("categoryId", "categoryId", {
               unique: false,
            });
            taskStore.createIndex("taskType", "taskType", { unique: false });
            taskStore.createIndex("syncState", "syncState", { unique: false });
         }

         // Categories store
         if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
            const catStore = db.createObjectStore(STORES.CATEGORIES, {
               keyPath: "id",
            });
            catStore.createIndex("userId", "userId", { unique: false });
            catStore.createIndex("taskType", "taskType", { unique: false });
            catStore.createIndex("syncState", "syncState", { unique: false });
         }

         // Queued mutations store
         if (!db.objectStoreNames.contains(STORES.MUTATIONS)) {
            const mutStore = db.createObjectStore(STORES.MUTATIONS, {
               keyPath: "id",
            });
            mutStore.createIndex("createdAt", "createdAt", { unique: false });
            mutStore.createIndex("entityType", "entityType", { unique: false });
         }
      };

      request.onsuccess = (event) => {
         resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
         const error = (event.target as IDBOpenDBRequest).error;
         logTaskSync("Failed to open IndexedDB", error);
         reject(error);
      };
   });
}

// ---------------------------------------------------------------------------
// Tasks Store Operations
// ---------------------------------------------------------------------------

export async function getAllLocalTasks(
   userId?: string | null
): Promise<LocalTaskRecord[]> {
   const db = await openDatabase();
   if (!db) return [];

   return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TASKS, "readonly");
      const store = tx.objectStore(STORES.TASKS);
      const request = store.getAll();

      request.onsuccess = () => {
         const all: LocalTaskRecord[] = request.result || [];
         if (userId === undefined) {
            resolve(all);
         } else {
            // Filter by userId or match guest tasks if userId is null
            resolve(all.filter((t) => t.userId === userId));
         }
      };
      request.onerror = () => reject(request.error);
   });
}

export async function putLocalTask(task: LocalTaskRecord): Promise<void> {
   const db = await openDatabase();
   if (!db) return;

   return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TASKS, "readwrite");
      const store = tx.objectStore(STORES.TASKS);
      const request = store.put(task);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
   });
}

export async function putLocalTasks(tasks: LocalTaskRecord[]): Promise<void> {
   const db = await openDatabase();
   if (!db || tasks.length === 0) return;

   return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TASKS, "readwrite");
      const store = tx.objectStore(STORES.TASKS);
      for (const task of tasks) {
         store.put(task);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
   });
}

export async function deleteLocalTask(id: string): Promise<void> {
   const db = await openDatabase();
   if (!db) return;

   return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TASKS, "readwrite");
      const store = tx.objectStore(STORES.TASKS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
   });
}

// ---------------------------------------------------------------------------
// Categories Store Operations
// ---------------------------------------------------------------------------

export async function getAllLocalCategories(
   userId?: string | null
): Promise<LocalCategoryRecord[]> {
   const db = await openDatabase();
   if (!db) return [];

   return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CATEGORIES, "readonly");
      const store = tx.objectStore(STORES.CATEGORIES);
      const request = store.getAll();

      request.onsuccess = () => {
         const all: LocalCategoryRecord[] = request.result || [];
         if (userId === undefined) {
            resolve(all);
         } else {
            resolve(all.filter((c) => c.userId === userId));
         }
      };
      request.onerror = () => reject(request.error);
   });
}

export async function putLocalCategory(
   category: LocalCategoryRecord
): Promise<void> {
   const db = await openDatabase();
   if (!db) return;

   return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CATEGORIES, "readwrite");
      const store = tx.objectStore(STORES.CATEGORIES);
      const request = store.put(category);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
   });
}

export async function putLocalCategories(
   categories: LocalCategoryRecord[]
): Promise<void> {
   const db = await openDatabase();
   if (!db || categories.length === 0) return;

   return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CATEGORIES, "readwrite");
      const store = tx.objectStore(STORES.CATEGORIES);
      for (const cat of categories) {
         store.put(cat);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
   });
}

export async function deleteLocalCategory(id: string): Promise<void> {
   const db = await openDatabase();
   if (!db) return;

   return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CATEGORIES, "readwrite");
      const store = tx.objectStore(STORES.CATEGORIES);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
   });
}

// ---------------------------------------------------------------------------
// Mutation Queue Operations
// ---------------------------------------------------------------------------

export async function enqueueMutation(mutation: QueuedMutation): Promise<void> {
   const db = await openDatabase();
   if (!db) return;

   return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MUTATIONS, "readwrite");
      const store = tx.objectStore(STORES.MUTATIONS);
      const request = store.put(mutation);

      request.onsuccess = () => {
         logTaskSync("Mutation enqueued locally", {
            id: mutation.id,
            entityType: mutation.entityType,
            action: mutation.action,
         });
         resolve();
      };
      request.onerror = () => reject(request.error);
   });
}

export async function getAllQueuedMutations(): Promise<QueuedMutation[]> {
   const db = await openDatabase();
   if (!db) return [];

   return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MUTATIONS, "readonly");
      const store = tx.objectStore(STORES.MUTATIONS);
      const request = store.getAll();

      request.onsuccess = () => {
         resolve(request.result || []);
      };
      request.onerror = () => reject(request.error);
   });
}

export async function removeQueuedMutations(ids: string[]): Promise<void> {
   const db = await openDatabase();
   if (!db || ids.length === 0) return;

   return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MUTATIONS, "readwrite");
      const store = tx.objectStore(STORES.MUTATIONS);
      for (const id of ids) {
         store.delete(id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
   });
}

/**
 * Moves every local task and queued mutation from a client-generated category id
 * to the server's winning category id after a create conflict.
 */
export async function remapLocalCategoryId(
   fromId: string,
   toId: string
): Promise<void> {
   if (fromId === toId) return;
   const db = await openDatabase();
   if (!db) return;

   await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
         [STORES.TASKS, STORES.CATEGORIES, STORES.MUTATIONS],
         "readwrite"
      );

      const taskIndex = tx.objectStore(STORES.TASKS).index("categoryId");
      const cursorRequest = taskIndex.openCursor(IDBKeyRange.only(fromId));
      cursorRequest.onsuccess = () => {
         const cursor = cursorRequest.result;
         if (!cursor) return;
         cursor.update({
            ...(cursor.value as LocalTaskRecord),
            categoryId: toId,
         });
         cursor.continue();
      };

      const mutationStore = tx.objectStore(STORES.MUTATIONS);
      const allRequest = mutationStore.getAll();
      allRequest.onsuccess = () => {
         const mutations = (allRequest.result || []) as QueuedMutation[];
         for (const mutation of mutations) {
            const payload = mutation.payload as Record<string, unknown>;
            if (payload?.categoryId === fromId) {
               mutationStore.put({
                  ...mutation,
                  payload: { ...payload, categoryId: toId },
               });
            }
         }
      };

      tx.objectStore(STORES.CATEGORIES).delete(fromId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
   });
}

// ---------------------------------------------------------------------------
// Guest Data Claim (Transfer local guest tasks to authenticated user)
// ---------------------------------------------------------------------------

export async function migrateGuestDataToUser(
   userId: string
): Promise<{ tasks: LocalTaskRecord[]; categories: LocalCategoryRecord[] }> {
   const db = await openDatabase();
   if (!db) return { tasks: [], categories: [] };

   const guestTasks = await getAllLocalTasks(null);
   const guestCategories = await getAllLocalCategories(null);

   if (guestTasks.length === 0 && guestCategories.length === 0) {
      return { tasks: [], categories: [] };
   }

   logTaskSync(
      `Migrating ${guestCategories.length} categories and ${guestTasks.length} tasks from guest to user ${userId}`
   );

   const updatedCategories: LocalCategoryRecord[] = guestCategories.map(
      (c) => ({
         ...c,
         userId,
         syncState: "pending",
      })
   );

   const updatedTasks: LocalTaskRecord[] = guestTasks.map((t) => ({
      ...t,
      userId,
      syncState: "pending",
   }));

   await putLocalCategories(updatedCategories);
   await putLocalTasks(updatedTasks);

   // Enqueue create mutations for each migrated item
   for (const cat of updatedCategories) {
      await enqueueMutation({
         id: crypto.randomUUID(),
         entityType: "CATEGORY",
         action: "CREATE",
         payload: {
            id: cat.id,
            name: cat.name,
            taskType: cat.taskType,
         },
         createdAt: Date.now(),
         retryCount: 0,
      });
   }

   for (const task of updatedTasks) {
      await enqueueMutation({
         id: crypto.randomUUID(),
         entityType: "TASK",
         action: "CREATE",
         payload: {
            id: task.id,
            categoryId: task.categoryId,
            challengeId: task.challengeId ?? null,
            title: task.title,
            taskType: task.taskType,
            sortOrder: task.sortOrder ?? 0,
            isComplete: task.isComplete,
            status: task.status ?? (task.isComplete ? "COMPLETED" : "TODO"),
            dueDate: task.dueDate ?? null,
         },
         createdAt: Date.now(),
         retryCount: 0,
      });
   }

   return { tasks: updatedTasks, categories: updatedCategories };
}
