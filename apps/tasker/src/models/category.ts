import { Prisma, type Category, type TaskType } from "@prisma/client";
import { buildCategoryTombstoneName } from "@holdmetoit/database";
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
   const normalized = name.trim();

   const live = await prisma.category.findFirst({
      where: {
         userId,
         taskType: DEFAULT_TASK_TYPE,
         isDeleted: false,
         name: { equals: normalized, mode: "insensitive" },
      },
   });

   if (live) throw new DuplicateCategoryError(normalized);

   const tombstoned = await prisma.category.findFirst({
      where: {
         userId,
         taskType: DEFAULT_TASK_TYPE,
         isDeleted: true,
         name: { equals: normalized, mode: "insensitive" },
      },
      orderBy: { updatedAt: "desc" },
   });

   try {
      if (tombstoned) {
         return await prisma.category.update({
            where: { id: tombstoned.id },
            data: { name: normalized, isDeleted: false, deletionTime: null },
         });
      }

      return await prisma.category.create({
         data: { userId, name: normalized, taskType: DEFAULT_TASK_TYPE },
      });
   } catch (error) {
      if (
         error instanceof Prisma.PrismaClientKnownRequestError &&
         error.code === "P2002"
      ) {
         const winner = await prisma.category.findFirst({
            where: {
               userId,
               taskType: DEFAULT_TASK_TYPE,
               isDeleted: false,
               name: { equals: normalized, mode: "insensitive" },
            },
         });
         if (winner) throw new DuplicateCategoryError(normalized);
      }
      throw error;
   }
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
   const category = await prisma.category.findFirst({
      where: { id: categoryId, isDeleted: false },
   });
   if (!category) return false;

   if (category.name.toLowerCase() === DEFAULT_CATEGORY_NAME.toLowerCase()) {
      throw new DefaultCategoryDeletionError();
   }

   const fallback = await getOrCreateDefaultCategory(category.userId);
   const now = new Date();

   await prisma.$transaction([
      prisma.task.updateMany({
         where: {
            categoryId,
            userId: category.userId,
            isDeleted: false,
         },
         data: { categoryId: fallback.id },
      }),
      prisma.category.update({
         where: { id: categoryId },
         data: {
            isDeleted: true,
            deletionTime: now,
            name: buildCategoryTombstoneName(category.name, category.id),
         },
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
         isDeleted: false,
         name: { equals: newName, mode: "insensitive" },
         NOT: { id: category.id },
      },
   });
   if (conflict) throw new DuplicateCategoryError(newName);

   try {
      await prisma.category.update({
         where: { id: category.id },
         data: { name: newName },
      });
   } catch (error) {
      if (
         error instanceof Prisma.PrismaClientKnownRequestError &&
         error.code === "P2002"
      ) {
         throw new DuplicateCategoryError(newName);
      }
      throw error;
   }
   return true;
}
