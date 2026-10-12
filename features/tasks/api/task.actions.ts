"use server";

import { revalidatePath } from "next/cache";
import { cacheTags, invalidateTags } from "@/core/cache";
import {
   AuthError,
   requireSessionUser,
} from "@/features/auth/api/require-session";
import {
   createCategorySchema,
   createTaskSchema,
   deleteCategorySchema,
   deleteTaskSchema,
   toggleTaskSchema,
   updateCategorySchema,
   updateTaskSchema,
   type CreateCategoryInput,
   type CreateTaskInput,
   type DeleteCategoryInput,
   type DeleteTaskInput,
   type ToggleTaskInput,
   type UpdateCategoryInput,
   type UpdateTaskInput,
} from "@/features/tasks/domain/task.validation";
import {
   createCategory,
   createTask,
   deleteCategory,
   deleteTask,
   toggleTask,
   updateCategory,
   updateTask,
} from "@/features/tasks/data/task.repository";
import { createLogger, logEvents } from "@/core/observability/logger";

const logger = createLogger("task");

export interface TaskActionResult<T = unknown> {
   ok: boolean;
   message?: string;
   code?: string;
   data?: T;
}

function invalidateUserTaskCache(userId: string): void {
   invalidateTags([cacheTags.userTasks(userId)]);
}

export async function createTaskAction(
   input: CreateTaskInput
): Promise<TaskActionResult> {
   try {
      const user = await requireSessionUser();
      const parsed = createTaskSchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: parsed.error.issues[0]?.message || "Invalid task input.",
         };
      }

      const task = await createTask({
         userId: user.id,
         title: parsed.data.title,
         taskType: parsed.data.taskType,
         categoryId: parsed.data.categoryId,
         newCategoryName: parsed.data.newCategoryName,
         isComplete: parsed.data.isComplete,
         status: parsed.data.status,
         dueDate: parsed.data.dueDate,
      });

      revalidatePath("/");
      revalidatePath("/dashboard");
      invalidateUserTaskCache(user.id);
      logger.info(logEvents.taskCreated, {
         context: { userId: user.id, taskId: task.id },
      });
      return { ok: true, data: task };
   } catch (error) {
      if (error instanceof AuthError) {
         logger.debug(logEvents.taskCreated, {
            context: { code: "UNAUTHORIZED" },
            error,
         });
         return { ok: false, code: "UNAUTHORIZED", message: error.message };
      }
      logger.error(logEvents.taskCreated, { error });
      return {
         ok: false,
         code: "PERSISTENCE_ERROR",
         message: "Could not create task. Please try again.",
      };
   }
}

export async function toggleTaskAction(
   input: ToggleTaskInput
): Promise<TaskActionResult> {
   try {
      const user = await requireSessionUser();
      const parsed = toggleTaskSchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: parsed.error.issues[0]?.message || "Invalid task update.",
         };
      }

      const updated = await toggleTask({
         taskId: parsed.data.taskId,
         userId: user.id,
         isComplete: parsed.data.isComplete,
         status: parsed.data.status,
      });

      if (!updated) {
         logger.debug(logEvents.taskToggled, {
            context: {
               userId: user.id,
               taskId: parsed.data.taskId,
               code: "NOT_FOUND",
            },
         });
         return {
            ok: false,
            code: "NOT_FOUND",
            message: "Task not found or access denied.",
         };
      }

      revalidatePath("/");
      revalidatePath("/dashboard");
      invalidateUserTaskCache(user.id);
      logger.info(logEvents.taskToggled, {
         context: {
            userId: user.id,
            taskId: parsed.data.taskId,
            isComplete: parsed.data.isComplete,
         },
      });
      return { ok: true, data: updated };
   } catch (error) {
      if (error instanceof AuthError) {
         logger.debug(logEvents.taskToggled, {
            context: { code: "UNAUTHORIZED" },
            error,
         });
         return { ok: false, code: "UNAUTHORIZED", message: error.message };
      }
      logger.error(logEvents.taskToggled, { error });
      return {
         ok: false,
         code: "PERSISTENCE_ERROR",
         message: "Could not update task.",
      };
   }
}

export async function deleteTaskAction(
   input: DeleteTaskInput
): Promise<TaskActionResult> {
   try {
      const user = await requireSessionUser();
      const parsed = deleteTaskSchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: parsed.error.issues[0]?.message || "Invalid task id.",
         };
      }

      const deleted = await deleteTask({
         taskId: parsed.data.taskId,
         userId: user.id,
      });

      if (!deleted) {
         logger.debug(logEvents.taskDeleted, {
            context: {
               userId: user.id,
               taskId: parsed.data.taskId,
               code: "NOT_FOUND",
            },
         });
         return {
            ok: false,
            code: "NOT_FOUND",
            message: "Task not found or access denied.",
         };
      }

      revalidatePath("/");
      revalidatePath("/dashboard");
      invalidateUserTaskCache(user.id);
      logger.info(logEvents.taskDeleted, {
         context: { userId: user.id, taskId: parsed.data.taskId },
      });
      return { ok: true };
   } catch (error) {
      if (error instanceof AuthError) {
         logger.debug(logEvents.taskDeleted, {
            context: { code: "UNAUTHORIZED" },
            error,
         });
         return { ok: false, code: "UNAUTHORIZED", message: error.message };
      }
      logger.error(logEvents.taskDeleted, { error });
      return {
         ok: false,
         code: "PERSISTENCE_ERROR",
         message: "Could not delete task.",
      };
   }
}

