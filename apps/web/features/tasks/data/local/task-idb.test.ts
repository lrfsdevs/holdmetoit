// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import {
   commitTaskMutation,
   discardDeadLetterMutation,
   enqueueMutation,
   getAllLocalTasks,
   getDeadLetterMutations,
   getQueuedMutationsForUser,
   recordMutationFailure,
   retryDeadLetterMutation,
   setActiveQueueUser,
} from "./task-idb";
import type {
   LocalTaskRecord,
   QueuedMutation,
} from "@/features/tasks/domain/task-sync.types";

const DB_NAME = "holdmetoit_db";

function makeTask(overrides: Partial<LocalTaskRecord> = {}): LocalTaskRecord {
   return {
      id: "task_1",
      userId: "user_a",
      categoryId: "cat_1",
      title: "Task",
      taskType: "DAILY",
      isComplete: false,
      status: "TODO",
      dueDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      syncState: "pending",
      ...overrides,
   };
}

function makeMutation(overrides: Partial<QueuedMutation> = {}): QueuedMutation {
   return {
      id: "mut_1",
      entityType: "TASK",
      action: "UPDATE",
      payload: { taskId: "task_1", title: "Edited" },
      createdAt: 1,
      retryCount: 0,
      ...overrides,
   };
}

async function createV1Database(): Promise<void> {
   await new Promise<void>((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = () => {
         const db = request.result;
         db.createObjectStore("tasks", { keyPath: "id" });
         db.createObjectStore("categories", { keyPath: "id" });
         const mutations = db.createObjectStore("queued_mutations", {
            keyPath: "id",
         });
         mutations.createIndex("createdAt", "createdAt", { unique: false });
         mutations.createIndex("entityType", "entityType", { unique: false });
      };

      request.onsuccess = () => {
         request.result.close();
         resolve();
      };
      request.onerror = () => reject(request.error);
   });
}

async function openV2Database(): Promise<IDBDatabase> {
   return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
   });
}

describe("task-idb queue hygiene", () => {
   beforeEach(() => {
      Object.defineProperty(window, "indexedDB", {
         value: new IDBFactory(),
         configurable: true,
      });
      setActiveQueueUser(null);
   });

   it("upgrades a v1 database without losing stores", async () => {
      await createV1Database();

      await commitTaskMutation(makeTask(), makeMutation());

      const db = await openV2Database();
      expect(db.objectStoreNames.contains("tasks")).toBe(true);
      expect(db.objectStoreNames.contains("categories")).toBe(true);
      expect(db.objectStoreNames.contains("queued_mutations")).toBe(true);
      expect(db.objectStoreNames.contains("dead_letter_mutations")).toBe(true);

      const mutations = db
         .transaction("queued_mutations")
         .objectStore("queued_mutations");
      expect(mutations.indexNames.contains("userId")).toBe(true);
      db.close();
   });

   it("commits the local task and its mutation in one transaction", async () => {
      const task = makeTask();
      const mutation = makeMutation();

      await commitTaskMutation(task, mutation);

      const tasks = await getAllLocalTasks("user_a");
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({ id: "task_1", title: "Task" });

      const queue = await getQueuedMutationsForUser("user_a");
      expect(queue).toHaveLength(1);
      expect(queue[0]).toMatchObject({ id: "mut_1", userId: "user_a" });
   });

   it("does not commit the mutation when the task write aborts", async () => {
      const invalidTask = makeTask({ id: undefined as unknown as string });

      await expect(
         commitTaskMutation(invalidTask, makeMutation())
      ).rejects.toBeDefined();

      const queue = await getQueuedMutationsForUser("user_a");
      expect(queue).toHaveLength(0);
   });

   it("partitions the queue by user", async () => {
      setActiveQueueUser("user_a");
      await enqueueMutation(makeMutation({ id: "mut_a" }));

      setActiveQueueUser("user_b");
      await enqueueMutation(makeMutation({ id: "mut_b" }));

      const a = await getQueuedMutationsForUser("user_a");
      const b = await getQueuedMutationsForUser("user_b");

      expect(a.map((m) => m.id)).toEqual(["mut_a"]);
      expect(b.map((m) => m.id)).toEqual(["mut_b"]);
   });

   it("claims a legacy mutation without a userId once", async () => {
      setActiveQueueUser(null);
      await enqueueMutation(makeMutation({ id: "mut_legacy" }));

      setActiveQueueUser("user_a");
      const firstRead = await getQueuedMutationsForUser("user_a");
      expect(firstRead.map((m) => m.id)).toEqual(["mut_legacy"]);
      expect(firstRead[0]?.userId).toBe("user_a");

      const secondUser = await getQueuedMutationsForUser("user_b");
      expect(secondUser).toHaveLength(0);
   });

   it("moves a mutation to dead letter at the retry cap", async () => {
      setActiveQueueUser("user_a");
      await enqueueMutation(makeMutation({ id: "mut_dead", retryCount: 4 }));

      const queue = await getQueuedMutationsForUser("user_a");
      const outcome = await recordMutationFailure(queue[0]!, "server_error");
      expect(outcome).toBe("dead-letter");

      expect(await getQueuedMutationsForUser("user_a")).toHaveLength(0);
      const dead = await getDeadLetterMutations("user_a");
      expect(dead).toHaveLength(1);
      expect(dead[0]).toMatchObject({
         id: "mut_dead",
         retryCount: 5,
         lastError: "server_error",
      });
   });

   it("keeps a mutation queued below the retry cap", async () => {
      setActiveQueueUser("user_a");
      await enqueueMutation(makeMutation({ id: "mut_retry" }));

      const queue = await getQueuedMutationsForUser("user_a");
      const outcome = await recordMutationFailure(queue[0]!, "server_error");
      expect(outcome).toBe("retry");

      const next = await getQueuedMutationsForUser("user_a");
      expect(next).toHaveLength(1);
      expect(next[0]?.retryCount).toBe(1);
   });

   it("moves a dead letter back to the queue on retry and discards it", async () => {
      setActiveQueueUser("user_a");
      await enqueueMutation(makeMutation({ id: "mut_dead", retryCount: 4 }));
      const queue = await getQueuedMutationsForUser("user_a");
      await recordMutationFailure(queue[0]!, "server_error");

      await retryDeadLetterMutation("mut_dead");
      const retried = await getQueuedMutationsForUser("user_a");
      expect(retried).toHaveLength(1);
      expect(retried[0]).toMatchObject({ id: "mut_dead", retryCount: 0 });
      expect(await getDeadLetterMutations("user_a")).toHaveLength(0);

      await discardDeadLetterMutation("mut_dead");
      expect(await getDeadLetterMutations("user_a")).toHaveLength(0);
   });
});
