import type { TaskStatus } from "./task.types";

export interface RolloverTaskSource {
   id: string;
   title?: string;
   text?: string;
   isComplete?: boolean;
   completed?: boolean;
   status?: TaskStatus | string;
   dueDate?: string | Date | null;
   createdAt?: string | Date | null;
   categoryId?: string;
   challengeId?: string | null;
}

export interface RolloverCategorySource<
   TTask extends RolloverTaskSource = RolloverTaskSource,
> {
   id?: string;
   name: string;
   tasks: TTask[];
}

export interface RolloverCandidate<
   TTask extends RolloverTaskSource = RolloverTaskSource,
> {
   task: TTask;
   taskId: string;
   title: string;
   sourceDateKey: string;
   categoryId?: string;
   categoryIndex: number;
}

export interface RolloverSummary {
   totalPastIncompleteCount: number;
   selectedDayIncompleteCount: number;
   yesterdayIncompleteCount: number;
   isViewingPastDay: boolean;
   candidateTaskIds: string[];
}

/**
 * Determines whether a task is incomplete.
 * Completed tasks and abandoned/crossed-out tasks are not considered incomplete.
 */
export function isTaskIncomplete(
   task: Pick<RolloverTaskSource, "isComplete" | "completed" | "status">
): boolean {
   if (task.isComplete || task.completed) return false;
   if (task.status === "COMPLETED" || task.status === "CROSSED_OUT")
      return false;
   return true;
}

/**
 * Formats a Date or date string to standard YYYY-MM-DD format.
 */
export function extractDateKey(
   dateValue?: string | Date | null,
   fallbackDateKey?: string
): string {
   if (!dateValue)
      return fallbackDateKey || new Date().toISOString().slice(0, 10);
   if (typeof dateValue === "string") {
      return dateValue.slice(0, 10);
   }
   return dateValue.toISOString().slice(0, 10);
}

/**
 * Derives the effective date key for a task from its dueDate or createdAt.
 */
export function getTaskDateKey(
   task: Pick<RolloverTaskSource, "dueDate" | "createdAt">,
   fallbackDateKey: string
): string {
   if (task.dueDate) {
      return extractDateKey(task.dueDate, fallbackDateKey);
   }
   if (task.createdAt) {
      return extractDateKey(task.createdAt, fallbackDateKey);
   }
   return fallbackDateKey;
}

/**
 * Calculates yesterday's date key relative to the given today date key.
 */
export function getYesterdayDateKey(todayDateKey: string): string {
   const [y, m, d] = todayDateKey.split("-").map(Number);
   const date = new Date(Date.UTC(y, m - 1, d));
   date.setUTCDate(date.getUTCDate() - 1);
   return date.toISOString().slice(0, 10);
}

/**
 * Finds all incomplete daily tasks from past days across categories.
 * If sourceDateKey is specified, only tasks from that specific date are returned.
 */
export function findRolloverCandidates<TTask extends RolloverTaskSource>(
   categories: readonly RolloverCategorySource<TTask>[],
   todayDateKey: string,
   options?: { sourceDateKey?: string; taskId?: string }
): RolloverCandidate<TTask>[] {
   const candidates: RolloverCandidate<TTask>[] = [];

   categories.forEach((category, categoryIndex) => {
      category.tasks.forEach((task) => {
         if (options?.taskId && task.id !== options.taskId) return;
         if (!isTaskIncomplete(task)) return;

         const taskDateKey = getTaskDateKey(task, todayDateKey);

         if (options?.sourceDateKey) {
            if (taskDateKey === options.sourceDateKey) {
               candidates.push({
                  task,
                  taskId: task.id,
                  title: task.title || task.text || "",
                  sourceDateKey: taskDateKey,
                  categoryId: category.id || task.categoryId,
                  categoryIndex,
               });
            }
         } else {
            // All past days
            if (taskDateKey < todayDateKey) {
               candidates.push({
                  task,
                  taskId: task.id,
                  title: task.title || task.text || "",
                  sourceDateKey: taskDateKey,
                  categoryId: category.id || task.categoryId,
                  categoryIndex,
               });
            }
         }
      });
   });

   return candidates;
}

/**
 * Immutably updates categories by updating the dueDate of candidate tasks to targetDateKey.
 */
export function applyRolloverToCategories<
   TCat extends RolloverCategorySource<TTask>,
   TTask extends RolloverTaskSource,
>(
   categories: readonly TCat[],
   candidateTaskIds: readonly string[],
   targetDateKey: string
): { updatedCategories: TCat[]; rolledOverCount: number } {
   const taskIdSet = new Set(candidateTaskIds);
   let rolledOverCount = 0;

   const updatedCategories = categories.map((category) => {
      let hasChange = false;
      const updatedTasks = category.tasks.map((task) => {
         if (taskIdSet.has(task.id)) {
            hasChange = true;
            rolledOverCount++;
            return {
               ...task,
               dueDate: targetDateKey,
            };
         }
         return task;
      });

      if (!hasChange) return category;
      return {
         ...category,
         tasks: updatedTasks,
      };
   });

   return {
      updatedCategories,
      rolledOverCount,
   };
}

/**
 * Computes a summary of rollover candidates for UI rendering.
 */
export function getRolloverSummary<TTask extends RolloverTaskSource>(
   categories: readonly RolloverCategorySource<TTask>[],
   todayDateKey: string,
   selectedDateKey: string
): RolloverSummary {
   const yesterdayDateKey = getYesterdayDateKey(todayDateKey);
   const isViewingPastDay = selectedDateKey < todayDateKey;

   let totalPastIncompleteCount = 0;
   let selectedDayIncompleteCount = 0;
   let yesterdayIncompleteCount = 0;
   const candidateTaskIds: string[] = [];

   categories.forEach((cat) => {
      cat.tasks.forEach((task) => {
         if (!isTaskIncomplete(task)) return;

         const dateKey = getTaskDateKey(task, todayDateKey);
         if (dateKey < todayDateKey) {
            totalPastIncompleteCount++;
            candidateTaskIds.push(task.id);

            if (dateKey === yesterdayDateKey) {
               yesterdayIncompleteCount++;
            }
         }

         if (dateKey === selectedDateKey && isViewingPastDay) {
            selectedDayIncompleteCount++;
         }
      });
   });

   return {
      totalPastIncompleteCount,
      selectedDayIncompleteCount,
      yesterdayIncompleteCount,
      isViewingPastDay,
      candidateTaskIds,
   };
}
