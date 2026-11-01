import type {
   DeadLetterMutation,
   LocalCategoryRecord,
   LocalTaskRecord,
   QueuedMutation,
} from "@/features/tasks/domain/task-sync.types";
import { createLogger, logEvents } from "@/core/observability/logger";

const logger = createLogger("tasks.sync.local");

const DB_NAME = "holdmetoit_db";
const DB_VERSION = 2;
const MAX_MUTATION_RETRIES = 5;

export const STORES = {
   TASKS: "tasks",
   CATEGORIES: "categories",
   MUTATIONS: "queued_mutations",
   DEAD_LETTER: "dead_letter_mutations",
} as const;

let activeQueueUserId: string | null = null;

export function setActiveQueueUser(userId: string | null): void {
   activeQueueUserId = userId;
}

export function getActiveQueueUser(): string | null {
   return activeQueueUserId;
}

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
            mutStore.createIndex("userId", "userId", { unique: false });
         } else {
            const upgradeTx = (event.target as IDBOpenDBRequest).transaction;
            const mutStore = upgradeTx?.objectStore(STORES.MUTATIONS);
            if (mutStore && !mutStore.indexNames.contains("userId")) {
               mutStore.createIndex("userId", "userId", { unique: false });
            }
         }

         // Dead-letter mutations store
         if (!db.objectStoreNames.contains(STORES.DEAD_LETTER)) {
            const deadStore = db.createObjectStore(STORES.DEAD_LETTER, {
               keyPath: "id",
            });
            deadStore.createIndex("userId", "userId", { unique: false });
            deadStore.createIndex("failedAt", "failedAt", { unique: false });
            deadStore.createIndex("createdAt", "createdAt", { unique: false });
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
      const getRequest = store.get(task.id);

      getRequest.onsuccess = () => {
         const existing = getRequest.result as LocalTaskRecord | undefined;
         store.put({
            ...task,
            revision: task.revision ?? existing?.revision,
         });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
   });
}

