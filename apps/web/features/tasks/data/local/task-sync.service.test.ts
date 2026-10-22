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
   getAllQueuedMutations: vi.fn(),
   logTaskSync: vi.fn(),
   migrateGuestDataToUser: vi.fn(),
   putLocalCategories: vi.fn(),
   putLocalTasks: vi.fn(),
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
      vi.mocked(taskIdb.putLocalCategories).mockResolvedValue();
      vi.mocked(taskIdb.putLocalTasks).mockResolvedValue();
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
         serverChanges: {
            categories: [
               {
                  id: "cat_1",
                  name: "General",
                  taskType: "DAILY",
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

   it("schedules an exponential retry on fetch network error", async () => {
      vi.mocked(taskIdb.getAllQueuedMutations).mockResolvedValue([
         {
            id: "mut_err",
            entityType: "TASK" as const,
            action: "CREATE" as const,
            payload: { id: "t_new", title: "Test" },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ] as never);

      vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network failed"));

      const res = await syncNow(userId);
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
});
