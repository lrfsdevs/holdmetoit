import { describe, expect, it } from "vitest";
import {
   createCategorySchema,
   createTaskSchema,
   deleteCategorySchema,
   deleteTaskSchema,
   rolloverTasksSchema,
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

      it("accepts challengeId as string or null", () => {
         const challengeScoped = createTaskSchema.safeParse({
            title: "Score 100 on quiz",
            taskType: "WEEKLY",
            categoryId: "cat_123",
            challengeId: "chal_abc",
         });
         expect(challengeScoped.success).toBe(true);
         if (challengeScoped.success) {
            expect(challengeScoped.data.challengeId).toBe("chal_abc");
         }

         const personalScoped = createTaskSchema.safeParse({
            title: "Buy textbook",
            taskType: "WEEKLY",
            categoryId: "cat_123",
            challengeId: null,
         });
         expect(personalScoped.success).toBe(true);
         if (personalScoped.success) {
            expect(personalScoped.data.challengeId).toBeNull();
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

      it("rejects invalid dueDate format", () => {
         const result = createTaskSchema.safeParse({
            title: "Review notes",
            taskType: "DAILY",
            categoryId: "cat_123",
            dueDate: "10-25-2026",
         });
         expect(result.success).toBe(false);
      });

      it("accepts valid dueDate format", () => {
         const result = createTaskSchema.safeParse({
            title: "Review notes",
            taskType: "DAILY",
            categoryId: "cat_123",
            dueDate: "2026-10-25",
         });
         expect(result.success).toBe(true);
      });
   });

   describe("toggleTaskSchema", () => {
      it("accepts valid toggle with isComplete", () => {
         const result = toggleTaskSchema.safeParse({
            taskId: "task_1",
            isComplete: true,
         });
         expect(result.success).toBe(true);
      });

      it("accepts valid toggle with status", () => {
         const result = toggleTaskSchema.safeParse({
            taskId: "task_1",
            status: "IN_PROGRESS",
         });
         expect(result.success).toBe(true);
      });

      it("rejects empty taskId", () => {
         expect(
            toggleTaskSchema.safeParse({ taskId: "  ", isComplete: true })
               .success
         ).toBe(false);
      });

      it("rejects when neither isComplete nor status is provided", () => {
         expect(toggleTaskSchema.safeParse({ taskId: "task_1" }).success).toBe(
            false
         );
      });
   });

   describe("deleteTaskSchema", () => {
      it("accepts valid taskId", () => {
         expect(deleteTaskSchema.safeParse({ taskId: "task_1" }).success).toBe(
            true
         );
      });

      it("rejects empty taskId", () => {
         expect(deleteTaskSchema.safeParse({ taskId: "" }).success).toBe(false);
      });
   });

   describe("createCategorySchema", () => {
      it("accepts valid category name", () => {
         const result = createCategorySchema.safeParse({ name: "Math" });
         expect(result.success).toBe(true);
         if (result.success) {
            expect(result.data.taskType).toBe("DAILY");
         }
      });

      it("accepts explicit taskType", () => {
         const result = createCategorySchema.safeParse({
            name: "Math",
            taskType: "WEEKLY",
         });
         expect(result.success).toBe(true);
         if (result.success) {
            expect(result.data.taskType).toBe("WEEKLY");
         }
      });

      it("rejects empty name", () => {
         expect(createCategorySchema.safeParse({ name: "   " }).success).toBe(
            false
         );
      });
   });

   describe("updateTaskSchema", () => {
      it("accepts title update", () => {
         const result = updateTaskSchema.safeParse({
            taskId: "task_1",
            title: "Updated Title",
         });
         expect(result.success).toBe(true);
      });

      it("accepts challengeId update", () => {
         const result = updateTaskSchema.safeParse({
            taskId: "task_1",
            challengeId: "chal_123",
         });
         expect(result.success).toBe(true);

         const toPersonal = updateTaskSchema.safeParse({
            taskId: "task_1",
            challengeId: null,
         });
         expect(toPersonal.success).toBe(true);
      });

      it("accepts dueDate update", () => {
         const result = updateTaskSchema.safeParse({
            taskId: "task_1",
            dueDate: "2026-10-08",
         });
         expect(result.success).toBe(true);
         if (result.success) {
            expect(result.data.dueDate).toBe("2026-10-08");
         }
      });

      it("rejects when neither title, isComplete, status, dueDate, nor challengeId is provided", () => {
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

   describe("rolloverTasksSchema", () => {
      it("accepts valid taskIds and targetDateKey", () => {
         const result = rolloverTasksSchema.safeParse({
            taskIds: ["task_1", "task_2"],
            targetDateKey: "2026-10-26",
         });
         expect(result.success).toBe(true);
      });

      it("rejects empty taskIds array", () => {
         const result = rolloverTasksSchema.safeParse({
            taskIds: [],
            targetDateKey: "2026-10-26",
         });
         expect(result.success).toBe(false);
      });

      it("rejects invalid targetDateKey format", () => {
         const result = rolloverTasksSchema.safeParse({
            taskIds: ["task_1"],
            targetDateKey: "10-26-2026",
         });
         expect(result.success).toBe(false);
      });
   });
});
