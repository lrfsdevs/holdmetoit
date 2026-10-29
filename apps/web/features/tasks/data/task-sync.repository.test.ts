import { beforeEach, describe, expect, it, vi } from "vitest";
import { processBatchSync } from "./task-sync.repository";
import { prisma } from "@/core/db";
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
         updateMany: vi.fn(),
         deleteMany: vi.fn(),
      },
      task: {
         findFirst: vi.fn(),
         upsert: vi.fn(),
         updateMany: vi.fn(),
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
         },
      });

      // Verify tasks inside this category are cascaded to target taskType
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
         where: { categoryId: catId, userId },
         data: {
            taskType: "WEEKLY",
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

   it("fails and leaves task mutation unacknowledged when explicit categoryId does not exist", async () => {
      vi.mocked(prisma.category.findFirst).mockResolvedValueOnce(null);

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
      expect(res.processedMutationIds).not.toContain("mut-task-orphan");
      expect(prisma.task.upsert).not.toHaveBeenCalled();
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
         "c_client"
      );
      expect(prisma.task.upsert).toHaveBeenCalledWith(
         expect.objectContaining({
            create: expect.objectContaining({ challengeId: "c_client" }),
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
      expect(prisma.task.upsert).toHaveBeenCalledWith(
         expect.objectContaining({
            create: expect.objectContaining({ challengeId: null }),
         })
      );
   });
});
