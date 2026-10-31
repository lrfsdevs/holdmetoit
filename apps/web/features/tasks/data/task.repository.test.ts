import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/core/db";
import {
   createCategory,
   createTask,
   deleteCategory,
   deleteTask,
   getUserCategorizedTasks,
   rolloverIncompleteTasks,
   toggleTask,
   updateCategory,
   updateTask,
} from "./task.repository";

vi.mock("next/cache", () => ({
   unstable_cache: (read: (...args: never[]) => unknown) => read,
}));

vi.mock("@/core/db", () => {
   const mockPrisma = {
      category: {
         findMany: vi.fn(),
         findFirst: vi.fn(),
         create: vi.fn(),
         update: vi.fn(),
         delete: vi.fn(),
      },
      task: {
         create: vi.fn(),
         findFirst: vi.fn(),
         update: vi.fn(),
         updateMany: vi.fn(),
         delete: vi.fn(),
      },
      challengeParticipant: {
         findMany: vi.fn(),
         findFirst: vi.fn(),
      },
      $queryRaw: vi
         .fn()
         .mockResolvedValue([{ resultsLockedAt: null, isDeleted: false }]),
      $transaction: vi.fn((cb) => cb(mockPrisma)),
   };
   return { prisma: mockPrisma };
});

describe("task.repository", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(prisma.challengeParticipant.findMany).mockResolvedValue(
         [] as never
      );
      vi.mocked(prisma.challengeParticipant.findFirst).mockResolvedValue(
         null as never
      );
   });

   describe("getUserCategorizedTasks", () => {
      it("returns strictly segregated daily and weekly categories", async () => {
         const mockCategories = [
            {
               id: "cat_1",
               userId: "user_1",
               name: "Daily Academics",
               taskType: "DAILY",
               createdAt: new Date("2026-10-01"),
               updatedAt: new Date("2026-10-01"),
               tasks: [
                  {
                     id: "t_1",
                     userId: "user_1",
                     categoryId: "cat_1",
                     title: "Daily math review",
                     taskType: "DAILY",
                     isComplete: true,
                     createdAt: new Date("2026-10-01"),
                     updatedAt: new Date("2026-10-01"),
                     completedAt: new Date("2026-10-01"),
                  },
               ],
            },
            {
               id: "cat_2",
               userId: "user_1",
               name: "Weekly Milestones",
               taskType: "WEEKLY",
               createdAt: new Date("2026-10-02"),
               updatedAt: new Date("2026-10-02"),
               tasks: [
                  {
                     id: "t_2",
                     userId: "user_1",
                     categoryId: "cat_2",
                     title: "Weekly physics problem set",
                     taskType: "WEEKLY",
                     isComplete: false,
                     createdAt: new Date("2026-10-02"),
                     updatedAt: new Date("2026-10-02"),
                     completedAt: null,
                  },
               ],
            },
         ];

         vi.mocked(prisma.category.findMany).mockResolvedValue(
            mockCategories as never
         );

         const result = await getUserCategorizedTasks("user_1");

         expect(result.categories).toHaveLength(2);

         // Verify DAILY categories contain only DAILY category and tasks
         expect(result.dailyCategories).toHaveLength(1);
         expect(result.dailyCategories[0].name).toBe("Daily Academics");
         expect(result.dailyCategories[0].tasks).toHaveLength(1);
         expect(result.dailyCategories[0].tasks[0].title).toBe(
            "Daily math review"
         );

         // Verify WEEKLY categories contain only WEEKLY category and tasks
         expect(result.weeklyCategories).toHaveLength(1);
         expect(result.weeklyCategories[0].name).toBe("Weekly Milestones");
         expect(result.weeklyCategories[0].tasks).toHaveLength(1);
         expect(result.weeklyCategories[0].tasks[0].title).toBe(
            "Weekly physics problem set"
         );

         expect(result.totalDailyTasks).toBe(1);
         expect(result.completedDailyTasks).toBe(1);
         expect(result.totalWeeklyTasks).toBe(1);
         expect(result.completedWeeklyTasks).toBe(0);
      });

      it("includes weekly parent categories in dailyCategories when they contain daily tasks", async () => {
         const mockCategories = [
            {
               id: "cat_weekly_parent",
               userId: "user_1",
               name: "Algorithms & DS",
               taskType: "WEEKLY",
               createdAt: new Date("2026-10-01"),
               updatedAt: new Date("2026-10-01"),
               tasks: [
                  {
                     id: "t_w",
                     userId: "user_1",
                     categoryId: "cat_weekly_parent",
                     title: "Solve 15 dynamic programming problems",
                     taskType: "WEEKLY",
                     isComplete: false,
                     createdAt: new Date("2026-10-01"),
                     updatedAt: new Date("2026-10-01"),
                     completedAt: null,
                  },
                  {
                     id: "t_d",
                     userId: "user_1",
                     categoryId: "cat_weekly_parent",
                     title: "Solve 2 DP problems today",
                     taskType: "DAILY",
                     isComplete: true,
                     createdAt: new Date("2026-10-01"),
                     updatedAt: new Date("2026-10-01"),
                     completedAt: new Date("2026-10-01"),
                  },
               ],
            },
         ];

         vi.mocked(prisma.category.findMany).mockResolvedValue(
            mockCategories as never
         );

         const result = await getUserCategorizedTasks("user_1");

         expect(result.dailyCategories).toHaveLength(1);
         expect(result.dailyCategories[0].name).toBe("Algorithms & DS");
         expect(result.dailyCategories[0].tasks).toHaveLength(1);
         expect(result.dailyCategories[0].tasks[0].title).toBe(
            "Solve 2 DP problems today"
         );

         expect(result.weeklyCategories).toHaveLength(1);
         expect(result.weeklyCategories[0].name).toBe("Algorithms & DS");
         expect(result.weeklyCategories[0].tasks).toHaveLength(1);
         expect(result.weeklyCategories[0].tasks[0].title).toBe(
            "Solve 15 dynamic programming problems"
         );
      });

      it("returns empty arrays without seeding default categories if user has no categories", async () => {
         vi.mocked(prisma.category.findMany).mockResolvedValue([] as never);

         const result = await getUserCategorizedTasks("user_new");

         expect(prisma.category.create).not.toHaveBeenCalled();
         expect(result.categories).toHaveLength(0);
         expect(result.dailyCategories).toHaveLength(0);
         expect(result.weeklyCategories).toHaveLength(0);
         expect(result.totalDailyTasks).toBe(0);
         expect(result.totalWeeklyTasks).toBe(0);
      });
   });

   describe("createTask", () => {
      it("creates a task in existing category", async () => {
         const mockCreated = {
            id: "task_new",
            userId: "user_1",
            categoryId: "cat_1",
            title: "Read Chapter 5",
            taskType: "DAILY",
            isComplete: false,
         };

         vi.mocked(prisma.task.create).mockResolvedValue(mockCreated as never);

         const result = await createTask({
            userId: "user_1",
            title: "Read Chapter 5",
            taskType: "DAILY",
            categoryId: "cat_1",
         });

         expect(result).toEqual(mockCreated);
         expect(prisma.task.create).toHaveBeenCalledWith(
            expect.objectContaining({
               data: expect.objectContaining({
                  title: "Read Chapter 5",
                  taskType: "DAILY",
                  categoryId: "cat_1",
               }),
            })
         );
      });

      it("creates task with explicit dueDate", async () => {
         const mockCreated = {
            id: "task_due",
            title: "Read Chapter 6",
            taskType: "DAILY",
            isComplete: false,
            dueDate: new Date("2026-10-06"),
         };

         vi.mocked(prisma.task.create).mockResolvedValue(mockCreated as never);

         await createTask({
            userId: "user_1",
            title: "Read Chapter 6",
            taskType: "DAILY",
            categoryId: "cat_1",
            dueDate: "2026-10-06",
         });

         expect(prisma.task.create).toHaveBeenCalledWith(
            expect.objectContaining({
               data: expect.objectContaining({
                  title: "Read Chapter 6",
                  dueDate: expect.any(Date),
               }),
            })
         );
      });

      it("links a new task to the current challenge when the user is enrolled", async () => {
         vi.mocked(prisma.challengeParticipant.findMany).mockResolvedValue([
            {
               challenge: {
                  id: "c_active",
                  startAt: new Date(Date.now() - 86400000),
                  endAt: new Date(Date.now() + 86400000),
               },
            },
         ] as never);
         vi.mocked(prisma.task.create).mockResolvedValue({
            id: "task_linked",
         } as never);

         await createTask({
            userId: "user_1",
            title: "Linked task",
            taskType: "WEEKLY",
            categoryId: "cat_1",
         });

         expect(prisma.task.create).toHaveBeenCalledWith(
            expect.objectContaining({
               data: expect.objectContaining({ challengeId: "c_active" }),
            })
         );
      });

      it("prefers the active challenge over an upcoming one when both exist", async () => {
         vi.mocked(prisma.challengeParticipant.findMany).mockResolvedValue([
            {
               challenge: {
                  id: "c_upcoming",
                  startAt: new Date(Date.now() + 86400000),
                  endAt: new Date(Date.now() + 8 * 86400000),
               },
            },
            {
               challenge: {
                  id: "c_active",
                  startAt: new Date(Date.now() - 86400000),
                  endAt: new Date(Date.now() + 86400000),
               },
            },
         ] as never);
         vi.mocked(prisma.task.create).mockResolvedValue({
            id: "task_active",
         } as never);

         await createTask({
            userId: "user_1",
            title: "Active link",
            taskType: "WEEKLY",
            categoryId: "cat_1",
         });

         expect(prisma.task.create).toHaveBeenCalledWith(
            expect.objectContaining({
               data: expect.objectContaining({ challengeId: "c_active" }),
            })
         );
      });

      it("uses an explicit challengeId without resolving the current challenge", async () => {
         vi.mocked(prisma.challengeParticipant.findFirst).mockResolvedValue({
            challengeId: "c_explicit",
         } as never);
         vi.mocked(prisma.task.create).mockResolvedValue({
            id: "task_explicit",
         } as never);

         await createTask({
            userId: "user_1",
            title: "Explicit link",
            taskType: "WEEKLY",
            categoryId: "cat_1",
            challengeId: "c_explicit",
         });

         expect(prisma.challengeParticipant.findMany).not.toHaveBeenCalled();
         expect(prisma.task.create).toHaveBeenCalledWith(
            expect.objectContaining({
               data: expect.objectContaining({ challengeId: "c_explicit" }),
            })
         );
      });

      it("rejects a locked challenge when creating a task", async () => {
         vi.mocked(prisma.challengeParticipant.findFirst).mockResolvedValue({
            challengeId: "c_locked",
         } as never);
         vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
            { resultsLockedAt: new Date(), isDeleted: false },
         ] as never);

         await expect(
            createTask({
               userId: "user_1",
               title: "Locked goal",
               taskType: "WEEKLY",
               categoryId: "cat_1",
               challengeId: "c_locked",
            })
         ).rejects.toThrow("task goals can no longer be changed");

         expect(prisma.task.create).not.toHaveBeenCalled();
      });

      it("creates new category if newCategoryName is specified", async () => {
         vi.mocked(prisma.category.findFirst).mockResolvedValue(null);
         vi.mocked(prisma.category.create).mockResolvedValue({
            id: "cat_biology",
            userId: "user_1",
            name: "Biology",
            createdAt: new Date(),
            updatedAt: new Date(),
         } as never);
         vi.mocked(prisma.task.create).mockResolvedValue({
            id: "task_bio",
            userId: "user_1",
            categoryId: "cat_biology",
            title: "Lab Report",
            taskType: "WEEKLY",
         } as never);

         await createTask({
            userId: "user_1",
            title: "Lab Report",
            taskType: "WEEKLY",
            newCategoryName: "Biology",
         });

         expect(prisma.category.create).toHaveBeenCalledWith(
            expect.objectContaining({
               data: { userId: "user_1", name: "Biology", taskType: "WEEKLY" },
            })
         );
         expect(prisma.task.create).toHaveBeenCalledWith(
            expect.objectContaining({
               data: expect.objectContaining({
                  categoryId: "cat_biology",
               }),
            })
         );
      });

      it("inherits parent weekly category when creating a daily task with matching category name", async () => {
         vi.mocked(prisma.category.findFirst)
            .mockResolvedValueOnce(null) // no DAILY category with this name
            .mockResolvedValueOnce({
               id: "cat_weekly_math",
               userId: "user_1",
               name: "Mathematics",
               taskType: "WEEKLY",
            } as never); // found parent WEEKLY category

         vi.mocked(prisma.task.create).mockResolvedValue({
            id: "task_math_daily",
            userId: "user_1",
            categoryId: "cat_weekly_math",
            title: "Calculus Homework",
            taskType: "DAILY",
         } as never);

         await createTask({
            userId: "user_1",
            title: "Calculus Homework",
            taskType: "DAILY",
            newCategoryName: "Mathematics",
         });

         expect(prisma.category.create).not.toHaveBeenCalled();
         expect(prisma.task.create).toHaveBeenCalledWith(
            expect.objectContaining({
               data: expect.objectContaining({
                  categoryId: "cat_weekly_math",
                  taskType: "DAILY",
               }),
            })
         );
      });
   });

   describe("toggleTask", () => {
      it("updates task completion and sets completedAt", async () => {
         vi.mocked(prisma.task.findFirst).mockResolvedValue({
            id: "task_1",
            userId: "user_1",
            isComplete: false,
         } as never);

         vi.mocked(prisma.task.update).mockResolvedValue({
            id: "task_1",
            isComplete: true,
            completedAt: new Date(),
         } as never);

         const result = await toggleTask({
            taskId: "task_1",
            userId: "user_1",
            isComplete: true,
         });

         expect(result).toBeDefined();
         expect(prisma.task.update).toHaveBeenCalledWith(
            expect.objectContaining({
               where: { id: "task_1" },
               data: expect.objectContaining({
                  isComplete: true,
                  completedAt: expect.any(Date),
               }),
            })
         );
      });

      it("returns null if task not found for user", async () => {
         vi.mocked(prisma.task.findFirst).mockResolvedValue(null);

         const result = await toggleTask({
            taskId: "task_other",
            userId: "user_1",
            isComplete: true,
         });

         expect(result).toBeNull();
         expect(prisma.task.update).not.toHaveBeenCalled();
      });
   });

   describe("deleteTask", () => {
      it("soft-deletes task when owned by user", async () => {
         vi.mocked(prisma.task.findFirst).mockResolvedValue({
            id: "task_del",
            userId: "user_1",
         } as never);
         vi.mocked(prisma.task.update).mockResolvedValue({
            id: "task_del",
            isDeleted: true,
            deletionTime: new Date(),
         } as never);

         const result = await deleteTask({
            taskId: "task_del",
            userId: "user_1",
         });

         expect(result).toEqual({
            id: "task_del",
            isDeleted: true,
            deletionTime: expect.any(Date),
         });
         expect(prisma.task.update).toHaveBeenCalledWith({
            where: { id: "task_del" },
            data: {
               isDeleted: true,
               deletionTime: expect.any(Date),
            },
         });
      });
   });

   describe("createCategory", () => {
      it("returns existing category if already present with same taskType", async () => {
         const existing = {
            id: "cat_exist",
            name: "Chemistry",
            taskType: "DAILY",
         };
         vi.mocked(prisma.category.findFirst).mockResolvedValue(
            existing as never
         );

         const result = await createCategory({
            userId: "user_1",
            name: "Chemistry",
            taskType: "DAILY",
         });

         expect(result).toEqual(existing);
         expect(prisma.category.create).not.toHaveBeenCalled();
      });

      it("returns the live category when create hits the unique index", async () => {
         const winner = {
            id: "cat_live",
            name: "Work",
            taskType: "DAILY",
         };
         vi.mocked(prisma.category.findFirst)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(winner as never);
         vi.mocked(prisma.category.create).mockRejectedValueOnce(
            new Prisma.PrismaClientKnownRequestError("Unique constraint", {
               code: "P2002",
               clientVersion: "test",
            })
         );

         const result = await createCategory({
            userId: "user_1",
            name: "work",
            taskType: "DAILY",
         });

         expect(result).toEqual(winner);
      });

      it("creates a new category with given taskType if not existing", async () => {
         vi.mocked(prisma.category.findFirst).mockResolvedValue(null);
         const created = {
            id: "cat_created",
            name: "Physics",
            taskType: "WEEKLY",
         };
         vi.mocked(prisma.category.create).mockResolvedValue(created as never);

         const result = await createCategory({
            userId: "user_1",
            name: "Physics",
            taskType: "WEEKLY",
         });

         expect(result).toEqual(created);
         expect(prisma.category.create).toHaveBeenCalledWith({
            data: {
               userId: "user_1",
               name: "Physics",
               taskType: "WEEKLY",
            },
         });
      });
   });

   describe("updateTask", () => {
      it("updates task title when owned by user", async () => {
         vi.mocked(prisma.task.findFirst).mockResolvedValue({
            id: "task_1",
            userId: "user_1",
            title: "Old title",
         } as never);
         vi.mocked(prisma.task.update).mockResolvedValue({
            id: "task_1",
            title: "New title",
         } as never);

         const result = await updateTask({
            taskId: "task_1",
            userId: "user_1",
            title: "  New title  ",
         });

         expect(result).toEqual({ id: "task_1", title: "New title" });
         expect(prisma.task.update).toHaveBeenCalledWith({
            where: { id: "task_1" },
            data: { title: "New title" },
            include: { category: true },
         });
      });

      it("updates task dueDate", async () => {
         vi.mocked(prisma.task.findFirst).mockResolvedValue({
            id: "task_1",
            userId: "user_1",
            title: "Current title",
         } as never);
         vi.mocked(prisma.task.update).mockResolvedValue({
            id: "task_1",
            title: "Current title",
            dueDate: new Date("2026-10-08"),
         } as never);

         const result = await updateTask({
            taskId: "task_1",
            userId: "user_1",
            dueDate: "2026-10-08",
         });

         expect(result).toBeDefined();
         expect(prisma.task.update).toHaveBeenCalledWith({
            where: { id: "task_1" },
            data: { dueDate: expect.any(Date) },
            include: { category: true },
         });
      });

      it("updates task completion and sets completedAt timestamp", async () => {
         vi.mocked(prisma.task.findFirst).mockResolvedValue({
            id: "task_1",
            userId: "user_1",
            title: "Current title",
            isComplete: false,
         } as never);
         vi.mocked(prisma.task.update).mockResolvedValue({
            id: "task_1",
            title: "Current title",
            isComplete: true,
            completedAt: new Date(),
         } as never);

         const result = await updateTask({
            taskId: "task_1",
            userId: "user_1",
            isComplete: true,
         });

         expect(result).toBeDefined();
         expect(prisma.task.update).toHaveBeenCalledWith({
            where: { id: "task_1" },
            data: {
               isComplete: true,
               status: "COMPLETED",
               completedAt: expect.any(Date),
            },
            include: { category: true },
         });
      });

      it("updates task to incomplete and resets completedAt to null", async () => {
         vi.mocked(prisma.task.findFirst).mockResolvedValue({
            id: "task_1",
            userId: "user_1",
            title: "Current title",
            isComplete: true,
         } as never);
         vi.mocked(prisma.task.update).mockResolvedValue({
            id: "task_1",
            title: "Current title",
            isComplete: false,
            status: "TODO",
            completedAt: null,
         } as never);

         const result = await updateTask({
            taskId: "task_1",
            userId: "user_1",
            isComplete: false,
         });

         expect(result).toBeDefined();
         expect(prisma.task.update).toHaveBeenCalledWith({
            where: { id: "task_1" },
            data: {
               isComplete: false,
               status: "TODO",
               completedAt: null,
            },
            include: { category: true },
         });
      });

      it("updates task with IN_PROGRESS status", async () => {
         vi.mocked(prisma.task.findFirst).mockResolvedValue({
            id: "task_1",
            userId: "user_1",
            title: "Current title",
            isComplete: false,
            status: "TODO",
         } as never);
         vi.mocked(prisma.task.update).mockResolvedValue({
            id: "task_1",
            title: "Current title",
            isComplete: false,
            status: "IN_PROGRESS",
            completedAt: null,
         } as never);

         const result = await updateTask({
            taskId: "task_1",
            userId: "user_1",
            status: "IN_PROGRESS",
         });

         expect(result).toBeDefined();
         expect(prisma.task.update).toHaveBeenCalledWith({
            where: { id: "task_1" },
            data: {
               isComplete: false,
               status: "IN_PROGRESS",
               completedAt: null,
            },
            include: { category: true },
         });
      });

      it("updates task with CROSSED_OUT status", async () => {
         vi.mocked(prisma.task.findFirst).mockResolvedValue({
            id: "task_1",
            userId: "user_1",
            title: "Current title",
            isComplete: false,
            status: "TODO",
         } as never);
         vi.mocked(prisma.task.update).mockResolvedValue({
            id: "task_1",
            title: "Current title",
            isComplete: false,
            status: "CROSSED_OUT",
            completedAt: null,
         } as never);

         const result = await updateTask({
            taskId: "task_1",
            userId: "user_1",
            status: "CROSSED_OUT",
         });

         expect(result).toBeDefined();
         expect(prisma.task.update).toHaveBeenCalledWith({
            where: { id: "task_1" },
            data: {
               isComplete: false,
               status: "CROSSED_OUT",
               completedAt: null,
            },
            include: { category: true },
         });
      });

      it("returns null if task does not exist or not owned by user", async () => {
         vi.mocked(prisma.task.findFirst).mockResolvedValue(null);

         const result = await updateTask({
            taskId: "task_99",
            userId: "user_1",
            title: "New title",
         });

         expect(result).toBeNull();
         expect(prisma.task.update).not.toHaveBeenCalled();
      });

      it("rejects linking a task after the challenge is locked", async () => {
         vi.mocked(prisma.task.findFirst).mockResolvedValue({
            id: "task_1",
            taskType: "WEEKLY",
            challengeId: null,
         } as never);
         vi.mocked(prisma.challengeParticipant.findFirst).mockResolvedValue({
            challengeId: "c_locked",
         } as never);
         vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
            { resultsLockedAt: new Date(), isDeleted: false },
         ] as never);

         await expect(
            updateTask({
               taskId: "task_1",
               userId: "user_1",
               challengeId: "c_locked",
            })
         ).rejects.toThrow("task goals can no longer be changed");

         expect(prisma.task.update).not.toHaveBeenCalled();
      });

      it("rejects unlinking a task from a locked challenge", async () => {
         vi.mocked(prisma.task.findFirst).mockResolvedValue({
            id: "task_1",
            taskType: "WEEKLY",
            challengeId: "c_locked",
         } as never);
         vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
            { resultsLockedAt: new Date(), isDeleted: false },
         ] as never);

         await expect(
            updateTask({
               taskId: "task_1",
               userId: "user_1",
               challengeId: null,
            })
         ).rejects.toThrow("task goals can no longer be changed");

         expect(prisma.task.update).not.toHaveBeenCalled();
      });

      it("updates task challengeId to valid challenge or null", async () => {
         vi.mocked(prisma.task.findFirst).mockResolvedValue({
            id: "task_1",
            userId: "user_1",
            taskType: "WEEKLY",
         } as never);
         vi.mocked(prisma.challengeParticipant.findFirst).mockResolvedValue({
            challengeId: "chal_valid",
         } as never);
         vi.mocked(prisma.task.update).mockResolvedValue({
            id: "task_1",
            challengeId: "chal_valid",
         } as never);

         const result = await updateTask({
            taskId: "task_1",
            userId: "user_1",
            challengeId: "chal_valid",
         });

         expect(result).toBeDefined();
         expect(prisma.task.update).toHaveBeenCalledWith({
            where: { id: "task_1" },
            data: { challengeId: "chal_valid" },
            include: { category: true },
         });

         const toPersonal = await updateTask({
            taskId: "task_1",
            userId: "user_1",
            challengeId: null,
         });

         expect(toPersonal).toBeDefined();
         expect(prisma.task.update).toHaveBeenCalledWith({
            where: { id: "task_1" },
            data: { challengeId: null },
            include: { category: true },
         });
      });

      it("rejects challengeId assignment when taskType is not WEEKLY", async () => {
         vi.mocked(prisma.task.findFirst).mockResolvedValue({
            id: "task_1",
            userId: "user_1",
            taskType: "DAILY",
         } as never);

         await expect(
            updateTask({
               taskId: "task_1",
               userId: "user_1",
               challengeId: "chal_valid",
            })
         ).rejects.toThrow("Only weekly tasks can be scoped to a challenge");
      });

      it("rejects invalid or unauthorized challengeId assignment", async () => {
         vi.mocked(prisma.task.findFirst).mockResolvedValue({
            id: "task_1",
            userId: "user_1",
            taskType: "WEEKLY",
         } as never);
         vi.mocked(prisma.challengeParticipant.findFirst).mockResolvedValue(
            null as never
         );

         await expect(
            updateTask({
               taskId: "task_1",
               userId: "user_1",
               challengeId: "chal_unauthorized",
            })
         ).rejects.toThrow("Invalid challenge ID");
      });
   });

   describe("rolloverIncompleteTasks", () => {
      it("updates dueDate for all matching tasks", async () => {
         vi.mocked(prisma.task.updateMany).mockResolvedValue({ count: 3 });

         const result = await rolloverIncompleteTasks({
            userId: "user_1",
            taskIds: ["task_1", "task_2", "task_3"],
            targetDateKey: "2026-10-26",
         });

         expect(result).toEqual({ count: 3 });
         expect(prisma.task.updateMany).toHaveBeenCalledWith({
            where: {
               id: { in: ["task_1", "task_2", "task_3"] },
               userId: "user_1",
               taskType: "DAILY",
               isComplete: false,
               status: {
                  notIn: ["COMPLETED", "CROSSED_OUT"],
               },
               isDeleted: false,
            },
            data: {
               dueDate: expect.any(Date),
            },
         });
      });
   });

   describe("updateCategory", () => {
      it("updates category name when owned by user and not colliding", async () => {
         vi.mocked(prisma.category.findFirst)
            .mockResolvedValueOnce({
               id: "cat_1",
               userId: "user_1",
               name: "Old Name",
               taskType: "DAILY",
            } as never)
            .mockResolvedValueOnce(null); // No collision

         vi.mocked(prisma.category.update).mockResolvedValue({
            id: "cat_1",
            name: "New Name",
         } as never);

         const result = await updateCategory({
            categoryId: "cat_1",
            userId: "user_1",
            name: "New Name",
         });

         expect(result).toEqual({ id: "cat_1", name: "New Name" });
         expect(prisma.category.update).toHaveBeenCalledWith({
            where: { id: "cat_1" },
            data: { name: "New Name" },
         });
      });

      it("returns null if category not found", async () => {
         vi.mocked(prisma.category.findFirst).mockResolvedValue(null);

         const result = await updateCategory({
            categoryId: "cat_99",
            userId: "user_1",
            name: "New Name",
         });

         expect(result).toBeNull();
      });

      it("throws error if new category name already exists for user in same taskType", async () => {
         vi.mocked(prisma.category.findFirst)
            .mockResolvedValueOnce({
               id: "cat_1",
               userId: "user_1",
               name: "Category 1",
               taskType: "DAILY",
            } as never)
            .mockResolvedValueOnce({
               id: "cat_2",
               userId: "user_1",
               name: "Category 2",
               taskType: "DAILY",
            } as never); // Collision!

         await expect(
            updateCategory({
               categoryId: "cat_1",
               userId: "user_1",
               name: "Category 2",
            })
         ).rejects.toThrow('Category "Category 2" already exists.');
      });
   });

   describe("deleteCategory", () => {
      it("soft-deletes the category and its tasks, tombstoning the name", async () => {
         vi.mocked(prisma.category.findFirst).mockResolvedValue({
            id: "cat_del",
            userId: "user_1",
            name: "Chemistry",
         } as never);
         vi.mocked(prisma.task.updateMany).mockResolvedValue({
            count: 2,
         } as never);
         vi.mocked(prisma.category.update).mockResolvedValue({
            id: "cat_del",
            isDeleted: true,
            deletionTime: new Date(),
            name: "Chemistry ·deleted·cat_del",
         } as never);

         const result = await deleteCategory({
            categoryId: "cat_del",
            userId: "user_1",
         });

         expect(prisma.task.updateMany).toHaveBeenCalledWith({
            where: {
               categoryId: "cat_del",
               userId: "user_1",
               isDeleted: false,
            },
            data: {
               isDeleted: true,
               deletionTime: expect.any(Date),
            },
         });
         expect(prisma.category.update).toHaveBeenCalledWith({
            where: { id: "cat_del" },
            data: {
               isDeleted: true,
               deletionTime: expect.any(Date),
               name: expect.stringContaining("Chemistry ·deleted·cat_del"),
            },
         });
         expect(result).toEqual(expect.objectContaining({ id: "cat_del" }));
      });

      it("returns null if category not found", async () => {
         vi.mocked(prisma.category.findFirst).mockResolvedValue(null);

         const result = await deleteCategory({
            categoryId: "cat_missing",
            userId: "user_1",
         });

         expect(result).toBeNull();
         expect(prisma.category.update).not.toHaveBeenCalled();
         expect(prisma.task.updateMany).not.toHaveBeenCalled();
      });
   });
});
