import { z } from "zod";

export const taskTypeSchema = z.enum(["DAILY", "WEEKLY"]);

export const taskStatusSchema = z.enum([
   "TODO",
   "IN_PROGRESS",
   "COMPLETED",
   "CROSSED_OUT",
]);

export const createTaskSchema = z
   .object({
      title: z
         .string()
         .trim()
         .min(1, "Task title cannot be empty.")
         .max(255, "Task title cannot exceed 255 characters."),
      taskType: taskTypeSchema,
      categoryId: z.string().trim().min(1).optional(),
      newCategoryName: z
         .string()
         .trim()
         .min(1, "Category name cannot be empty.")
         .max(100, "Category name cannot exceed 100 characters.")
         .optional(),
      isComplete: z.boolean().optional(),
      status: taskStatusSchema.optional(),
      dueDate: z
         .string()
         .trim()
         .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be in YYYY-MM-DD format.")
         .nullable()
         .optional(),
   })
   .refine((data) => Boolean(data.categoryId || data.newCategoryName), {
      message:
         "Either an existing category or a new category name must be provided.",
      path: ["categoryId"],
   });

export const toggleTaskSchema = z
   .object({
      taskId: z.string().trim().min(1, "Task ID is required."),
      isComplete: z.boolean().optional(),
      status: taskStatusSchema.optional(),
   })
   .refine(
      (data) => data.isComplete !== undefined || data.status !== undefined,
      {
         message: "Either isComplete or status must be provided.",
      }
   );

export const deleteTaskSchema = z.object({
   taskId: z.string().trim().min(1, "Task ID is required."),
});

export const createCategorySchema = z.object({
   name: z
      .string()
      .trim()
      .min(1, "Category name cannot be empty.")
      .max(100, "Category name cannot exceed 100 characters."),
   taskType: taskTypeSchema.default("DAILY"),
});

export const updateTaskSchema = z
   .object({
      taskId: z.string().trim().min(1, "Task ID is required."),
      title: z
         .string()
         .trim()
         .min(1, "Task title cannot be empty.")
         .max(255, "Task title cannot exceed 255 characters.")
         .optional(),
      isComplete: z.boolean().optional(),
      status: taskStatusSchema.optional(),
      dueDate: z
         .string()
         .trim()
         .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be in YYYY-MM-DD format.")
         .nullable()
         .optional(),
   })
   .refine(
      (data) =>
         data.title !== undefined ||
         data.isComplete !== undefined ||
         data.status !== undefined ||
         data.dueDate !== undefined,
      {
         message:
            "Either title, isComplete, status, or dueDate must be provided.",
      }
   );

export const updateCategorySchema = z.object({
   categoryId: z.string().trim().min(1, "Category ID is required."),
   name: z
      .string()
      .trim()
      .min(1, "Category name cannot be empty.")
      .max(100, "Category name cannot exceed 100 characters."),
   taskType: taskTypeSchema.optional(),
});

export const deleteCategorySchema = z.object({
   categoryId: z.string().trim().min(1, "Category ID is required."),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type ToggleTaskInput = z.infer<typeof toggleTaskSchema>;
export type DeleteTaskInput = z.infer<typeof deleteTaskSchema>;
export type CreateCategoryInput = z.input<typeof createCategorySchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>;
