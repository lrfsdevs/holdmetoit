import type { TaskType } from "./task.types";

/**
 * Pure function to reorder items within an array immutably.
 */
export function reorderArray<T>(
   list: T[],
   startIndex: number,
   endIndex: number
): T[] {
   if (
      startIndex < 0 ||
      startIndex >= list.length ||
      endIndex < 0 ||
      endIndex >= list.length ||
      startIndex === endIndex
   ) {
      return [...list];
   }

   const result = [...list];
   const [removed] = result.splice(startIndex, 1);
   result.splice(endIndex, 0, removed);
   return result;
}

export interface DragTaskItem {
   id: string;
   text?: string;
   title?: string;
   completed?: boolean;
   isComplete?: boolean;
   categoryId?: string;
   taskType?: TaskType;
   status?: string;
   dueDate?: string | null;
   createdAt?: string | Date;
}

export interface DragCategoryGroup<TTask extends DragTaskItem = DragTaskItem> {
   id?: string;
   name?: string;
   taskType?: TaskType;
   isCollapsed?: boolean;
   tasks: TTask[];
}

export interface MoveTaskParams<
   TTask extends DragTaskItem = DragTaskItem,
   TCat extends DragCategoryGroup<TTask> = DragCategoryGroup<TTask>,
> {
   taskId: string;
   sourceCategoryIndex: number;
   sourceColumn: "daily" | "weekly";
   targetCategoryIndex: number;
   targetColumn: "daily" | "weekly";
   targetTaskIndex?: number;
   targetDueDate?: string | null;
   dailyCategories: TCat[];
   weeklyCategories: TCat[];
}

export interface MoveTaskResult<
   TTask extends DragTaskItem = DragTaskItem,
   TCat extends DragCategoryGroup<TTask> = DragCategoryGroup<TTask>,
> {
   dailyCategories: TCat[];
   weeklyCategories: TCat[];
   movedTask: TTask | null;
   targetCategoryId: string | null;
   targetTaskType: TaskType;
}

/**
 * Moves a task between categories (intra-board or cross-board between Daily & Weekly).
 */
export function moveTaskBetweenCategories<
   TTask extends DragTaskItem = DragTaskItem,
   TCat extends DragCategoryGroup<TTask> = DragCategoryGroup<TTask>,
>({
   taskId,
   sourceCategoryIndex,
   sourceColumn,
   targetCategoryIndex,
   targetColumn,
   targetTaskIndex,
   targetDueDate,
   dailyCategories,
   weeklyCategories,
}: MoveTaskParams<TTask, TCat>): MoveTaskResult<TTask, TCat> {
   const sourceGroups =
      sourceColumn === "daily" ? dailyCategories : weeklyCategories;
   const targetGroups =
      targetColumn === "daily" ? dailyCategories : weeklyCategories;

   const sourceCat = sourceGroups[sourceCategoryIndex];
   const targetCat = targetGroups[targetCategoryIndex];

   if (!sourceCat || !targetCat) {
      return {
         dailyCategories,
         weeklyCategories,
         movedTask: null,
         targetCategoryId: null,
         targetTaskType: targetColumn === "daily" ? "DAILY" : "WEEKLY",
      };
   }

   const taskIndex = sourceCat.tasks.findIndex((t) => t.id === taskId);
   if (taskIndex === -1) {
      return {
         dailyCategories,
         weeklyCategories,
         movedTask: null,
         targetCategoryId: null,
         targetTaskType: targetColumn === "daily" ? "DAILY" : "WEEKLY",
      };
   }

   const originalTask = sourceCat.tasks[taskIndex];
   const targetTaskType: TaskType =
      targetColumn === "daily" ? "DAILY" : "WEEKLY";

   const resolvedDueDate =
      targetDueDate !== undefined
         ? targetDueDate
         : targetColumn === "weekly"
           ? null
           : (originalTask.dueDate ?? null);

   const updatedTask: TTask = {
      ...originalTask,
      categoryId: targetCat.id || originalTask.categoryId,
      taskType: targetTaskType,
      dueDate: resolvedDueDate,
   };

   // Case 1: Same category reorder
   if (
      sourceColumn === targetColumn &&
      sourceCategoryIndex === targetCategoryIndex
   ) {
      const destIdx =
         targetTaskIndex !== undefined
            ? targetTaskIndex
            : sourceCat.tasks.length - 1;
      const reordered = reorderArray(sourceCat.tasks, taskIndex, destIdx);

      const updatedGroups = sourceGroups.map((c, i) =>
         i === sourceCategoryIndex ? ({ ...c, tasks: reordered } as TCat) : c
      );

      return {
         dailyCategories: (sourceColumn === "daily"
            ? updatedGroups
            : dailyCategories) as TCat[],
         weeklyCategories: (sourceColumn === "weekly"
            ? updatedGroups
            : weeklyCategories) as TCat[],
         movedTask: updatedTask,
         targetCategoryId: targetCat.id ?? null,
         targetTaskType,
      };
   }

   // Case 2: Different category (same column or cross column)
   const newSourceTasks = sourceCat.tasks.filter((t) => t.id !== taskId);
   const newTargetTasks = [...targetCat.tasks];
   const insertIndex =
      targetTaskIndex !== undefined && targetTaskIndex >= 0
         ? targetTaskIndex
         : newTargetTasks.length;

   newTargetTasks.splice(insertIndex, 0, updatedTask);

   if (sourceColumn === targetColumn) {
      const updatedGroups = sourceGroups.map((cat, i) => {
         if (i === sourceCategoryIndex) {
            return { ...cat, tasks: newSourceTasks } as TCat;
         }
         if (i === targetCategoryIndex) {
            return { ...cat, tasks: newTargetTasks } as TCat;
         }
         return cat;
      });

      return {
         dailyCategories: (sourceColumn === "daily"
            ? updatedGroups
            : dailyCategories) as TCat[],
         weeklyCategories: (sourceColumn === "weekly"
            ? updatedGroups
            : weeklyCategories) as TCat[],
         movedTask: updatedTask,
         targetCategoryId: targetCat.id ?? null,
         targetTaskType,
      };
   }

   // Cross-column move (daily <-> weekly)
   const nextDaily = (
      sourceColumn === "daily"
         ? dailyCategories.map((c, i) =>
              i === sourceCategoryIndex
                 ? ({ ...c, tasks: newSourceTasks } as TCat)
                 : c
           )
         : dailyCategories.map((c, i) =>
              i === targetCategoryIndex
                 ? ({ ...c, tasks: newTargetTasks } as TCat)
                 : c
           )
   ) as TCat[];

   const nextWeekly = (
      sourceColumn === "weekly"
         ? weeklyCategories.map((c, i) =>
              i === sourceCategoryIndex
                 ? ({ ...c, tasks: newSourceTasks } as TCat)
                 : c
           )
         : weeklyCategories.map((c, i) =>
              i === targetCategoryIndex
                 ? ({ ...c, tasks: newTargetTasks } as TCat)
                 : c
           )
   ) as TCat[];

   return {
      dailyCategories: nextDaily,
      weeklyCategories: nextWeekly,
      movedTask: updatedTask,
      targetCategoryId: targetCat.id ?? null,
      targetTaskType,
   };
}

