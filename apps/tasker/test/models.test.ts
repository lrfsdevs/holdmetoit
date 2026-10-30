import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/db.js";
import {
   createCategory,
   deleteCategory,
   DuplicateCategoryError,
   updateCategoryName,
} from "../src/models/category.js";
import {
   deleteTask,
   updateTaskContent,
   updateTaskStatus,
} from "../src/models/task.js";

vi.mock("../src/db.js", () => ({
   prisma: {
      task: {
         updateMany: vi.fn(),
         findFirst: vi.fn(),
      },
      category: {
         findFirst: vi.fn(),
         findUnique: vi.fn(),
         create: vi.fn(),
         update: vi.fn(),
      },
      $transaction: vi.fn(async (operations: unknown[]) =>
         Promise.all(operations)
      ),
   },
}));

function p2002(): Prisma.PrismaClientKnownRequestError {
   return new Prisma.PrismaClientKnownRequestError("Unique constraint", {
      code: "P2002",
      clientVersion: "test",
   });
}

describe("tasker task write predicates", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("updates a status with a guarded updateMany and re-reads the row", async () => {
      vi.mocked(prisma.task.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
         id: "task_1",
         status: "COMPLETED",
      } as never);

      const result = await updateTaskStatus("task_1", "user_1", "completed");

      expect(prisma.task.updateMany).toHaveBeenCalledWith({
         where: { id: "task_1", userId: "user_1", isDeleted: false },
         data: expect.objectContaining({
            status: "COMPLETED",
            isComplete: true,
         }),
      });
      expect(result).toMatchObject({ id: "task_1" });
   });

   it("returns null when the status update matches no live row", async () => {
      vi.mocked(prisma.task.updateMany).mockResolvedValue({ count: 0 });

      const result = await updateTaskStatus("task_1", "user_1", "completed");

      expect(result).toBeNull();
      expect(prisma.task.findFirst).not.toHaveBeenCalled();
   });

   it("returns null when the content update matches no live row", async () => {
      vi.mocked(prisma.task.updateMany).mockResolvedValue({ count: 0 });

      const result = await updateTaskContent("task_1", "user_1", "New title");

      expect(result).toBeNull();
      expect(prisma.task.findFirst).not.toHaveBeenCalled();
   });

   it("deletes only when a live row matched", async () => {
      vi.mocked(prisma.task.updateMany)
         .mockResolvedValueOnce({ count: 0 })
         .mockResolvedValueOnce({ count: 1 });

      await expect(deleteTask("task_1", "user_1")).resolves.toBe(false);
      await expect(deleteTask("task_1", "user_1")).resolves.toBe(true);
   });
});

describe("tasker category lifecycle", () => {
   const nowCategory = {
      id: "cat_1",
      userId: "user_1",
      name: "Work",
      taskType: "DAILY",
      isDeleted: false,
   };

   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("throws for a live duplicate", async () => {
      vi.mocked(prisma.category.findFirst).mockResolvedValue(
         nowCategory as never
      );

      await expect(createCategory("user_1", "work")).rejects.toBeInstanceOf(
         DuplicateCategoryError
      );
   });

   it("revives a soft-deleted category instead of inserting", async () => {
      vi.mocked(prisma.category.findFirst)
         .mockResolvedValueOnce(null)
         .mockResolvedValueOnce({ ...nowCategory, isDeleted: true } as never);
      vi.mocked(prisma.category.update).mockResolvedValue(nowCategory as never);

      const result = await createCategory("user_1", "Work");

      expect(prisma.category.update).toHaveBeenCalledWith({
         where: { id: "cat_1" },
         data: { name: "Work", isDeleted: false, deletionTime: null },
      });
      expect(result).toEqual(nowCategory);
   });

   it("creates a new category after a tombstoned name was renamed", async () => {
      vi.mocked(prisma.category.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.category.create).mockResolvedValue(nowCategory as never);

      await createCategory("user_1", "Work");

      expect(prisma.category.create).toHaveBeenCalledWith({
         data: { userId: "user_1", name: "Work", taskType: "DAILY" },
      });
   });

   it("maps a create race to DuplicateCategoryError", async () => {
      vi.mocked(prisma.category.findFirst)
         .mockResolvedValueOnce(null)
         .mockResolvedValueOnce(null)
         .mockResolvedValueOnce(nowCategory as never);
      vi.mocked(prisma.category.create).mockRejectedValueOnce(p2002());

      await expect(createCategory("user_1", "Work")).rejects.toBeInstanceOf(
         DuplicateCategoryError
      );
   });

   it("writes a tombstone and moves only active tasks on delete", async () => {
      vi.mocked(prisma.category.findFirst)
         .mockResolvedValueOnce(nowCategory as never)
         .mockResolvedValueOnce({
            ...nowCategory,
            id: "cat_default",
            name: "Default",
         } as never);
      vi.mocked(prisma.task.updateMany).mockResolvedValue({
         count: 2,
      } as never);
      vi.mocked(prisma.category.update).mockResolvedValue({} as never);

      const result = await deleteCategory("cat_1");

      expect(result).toBe(true);
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
         where: {
            categoryId: "cat_1",
            userId: "user_1",
            isDeleted: false,
         },
         data: { categoryId: "cat_default" },
      });
      expect(prisma.category.update).toHaveBeenCalledWith({
         where: { id: "cat_1" },
         data: expect.objectContaining({
            isDeleted: true,
            name: expect.stringContaining("·deleted·"),
         }),
      });
   });

   it("maps a rename race to DuplicateCategoryError", async () => {
      vi.mocked(prisma.category.findFirst)
         .mockResolvedValueOnce(nowCategory as never)
         .mockResolvedValueOnce(null);
      vi.mocked(prisma.category.update).mockRejectedValueOnce(p2002());

      await expect(
         updateCategoryName("user_1", "Work", "Study")
      ).rejects.toBeInstanceOf(DuplicateCategoryError);
   });
});