export async function putLocalTasks(tasks: LocalTaskRecord[]): Promise<void> {
   const db = await openDatabase();
   if (!db || tasks.length === 0) return;

   return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TASKS, "readwrite");
      const store = tx.objectStore(STORES.TASKS);
      for (const task of tasks) {
         const getRequest = store.get(task.id);
         getRequest.onsuccess = () => {
            const existing = getRequest.result as LocalTaskRecord | undefined;
            store.put({
               ...task,
               revision: task.revision ?? existing?.revision,
            });
         };
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
      const getRequest = store.get(category.id);

      getRequest.onsuccess = () => {
         const existing = getRequest.result as LocalCategoryRecord | undefined;
         store.put({
            ...category,
            revision: category.revision ?? existing?.revision,
         });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
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
         const getRequest = store.get(cat.id);
         getRequest.onsuccess = () => {
            const existing = getRequest.result as
               LocalCategoryRecord | undefined;
            store.put({
               ...cat,
               revision: cat.revision ?? existing?.revision,
            });
         };
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

   const record: QueuedMutation = {
      ...mutation,
      userId: mutation.userId ?? activeQueueUserId ?? undefined,
   };

   return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MUTATIONS, "readwrite");
      const store = tx.objectStore(STORES.MUTATIONS);
      const request = store.put(record);

      request.onsuccess = () => {
         logTaskSync("Mutation enqueued locally", {
            id: record.id,
            entityType: record.entityType,
            action: record.action,
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

/**
 * Returns the current user's queue. Legacy entries without an owner are
 * claimed by this user once and then remain partitioned to them.
 */
export async function getQueuedMutationsForUser(
   userId: string
): Promise<QueuedMutation[]> {
   const all = await getAllQueuedMutations();
   const owned = all.filter((m) => m.userId === userId);
   const legacy = all.filter((m) => m.userId === undefined);

   if (legacy.length === 0) {
      return owned.sort((a, b) => a.createdAt - b.createdAt);
   }

   const db = await openDatabase();
   if (db) {
      await new Promise<void>((resolve, reject) => {
         const tx = db.transaction(STORES.MUTATIONS, "readwrite");
         const store = tx.objectStore(STORES.MUTATIONS);
         for (const mutation of legacy) {
            store.put({ ...mutation, userId });
         }
         tx.oncomplete = () => resolve();
         tx.onerror = () => reject(tx.error);
      });
   }

   return [...owned, ...legacy.map((m) => ({ ...m, userId }))].sort(
      (a, b) => a.createdAt - b.createdAt
   );
}

export interface LocalCommit {
   tasks?: LocalTaskRecord[];
   deleteTaskIds?: string[];
   categories?: LocalCategoryRecord[];
   deleteCategoryIds?: string[];
   mutations: QueuedMutation[];
}

/**
 * Commits local entity changes and their queued mutations in one IndexedDB
 * transaction. The revision merge matches putLocalTask/putLocalCategory.
 */
export async function commitLocalBatch(input: LocalCommit): Promise<void> {
   const db = await openDatabase();
   if (!db) return;

   const ownerFallback =
      input.tasks?.find((task) => task.userId)?.userId ??
      input.categories?.find((category) => category.userId)?.userId ??
      activeQueueUserId ??
      undefined;

   await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
         [STORES.TASKS, STORES.CATEGORIES, STORES.MUTATIONS],
         "readwrite"
      );
      const taskStore = tx.objectStore(STORES.TASKS);
      const categoryStore = tx.objectStore(STORES.CATEGORIES);
      const mutationStore = tx.objectStore(STORES.MUTATIONS);

      for (const task of input.tasks ?? []) {
         const getRequest = taskStore.get(task.id);
         getRequest.onsuccess = () => {
            const existing = getRequest.result as LocalTaskRecord | undefined;
            taskStore.put({
               ...task,
               revision: task.revision ?? existing?.revision,
            });
         };
      }
      for (const id of input.deleteTaskIds ?? []) {
         taskStore.delete(id);
      }

      for (const category of input.categories ?? []) {
         const getRequest = categoryStore.get(category.id);
         getRequest.onsuccess = () => {
            const existing = getRequest.result as
               LocalCategoryRecord | undefined;
            categoryStore.put({
               ...category,
               revision: category.revision ?? existing?.revision,
            });
         };
      }
      for (const id of input.deleteCategoryIds ?? []) {
         categoryStore.delete(id);
      }

      for (const mutation of input.mutations) {
         mutationStore.put({
            ...mutation,
            userId: mutation.userId ?? ownerFallback,
         });
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
   });
}

export function commitTaskMutation(
   task: LocalTaskRecord | null,
   mutation: QueuedMutation,
   options?: { deleteTaskId?: string }
): Promise<void> {
   return commitLocalBatch({
      tasks: task ? [task] : [],
      deleteTaskIds: options?.deleteTaskId ? [options.deleteTaskId] : [],
      mutations: [mutation],
   });
}

export function commitTaskBatch(
   tasks: LocalTaskRecord[],
   mutation: QueuedMutation,
   options?: { deleteTaskIds?: string[] }
): Promise<void> {
   return commitLocalBatch({
      tasks,
      deleteTaskIds: options?.deleteTaskIds,
      mutations: [mutation],
   });
}

export function commitCategoryMutation(
   category: LocalCategoryRecord | null,
   mutation: QueuedMutation,
   options?: { deleteCategoryId?: string }
): Promise<void> {
   return commitLocalBatch({
      categories: category ? [category] : [],
      deleteCategoryIds: options?.deleteCategoryId
         ? [options.deleteCategoryId]
         : [],
      mutations: [mutation],
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
 * Records one failed attempt for a mutation. At the cap the mutation moves to
 * the dead-letter store instead of retrying forever.
 */
export async function recordMutationFailure(
   mutation: QueuedMutation,
   reason?: string
): Promise<"retry" | "dead-letter"> {
   const db = await openDatabase();
   if (!db) return "retry";

   return new Promise((resolve, reject) => {
      const tx = db.transaction(
         [STORES.MUTATIONS, STORES.DEAD_LETTER],
         "readwrite"
      );
      const mutationStore = tx.objectStore(STORES.MUTATIONS);
      const deadStore = tx.objectStore(STORES.DEAD_LETTER);
      const getRequest = mutationStore.get(mutation.id);
      let outcome: "retry" | "dead-letter" = "retry";

      getRequest.onsuccess = () => {
         const current =
            (getRequest.result as QueuedMutation | undefined) ?? mutation;
         const retryCount = current.retryCount + 1;

         if (retryCount >= MAX_MUTATION_RETRIES) {
            outcome = "dead-letter";
            mutationStore.delete(current.id);
            deadStore.put({
               ...current,
               retryCount,
               userId: current.userId ?? activeQueueUserId ?? "",
               failedAt: Date.now(),
               lastError: reason,
            } satisfies DeadLetterMutation);
         } else {
            mutationStore.put({ ...current, retryCount });
         }
      };

      tx.oncomplete = () => resolve(outcome);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
   });
}

export async function getDeadLetterMutations(
   userId: string
): Promise<DeadLetterMutation[]> {
   const db = await openDatabase();
   if (!db) return [];

   return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.DEAD_LETTER, "readonly");
      const store = tx.objectStore(STORES.DEAD_LETTER);
      const request = store.getAll();

      request.onsuccess = () => {
         const all = (request.result || []) as DeadLetterMutation[];
         resolve(
            all
               .filter((mutation) => mutation.userId === userId)
               .sort((a, b) => a.failedAt - b.failedAt)
         );
      };
      request.onerror = () => reject(request.error);
   });
}

export async function retryDeadLetterMutation(id: string): Promise<void> {
   const db = await openDatabase();
   if (!db) return;

   await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
         [STORES.MUTATIONS, STORES.DEAD_LETTER],
         "readwrite"
      );
      const deadStore = tx.objectStore(STORES.DEAD_LETTER);
      const mutationStore = tx.objectStore(STORES.MUTATIONS);
      const getRequest = deadStore.get(id);

      getRequest.onsuccess = () => {
         const dead = getRequest.result as DeadLetterMutation | undefined;
         if (!dead) return;

         const mutation: QueuedMutation = {
            id: dead.id,
            entityType: dead.entityType,
            action: dead.action,
            payload: dead.payload,
            createdAt: dead.createdAt,
            retryCount: 0,
            baseRevision: dead.baseRevision,
            userId: dead.userId,
         };

         deadStore.delete(id);
         mutationStore.put(mutation);
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
   });
}

export async function discardDeadLetterMutation(id: string): Promise<void> {
   const db = await openDatabase();
   if (!db) return;

   await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.DEAD_LETTER, "readwrite");
      tx.objectStore(STORES.DEAD_LETTER).delete(id);
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
         userId,
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
         userId,
      });
   }

   return { tasks: updatedTasks, categories: updatedCategories };
}
