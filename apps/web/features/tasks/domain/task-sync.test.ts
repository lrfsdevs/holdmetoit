import { describe, expect, it } from "vitest";
import {
   batchSyncSchema,
   compactMutationQueue,
   queuedMutationSchema,
   sortMutationsChronologically,
} from "./task-sync.schema";
import type { QueuedMutation } from "./task-sync.types";

describe("task-sync pure domain logic", () => {
   it("validates valid queued mutation", () => {
      const validMutation = {
         id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
         entityType: "TASK",
         action: "CREATE",
         payload: { title: "Complete Physics Homework", taskType: "DAILY" },
         createdAt: 1728189600000,
         retryCount: 0,
      };

      const parsed = queuedMutationSchema.safeParse(validMutation);
      expect(parsed.success).toBe(true);
   });

   it("fails validation for invalid mutation UUID", () => {
      const invalidMutation = {
         id: "not-a-uuid",
         entityType: "TASK",
         action: "CREATE",
         payload: {},
         createdAt: 1728189600000,
         retryCount: 0,
      };

      const parsed = queuedMutationSchema.safeParse(invalidMutation);
      expect(parsed.success).toBe(false);
   });

   it("validates batch sync payload", () => {
      const payload = {
         lastSyncTimestamp: "2026-10-06T00:00:00.000Z",
         mutations: [
            {
               id: "11111111-1111-4111-8111-111111111111",
               entityType: "CATEGORY",
               action: "CREATE",
               payload: { name: "Exam Prep", taskType: "WEEKLY" },
               createdAt: 1728189600000,
               retryCount: 0,
            },
         ],
      };

      const parsed = batchSyncSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
   });

   it("sorts mutations chronologically in FIFO order", () => {
      const m1: QueuedMutation = {
         id: "11111111-1111-4111-8111-111111111111",
         entityType: "TASK",
         action: "CREATE",
         payload: { id: "t1" },
         createdAt: 300,
         retryCount: 0,
      };
      const m2: QueuedMutation = {
         id: "22222222-2222-4222-8222-222222222222",
         entityType: "TASK",
         action: "UPDATE",
         payload: { taskId: "t1" },
         createdAt: 100,
         retryCount: 0,
      };
      const m3: QueuedMutation = {
         id: "33333333-3333-4333-8333-333333333333",
         entityType: "TASK",
         action: "TOGGLE",
         payload: { taskId: "t1" },
         createdAt: 200,
         retryCount: 0,
      };

      const sorted = sortMutationsChronologically([m1, m2, m3]);
      expect(sorted.map((m) => m.id)).toEqual([m2.id, m3.id, m1.id]);
   });

   it("compacts mutations when a task is created and deleted before sync", () => {
      const taskId = "99999999-9999-4999-8999-999999999999";
      const createM: QueuedMutation = {
         id: "11111111-1111-4111-8111-111111111111",
         entityType: "TASK",
         action: "CREATE",
         payload: { id: taskId, title: "Transient Task" },
         createdAt: 100,
         retryCount: 0,
      };
      const updateM: QueuedMutation = {
         id: "22222222-2222-4222-8222-222222222222",
         entityType: "TASK",
         action: "UPDATE",
         payload: { taskId, title: "Transient Task Edited" },
         createdAt: 200,
         retryCount: 0,
      };
      const deleteM: QueuedMutation = {
         id: "33333333-3333-4333-8333-333333333333",
         entityType: "TASK",
         action: "DELETE",
         payload: { taskId },
         createdAt: 300,
         retryCount: 0,
      };

      const otherTask: QueuedMutation = {
         id: "44444444-4444-4444-8444-444444444444",
         entityType: "TASK",
         action: "CREATE",
         payload: { id: "permanent-task", title: "Keep Me" },
         createdAt: 250,
         retryCount: 0,
      };

      const compacted = compactMutationQueue([
         createM,
         updateM,
         otherTask,
         deleteM,
      ]);
      // The transient task was created & deleted before syncing, so it should be pruned entirely!
      expect(compacted).toHaveLength(1);
      expect(compacted[0].id).toBe(otherTask.id);
   });

   it("validates queued mutation with dueDate for scheduled daily tasks", () => {
      const scheduledTaskMutation = {
         id: "55555555-5555-4555-8555-555555555555",
         entityType: "TASK",
         action: "CREATE",
         payload: {
            id: "task-scheduled-future",
            title: "Future Day Homework",
            taskType: "DAILY",
            dueDate: "2026-10-10",
            status: "TODO",
            isComplete: false,
         },
         createdAt: 1728189600000,
         retryCount: 0,
      };

      const parsed = queuedMutationSchema.safeParse(scheduledTaskMutation);
      expect(parsed.success).toBe(true);
      expect((parsed.data?.payload as { dueDate?: string })?.dueDate).toBe(
         "2026-10-10"
      );
   });
});
