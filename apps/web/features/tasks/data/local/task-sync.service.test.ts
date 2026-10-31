// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
   initTaskSync,
   scheduleSync,
   syncNow,
   TASKS_SYNCED_EVENT,
} from "./task-sync.service";
import * as taskIdb from "./task-idb";

vi.mock("./task-idb", () => ({
   deleteLocalCategory: vi.fn(),
   deleteLocalTask: vi.fn(),
   enqueueMutation: vi.fn(),
   getAllLocalCategories: vi.fn(),
   getAllLocalTasks: vi.fn(),
   getAllQueuedMutations: vi.fn(),
   logTaskSync: vi.fn(),
   migrateGuestDataToUser: vi.fn(),
   putLocalCategories: vi.fn(),
   putLocalCategory: vi.fn(),
   putLocalTask: vi.fn(),
   putLocalTasks: vi.fn(),
   remapLocalCategoryId: vi.fn(),
   removeQueuedMutations: vi.fn(),
}));

describe("task-sync.service", () => {
   const userId = "usr_sync_test";

   beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();

      Object.defineProperty(window.navigator, "onLine", {
         value: true,
         writable: true,
         configurable: true,
      });

      vi.mocked(taskIdb.migrateGuestDataToUser).mockResolvedValue({
         tasks: [],
         categories: [],
      });
      vi.mocked(taskIdb.removeQueuedMutations).mockResolvedValue();
      vi.mocked(taskIdb.enqueueMutation).mockResolvedValue();
      vi.mocked(taskIdb.putLocalCategories).mockResolvedValue();
      vi.mocked(taskIdb.putLocalCategory).mockResolvedValue();
      vi.mocked(taskIdb.putLocalTask).mockResolvedValue();
      vi.mocked(taskIdb.putLocalTasks).mockResolvedValue();
      vi.mocked(taskIdb.remapLocalCategoryId).mockResolvedValue();
      vi.mocked(taskIdb.getAllLocalCategories).mockResolvedValue([]);
      vi.mocked(taskIdb.getAllLocalTasks).mockResolvedValue([]);
      vi.mocked(taskIdb.deleteLocalCategory).mockResolvedValue();
      vi.mocked(taskIdb.deleteLocalTask).mockResolvedValue();
   });

   afterEach(() => {
      vi.useRealTimers();
   });

   it("returns null early if userId is null or undefined", async () => {
      const res = await syncNow(null);
      expect(res).toBeNull();
      expect(taskIdb.getAllQueuedMutations).not.toHaveBeenCalled();
   });

   it("returns null if network is offline", async () => {
      Object.defineProperty(window.navigator, "onLine", {
         value: false,
         writable: true,
      });

      const res = await syncNow(userId);
      expect(res).toBeNull();
      expect(taskIdb.logTaskSync).toHaveBeenCalledWith(
         expect.stringContaining("Network is offline")
      );
   });

   it("returns null without fetching if mutations queue is empty and forcePull is not requested", async () => {
      vi.mocked(taskIdb.getAllQueuedMutations).mockResolvedValue([]);
      const fetchSpy = vi.spyOn(global, "fetch");

      const res = await syncNow(userId);
      expect(res).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
   });

   it("fetches /api/tasks/sync with forcePull even if mutations queue is empty", async () => {
      vi.mocked(taskIdb.getAllQueuedMutations).mockResolvedValue([]);

      const mockResponse = {
         success: true,
         processedMutationIds: [],
         authenticatedUserId: userId,
         serverChanges: {
            categories: [
               {
                  id: "cat_1",
                  name: "General",
                  taskType: "DAILY" as const,
                  sortOrder: 0,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
               },
            ],
            tasks: [],
         },
      };

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
         ok: true,
         json: async () => mockResponse,
      } as Response);

      const dispatchSpy = vi.spyOn(window, "dispatchEvent");

      const res = await syncNow(userId, { forcePull: true });
      expect(fetchSpy).toHaveBeenCalledWith("/api/tasks/sync", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ mutations: [] }),
      });
      expect(res).toEqual(mockResponse);
      expect(taskIdb.putLocalCategories).toHaveBeenCalled();
      expect(dispatchSpy).toHaveBeenCalledWith(
         expect.objectContaining({
            type: TASKS_SYNCED_EVENT,
         })
      );
   });

   it("flushes pending mutations and removes acknowledged IDs on success", async () => {
      const mockMutations = [
         {
            id: "mut_1",
            entityType: "TASK" as const,
            action: "TOGGLE" as const,
            payload: { taskId: "t_1", isComplete: true },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ];

      vi.mocked(taskIdb.getAllQueuedMutations).mockResolvedValue(
         mockMutations as never
      );

      vi.spyOn(global, "fetch").mockResolvedValue({
         ok: true,
         json: async () => ({
            success: true,
            processedMutationIds: ["mut_1"],
            authenticatedUserId: userId,
            serverChanges: {
               categories: [],
               tasks: [
                  {
                     id: "t_1",
                     categoryId: "cat_1",
                     challengeId: null,
                     title: "Physics Problem",
                     taskType: "DAILY",
                     sortOrder: 0,
                     isComplete: true,
                     status: "COMPLETED",
                     dueDate: "2026-10-22",
                     createdAt: new Date().toISOString(),
                     updatedAt: new Date().toISOString(),
                     completedAt: new Date().toISOString(),
                  },
               ],
            },
         }),
      } as Response);

      const res = await syncNow(userId);
      expect(res?.success).toBe(true);
      expect(taskIdb.removeQueuedMutations).toHaveBeenCalledWith(["mut_1"]);
      expect(taskIdb.putLocalTasks).toHaveBeenCalledWith(
         expect.arrayContaining([
            expect.objectContaining({
               id: "t_1",
               isComplete: true,
               syncState: "synced",
            }),
         ])
      );
   });

   it("keeps only error mutations and removes applied and conflict ids", async () => {
      vi.mocked(taskIdb.getAllQueuedMutations).mockResolvedValue([
         {
            id: "mut_ok",
            entityType: "TASK" as const,
            action: "TOGGLE" as const,
            payload: { taskId: "t_ok", isComplete: true },
            createdAt: 1,
            retryCount: 0,
         },
         {
            id: "mut_conflict",
            entityType: "TASK" as const,
            action: "UPDATE" as const,
            payload: { taskId: "t_conflict", title: "Stale" },
            createdAt: 2,
            retryCount: 0,
         },
         {
            id: "mut_err",
            entityType: "TASK" as const,
            action: "UPDATE" as const,
            payload: { taskId: "t_err", title: "Retry" },
            createdAt: 3,
            retryCount: 0,
         },
      ] as never);

      vi.spyOn(global, "fetch").mockResolvedValue({
         ok: true,
         json: async () => ({
            success: true,
            processedMutationIds: ["mut_ok", "mut_conflict"],
            mutationResults: [
               { id: "mut_ok", status: "applied" },
               {
                  id: "mut_conflict",
                  status: "conflict",
                  reason: "zero_rows",
                  currentTask: null,
               },
               { id: "mut_err", status: "error", reason: "invalid_payload" },
            ],
            authenticatedUserId: userId,
            serverChanges: { categories: [], tasks: [] },
         }),
      } as Response);

      await syncNow(userId);

      expect(taskIdb.removeQueuedMutations).toHaveBeenCalledWith([
         "mut_ok",
         "mut_conflict",
      ]);
      expect(taskIdb.deleteLocalTask).toHaveBeenCalledWith("t_conflict");
      expect(taskIdb.deleteLocalTask).not.toHaveBeenCalledWith("t_err");
   });

   it("applies the current server task on a conflict", async () => {
      vi.mocked(taskIdb.getAllQueuedMutations).mockResolvedValue([
         {
            id: "mut_conflict",
            entityType: "TASK" as const,
            action: "TOGGLE" as const,
            payload: { taskId: "t_1", isComplete: true },
            createdAt: 1,
            retryCount: 0,
         },
      ] as never);

      vi.spyOn(global, "fetch").mockResolvedValue({
         ok: true,
         json: async () => ({
            success: true,
            processedMutationIds: ["mut_conflict"],
            mutationResults: [
               {
                  id: "mut_conflict",
                  status: "conflict",
                  reason: "zero_rows",
                  currentTask: {
                     id: "t_1",
                     userId,
                     categoryId: "cat_1",
                     challengeId: null,
                     title: "Server title",
                     taskType: "DAILY",
                     sortOrder: 0,
                     isComplete: false,
                     status: "TODO",
                     dueDate: "2026-10-30",
                     isDeleted: false,
                     deletionTime: null,
                     createdAt: new Date().toISOString(),
                     updatedAt: new Date().toISOString(),
                     completedAt: null,
                     revision: 3,
                  },
               },
            ],
            authenticatedUserId: userId,
            serverChanges: {
               categories: [],
               tasks: [
                  {
                     id: "t_1",
                     categoryId: "cat_1",
                     challengeId: null,
                     title: "Server title",
                     taskType: "DAILY",
                     sortOrder: 0,
                     isComplete: false,
                     status: "TODO",
                     dueDate: "2026-10-30",
                     createdAt: new Date().toISOString(),
                     updatedAt: new Date().toISOString(),
                     completedAt: null,
                     revision: 3,
                  },
               ],
            },
         }),
      } as Response);

      await syncNow(userId);

      expect(taskIdb.putLocalTask).toHaveBeenCalledWith(
         expect.objectContaining({
            id: "t_1",
            title: "Server title",
            isComplete: true,
            status: "COMPLETED",
            syncState: "pending",
            revision: 3,
         })
      );
      expect(taskIdb.enqueueMutation).toHaveBeenCalledWith(
         expect.objectContaining({
            action: "TOGGLE",
            payload: { taskId: "t_1", isComplete: true },
            retryCount: 1,
         })
      );
      // The rebased entity must be excluded from the snapshot reconciliation.
      expect(taskIdb.putLocalTasks).toHaveBeenCalledWith([]);
   });

   it("remaps a local category id when the server returns a create conflict", async () => {
      vi.mocked(taskIdb.getAllQueuedMutations).mockResolvedValue([
         {
            id: "mut_cat",
            entityType: "CATEGORY" as const,
            action: "CREATE" as const,
            payload: { id: "cat_local", name: "Work", taskType: "DAILY" },
            createdAt: 1,
            retryCount: 0,
         },
      ] as never);

      vi.spyOn(global, "fetch").mockResolvedValue({
         ok: true,
         json: async () => ({
            success: true,
            processedMutationIds: ["mut_cat"],
            mutationResults: [
               {
                  id: "mut_cat",
                  status: "conflict",
                  reason: "category_name_taken",
                  currentCategory: {
                     id: "cat_server",
                     userId,
                     name: "Work",
                     taskType: "DAILY",
                     sortOrder: 0,
                     isDeleted: false,
                     deletionTime: null,
                     createdAt: new Date().toISOString(),
                     updatedAt: new Date().toISOString(),
                  },
               },
            ],
            authenticatedUserId: userId,
            serverChanges: { categories: [], tasks: [] },
         }),
      } as Response);

      await syncNow(userId);

      expect(taskIdb.remapLocalCategoryId).toHaveBeenCalledWith(
         "cat_local",
         "cat_server"
      );
      expect(taskIdb.putLocalCategory).toHaveBeenCalledWith(
         expect.objectContaining({ id: "cat_server", name: "Work" })
      );
   });

   it("removes a local task when a CREATE is rejected without a server entity", async () => {
      vi.mocked(taskIdb.getAllQueuedMutations).mockResolvedValue([
         {
            id: "mut_create",
            entityType: "TASK" as const,
            action: "CREATE" as const,
            payload: { id: "t_new", title: "New task" },
            createdAt: 1,
            retryCount: 0,
         },
      ] as never);

      vi.spyOn(global, "fetch").mockResolvedValue({
         ok: true,
         json: async () => ({
            success: true,
            processedMutationIds: ["mut_create"],
            mutationResults: [
               {
                  id: "mut_create",
                  status: "conflict",
                  reason: "invalid_payload",
               },
            ],
            authenticatedUserId: userId,
            serverChanges: { categories: [], tasks: [] },
         }),
      } as Response);

      await syncNow(userId);

      expect(taskIdb.deleteLocalTask).toHaveBeenCalledWith("t_new");
   });

   it("keeps a local task when an UPDATE is rejected without a server entity", async () => {
      vi.mocked(taskIdb.getAllQueuedMutations).mockResolvedValue([
         {
            id: "mut_update",
            entityType: "TASK" as const,
            action: "UPDATE" as const,
            payload: { taskId: "t_existing", title: "Stale" },
            createdAt: 1,
            retryCount: 0,
         },
      ] as never);

      vi.spyOn(global, "fetch").mockResolvedValue({
         ok: true,
         json: async () => ({
            success: true,
            processedMutationIds: ["mut_update"],
            mutationResults: [
               {
                  id: "mut_update",
                  status: "conflict",
                  reason: "invalid_payload",
               },
            ],
            authenticatedUserId: userId,
            serverChanges: { categories: [], tasks: [] },
         }),
      } as Response);

      await syncNow(userId);

      expect(taskIdb.deleteLocalTask).not.toHaveBeenCalledWith("t_existing");
   });

   it("does not overwrite pending local entities with stale server changes", async () => {
      // Local mutation is still in-flight/pending for t_pending
      vi.mocked(taskIdb.getAllQueuedMutations).mockResolvedValue([
         {
            id: "mut_pending",
            entityType: "TASK" as const,
            action: "UPDATE" as const,
            payload: { taskId: "t_pending", title: "Edited Title" },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ] as never);

      vi.spyOn(global, "fetch").mockResolvedValue({
         ok: true,
         json: async () => ({
            success: true,
            processedMutationIds: [], // not processed yet
            authenticatedUserId: userId,
            serverChanges: {
               categories: [],
               tasks: [
                  {
                     id: "t_pending",
                     categoryId: "cat_1",
                     title: "Old Server Title",
                     taskType: "DAILY",
                     isComplete: false,
                     createdAt: new Date().toISOString(),
                     updatedAt: new Date().toISOString(),
                  },
               ],
            },
         }),
      } as Response);

      await syncNow(userId);
      // t_pending must be excluded from putLocalTasks because it has a pending mutation
      expect(taskIdb.putLocalTasks).toHaveBeenCalledWith([]);
   });

   it("prunes synced local entities that are absent from server changes while keeping pending entities", async () => {
      vi.mocked(taskIdb.getAllQueuedMutations).mockResolvedValue([
         {
            id: "mut_pending_local",
            entityType: "TASK" as const,
            action: "CREATE" as const,
            payload: { id: "t_pending_local", title: "Local Draft" },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ] as never);

      // Local IndexedDB has one synced task deleted on server, and one pending draft
      vi.mocked(taskIdb.getAllLocalTasks).mockResolvedValue([
         {
            id: "t_deleted_on_server",
            userId,
            categoryId: "cat_1",
            title: "Old Task",
            taskType: "DAILY",
            isComplete: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: null,
            syncState: "synced",
         },
         {
            id: "t_pending_local",
            userId,
            categoryId: "cat_1",
            title: "Local Draft",
            taskType: "DAILY",
            isComplete: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: null,
            syncState: "pending",
         },
      ]);

      vi.spyOn(global, "fetch").mockResolvedValue({
         ok: true,
         json: async () => ({
            success: true,
            processedMutationIds: [],
            authenticatedUserId: userId,
            serverChanges: {
               categories: [],
               tasks: [], // Server has 0 tasks
            },
         }),
      } as Response);

      await syncNow(userId, { forcePull: true });

      // Synced task deleted remotely is deleted locally
      expect(taskIdb.deleteLocalTask).toHaveBeenCalledWith(
         "t_deleted_on_server"
      );
      // Pending local task is NOT deleted
      expect(taskIdb.deleteLocalTask).not.toHaveBeenCalledWith(
         "t_pending_local"
      );
   });

   it("aborts local persistence when authenticatedUserId mismatches client userId", async () => {
      vi.mocked(taskIdb.getAllQueuedMutations).mockResolvedValue([]);

      vi.spyOn(global, "fetch").mockResolvedValue({
         ok: true,
         json: async () => ({
            success: true,
            processedMutationIds: [],
            authenticatedUserId: "different_user_b",
            serverChanges: {
               categories: [
                  {
                     id: "cat_b",
                     name: "User B Cat",
                     taskType: "DAILY",
                     sortOrder: 0,
                     createdAt: "",
                     updatedAt: "",
                  },
               ],
               tasks: [],
            },
         }),
      } as Response);

      await syncNow("user_a", { forcePull: true });

      // Should abort and NOT write user B's categories under user A
      expect(taskIdb.putLocalCategories).not.toHaveBeenCalled();
      expect(taskIdb.logTaskSync).toHaveBeenCalledWith(
         expect.stringContaining("Session user mismatch detected")
      );
   });

   it("schedules an exponential retry preserving forcePull on fetch network error", async () => {
      vi.mocked(taskIdb.getAllQueuedMutations).mockResolvedValue([]);

      vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network failed"));

      const res = await syncNow(userId, { forcePull: true });
      expect(res).toBeNull();
      expect(taskIdb.logTaskSync).toHaveBeenCalledWith(
         "Network error during sync flush:",
         expect.any(Error)
      );

      // Verify that retry timer is scheduled
      expect(vi.getTimerCount()).toBeGreaterThan(0);
   });

   it("initTaskSync attaches event listeners and cleans them up on teardown", () => {
      const addEventSpy = vi.spyOn(window, "addEventListener");
      const removeEventSpy = vi.spyOn(window, "removeEventListener");

      const cleanup = initTaskSync(userId);
      expect(addEventSpy).toHaveBeenCalledWith("online", expect.any(Function));
      expect(addEventSpy).toHaveBeenCalledWith("offline", expect.any(Function));

      cleanup();
      expect(removeEventSpy).toHaveBeenCalledWith(
         "online",
         expect.any(Function)
      );
      expect(removeEventSpy).toHaveBeenCalledWith(
         "offline",
         expect.any(Function)
      );
   });

   it("computes sequential baseRevision values from the local records", async () => {
      vi.mocked(taskIdb.getAllQueuedMutations).mockResolvedValue([
         {
            id: "mut_update",
            entityType: "TASK" as const,
            action: "UPDATE" as const,
            payload: { taskId: "t_1", title: "Edited" },
            createdAt: 1,
            retryCount: 0,
         },
         {
            id: "mut_toggle",
            entityType: "TASK" as const,
            action: "TOGGLE" as const,
            payload: { taskId: "t_1", isComplete: true },
            createdAt: 2,
            retryCount: 0,
         },
      ] as never);
      vi.mocked(taskIdb.getAllLocalTasks).mockResolvedValue([
         {
            id: "t_1",
            userId,
            categoryId: "cat_1",
            title: "Old",
            taskType: "DAILY",
            isComplete: false,
            status: "TODO",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: null,
            syncState: "synced",
            revision: 3,
         },
      ] as never);

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
         ok: true,
         json: async () => ({
            success: true,
            processedMutationIds: ["mut_update", "mut_toggle"],
            mutationResults: [
               { id: "mut_update", status: "applied" },
               { id: "mut_toggle", status: "applied" },
            ],
            authenticatedUserId: userId,
            serverChanges: { categories: [], tasks: [] },
         }),
      } as Response);

      await syncNow(userId);

      const requestInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(String(requestInit.body)) as {
         mutations: Array<{ id: string; baseRevision?: number }>;
      };
      expect(body.mutations).toEqual([
         expect.objectContaining({ id: "mut_update", baseRevision: 3 }),
         expect.objectContaining({ id: "mut_toggle", baseRevision: 4 }),
      ]);
   });

   it("omits baseRevision for a legacy local record without a revision", async () => {
      vi.mocked(taskIdb.getAllQueuedMutations).mockResolvedValue([
         {
            id: "mut_legacy",
            entityType: "TASK" as const,
            action: "UPDATE" as const,
            payload: { taskId: "t_legacy", title: "Legacy edit" },
            createdAt: 1,
            retryCount: 0,
         },
      ] as never);
      vi.mocked(taskIdb.getAllLocalTasks).mockResolvedValue([
         {
            id: "t_legacy",
            userId,
            categoryId: "cat_1",
            title: "Old",
            taskType: "DAILY",
            isComplete: false,
            status: "TODO",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: null,
            syncState: "synced",
         },
      ] as never);

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
         ok: true,
         json: async () => ({
            success: true,
            processedMutationIds: ["mut_legacy"],
            mutationResults: [{ id: "mut_legacy", status: "applied" }],
            authenticatedUserId: userId,
            serverChanges: { categories: [], tasks: [] },
         }),
      } as Response);

      await syncNow(userId);

      const requestInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(String(requestInit.body)) as {
         mutations: Array<{ id: string; baseRevision?: number }>;
      };
      expect(body.mutations[0]).not.toHaveProperty("baseRevision");
   });

   it("accepts the server row after the rebase limit", async () => {
      vi.mocked(taskIdb.getAllQueuedMutations).mockResolvedValue([
         {
            id: "mut_capped",
            entityType: "TASK" as const,
            action: "UPDATE" as const,
            payload: { taskId: "t_1", title: "Contended" },
            createdAt: 1,
            retryCount: 2,
         },
      ] as never);

      vi.spyOn(global, "fetch").mockResolvedValue({
         ok: true,
         json: async () => ({
            success: true,
            processedMutationIds: ["mut_capped"],
            mutationResults: [
               {
                  id: "mut_capped",
                  status: "conflict",
                  reason: "zero_rows",
                  currentTask: {
                     id: "t_1",
                     userId,
                     categoryId: "cat_1",
                     challengeId: null,
                     title: "Server title",
                     taskType: "DAILY",
                     sortOrder: 0,
                     isComplete: false,
                     status: "TODO",
                     dueDate: "2026-10-30",
                     createdAt: new Date().toISOString(),
                     updatedAt: new Date().toISOString(),
                     completedAt: null,
                     revision: 7,
                  },
               },
            ],
            authenticatedUserId: userId,
            serverChanges: { categories: [], tasks: [] },
         }),
      } as Response);

      await syncNow(userId);

      expect(taskIdb.enqueueMutation).not.toHaveBeenCalled();
      expect(taskIdb.putLocalTask).toHaveBeenCalledWith(
         expect.objectContaining({
            id: "t_1",
            title: "Server title",
            syncState: "synced",
            revision: 7,
         })
      );
   });

   it("adopts the server row on a challenge_locked conflict without rebasing", async () => {
      vi.mocked(taskIdb.getAllQueuedMutations).mockResolvedValue([
         {
            id: "mut_locked",
            entityType: "TASK" as const,
            action: "TOGGLE" as const,
            payload: { taskId: "t_locked", isComplete: true },
            createdAt: 1,
            retryCount: 0,
         },
      ] as never);

      vi.spyOn(global, "fetch").mockResolvedValue({
         ok: true,
         json: async () => ({
            success: true,
            processedMutationIds: ["mut_locked"],
            mutationResults: [
               {
                  id: "mut_locked",
                  status: "conflict",
                  reason: "challenge_locked",
                  currentTask: {
                     id: "t_locked",
                     userId,
                     categoryId: "cat_1",
                     challengeId: "c_locked",
                     title: "Weekly goal",
                     taskType: "WEEKLY",
                     sortOrder: 0,
                     isComplete: false,
                     status: "TODO",
                     dueDate: null,
                     createdAt: new Date().toISOString(),
                     updatedAt: new Date().toISOString(),
                     completedAt: null,
                     revision: 2,
                  },
               },
            ],
            authenticatedUserId: userId,
            serverChanges: { categories: [], tasks: [] },
         }),
      } as Response);

      await syncNow(userId);

      expect(taskIdb.enqueueMutation).not.toHaveBeenCalled();
      expect(taskIdb.putLocalTask).toHaveBeenCalledWith(
         expect.objectContaining({
            id: "t_locked",
            isComplete: false,
            syncState: "synced",
            revision: 2,
         })
      );
   });
});