export async function createCategoryAction(
   input: CreateCategoryInput
): Promise<TaskActionResult> {
   try {
      const user = await requireSessionUser();
      const parsed = createCategorySchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message:
               parsed.error.issues[0]?.message || "Invalid category name.",
         };
      }

      const category = await createCategory({
         userId: user.id,
         name: parsed.data.name,
         taskType: parsed.data.taskType,
      });

      revalidatePath("/");
      revalidatePath("/dashboard");
      invalidateUserTaskCache(user.id);
      logger.info(logEvents.taskCategoryCreated, {
         context: { userId: user.id, categoryId: category.id },
      });
      return { ok: true, data: category };
   } catch (error) {
      if (error instanceof AuthError) {
         logger.debug(logEvents.taskCategoryCreated, {
            context: { code: "UNAUTHORIZED" },
            error,
         });
         return { ok: false, code: "UNAUTHORIZED", message: error.message };
      }
      logger.error(logEvents.taskCategoryCreated, { error });
      return {
         ok: false,
         code: "PERSISTENCE_ERROR",
         message: "Could not create category.",
      };
   }
}

export async function updateTaskAction(
   input: UpdateTaskInput
): Promise<TaskActionResult> {
   try {
      const user = await requireSessionUser();
      const parsed = updateTaskSchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: parsed.error.issues[0]?.message || "Invalid task input.",
         };
      }

      const updated = await updateTask({
         taskId: parsed.data.taskId,
         userId: user.id,
         title: parsed.data.title,
         isComplete: parsed.data.isComplete,
         status: parsed.data.status,
         dueDate: parsed.data.dueDate,
      });

      if (!updated) {
         logger.debug(logEvents.taskUpdated, {
            context: {
               userId: user.id,
               taskId: parsed.data.taskId,
               code: "NOT_FOUND",
            },
         });
         return {
            ok: false,
            code: "NOT_FOUND",
            message: "Task not found or access denied.",
         };
      }

      revalidatePath("/");
      revalidatePath("/dashboard");
      invalidateUserTaskCache(user.id);
      logger.info(logEvents.taskUpdated, {
         context: { userId: user.id, taskId: parsed.data.taskId },
      });
      return { ok: true, data: updated };
   } catch (error) {
      if (error instanceof AuthError) {
         logger.debug(logEvents.taskUpdated, {
            context: { code: "UNAUTHORIZED" },
            error,
         });
         return { ok: false, code: "UNAUTHORIZED", message: error.message };
      }
      logger.error(logEvents.taskUpdated, { error });
      return {
         ok: false,
         code: "PERSISTENCE_ERROR",
         message: "Could not update task.",
      };
   }
}

export async function updateCategoryAction(
   input: UpdateCategoryInput
): Promise<TaskActionResult> {
   try {
      const user = await requireSessionUser();
      const parsed = updateCategorySchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message:
               parsed.error.issues[0]?.message || "Invalid category input.",
         };
      }

      const updated = await updateCategory({
         categoryId: parsed.data.categoryId,
         userId: user.id,
         name: parsed.data.name,
      });

      if (!updated) {
         logger.debug(logEvents.taskCategoryUpdated, {
            context: {
               userId: user.id,
               categoryId: parsed.data.categoryId,
               code: "NOT_FOUND",
            },
         });
         return {
            ok: false,
            code: "NOT_FOUND",
            message: "Category not found or access denied.",
         };
      }

      revalidatePath("/");
      revalidatePath("/dashboard");
      invalidateUserTaskCache(user.id);
      logger.info(logEvents.taskCategoryUpdated, {
         context: { userId: user.id, categoryId: parsed.data.categoryId },
      });
      return { ok: true, data: updated };
   } catch (error) {
      if (error instanceof AuthError) {
         logger.debug(logEvents.taskCategoryUpdated, {
            context: { code: "UNAUTHORIZED" },
            error,
         });
         return { ok: false, code: "UNAUTHORIZED", message: error.message };
      }
      if (error instanceof Error && error.message.includes("already exists")) {
         logger.debug(logEvents.taskCategoryUpdated, {
            context: {
               categoryId: input?.categoryId,
               code: "CONFLICT",
            },
            error,
         });
         return {
            ok: false,
            code: "CONFLICT",
            message: error.message,
         };
      }
      logger.error(logEvents.taskCategoryUpdated, { error });
      return {
         ok: false,
         code: "PERSISTENCE_ERROR",
         message: "Could not update category.",
      };
   }
}

export async function deleteCategoryAction(
   input: DeleteCategoryInput
): Promise<TaskActionResult> {
   try {
      const user = await requireSessionUser();
      const parsed = deleteCategorySchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: parsed.error.issues[0]?.message || "Invalid category ID.",
         };
      }

      const deleted = await deleteCategory({
         categoryId: parsed.data.categoryId,
         userId: user.id,
      });

      if (!deleted) {
         logger.debug(logEvents.taskCategoryDeleted, {
            context: {
               userId: user.id,
               categoryId: parsed.data.categoryId,
               code: "NOT_FOUND",
            },
         });
         return {
            ok: false,
            code: "NOT_FOUND",
            message: "Category not found or access denied.",
         };
      }

      revalidatePath("/");
      revalidatePath("/dashboard");
      invalidateUserTaskCache(user.id);
      logger.info(logEvents.taskCategoryDeleted, {
         context: { userId: user.id, categoryId: parsed.data.categoryId },
      });
      return { ok: true };
   } catch (error) {
      if (error instanceof AuthError) {
         logger.debug(logEvents.taskCategoryDeleted, {
            context: { code: "UNAUTHORIZED" },
            error,
         });
         return { ok: false, code: "UNAUTHORIZED", message: error.message };
      }
      logger.error(logEvents.taskCategoryDeleted, { error });
      return {
         ok: false,
         code: "PERSISTENCE_ERROR",
         message: "Could not delete category.",
      };
   }
}
