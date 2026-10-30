import { PrismaClient, type TaskStatus, type TaskType } from "@prisma/client";
import {
   DEFAULT_CATEGORY_NAME,
   getOrCreateDefaultCategory,
} from "../models/category.js";
import { env } from "../config/env.js";
import { prisma } from "../db.js";

interface SourceCategory {
   id: string;
   userId: string;
   name: string;
   taskType: string;
   isDeleted: boolean;
   deletionTime: Date | null;
   createdAt: Date;
   updatedAt: Date;
}

interface SourceTask {
   id: string;
   userId: string;
   categoryId: string | null;
   title: string;
   taskType: string;
   sortOrder: number;
   isComplete: boolean;
   status: string;
   dueDate: Date | null;
   isDeleted: boolean;
   deletionTime: Date | null;
   createdAt: Date;
   updatedAt: Date;
   completedAt: Date | null;
}

const CHUNK_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
   const chunks: T[][] = [];
   for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
   }
   return chunks;
}

async function main() {
   const apply = process.argv.includes("--apply");
   const sourceUrl = env.TASKER_SOURCE_DATABASE_URL;

   if (!sourceUrl) {
      throw new Error(
         "TASKER_SOURCE_DATABASE_URL is required to run the backfill."
      );
   }

   const source = new PrismaClient({
      datasources: { db: { url: sourceUrl } },
   });

   try {
      const [sourceCategories, sourceTasks] = await Promise.all([
         source.$queryRawUnsafe<SourceCategory[]>(
            `SELECT id, "userId", name, "taskType", "isDeleted", "deletionTime", "createdAt", "updatedAt" FROM "Category" ORDER BY "createdAt" ASC`
         ),
         source.$queryRawUnsafe<SourceTask[]>(
            `SELECT id, "userId", "categoryId", title, "taskType", "sortOrder", "isComplete", status, "dueDate", "isDeleted", "deletionTime", "createdAt", "updatedAt", "completedAt" FROM "Task" ORDER BY "createdAt" ASC`
         ),
      ]);

      if (!sourceUrl || (!sourceCategories.length && !sourceTasks.length)) {
         console.log("No legacy Tasker rows found. Nothing to backfill.");
         return;
      }

      const snowflakes = [
         ...new Set(
            [...sourceCategories, ...sourceTasks].map((row) => row.userId)
         ),
      ];

      const usersByDiscordId = new Map<string, string>();
      for (const batch of chunk(snowflakes, CHUNK_SIZE)) {
         const users = await prisma.user.findMany({
            where: { discordId: { in: batch } },
            select: { id: true, discordId: true },
         });
         for (const user of users) {
            if (user.discordId) usersByDiscordId.set(user.discordId, user.id);
         }
      }

      const unknown = snowflakes.filter(
         (snowflake) => !usersByDiscordId.has(snowflake)
      );

      console.log(
         `Found ${sourceCategories.length} categories and ${sourceTasks.length} tasks for ${snowflakes.length} Discord users.`
      );
      console.log(
         `Mapped ${usersByDiscordId.size} users to web accounts; ${unknown.length} have never signed in.`
      );
      if (unknown.length > 0) {
         console.log(`Unmapped snowflakes: ${unknown.slice(0, 10).join(", ")}`);
      }

      const categoryIdMap = new Map<string, string>();
      let categoriesCreated = 0;
      let categoriesReused = 0;

      for (const row of sourceCategories) {
         const userId = usersByDiscordId.get(row.userId);
         if (!userId) continue;

         const taskType = row.taskType as TaskType;
         let target = await prisma.category.findFirst({
            where: {
               userId,
               taskType,
               name: { equals: row.name, mode: "insensitive" },
            },
         });

         if (target) {
            categoriesReused++;
            if (target.isDeleted) {
               target = await prisma.category.update({
                  where: { id: target.id },
                  data: { isDeleted: false, deletionTime: null },
               });
            }
         } else {
            categoriesCreated++;
            target = await prisma.category.create({
               data: {
                  userId,
                  name: row.name,
                  taskType,
                  isDeleted: row.isDeleted,
                  deletionTime: row.deletionTime,
                  createdAt: row.createdAt,
                  updatedAt: row.updatedAt,
               },
            });
         }

         categoryIdMap.set(row.id, target.id);
      }

      let tasksCreated = 0;
      let tasksSkipped = 0;
      let tasksWithoutUser = 0;

      for (const row of sourceTasks) {
         const userId = usersByDiscordId.get(row.userId);
         if (!userId) {
            tasksWithoutUser++;
            continue;
         }

         const duplicate = await prisma.task.findFirst({
            where: { userId, title: row.title, createdAt: row.createdAt },
            select: { id: true },
         });
         if (duplicate) {
            tasksSkipped++;
            continue;
         }

         const mappedCategoryId = row.categoryId
            ? categoryIdMap.get(row.categoryId)
            : undefined;
         const categoryId =
            mappedCategoryId ?? (await getOrCreateDefaultCategory(userId)).id;

         if (apply) {
            await prisma.task.create({
               data: {
                  userId,
                  categoryId,
                  challengeId: null,
                  title: row.title,
                  taskType: row.taskType as TaskType,
                  sortOrder: row.sortOrder,
                  isComplete: row.isComplete,
                  status: row.status as TaskStatus,
                  dueDate: row.dueDate,
                  isDeleted: row.isDeleted,
                  deletionTime: row.deletionTime,
                  createdAt: row.createdAt,
                  updatedAt: row.updatedAt,
                  completedAt: row.completedAt,
               },
            });
         }

         tasksCreated++;
      }

      console.log("");
      console.log(
         apply ? "Backfill applied." : "Dry run (pass --apply to write)."
      );
      console.log(
         `Categories: ${categoriesCreated} created, ${categoriesReused} reused.`
      );
      console.log(
         `Tasks: ${tasksCreated} ${apply ? "created" : "would be created"}, ${tasksSkipped} already present, ${tasksWithoutUser} skipped (no web account).`
      );
      console.log(`Default category: ${DEFAULT_CATEGORY_NAME}`);
   } finally {
      await source.$disconnect();
      await prisma.$disconnect();
   }
}

main().catch((error) => {
   console.error("Backfill failed:", error);
   process.exit(1);
});
