import { beforeEach, describe, expect, it, vi } from "vitest";
import { processBatchSync } from "./task-sync.repository";
import { prisma } from "@/core/db";
import { ChallengeStateError } from "@/features/challenges/domain/challenge-lifecycle";
import * as taskRepo from "./task.repository";

vi.mock("@/core/db", () => ({
   prisma: {
      $transaction: vi.fn(),
      category: {
         findUnique: vi.fn(),
         findFirst: vi.fn(),
         findMany: vi.fn(),
         create: vi.fn(),
         update: vi.fn(),
         updateMany: vi.fn().mockResolvedValue({ count: 1 }),
         deleteMany: vi.fn(),
      },
      task: {
         findFirst: vi.fn(),
         findUnique: vi.fn(),
         create: vi.fn(),
         update: vi.fn(),
         upsert: vi.fn(),
         updateMany: vi.fn().mockResolvedValue({ count: 1 }),
         deleteMany: vi.fn(),
      },
   },
}));

vi.mock("./task.repository", () => ({
   DEFAULT_CATEGORY_NAME: "General",
   getUserCategorizedTasks: vi.fn(),
   getUserCategorizedTasksFromDatabase: vi.fn(),
   resolveTaskChallengeId: vi.fn(),
   validateTaskChallengeId: vi.fn(),
   rolloverIncompleteTasks: vi.fn().mockResolvedValue({ count: 0 }),
   assertChallengeWritable: vi.fn().mockResolvedValue(undefined),
   toTaskItem: vi.fn((task: Record<string, unknown>, taskType: string) => ({
      ...task,
      taskType,
   })),
   toCategoryItem: vi.fn((category: Record<string, unknown>) => ({
      ...category,
   })),
}));

