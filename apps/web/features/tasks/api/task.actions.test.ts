import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/features/auth/api/require-session";
import {
   createCategoryAction,
   createTaskAction,
   deleteCategoryAction,
   deleteTaskAction,
   toggleTaskAction,
   updateCategoryAction,
   updateTaskAction,
} from "./task.actions";
import * as taskRepo from "@/features/tasks/data/task.repository";
import * as sessionModule from "@/features/auth/api/require-session";

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
   revalidateTag: vi.fn(),
}));

vi.mock("@/features/auth/api/require-session", () => ({
   AuthError: class AuthError extends Error {},
   requireSessionUser: vi.fn(),
}));

vi.mock("@/features/tasks/data/task.repository", () => ({
   createTask: vi.fn(),
   toggleTask: vi.fn(),
   deleteTask: vi.fn(),
   createCategory: vi.fn(),
   updateTask: vi.fn(),
   updateCategory: vi.fn(),
   deleteCategory: vi.fn(),
}));

describe("task.actions", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   describe("createTaskAction", () => {
      it("creates task when session user is present and input is valid", async () => {
         vi.mocked(sessionModule.requireSessionUser).mockResolvedValue({
            id: "user_1",
         } as never);
         vi.mocked(taskRepo.createTask).mockResolvedValue({
            id: "t_1",
            title: "Study notes",
         } as never);

         const result = await createTaskAction({
            title: "Study notes",
            taskType: "DAILY",
            categoryId: "cat_1",
         });

         expect(result.ok).toBe(true);
         expect(taskRepo.createTask).toHaveBeenCalledWith(
            expect.objectContaining({
               userId: "user_1",
               title: "Study notes",
               taskType: "DAILY",
               categoryId: "cat_1",
            })
         );
      });

      it("passes dueDate to createTask when provided", async () => {
         vi.mocked(sessionModule.requireSessionUser).mockResolvedValue({
            id: "user_1",
         } as never);
         vi.mocked(taskRepo.createTask).mockResolvedValue({
            id: "t_1",
            title: "Study notes",
         } as never);

         const result = await createTaskAction({
            title: "Study notes",
            taskType: "DAILY",
            categoryId: "cat_1",
            dueDate: "2026-10-06",
         });

         expect(result.ok).toBe(true);
         expect(taskRepo.createTask).toHaveBeenCalledWith(
            expect.objectContaining({
               dueDate: "2026-10-06",
            })
         );
      });

      it("returns UNAUTHORIZED when no session", async () => {
         vi.mocked(sessionModule.requireSessionUser).mockRejectedValue(
            new AuthError("Sign in required.")
         );

         const result = await createTaskAction({
            title: "Study notes",
            taskType: "DAILY",
            categoryId: "cat_1",
         });

         expect(result.ok).toBe(false);
         expect(result.code).toBe("UNAUTHORIZED");
      });

      it("returns INVALID_INPUT when validation fails", async () => {
         vi.mocked(sessionModule.requireSessionUser).mockResolvedValue({
            id: "user_1",
         } as never);

         const result = await createTaskAction({
            title: "   ",
            taskType: "DAILY",
            categoryId: "cat_1",
         });

         expect(result.ok).toBe(false);
         expect(result.code).toBe("INVALID_INPUT");
      });
   });

   describe("toggleTaskAction", () => {
      it("toggles task completion successfully", async () => {
         vi.mocked(sessionModule.requireSessionUser).mockResolvedValue({
            id: "user_1",
         } as never);
         vi.mocked(taskRepo.toggleTask).mockResolvedValue({
            id: "t_1",
            isComplete: true,
         } as never);

         const result = await toggleTaskAction({
            taskId: "t_1",
            isComplete: true,
         });

         expect(result.ok).toBe(true);
         expect(taskRepo.toggleTask).toHaveBeenCalledWith({
            taskId: "t_1",
            userId: "user_1",
            isComplete: true,
         });
      });

      it("returns NOT_FOUND if task does not belong to user", async () => {
         vi.mocked(sessionModule.requireSessionUser).mockResolvedValue({
            id: "user_1",
         } as never);
         vi.mocked(taskRepo.toggleTask).mockResolvedValue(null);

         const result = await toggleTaskAction({
            taskId: "t_other",
            isComplete: true,
         });

         expect(result.ok).toBe(false);
         expect(result.code).toBe("NOT_FOUND");
      });
   });

   describe("deleteTaskAction", () => {
      it("deletes task successfully", async () => {
         vi.mocked(sessionModule.requireSessionUser).mockResolvedValue({
            id: "user_1",
         } as never);
         vi.mocked(taskRepo.deleteTask).mockResolvedValue({
            id: "t_1",
         } as never);

         const result = await deleteTaskAction({
            taskId: "t_1",
         });

         expect(result.ok).toBe(true);
      });
   });

   describe("createCategoryAction", () => {
      it("creates category successfully defaulting taskType to DAILY", () => {
         vi.mocked(sessionModule.requireSessionUser).mockResolvedValue({
            id: "user_1",
         } as never);
         vi.mocked(taskRepo.createCategory).mockResolvedValue({
            id: "cat_1",
            name: "History",
            taskType: "DAILY",
         } as never);

         return createCategoryAction({
            name: "History",
         }).then((result) => {
            expect(result.ok).toBe(true);
            expect(taskRepo.createCategory).toHaveBeenCalledWith({
               userId: "user_1",
               name: "History",
               taskType: "DAILY",
            });
         });
      });

      it("creates category successfully with explicit WEEKLY taskType", async () => {
         vi.mocked(sessionModule.requireSessionUser).mockResolvedValue({
            id: "user_1",
         } as never);
         vi.mocked(taskRepo.createCategory).mockResolvedValue({
            id: "cat_2",
            name: "Sprint Goals",
            taskType: "WEEKLY",
         } as never);

         const result = await createCategoryAction({
            name: "Sprint Goals",
            taskType: "WEEKLY",
         });

         expect(result.ok).toBe(true);
         expect(taskRepo.createCategory).toHaveBeenCalledWith({
            userId: "user_1",
            name: "Sprint Goals",
            taskType: "WEEKLY",
         });
      });
   });

   describe("updateTaskAction", () => {
      it("updates task successfully", async () => {
         vi.mocked(sessionModule.requireSessionUser).mockResolvedValue({
            id: "user_1",
         } as never);
         vi.mocked(taskRepo.updateTask).mockResolvedValue({
            id: "task_1",
            title: "Updated title",
         } as never);

         const result = await updateTaskAction({
            taskId: "task_1",
            title: "Updated title",
         });

         expect(result.ok).toBe(true);
         expect(taskRepo.updateTask).toHaveBeenCalledWith({
            taskId: "task_1",
            userId: "user_1",
            title: "Updated title",
         });
      });

      it("updates task completion status successfully", async () => {
         vi.mocked(sessionModule.requireSessionUser).mockResolvedValue({
            id: "user_1",
         } as never);
         vi.mocked(taskRepo.updateTask).mockResolvedValue({
            id: "task_1",
            isComplete: true,
         } as never);

         const result = await updateTaskAction({
            taskId: "task_1",
            isComplete: true,
         });

         expect(result.ok).toBe(true);
         expect(taskRepo.updateTask).toHaveBeenCalledWith({
            taskId: "task_1",
            userId: "user_1",
            isComplete: true,
         });
      });

      it("passes dueDate to updateTask when provided", async () => {
         vi.mocked(sessionModule.requireSessionUser).mockResolvedValue({
            id: "user_1",
         } as never);
         vi.mocked(taskRepo.updateTask).mockResolvedValue({
            id: "task_1",
            title: "Same title",
         } as never);

         const result = await updateTaskAction({
            taskId: "task_1",
            dueDate: "2026-10-08",
         });

         expect(result.ok).toBe(true);
         expect(taskRepo.updateTask).toHaveBeenCalledWith(
            expect.objectContaining({
               taskId: "task_1",
               dueDate: "2026-10-08",
            })
         );
      });

      it("returns NOT_FOUND when task does not exist", async () => {
         vi.mocked(sessionModule.requireSessionUser).mockResolvedValue({
            id: "user_1",
         } as never);
         vi.mocked(taskRepo.updateTask).mockResolvedValue(null);

         const result = await updateTaskAction({
            taskId: "task_99",
            title: "Updated title",
         });

         expect(result.ok).toBe(false);
         expect(result.code).toBe("NOT_FOUND");
      });
   });

   describe("updateCategoryAction", () => {
      it("updates category name successfully", async () => {
         vi.mocked(sessionModule.requireSessionUser).mockResolvedValue({
            id: "user_1",
         } as never);
         vi.mocked(taskRepo.updateCategory).mockResolvedValue({
            id: "cat_1",
            name: "Renamed Cat",
         } as never);

         const result = await updateCategoryAction({
            categoryId: "cat_1",
            name: "Renamed Cat",
         });

         expect(result.ok).toBe(true);
         expect(taskRepo.updateCategory).toHaveBeenCalledWith({
            categoryId: "cat_1",
            userId: "user_1",
            name: "Renamed Cat",
         });
      });

      it("returns CONFLICT if duplicate name error thrown", async () => {
         vi.mocked(sessionModule.requireSessionUser).mockResolvedValue({
            id: "user_1",
         } as never);
         vi.mocked(taskRepo.updateCategory).mockRejectedValue(
            new Error('Category "Renamed Cat" already exists.')
         );

         const result = await updateCategoryAction({
            categoryId: "cat_1",
            name: "Renamed Cat",
         });

         expect(result.ok).toBe(false);
         expect(result.code).toBe("CONFLICT");
         expect(result.message).toContain("already exists");
      });
   });

   describe("deleteCategoryAction", () => {
      it("deletes category successfully", async () => {
         vi.mocked(sessionModule.requireSessionUser).mockResolvedValue({
            id: "user_1",
         } as never);
         vi.mocked(taskRepo.deleteCategory).mockResolvedValue({
            id: "cat_del",
         } as never);

         const result = await deleteCategoryAction({
            categoryId: "cat_del",
         });

         expect(result.ok).toBe(true);
         expect(taskRepo.deleteCategory).toHaveBeenCalledWith({
            categoryId: "cat_del",
            userId: "user_1",
         });
      });

      it("returns NOT_FOUND if category does not exist", async () => {
         vi.mocked(sessionModule.requireSessionUser).mockResolvedValue({
            id: "user_1",
         } as never);
         vi.mocked(taskRepo.deleteCategory).mockResolvedValue(null);

         const result = await deleteCategoryAction({
            categoryId: "cat_missing",
         });

         expect(result.ok).toBe(false);
         expect(result.code).toBe("NOT_FOUND");
      });
   });
});
