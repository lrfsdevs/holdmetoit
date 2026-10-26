import { describe, expect, it } from "vitest";
import {
   applyRolloverToCategories,
   extractDateKey,
   findRolloverCandidates,
   getRolloverSummary,
   getTaskDateKey,
   getYesterdayDateKey,
   isTaskIncomplete,
   type RolloverCategorySource,
   type RolloverTaskSource,
} from "./task-rollover";

describe("task-rollover domain", () => {
   describe("isTaskIncomplete", () => {
      it("returns true for TODO status and uncompleted tasks", () => {
         expect(isTaskIncomplete({ isComplete: false, status: "TODO" })).toBe(
            true
         );
         expect(isTaskIncomplete({ completed: false, status: "TODO" })).toBe(
            true
         );
         expect(isTaskIncomplete({ isComplete: false })).toBe(true);
      });

      it("returns true for IN_PROGRESS status", () => {
         expect(
            isTaskIncomplete({ isComplete: false, status: "IN_PROGRESS" })
         ).toBe(true);
      });

      it("returns false for COMPLETED tasks or isComplete true", () => {
         expect(
            isTaskIncomplete({ isComplete: true, status: "COMPLETED" })
         ).toBe(false);
         expect(isTaskIncomplete({ completed: true })).toBe(false);
         expect(
            isTaskIncomplete({ isComplete: false, status: "COMPLETED" })
         ).toBe(false);
      });

      it("returns false for CROSSED_OUT tasks", () => {
         expect(
            isTaskIncomplete({ isComplete: false, status: "CROSSED_OUT" })
         ).toBe(false);
      });
   });

   describe("extractDateKey and getTaskDateKey", () => {
      it("formats string or Date correctly", () => {
         expect(extractDateKey("2026-10-25T14:00:00Z")).toBe("2026-10-25");
         expect(extractDateKey("2026-10-25")).toBe("2026-10-25");
         expect(extractDateKey(new Date("2026-10-25T00:00:00Z"))).toBe(
            "2026-10-25"
         );
         expect(extractDateKey(null, "2026-10-26")).toBe("2026-10-26");
      });

      it("prefers dueDate over createdAt", () => {
         const task: RolloverTaskSource = {
            id: "t-1",
            dueDate: "2026-10-24",
            createdAt: "2026-10-20T10:00:00Z",
         };
         expect(getTaskDateKey(task, "2026-10-26")).toBe("2026-10-24");
      });

      it("falls back to createdAt if dueDate is missing", () => {
         const task: RolloverTaskSource = {
            id: "t-2",
            dueDate: null,
            createdAt: "2026-10-22T08:00:00Z",
         };
         expect(getTaskDateKey(task, "2026-10-26")).toBe("2026-10-22");
      });

      it("falls back to fallbackDateKey if both dueDate and createdAt are missing", () => {
         const task: RolloverTaskSource = {
            id: "t-3",
         };
         expect(getTaskDateKey(task, "2026-10-26")).toBe("2026-10-26");
      });
   });

   describe("getYesterdayDateKey", () => {
      it("calculates yesterday within the same month", () => {
         expect(getYesterdayDateKey("2026-10-26")).toBe("2026-10-25");
      });

      it("calculates yesterday across month boundary", () => {
         expect(getYesterdayDateKey("2026-10-01")).toBe("2026-09-30");
      });

      it("calculates yesterday across year boundary", () => {
         expect(getYesterdayDateKey("2026-01-01")).toBe("2025-12-31");
      });
   });

   describe("findRolloverCandidates", () => {
      const categories: RolloverCategorySource[] = [
         {
            id: "cat-1",
            name: "Study",
            tasks: [
               {
                  id: "task-old-1",
                  title: "Read Chapter 1",
                  dueDate: "2026-10-24",
                  isComplete: false,
                  status: "TODO",
               },
               {
                  id: "task-old-done",
                  title: "Read Chapter 2",
                  dueDate: "2026-10-24",
                  isComplete: true,
                  status: "COMPLETED",
               },
               {
                  id: "task-yesterday",
                  title: "Review Notes",
                  dueDate: "2026-10-25",
                  isComplete: false,
                  status: "IN_PROGRESS",
               },
            ],
         },
         {
            id: "cat-2",
            name: "Coding",
            tasks: [
               {
                  id: "task-today",
                  title: "Build Feature",
                  dueDate: "2026-10-26",
                  isComplete: false,
                  status: "TODO",
               },
               {
                  id: "task-future",
                  title: "Deploy V2",
                  dueDate: "2026-10-27",
                  isComplete: false,
                  status: "TODO",
               },
               {
                  id: "task-crossed",
                  title: "Cancelled task",
                  dueDate: "2026-10-23",
                  isComplete: false,
                  status: "CROSSED_OUT",
               },
            ],
         },
      ];

      it("finds all incomplete tasks strictly before todayDateKey", () => {
         const candidates = findRolloverCandidates(categories, "2026-10-26");
         expect(candidates).toHaveLength(2);
         expect(candidates.map((c) => c.taskId)).toEqual([
            "task-old-1",
            "task-yesterday",
         ]);
         expect(candidates[0].sourceDateKey).toBe("2026-10-24");
         expect(candidates[1].sourceDateKey).toBe("2026-10-25");
      });

      it("filters by sourceDateKey if provided", () => {
         const yesterdayOnly = findRolloverCandidates(
            categories,
            "2026-10-26",
            {
               sourceDateKey: "2026-10-25",
            }
         );
         expect(yesterdayOnly).toHaveLength(1);
         expect(yesterdayOnly[0].taskId).toBe("task-yesterday");
      });

      it("filters by specific taskId if provided", () => {
         const specificTaskOnly = findRolloverCandidates(
            categories,
            "2026-10-26",
            {
               sourceDateKey: "2026-10-24",
               taskId: "task-old-1",
            }
         );
         expect(specificTaskOnly).toHaveLength(1);
         expect(specificTaskOnly[0].taskId).toBe("task-old-1");

         const nonExistentTask = findRolloverCandidates(
            categories,
            "2026-10-26",
            {
               taskId: "task-does-not-exist",
            }
         );
         expect(nonExistentTask).toHaveLength(0);
      });

      it("returns empty array if no past tasks are incomplete", () => {
         const cleanCategories: RolloverCategorySource[] = [
            {
               id: "cat-clean",
               name: "Clean",
               tasks: [
                  {
                     id: "t-1",
                     dueDate: "2026-10-24",
                     isComplete: true,
                     status: "COMPLETED",
                  },
               ],
            },
         ];
         expect(findRolloverCandidates(cleanCategories, "2026-10-26")).toEqual(
            []
         );
      });
   });

   describe("applyRolloverToCategories", () => {
      const categories: RolloverCategorySource[] = [
         {
            id: "cat-1",
            name: "Study",
            tasks: [
               {
                  id: "t-1",
                  title: "Task 1",
                  dueDate: "2026-10-24",
                  isComplete: false,
               },
               {
                  id: "t-2",
                  title: "Task 2",
                  dueDate: "2026-10-25",
                  isComplete: false,
               },
            ],
         },
      ];

      it("immutably updates candidate tasks to targetDateKey", () => {
         const { updatedCategories, rolledOverCount } =
            applyRolloverToCategories(categories, ["t-1", "t-2"], "2026-10-26");

         expect(rolledOverCount).toBe(2);
         expect(updatedCategories[0].tasks[0].dueDate).toBe("2026-10-26");
         expect(updatedCategories[0].tasks[1].dueDate).toBe("2026-10-26");
         // Original remains untouched
         expect(categories[0].tasks[0].dueDate).toBe("2026-10-24");
      });

      it("leaves unselected tasks untouched", () => {
         const { updatedCategories, rolledOverCount } =
            applyRolloverToCategories(categories, ["t-1"], "2026-10-26");

         expect(rolledOverCount).toBe(1);
         expect(updatedCategories[0].tasks[0].dueDate).toBe("2026-10-26");
         expect(updatedCategories[0].tasks[1].dueDate).toBe("2026-10-25");
      });
   });

   describe("getRolloverSummary", () => {
      const categories: RolloverCategorySource[] = [
         {
            id: "cat-1",
            name: "Work",
            tasks: [
               {
                  id: "t-1",
                  dueDate: "2026-10-23",
                  isComplete: false,
                  status: "TODO",
               },
               {
                  id: "t-2",
                  dueDate: "2026-10-25", // Yesterday
                  isComplete: false,
                  status: "TODO",
               },
               {
                  id: "t-3",
                  dueDate: "2026-10-26", // Today
                  isComplete: false,
                  status: "TODO",
               },
            ],
         },
      ];

      it("summarizes past incomplete tasks when on Today", () => {
         const summary = getRolloverSummary(
            categories,
            "2026-10-26",
            "2026-10-26"
         );
         expect(summary.totalPastIncompleteCount).toBe(2);
         expect(summary.yesterdayIncompleteCount).toBe(1);
         expect(summary.isViewingPastDay).toBe(false);
         expect(summary.candidateTaskIds).toEqual(["t-1", "t-2"]);
      });

      it("identifies incomplete tasks for a viewed past day", () => {
         const summary = getRolloverSummary(
            categories,
            "2026-10-26",
            "2026-10-25"
         );
         expect(summary.isViewingPastDay).toBe(true);
         expect(summary.selectedDayIncompleteCount).toBe(1);
         expect(summary.totalPastIncompleteCount).toBe(2);
      });
   });
});
