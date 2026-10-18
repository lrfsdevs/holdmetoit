import { describe, expect, it } from "vitest";
import {
   calculateReorderIndex,
   getTaskDateKeyHelper,
   moveCategoryBetweenColumns,
   moveCategoryToDay,
   moveTaskBetweenCategories,
   reorderArray,
} from "./task-reorder";
import type { CategoryGroup } from "./task.types";

describe("task-reorder domain logic", () => {
   it("reorders array elements correctly", () => {
      const list = ["A", "B", "C", "D"];
      const result = reorderArray(list, 1, 3);
      expect(result).toEqual(["A", "C", "D", "B"]);
   });

   it("returns cloned array when reorder index is out of bounds", () => {
      const list = ["A", "B"];
      expect(reorderArray(list, -1, 1)).toEqual(["A", "B"]);
      expect(reorderArray(list, 0, 5)).toEqual(["A", "B"]);
   });

   describe("moveTaskBetweenCategories", () => {
      const dailyCats: CategoryGroup[] = [
         {
            id: "cat_d1",
            name: "Cat D1",
            taskType: "DAILY",
            isCollapsed: false,
            tasks: [
               {
                  id: "t1",
                  userId: "u1",
                  categoryId: "cat_d1",
                  title: "Task 1",
                  taskType: "DAILY",
                  isComplete: false,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  completedAt: null,
               },
               {
                  id: "t2",
                  userId: "u1",
                  categoryId: "cat_d1",
                  title: "Task 2",
                  taskType: "DAILY",
                  isComplete: false,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  completedAt: null,
               },
            ],
         },
      ];

      const weeklyCats: CategoryGroup[] = [
         {
            id: "cat_w1",
            name: "Cat W1",
            taskType: "WEEKLY",
            isCollapsed: false,
            tasks: [
               {
                  id: "t3",
                  userId: "u1",
                  categoryId: "cat_w1",
                  title: "Task 3",
                  taskType: "WEEKLY",
                  isComplete: true,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  completedAt: new Date(),
               },
            ],
         },
      ];

      it("reorders tasks within the same category", () => {
         const res = moveTaskBetweenCategories({
            taskId: "t1",
            sourceCategoryIndex: 0,
            sourceColumn: "daily",
            targetCategoryIndex: 0,
            targetColumn: "daily",
            targetTaskIndex: 1,
            dailyCategories: dailyCats,
            weeklyCategories: weeklyCats,
         });

         expect(res.dailyCategories[0].tasks.map((t) => t.id)).toEqual([
            "t2",
            "t1",
         ]);
         expect(res.weeklyCategories).toEqual(weeklyCats);
      });

      it("moves task across boards from Daily to Weekly", () => {
         const res = moveTaskBetweenCategories({
            taskId: "t1",
            sourceCategoryIndex: 0,
            sourceColumn: "daily",
            targetCategoryIndex: 0,
            targetColumn: "weekly",
            targetTaskIndex: 0,
            dailyCategories: dailyCats,
            weeklyCategories: weeklyCats,
         });

         // Daily category should have lost t1
         expect(res.dailyCategories[0].tasks.map((t) => t.id)).toEqual(["t2"]);
         // Weekly category should have gained t1 at index 0 with taskType updated to WEEKLY
         expect(res.weeklyCategories[0].tasks.map((t) => t.id)).toEqual([
            "t1",
            "t3",
         ]);
         expect(res.weeklyCategories[0].tasks[0].taskType).toBe("WEEKLY");
         expect(res.weeklyCategories[0].tasks[0].categoryId).toBe("cat_w1");
         expect(res.weeklyCategories[0].tasks[0].dueDate).toBeNull();
      });

      it("assigns targetDueDate when moving task from Weekly to Daily", () => {
         const res = moveTaskBetweenCategories({
            taskId: "t3",
            sourceCategoryIndex: 0,
            sourceColumn: "weekly",
            targetCategoryIndex: 0,
            targetColumn: "daily",
            targetTaskIndex: 0,
            targetDueDate: "2026-10-09",
            dailyCategories: dailyCats,
            weeklyCategories: weeklyCats,
         });

         expect(res.dailyCategories[0].tasks[0].id).toBe("t3");
         expect(res.dailyCategories[0].tasks[0].taskType).toBe("DAILY");
         expect(res.dailyCategories[0].tasks[0].dueDate).toBe("2026-10-09");
         expect(res.movedTask?.dueDate).toBe("2026-10-09");
      });
   });

   describe("moveCategoryBetweenColumns", () => {
      const dailyCats: CategoryGroup[] = [
         {
            id: "cat_d1",
            name: "Math",
            taskType: "DAILY",
            isCollapsed: false,
            tasks: [
               {
                  id: "t1",
                  userId: "u1",
                  categoryId: "cat_d1",
                  title: "Calculus",
                  taskType: "DAILY",
                  isComplete: false,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  completedAt: null,
               },
            ],
         },
      ];

      const weeklyCats: CategoryGroup[] = [
         {
            id: "cat_w1",
            name: "Physics",
            taskType: "WEEKLY",
            isCollapsed: false,
            tasks: [],
         },
      ];

      it("moves category from Daily to Weekly and cascades taskType", () => {
         const res = moveCategoryBetweenColumns({
            categoryIndex: 0,
            sourceColumn: "daily",
            targetColumn: "weekly",
            targetIndex: 1,
            dailyCategories: dailyCats,
            weeklyCategories: weeklyCats,
         });

         expect(res.dailyCategories).toHaveLength(0);
         expect(res.weeklyCategories).toHaveLength(2);
         expect(res.weeklyCategories[1].name).toBe("Math");
         expect(res.weeklyCategories[1].taskType).toBe("WEEKLY");
         expect(res.weeklyCategories[1].tasks[0].taskType).toBe("WEEKLY");
         expect(res.weeklyCategories[1].tasks[0].dueDate).toBeNull();
      });

      it("moves category from Weekly to Daily and assigns targetDueDate to tasks", () => {
         const customWeeklyCats: CategoryGroup[] = [
            {
               id: "cat_w_custom",
               name: "Literature",
               taskType: "WEEKLY",
               isCollapsed: false,
               tasks: [
                  {
                     id: "t_lit",
                     userId: "u1",
                     categoryId: "cat_w_custom",
                     title: "Essay",
                     taskType: "WEEKLY",
                     isComplete: false,
                     dueDate: null,
                     createdAt: new Date(),
                     updatedAt: new Date(),
                     completedAt: null,
                  },
               ],
            },
         ];

         const res = moveCategoryBetweenColumns({
            categoryIndex: 0,
            sourceColumn: "weekly",
            targetColumn: "daily",
            targetIndex: 0,
            targetDueDate: "2026-10-09",
            dailyCategories: [],
            weeklyCategories: customWeeklyCats,
         });

         expect(res.dailyCategories).toHaveLength(1);
         expect(res.dailyCategories[0].name).toBe("Literature");
         expect(res.dailyCategories[0].tasks[0].dueDate).toBe("2026-10-09");
         expect(res.dailyCategories[0].tasks[0].taskType).toBe("DAILY");
      });
   });

   describe("calculateReorderIndex", () => {
      it("returns same index if sourceIndex equals targetIndex", () => {
         expect(calculateReorderIndex(2, 2, "above")).toBe(2);
         expect(calculateReorderIndex(2, 2, "below")).toBe(2);
      });

      it("correctly handles dragging downwards (sourceIndex < targetIndex)", () => {
         // Dragging item 0 above item 1 keeps it before item 1 (index 0)
         expect(calculateReorderIndex(0, 1, "above")).toBe(0);
         // Dragging item 0 below item 1 places it after item 1 (index 1)
         expect(calculateReorderIndex(0, 1, "below")).toBe(1);
         // Dragging item 0 above item 2 places it at index 1
         expect(calculateReorderIndex(0, 2, "above")).toBe(1);
         // Dragging item 0 below item 2 places it at index 2
         expect(calculateReorderIndex(0, 2, "below")).toBe(2);
      });

      it("correctly handles dragging upwards (sourceIndex > targetIndex)", () => {
         // Dragging item 2 above item 1 places it at index 1
         expect(calculateReorderIndex(2, 1, "above")).toBe(1);
         // Dragging item 2 below item 1 places it at index 2
         expect(calculateReorderIndex(2, 1, "below")).toBe(2);
         // Dragging item 3 above item 0 places it at index 0
         expect(calculateReorderIndex(3, 0, "above")).toBe(0);
         // Dragging item 3 below item 0 places it at index 1
         expect(calculateReorderIndex(3, 0, "below")).toBe(1);
      });
   });

   describe("getTaskDateKeyHelper", () => {
      it("extracts date key from string or Date dueDate", () => {
         expect(getTaskDateKeyHelper({ id: "1", dueDate: "2026-10-15" })).toBe(
            "2026-10-15"
         );
         expect(
            getTaskDateKeyHelper({
               id: "2",
               dueDate: new Date("2026-10-15T00:00:00Z") as unknown as string,
            })
         ).toBe("2026-10-15");
      });

      it("falls back to createdAt or fallbackDate", () => {
         expect(
            getTaskDateKeyHelper({ id: "3", createdAt: "2026-10-12T12:00:00Z" })
         ).toBe("2026-10-12");
         expect(getTaskDateKeyHelper({ id: "4" }, "2026-10-11")).toBe(
            "2026-10-11"
         );
      });
   });

   describe("moveCategoryToDay", () => {
      const dailyCats: CategoryGroup[] = [
         {
            id: "cat_d1",
            name: "Morning Focus",
            taskType: "DAILY",
            isCollapsed: false,
            tasks: [
               {
                  id: "t1",
                  userId: "u1",
                  categoryId: "cat_d1",
                  title: "Task Day 1",
                  taskType: "DAILY",
                  isComplete: false,
                  dueDate: "2026-10-10",
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  completedAt: null,
               },
               {
                  id: "t2",
                  userId: "u1",
                  categoryId: "cat_d1",
                  title: "Task Day 2",
                  taskType: "DAILY",
                  isComplete: false,
                  dueDate: "2026-10-11",
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  completedAt: null,
               },
            ],
         },
      ];

      it("moves only daily tasks matching sourceDateKey to targetDateKey", () => {
         const res = moveCategoryToDay({
            categoryIndex: 0,
            sourceColumn: "daily",
            sourceDateKey: "2026-10-10",
            targetDateKey: "2026-10-12",
            dailyCategories: dailyCats,
            weeklyCategories: [],
         });

         expect(res.movedTasks).toHaveLength(1);
         expect(res.movedTasks[0].id).toBe("t1");
         expect(res.movedTasks[0].dueDate).toBe("2026-10-12");

         // In daily categories, t1 is updated to 2026-10-12 while t2 remains 2026-10-11
         const updatedCat = res.dailyCategories[0];
         expect(updatedCat.tasks.find((t) => t.id === "t1")?.dueDate).toBe(
            "2026-10-12"
         );
         expect(updatedCat.tasks.find((t) => t.id === "t2")?.dueDate).toBe(
            "2026-10-11"
         );
      });

      it("moves all tasks if sourceDateKey is not specified", () => {
         const res = moveCategoryToDay({
            categoryIndex: 0,
            sourceColumn: "daily",
            targetDateKey: "2026-10-15",
            dailyCategories: dailyCats,
            weeklyCategories: [],
         });

         expect(res.movedTasks).toHaveLength(2);
         expect(
            res.dailyCategories[0].tasks.every(
               (t) => t.dueDate === "2026-10-15"
            )
         ).toBe(true);
      });

      it("moves weekly category across to daily with targetDueDate on all tasks", () => {
         const weeklyCats: CategoryGroup[] = [
            {
               id: "cat_w1",
               name: "Project Sprint",
               taskType: "WEEKLY",
               isCollapsed: false,
               tasks: [
                  {
                     id: "tw1",
                     userId: "u1",
                     categoryId: "cat_w1",
                     title: "Weekly deliverable",
                     taskType: "WEEKLY",
                     isComplete: false,
                     dueDate: null,
                     createdAt: new Date(),
                     updatedAt: new Date(),
                     completedAt: null,
                  },
               ],
            },
         ];

         const res = moveCategoryToDay({
            categoryIndex: 0,
            sourceColumn: "weekly",
            targetDateKey: "2026-10-14",
            dailyCategories: [],
            weeklyCategories: weeklyCats,
         });

         expect(res.weeklyCategories).toHaveLength(0);
         expect(res.dailyCategories).toHaveLength(1);
         expect(res.dailyCategories[0].name).toBe("Project Sprint");
         expect(res.dailyCategories[0].taskType).toBe("DAILY");
         expect(res.dailyCategories[0].tasks[0].taskType).toBe("DAILY");
         expect(res.dailyCategories[0].tasks[0].dueDate).toBe("2026-10-14");
         expect(res.targetTaskType).toBe("DAILY");
      });
   });
});