export interface MoveCategoryParams<
   TTask extends DragTaskItem = DragTaskItem,
   TCat extends DragCategoryGroup<TTask> = DragCategoryGroup<TTask>,
> {
   categoryIndex: number;
   sourceColumn: "daily" | "weekly";
   targetColumn: "daily" | "weekly";
   targetIndex?: number;
   targetDueDate?: string | null;
   dailyCategories: TCat[];
   weeklyCategories: TCat[];
}

export interface MoveCategoryResult<
   TTask extends DragTaskItem = DragTaskItem,
   TCat extends DragCategoryGroup<TTask> = DragCategoryGroup<TTask>,
> {
   dailyCategories: TCat[];
   weeklyCategories: TCat[];
   movedCategory: TCat | null;
   targetTaskType: TaskType;
}

/**
 * Moves or reorders a category within or across Daily/Weekly columns.
 * When moved across columns, all member tasks automatically adopt the new taskType.
 */
export function moveCategoryBetweenColumns<
   TTask extends DragTaskItem = DragTaskItem,
   TCat extends DragCategoryGroup<TTask> = DragCategoryGroup<TTask>,
>({
   categoryIndex,
   sourceColumn,
   targetColumn,
   targetIndex,
   targetDueDate,
   dailyCategories,
   weeklyCategories,
}: MoveCategoryParams<TTask, TCat>): MoveCategoryResult<TTask, TCat> {
   const sourceList =
      sourceColumn === "daily" ? dailyCategories : weeklyCategories;
   const targetList =
      targetColumn === "daily" ? dailyCategories : weeklyCategories;

   if (categoryIndex < 0 || categoryIndex >= sourceList.length) {
      return {
         dailyCategories,
         weeklyCategories,
         movedCategory: null,
         targetTaskType: targetColumn === "daily" ? "DAILY" : "WEEKLY",
      };
   }

   const category = sourceList[categoryIndex];
   const targetTaskType: TaskType =
      targetColumn === "daily" ? "DAILY" : "WEEKLY";

   // Reorder within the same column
   if (sourceColumn === targetColumn) {
      const dest =
         targetIndex !== undefined ? targetIndex : sourceList.length - 1;
      const reordered = reorderArray(sourceList, categoryIndex, dest);

      return {
         dailyCategories: (sourceColumn === "daily"
            ? reordered
            : dailyCategories) as TCat[],
         weeklyCategories: (sourceColumn === "weekly"
            ? reordered
            : weeklyCategories) as TCat[],
         movedCategory: category,
         targetTaskType,
      };
   }

   // Cross column move (Daily <-> Weekly)
   const resolvedDueDate =
      targetDueDate !== undefined
         ? targetDueDate
         : targetColumn === "weekly"
           ? null
           : undefined;

   const updatedTasks = category.tasks.map((t) => ({
      ...t,
      taskType: targetTaskType,
      ...(resolvedDueDate !== undefined ? { dueDate: resolvedDueDate } : {}),
   })) as TTask[];

   const updatedCategory = {
      ...category,
      taskType: targetTaskType,
      tasks: updatedTasks,
   } as TCat;

   const newSource = sourceList.filter((_, i) => i !== categoryIndex);
   const newTarget = [...targetList];
   const dest =
      targetIndex !== undefined && targetIndex >= 0
         ? targetIndex
         : newTarget.length;
   newTarget.splice(dest, 0, updatedCategory);

   return {
      dailyCategories: (sourceColumn === "daily"
         ? newSource
         : newTarget) as TCat[],
      weeklyCategories: (sourceColumn === "weekly"
         ? newSource
         : newTarget) as TCat[],
      movedCategory: updatedCategory,
      targetTaskType,
   };
}

