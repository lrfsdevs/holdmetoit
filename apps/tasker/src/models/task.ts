import type { Task, TaskType } from "@prisma/client";
import { prisma } from "../db.js";

export type { Task };

export type TaskStatusInput = "pending" | "completed";

const DEFAULT_TASK_TYPE: TaskType = "DAILY";

export async function createTask(
   userId: string,
   content: string,
   categoryId: string,
   taskType: TaskType = DEFAULT_TASK_TYPE
): Promise<Task> {
   return prisma.task.create({
      data: {
         userId,
         title: content,
         categoryId,
         taskType,
         status: "TODO",
         isComplete: false,
      },
   });
}

export async function updateTaskStatus(
   taskId: string,
   userId: string,
   status: TaskStatusInput
): Promise<Task | null> {
   const isCompleted = status === "completed";

   const { count } = await prisma.task.updateMany({
      where: { id: taskId, userId, challengeId: null, isDeleted: false },
      data: isCompleted
         ? { status: "COMPLETED", isComplete: true, completedAt: new Date() }
         : { status: "TODO", isComplete: false, completedAt: null },
   });

   if (count === 0) return null;

   return prisma.task.findFirst({
      where: { id: taskId, userId, challengeId: null, isDeleted: false },
   });
}

/**
 * Bot-visible tasks: today's tasks plus unfinished older ones.
 * Scoped to `challengeId: null` so bot CRUD never mutates challenge-linked
 * weekly goals (Law L6 accountability inputs).
 */
export async function getTasks(userId: string): Promise<Task[]> {
   const today = new Date();
   today.setHours(0, 0, 0, 0);
   const tomorrow = new Date(today);
   tomorrow.setDate(tomorrow.getDate() + 1);

   return prisma.task.findMany({
      where: {
         userId,
         challengeId: null,
         isDeleted: false,
         OR: [
            { createdAt: { gte: today, lt: tomorrow } },
            { createdAt: { lt: today }, status: "TODO" },
            { updatedAt: { gte: today }, status: "COMPLETED" },
         ],
      },
      orderBy: [{ createdAt: "asc" }, { updatedAt: "asc" }],
   });
}

export async function deleteTask(
   taskId: string,
   userId: string
): Promise<boolean> {
   const { count } = await prisma.task.updateMany({
      where: { id: taskId, userId, challengeId: null, isDeleted: false },
      data: { isDeleted: true, deletionTime: new Date() },
   });
   return count > 0;
}

export async function updateTaskContent(
   taskId: string,
   userId: string,
   content: string,
   categoryId?: string
): Promise<Task | null> {
   const { count } = await prisma.task.updateMany({
      where: { id: taskId, userId, challengeId: null, isDeleted: false },
      data: {
         title: content,
         ...(categoryId !== undefined ? { categoryId } : {}),
      },
   });

   if (count === 0) return null;

   return prisma.task.findFirst({
      where: { id: taskId, userId, challengeId: null, isDeleted: false },
   });
}

export async function getTaskById(
   taskId: string,
   userId: string
): Promise<Task | null> {
   return prisma.task.findFirst({
      where: { id: taskId, userId, challengeId: null, isDeleted: false },
   });
}
