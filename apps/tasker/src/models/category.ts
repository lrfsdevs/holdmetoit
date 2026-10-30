import type { Category, TaskType } from "@prisma/client";
import { prisma } from "../db.js";

export type { Category };

export const DEFAULT_CATEGORY_NAME = "Default";
const DEFAULT_TASK_TYPE: TaskType = "DAILY";

export class DuplicateCategoryError extends Error {
   constructor(name: string) {
      super(`Category "${name}" already exists.`);
      this.name = "DuplicateCategoryError";
   }
}

export class DefaultCategoryDeletionError extends Error {
   constructor() {
      super("The Default category cannot be deleted.");
      this.name = "DefaultCategoryDeletionError";
   }
}

export async function createCategory(
   userId: string,
   name: string
): Promise<Category> {
   const existing = await prisma.category.findFirst({
      where: {
         userId,
         name: { equals: name, mode: "insensitive" },
         taskType: DEFAULT_TASK_TYPE,
      },
   });

   if (existing) {
      if (!existing.isDeleted) throw new DuplicateCategoryError(name);
      return prisma.category.update({
         where: { id: existing.id },
         data: { name, isDeleted: false, deletionTime: null },
      });
   }

   return prisma.category.create({
      data: { userId, name, taskType: DEFAULT_TASK_TYPE },
   });
}

export async function getCategories(userId: string): Promise<Category[]> {
   return prisma.category.findMany({
      where: { userId, isDeleted: false },
      orderBy: { createdAt: "desc" },
   });
}

export async function getCategoryByName(
   userId: string,
   name: string
): Promise<Category | null> {
   if (!name) return null;
   return prisma.category.findFirst({
      where: {
         userId,
         isDeleted: false,
         name: { equals: name, mode: "insensitive" },
      },
   });
}

export async function getOrCreateDefaultCategory(
   userId: string
): Promise<Category> {
   const existing = await getCategoryByName(userId, DEFAULT_CATEGORY_NAME);
   if (existing) return existing;
   return createCategory(userId, DEFAULT_CATEGORY_NAME);
}

export async function getCategoryById(
   categoryId: string,
   userId: string
): Promise<Category | null> {
   return prisma.category.findFirst({
      where: { id: categoryId, userId, isDeleted: false },
   });
}

export async function categoryExists(
   userId: string,
   name: string
): Promise<boolean> {
   return (await getCategoryByName(userId, name)) !== null;
}

/**
 * Soft-deletes a category and moves its tasks to the user's Default category.
 * The shared schema requires `Task.categoryId`, so tasks can never be orphaned.
 */
export async function deleteCategory(categoryId: string): Promise<boolean> {
   const category = await prisma.category.findUnique({
      where: { id: categoryId },
   });
   if (!category || category.isDeleted) return false;

   if (category.name.toLowerCase() === DEFAULT_CATEGORY_NAME.toLowerCase()) {
      throw new DefaultCategoryDeletionError();
   }

   const fallback = await getOrCreateDefaultCategory(category.userId);

   await prisma.$transaction([
      prisma.task.updateMany({
         where: { categoryId, userId: category.userId },
         data: { categoryId: fallback.id },
      }),
      prisma.category.update({
         where: { id: categoryId },
         data: { isDeleted: true, deletionTime: new Date() },
      }),
   ]);

   return true;
}

export async function updateCategoryName(
   userId: string,
   oldName: string,
   newName: string
): Promise<boolean> {
   const category = await getCategoryByName(userId, oldName);
   if (!category) return false;

   const conflict = await prisma.category.findFirst({
      where: {
         userId,
         taskType: category.taskType,
         name: { equals: newName, mode: "insensitive" },
         NOT: { id: category.id },
      },
   });
   if (conflict) throw new DuplicateCategoryError(newName);

   await prisma.category.update({
      where: { id: category.id },
      data: { name: newName },
   });
   return true;
}