/**
 * Calculates the destination array index when dragging an item above or below a target item.
 * Accounts for index shift when moving an item within the same list.
 */
export function calculateReorderIndex(
   sourceIndex: number,
   targetIndex: number,
   position: "above" | "below"
): number {
   if (sourceIndex === targetIndex) {
      return sourceIndex;
   }
   if (position === "above") {
      return sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
   }
   return sourceIndex < targetIndex ? targetIndex : targetIndex + 1;
}

export function getTaskDateKeyHelper(
   task: DragTaskItem,
   fallbackDate?: string
): string {
   if (task.dueDate) {
      return typeof task.dueDate === "string"
         ? task.dueDate.slice(0, 10)
         : new Date(task.dueDate).toISOString().slice(0, 10);
   }
   if (task.createdAt) {
      return typeof task.createdAt === "string"
         ? task.createdAt.slice(0, 10)
         : new Date(task.createdAt).toISOString().slice(0, 10);
   }
   return fallbackDate || "";
}

export interface MoveCategoryToDayParams<
   TTask extends DragTaskItem = DragTaskItem,
   TCat extends DragCategoryGroup<TTask> = DragCategoryGroup<TTask>,
> {
   categoryIndex: number;
   sourceColumn: "daily" | "weekly";
   sourceDateKey?: string;
   targetDateKey: string;
   dailyCategories: TCat[];
   weeklyCategories: TCat[];
}

export interface MoveCategoryToDayResult<
   TTask extends DragTaskItem = DragTaskItem,
   TCat extends DragCategoryGroup<TTask> = DragCategoryGroup<TTask>,
> {
   dailyCategories: TCat[];
   weeklyCategories: TCat[];
   movedCategory: TCat | null;
   movedTasks: TTask[];
   targetTaskType: TaskType;
}

/**
 * Moves all tasks of a category (for a given source date, or all if unspecified) to a target date.
 * If moving from Weekly to Daily, moves the category across columns with targetDueDate set.
 */
export function moveCategoryToDay<
   TTask extends DragTaskItem = DragTaskItem,
   TCat extends DragCategoryGroup<TTask> = DragCategoryGroup<TTask>,
>({
   categoryIndex,
   sourceColumn,
   sourceDateKey,
   targetDateKey,
   dailyCategories,
   weeklyCategories,
}: MoveCategoryToDayParams<TTask, TCat>): MoveCategoryToDayResult<TTask, TCat> {
   if (sourceColumn === "weekly") {
      const res = moveCategoryBetweenColumns({
         categoryIndex,
         sourceColumn: "weekly",
         targetColumn: "daily",
         targetIndex: dailyCategories.length,
         targetDueDate: targetDateKey,
         dailyCategories,
         weeklyCategories,
      });
      return {
         dailyCategories: res.dailyCategories,
         weeklyCategories: res.weeklyCategories,
         movedCategory: res.movedCategory,
         movedTasks: res.movedCategory?.tasks || [],
         targetTaskType: "DAILY",
      };
   }

   // sourceColumn === "daily"
   if (categoryIndex < 0 || categoryIndex >= dailyCategories.length) {
      return {
         dailyCategories,
         weeklyCategories,
         movedCategory: null,
         movedTasks: [],
         targetTaskType: "DAILY",
      };
   }

   const category = dailyCategories[categoryIndex];
   const tasksToMove: TTask[] = [];

   const updatedTasks = category.tasks.map((task) => {
      const taskDate = getTaskDateKeyHelper(task, sourceDateKey);
      const shouldMove = !sourceDateKey || taskDate === sourceDateKey;
      if (shouldMove) {
         const moved = { ...task, dueDate: targetDateKey };
         tasksToMove.push(moved);
         return moved;
      }
      return task;
   }) as TTask[];

   const updatedCategory = {
      ...category,
      tasks: updatedTasks,
   } as TCat;

   const nextDaily = dailyCategories.map((c, i) =>
      i === categoryIndex ? updatedCategory : c
   );

   return {
      dailyCategories: nextDaily,
      weeklyCategories,
      movedCategory: updatedCategory,
      movedTasks: tasksToMove,
      targetTaskType: "DAILY",
   };
}
