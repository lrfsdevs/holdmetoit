import { describe, expect, it } from "vitest";
import {
   createCategorySchema,
   createTaskSchema,
   deleteCategorySchema,
   deleteTaskSchema,
   toggleTaskSchema,
   updateCategorySchema,
   updateTaskSchema,
} from "./task.validation";

describe("task.validation", () => {
   describe("createTaskSchema", () => {
      it("accepts valid input with categoryId", () => {
         const result = createTaskSchema.safeParse({
            title: "Study Chapter 4",
            taskType: "DAILY",
            categoryId: "cat_123",
         });
         expect(result.success).toBe(true);
      });

      it("accepts valid input with newCategoryName and optional isComplete", () => {
         const result = createTaskSchema.safeParse({
            title: "Finish physics set",
            taskType: "WEEKLY",
            newCategoryName: "Physics",
            isComplete: true,
         });
         expect(result.success).toBe(true);
         if (result.success) {
            expect(result.data.isComplete).toBe(true);
         }
      });

      it("rejects empty title", () => {
         const result = createTaskSchema.safeParse({
            title: "   ",
            taskType: "DAILY",
            categoryId: "cat_123",
         });
         expect(result.success).toBe(false);
      });

      it("rejects when both categoryId and newCategoryName are missing", () => {
         const result = createTaskSchema.safeParse({
            title: "Review notes",
            taskType: "DAILY",
         });
         expect(result.success).toBe(false);
      });

      it("rejects invalid taskType", () => {
         const result = createTaskSchema.safeParse({
            title: "Review notes",
            taskType: "MONTHLY",
            categoryId: "cat_123",
         });
         expect(result.success).toBe(false);
      });

      it("accepts valid dueDate format YYYY-MM-DD", () => {
         const result = createTaskSchema.safeParse({
            title: "Study Chapter 4",
            taskType: "DAILY",
            categoryId: "cat_123",
            dueDate: "2026-10-06",
         });
         expect(result.success).toBe(true);
         if (result.success) {
            expect(result.data.dueDate).toBe("2026-10-06");
         }
      });

      it("rejects invalid dueDate format", () => {
         const result = createTaskSchema.safeParse({
            title: "Study Chapter 4",
            taskType: "DAILY",
            categoryId: "cat_123",
            dueDate: "10-06-2026",
         });
         expect(result.success).toBe(false);
      });
   });

   describe("toggleTaskSchema", () => {
      it("accepts valid toggle input", () => {
         const result = toggleTaskSchema.safeParse({
            taskId: "task_1",
            isComplete: true,
         });
         expect(result.success).toBe(true);
      });

      it("rejects empty taskId", () => {
         const result = toggleTaskSchema.safeParse({
            taskId: "   ",
            isComplete: true,
         });
         expect(result.success).toBe(false);
      });
   });

   describe("deleteTaskSchema", () => {
      it("accepts valid taskId", () => {
         const result = deleteTaskSchema.safeParse({
            taskId: "task_abc",
         });
         expect(result.success).toBe(true);
      });

      it("rejects empty taskId", () => {
         const result = deleteTaskSchema.safeParse({
            taskId: "",
         });
         expect(result.success).toBe(false);
      });
   });

   describe("createCategorySchema", () => {
      it("accepts valid category name and defaults taskType to DAILY", () => {
         const result = createCategorySchema.safeParse({
            name: "Mathematics",
         });
         expect(result.success).toBe(true);
         if (result.success) {
            expect(result.data.taskType).toBe("DAILY");
         }
      });

      it("accepts explicit WEEKLY taskType", () => {
         const result = createCategorySchema.safeParse({
            name: "Weekly Goals",
            taskType: "WEEKLY",
         });
         expect(result.success).toBe(true);
         if (result.success) {
            expect(result.data.taskType).toBe("WEEKLY");
         }
      });

      it("rejects empty category name", () => {
         const result = createCategorySchema.safeParse({
            name: "   ",
         });
         expect(result.success).toBe(false);
      });
   });

   describe("updateTaskSchema", () => {
      it("accepts valid task update", () => {
         const result = updateTaskSchema.safeParse({
            taskId: "task_1",
            title: "Updated task title",
         });
         expect(result.success).toBe(true);
      });

      it("accepts valid task status update without title", () => {
         const result = updateTaskSchema.safeParse({
            taskId: "task_1",
            isComplete: true,
         });
         expect(result.success).toBe(true);
         if (result.success) {
            expect(result.data.isComplete).toBe(true);
         }
      });

      it("accepts valid update with both title and isComplete", () => {
         const result = updateTaskSchema.safeParse({
            taskId: "task_1",
            title: "Finished essay",
            isComplete: true,
         });
         expect(result.success).toBe(true);
         if (result.success) {
            expect(result.data.title).toBe("Finished essay");
            expect(result.data.isComplete).toBe(true);
         }
      });

      it("rejects empty taskId or empty title", () => {
         expect(
            updateTaskSchema.safeParse({ taskId: "", title: "Valid title" })
               .success
         ).toBe(false);
         expect(
            updateTaskSchema.safeParse({ taskId: "task_1", title: "   " })
               .success
         ).toBe(false);
      });

      it("accepts valid dueDate update without title or status", () => {
         const result = updateTaskSchema.safeParse({
            taskId: "task_1",
            dueDate: "2026-10-08",
         });
         expect(result.success).toBe(true);
         if (result.success) {
            expect(result.data.dueDate).toBe("2026-10-08");
         }
      });

      it("rejects when neither title, isComplete, status, nor dueDate is provided", () => {
         const result = updateTaskSchema.safeParse({
            taskId: "task_1",
         });
         expect(result.success).toBe(false);
      });
   });

   describe("updateCategorySchema", () => {
      it("accepts valid category rename", () => {
         const result = updateCategorySchema.safeParse({
            categoryId: "cat_1",
            name: "Physics",
         });
         expect(result.success).toBe(true);
      });

      it("rejects empty categoryId or empty name", () => {
         expect(
            updateCategorySchema.safeParse({ categoryId: "", name: "Valid" })
               .success
         ).toBe(false);
         expect(
            updateCategorySchema.safeParse({ categoryId: "cat_1", name: "   " })
               .success
         ).toBe(false);
      });
   });

   describe("deleteCategorySchema", () => {
      it("accepts valid categoryId", () => {
         const result = deleteCategorySchema.safeParse({
            categoryId: "cat_1",
         });
         expect(result.success).toBe(true);
      });

      it("rejects empty categoryId", () => {
         expect(
            deleteCategorySchema.safeParse({ categoryId: "" }).success
         ).toBe(false);
      });
   });
});