describe("processBatchSync (task-sync.repository)", () => {
   const userId = "user_test_123";

   beforeEach(() => {
      vi.clearAllMocks();

      vi.mocked(taskRepo.getUserCategorizedTasksFromDatabase).mockResolvedValue(
         {
            categories: [],
            dailyCategories: [],
            weeklyCategories: [],
            totalDailyTasks: 0,
            completedDailyTasks: 0,
            totalWeeklyTasks: 0,
            completedWeeklyTasks: 0,
         }
      );
      vi.mocked(taskRepo.getUserCategorizedTasks).mockResolvedValue({
         categories: [],
         dailyCategories: [],
         weeklyCategories: [],
         totalDailyTasks: 0,
         completedDailyTasks: 0,
         totalWeeklyTasks: 0,
         completedWeeklyTasks: 0,
      });

      vi.mocked(taskRepo.resolveTaskChallengeId).mockResolvedValue(null);
      vi.mocked(taskRepo.validateTaskChallengeId).mockImplementation(
         async (_userId, requestedChallengeId) => requestedChallengeId
      );

      // Mock prisma.$transaction to execute callback with mock tx
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
         return (callback as (tx: unknown) => Promise<unknown>)(prisma);
      });
   });

   it("does not rename category to DEFAULT_CATEGORY_NAME when moving a category without name in payload", async () => {
      const catId = "cat-uuid-123";
      vi.mocked(prisma.category.findUnique).mockResolvedValue({
         id: catId,
         userId,
         name: "Custom Category",
         taskType: "DAILY",
         sortOrder: 0,
         createdAt: new Date(),
         updatedAt: new Date(),
         isDeleted: false,
         deletionTime: null,
         revision: 0,
      });

      vi.mocked(prisma.category.findFirst).mockResolvedValue(null); // No collision in WEEKLY

      const res = await processBatchSync(userId, [
         {
            id: "mut-1",
            entityType: "CATEGORY",
            action: "MOVE",
            payload: {
               categoryId: catId,
               taskType: "WEEKLY",
               sortOrder: 1,
            },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ]);

      expect(res.success).toBe(true);
      expect(res.processedMutationIds).toContain("mut-1");

      // Verify updateMany was called WITHOUT name: "Category 1"
      expect(prisma.category.updateMany).toHaveBeenCalledWith({
         where: { id: catId, userId, isDeleted: false },
         data: {
            sortOrder: 1,
            taskType: "WEEKLY",
            revision: { increment: 1 },
         },
      });

      // Verify tasks inside this category are cascaded to target taskType
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
         where: { categoryId: catId, userId },
         data: {
            taskType: "WEEKLY",
            revision: { increment: 1 },
         },
      });
   });

   it("disambiguates category name when moving across columns with an existing name collision", async () => {
      const catId = "cat-uuid-daily";
      vi.mocked(prisma.category.findUnique).mockResolvedValue({
         id: catId,
         userId,
         name: "Math",
         taskType: "DAILY",
         sortOrder: 0,
         createdAt: new Date(),
         updatedAt: new Date(),
         isDeleted: false,
         deletionTime: null,
         revision: 0,
      });

      // Collision exists in target column
      vi.mocked(prisma.category.findFirst).mockResolvedValue({
         id: "cat-uuid-weekly-math",
         userId,
         name: "Math",
         taskType: "WEEKLY",
         sortOrder: 0,
         createdAt: new Date(),
         updatedAt: new Date(),
         isDeleted: false,
         deletionTime: null,
         revision: 0,
      });

      const res = await processBatchSync(userId, [
         {
            id: "mut-2",
            entityType: "CATEGORY",
            action: "MOVE",
            payload: {
               categoryId: catId,
               taskType: "WEEKLY",
               sortOrder: 2,
            },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ]);

      expect(res.success).toBe(true);
      expect(res.processedMutationIds).toContain("mut-2");

      // Verify name was disambiguated to avoid unique constraint failure
      expect(prisma.category.updateMany).toHaveBeenCalledWith({
         where: { id: catId, userId, isDeleted: false },
         data: {
            name: "Math (Moved)",
            taskType: "WEEKLY",
            sortOrder: 2,
            revision: { increment: 1 },
         },
      });
   });

   it("does not acknowledge mutations that throw errors during execution", async () => {
      vi.mocked(prisma.category.updateMany).mockRejectedValueOnce(
         new Error("Database error")
      );

      const res = await processBatchSync(userId, [
         {
            id: "mut-fail-1",
            entityType: "CATEGORY",
            action: "UPDATE",
            payload: {
               categoryId: "cat-fail",
               name: "New Name",
            },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ]);

      expect(res.success).toBe(true);
      expect(res.processedMutationIds).not.toContain("mut-fail-1");
   });

   it("isolates mutation failures so remaining valid mutations in the batch are committed and acknowledged", async () => {
      // First mutation fails
      vi.mocked(prisma.category.updateMany).mockRejectedValueOnce(
         new Error("Database collision")
      );
      // Second mutation succeeds
      vi.mocked(prisma.task.updateMany).mockResolvedValueOnce({ count: 1 });

      const res = await processBatchSync(userId, [
         {
            id: "mut-bad",
            entityType: "CATEGORY",
            action: "UPDATE",
            payload: { categoryId: "cat-broken", name: "Broken" },
            createdAt: Date.now(),
            retryCount: 0,
         },
         {
            id: "mut-good",
            entityType: "TASK",
            action: "TOGGLE",
            payload: { taskId: "task-good", isComplete: true },
            createdAt: Date.now() + 1,
            retryCount: 0,
         },
      ]);

      expect(res.success).toBe(true);
      expect(res.processedMutationIds).not.toContain("mut-bad");
      expect(res.processedMutationIds).toContain("mut-good");
   });

   it("falls back to a default category when an explicit categoryId no longer exists", async () => {
      vi.mocked(prisma.category.findFirst)
         .mockResolvedValueOnce(null)
         .mockResolvedValueOnce({ id: "cat-default", userId } as never);

      const res = await processBatchSync(userId, [
         {
            id: "mut-task-orphan",
            entityType: "TASK",
            action: "CREATE",
            payload: {
               id: "task-orphan",
               title: "Task with missing cat",
               categoryId: "cat-missing",
            },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ]);

      expect(res.success).toBe(true);
      expect(res.processedMutationIds).toContain("mut-task-orphan");
      expect(prisma.task.create).toHaveBeenCalledWith(
         expect.objectContaining({
            data: expect.objectContaining({ categoryId: "cat-default" }),
         })
      );
   });

   it("soft-deletes a task on DELETE mutations instead of removing the row", async () => {
      const res = await processBatchSync(userId, [
         {
            id: "mut-del-1",
            entityType: "TASK",
            action: "DELETE",
            payload: { taskId: "task-del-1" },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ]);

      expect(res.success).toBe(true);
      expect(res.processedMutationIds).toContain("mut-del-1");
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
         where: { id: "task-del-1", userId, isDeleted: false },
         data: {
            isDeleted: true,
            deletionTime: expect.any(Date),
            revision: { increment: 1 },
         },
      });
      expect(prisma.task.deleteMany).not.toHaveBeenCalled();
   });

   it("stamps a client-sent challengeId on task CREATE after validation", async () => {
      const res = await processBatchSync(userId, [
         {
            id: "mut-create-1",
            entityType: "TASK",
            action: "CREATE",
            payload: {
               id: "task-create-1",
               categoryId: "cat-1",
               challengeId: "c_client",
               title: "Linked task",
               taskType: "WEEKLY",
               isComplete: false,
               status: "TODO",
            },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ]);

      expect(res.success).toBe(true);
      expect(taskRepo.validateTaskChallengeId).toHaveBeenCalledWith(
         userId,
         "c_client",
         expect.anything()
      );
      expect(prisma.task.create).toHaveBeenCalledWith(
         expect.objectContaining({
            data: expect.objectContaining({ challengeId: "c_client" }),
         })
      );
   });

   it("creates an unlinked task when the challenge is locked", async () => {
      vi.mocked(prisma.category.findFirst).mockResolvedValue({
         id: "cat-1",
         userId,
      } as never);
      vi.mocked(taskRepo.validateTaskChallengeId).mockResolvedValue("c_locked");
      vi.mocked(taskRepo.assertChallengeWritable).mockRejectedValueOnce(
         new ChallengeStateError("locked")
      );

      const res = await processBatchSync(userId, [
         {
            id: "mut-locked-1",
            entityType: "TASK",
            action: "CREATE",
            payload: {
               id: "task-locked-1",
               categoryId: "cat-1",
               challengeId: "c_locked",
               title: "Locked goal",
               taskType: "WEEKLY",
               isComplete: false,
               status: "TODO",
            },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ]);

      expect(res.success).toBe(true);
      expect(res.processedMutationIds).toContain("mut-locked-1");
      expect(prisma.task.create).toHaveBeenCalledWith(
         expect.objectContaining({
            data: expect.objectContaining({ challengeId: null }),
         })
      );
   });

   it("treats an explicit null challengeId as standalone without resolving", async () => {
      await processBatchSync(userId, [
         {
            id: "mut-create-2",
            entityType: "TASK",
            action: "CREATE",
            payload: {
               id: "task-create-2",
               categoryId: "cat-1",
               challengeId: null,
               title: "Standalone task",
               taskType: "WEEKLY",
               isComplete: false,
               status: "TODO",
            },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ]);

      expect(taskRepo.resolveTaskChallengeId).not.toHaveBeenCalled();
      expect(prisma.task.create).toHaveBeenCalledWith(
         expect.objectContaining({
            data: expect.objectContaining({ challengeId: null }),
         })
      );
   });

   it("reports a conflict with the current task when an update matches zero rows", async () => {
      vi.mocked(prisma.task.updateMany).mockResolvedValueOnce({ count: 0 });
      vi.mocked(prisma.task.findFirst)
         .mockResolvedValueOnce({ challengeId: null } as never)
         .mockResolvedValueOnce({
            id: "t_server",
            userId,
            categoryId: "cat_1",
            challengeId: null,
            title: "Server title",
            taskType: "DAILY",
            sortOrder: 0,
            isComplete: false,
            status: "TODO",
            dueDate: null,
            isDeleted: false,
            deletionTime: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            completedAt: null,
            revision: 5,
         } as never);

      const res = await processBatchSync(userId, [
         {
            id: "mut-zero",
            entityType: "TASK",
            action: "UPDATE",
            payload: { taskId: "t_server", title: "Stale title" },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ]);

      expect(res.processedMutationIds).toContain("mut-zero");
      expect(res.mutationResults).toEqual([
         expect.objectContaining({
            id: "mut-zero",
            status: "conflict",
            reason: "zero_rows",
            currentTask: expect.objectContaining({
               id: "t_server",
               title: "Server title",
               revision: 5,
            }),
         }),
      ]);
   });

   it("reports a conflict with null when the task no longer exists", async () => {
      vi.mocked(prisma.task.updateMany).mockResolvedValueOnce({ count: 0 });
      vi.mocked(prisma.task.findFirst).mockResolvedValueOnce(null);

      const res = await processBatchSync(userId, [
         {
            id: "mut-gone",
            entityType: "TASK",
            action: "TOGGLE",
            payload: { taskId: "t_gone", isComplete: true },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ]);

      expect(res.mutationResults?.[0]).toMatchObject({
         id: "mut-gone",
         status: "conflict",
         reason: "zero_rows",
         currentTask: null,
      });
   });

   it("reports a category name conflict when the name belongs to another id", async () => {
      vi.mocked(prisma.category.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.category.findFirst).mockResolvedValueOnce({
         id: "cat_server",
         userId,
         name: "Work",
         taskType: "DAILY",
         sortOrder: 0,
         isDeleted: false,
         deletionTime: null,
         createdAt: new Date(),
         updatedAt: new Date(),
      } as never);

      const res = await processBatchSync(userId, [
         {
            id: "mut-cat",
            entityType: "CATEGORY",
            action: "CREATE",
            payload: { id: "cat_local", name: "Work", taskType: "DAILY" },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ]);

      expect(res.mutationResults?.[0]).toMatchObject({
         id: "mut-cat",
         status: "conflict",
         reason: "category_name_taken",
         currentCategory: expect.objectContaining({ id: "cat_server" }),
      });
      expect(prisma.category.create).not.toHaveBeenCalled();
   });

   it("rejects a task create that collides with another user's id", async () => {
      vi.mocked(prisma.category.findFirst).mockResolvedValue({
         id: "cat-1",
         userId,
      } as never);
      vi.mocked(prisma.task.findUnique).mockResolvedValueOnce({
         userId: "other_user",
      } as never);

      const res = await processBatchSync(userId, [
         {
            id: "mut-foreign",
            entityType: "TASK",
            action: "CREATE",
            payload: {
               id: "task-foreign",
               categoryId: "cat-1",
               title: "Not mine",
            },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ]);

      expect(res.mutationResults?.[0]).toMatchObject({
         id: "mut-foreign",
         status: "conflict",
         reason: "foreign_row",
         currentTask: null,
      });
      expect(prisma.task.create).not.toHaveBeenCalled();
   });

   it("rolls over incomplete daily tasks in one mutation", async () => {
      const res = await processBatchSync(userId, [
         {
            id: "mut-rollover",
            entityType: "TASK",
            action: "ROLLOVER",
            payload: {
               taskIds: ["t_1", "t_2"],
               targetDateKey: "2026-10-30",
            },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ]);

      expect(res.mutationResults?.[0]).toMatchObject({
         id: "mut-rollover",
         status: "applied",
      });
      expect(taskRepo.rolloverIncompleteTasks).toHaveBeenCalledWith(
         {
            userId,
            taskIds: ["t_1", "t_2"],
            targetDateKey: "2026-10-30",
         },
         expect.anything()
      );
   });

   it("rejects a rollover with an invalid date key", async () => {
      const res = await processBatchSync(userId, [
         {
            id: "mut-rollover-bad",
            entityType: "TASK",
            action: "ROLLOVER",
            payload: {
               taskIds: ["t_1"],
               targetDateKey: "not-a-date",
            },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ]);

      expect(res.mutationResults?.[0]).toMatchObject({
         id: "mut-rollover-bad",
         status: "conflict",
         reason: "invalid_payload",
      });
      expect(taskRepo.rolloverIncompleteTasks).not.toHaveBeenCalled();
   });

   it("rejects an update with an overlong title before writing", async () => {
      const res = await processBatchSync(userId, [
         {
            id: "mut-long-title",
            entityType: "TASK",
            action: "UPDATE",
            payload: { taskId: "t_1", title: "x".repeat(256) },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ]);

      expect(res.mutationResults?.[0]).toMatchObject({
         id: "mut-long-title",
         status: "conflict",
         reason: "invalid_payload",
      });
      expect(prisma.task.updateMany).not.toHaveBeenCalled();
   });

   it("rejects a toggle without a status or completion flag", async () => {
      const res = await processBatchSync(userId, [
         {
            id: "mut-empty-toggle",
            entityType: "TASK",
            action: "TOGGLE",
            payload: { taskId: "t_1" },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ]);

      expect(res.mutationResults?.[0]).toMatchObject({
         id: "mut-empty-toggle",
         status: "conflict",
         reason: "invalid_payload",
      });
      expect(prisma.task.updateMany).not.toHaveBeenCalled();
   });

   it("writes a task update with the client base revision and increments it", async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValueOnce({
         challengeId: null,
      } as never);
      vi.mocked(prisma.task.updateMany).mockResolvedValueOnce({ count: 1 });

      const res = await processBatchSync(userId, [
         {
            id: "mut-rev",
            entityType: "TASK",
            action: "UPDATE",
            payload: { taskId: "t_rev", title: "New title" },
            createdAt: Date.now(),
            retryCount: 0,
            baseRevision: 3,
         },
      ]);

      expect(res.mutationResults?.[0]).toMatchObject({
         id: "mut-rev",
         status: "applied",
      });
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
         where: {
            id: "t_rev",
            userId,
            isDeleted: false,
            revision: 3,
         },
         data: {
            title: "New title",
            revision: { increment: 1 },
         },
      });
   });

   it("rejects a stale base revision and returns the current row", async () => {
      vi.mocked(prisma.task.findFirst)
         .mockResolvedValueOnce({ challengeId: null } as never)
         .mockResolvedValueOnce({
            id: "t_stale",
            userId,
            categoryId: "cat_1",
            challengeId: null,
            title: "Current title",
            taskType: "DAILY",
            sortOrder: 0,
            isComplete: false,
            status: "TODO",
            dueDate: null,
            isDeleted: false,
            deletionTime: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            completedAt: null,
            revision: 4,
         } as never);
      vi.mocked(prisma.task.updateMany).mockResolvedValueOnce({ count: 0 });

      const res = await processBatchSync(userId, [
         {
            id: "mut-stale",
            entityType: "TASK",
            action: "UPDATE",
            payload: { taskId: "t_stale", title: "Stale edit" },
            createdAt: Date.now(),
            retryCount: 0,
            baseRevision: 3,
         },
      ]);

      expect(prisma.task.updateMany).toHaveBeenCalledWith(
         expect.objectContaining({
            where: expect.objectContaining({ revision: 3 }),
         })
      );
      expect(res.mutationResults?.[0]).toMatchObject({
         id: "mut-stale",
         status: "conflict",
         reason: "zero_rows",
         currentTask: expect.objectContaining({
            id: "t_stale",
            revision: 4,
         }),
      });
   });

   it("applies a legacy mutation without a base revision", async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValueOnce({
         challengeId: null,
      } as never);
      vi.mocked(prisma.task.updateMany).mockResolvedValueOnce({ count: 1 });

      const res = await processBatchSync(userId, [
         {
            id: "mut-legacy",
            entityType: "TASK",
            action: "UPDATE",
            payload: { taskId: "t_legacy", title: "Legacy edit" },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ]);

      expect(res.mutationResults?.[0]).toMatchObject({
         id: "mut-legacy",
         status: "applied",
      });
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
         where: { id: "t_legacy", userId, isDeleted: false },
         data: {
            title: "Legacy edit",
            revision: { increment: 1 },
         },
      });
   });

   it("bumps revisions on task reorder", async () => {
      await processBatchSync(userId, [
         {
            id: "mut-reorder",
            entityType: "TASK",
            action: "REORDER",
            payload: { taskIds: ["t_a", "t_b"] },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ]);

      expect(prisma.task.updateMany).toHaveBeenNthCalledWith(1, {
         where: { id: "t_a", userId, isDeleted: false },
         data: { sortOrder: 0, revision: { increment: 1 } },
      });
      expect(prisma.task.updateMany).toHaveBeenNthCalledWith(2, {
         where: { id: "t_b", userId, isDeleted: false },
         data: { sortOrder: 1, revision: { increment: 1 } },
      });
   });

   it("writes a category update with the base revision", async () => {
      vi.mocked(prisma.category.updateMany).mockResolvedValueOnce({
         count: 1,
      });

      const res = await processBatchSync(userId, [
         {
            id: "mut-cat-rev",
            entityType: "CATEGORY",
            action: "UPDATE",
            payload: { categoryId: "cat_rev", name: "Renamed" },
            createdAt: Date.now(),
            retryCount: 0,
            baseRevision: 2,
         },
      ]);

      expect(res.mutationResults?.[0]).toMatchObject({
         id: "mut-cat-rev",
         status: "applied",
      });
      expect(prisma.category.updateMany).toHaveBeenCalledWith({
         where: {
            id: "cat_rev",
            userId,
            isDeleted: false,
            revision: 2,
         },
         data: {
            name: "Renamed",
            revision: { increment: 1 },
         },
      });
   });

   it("rejects a weekly goal mutation when the challenge is locked", async () => {
      vi.mocked(prisma.task.findFirst)
         .mockResolvedValueOnce({ challengeId: "c_locked" } as never)
         .mockResolvedValueOnce({
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
            isDeleted: false,
            deletionTime: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            completedAt: null,
            revision: 2,
         } as never);
      vi.mocked(taskRepo.assertChallengeWritable).mockRejectedValueOnce(
         new ChallengeStateError("locked")
      );

      const res = await processBatchSync(userId, [
         {
            id: "mut-locked-update",
            entityType: "TASK",
            action: "TOGGLE",
            payload: { taskId: "t_locked", isComplete: true },
            createdAt: Date.now(),
            retryCount: 0,
            baseRevision: 2,
         },
      ]);

      expect(res.mutationResults?.[0]).toMatchObject({
         id: "mut-locked-update",
         status: "conflict",
         reason: "challenge_locked",
         currentTask: expect.objectContaining({
            id: "t_locked",
            revision: 2,
         }),
      });
      expect(prisma.task.updateMany).not.toHaveBeenCalled();
   });
});
