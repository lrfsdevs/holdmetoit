"use client";

import { useState, useEffect, useTransition, useRef, useMemo } from "react";
import {
   ChevronDown,
   ChevronUp,
   Check,
   X,
   Trash2,
   MoreVertical,
   Pencil,
   GripVertical,
   RotateCcw,
   Calendar,
   Lock,
   ArrowRight,
} from "lucide-react";
import {
   getChallengeDayOptions,
   getCalendarWeekDayOptions,
   formatDayDate,
   validateMoveTaskChallengeDay,
   type ChallengeDayOption,
} from "@/features/study-logs/domain/challenge-day";
import {
   calculateReorderIndex,
   moveCategoryBetweenColumns,
   moveCategoryToDay,
   moveTaskBetweenCategories,
} from "@/features/tasks/domain/task-reorder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
   Select,
   SelectContent,
   SelectGroup,
   SelectItem,
   SelectLabel,
   SelectTrigger,
   SelectValue,
} from "@/components/ui/select";
import {
   DropdownMenu,
   DropdownMenuTrigger,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
   ContextMenu,
   ContextMenuTrigger,
   ContextMenuContent,
   ContextMenuItem,
   ContextMenuSeparator,
   ContextMenuLabel,
} from "@/components/ui/context-menu";
import { TaskMenuItems, CategoryMenuItems } from "./cockpit-task-menu";
import { trackLogRocketEvent } from "@/core/observability/logrocket";
import {
   createTaskAction,
   deleteCategoryAction,
   deleteTaskAction,
   toggleTaskAction,
   updateCategoryAction,
   updateTaskAction,
} from "@/features/tasks/api/task.actions";
import type {
   TaskStatus,
   UserCategorizedTasks,
} from "@/features/tasks/domain/task.types";
import {
   deleteLocalCategory,
   deleteLocalTask,
   enqueueMutation,
   getAllLocalCategories,
   getAllLocalTasks,
   logTaskSync,
   putLocalCategories,
   putLocalCategory,
   putLocalTask,
   putLocalTasks,
} from "@/features/tasks/data/local/task-idb";
import {
   initTaskSync,
   scheduleSync,
   TASKS_SYNCED_EVENT,
} from "@/features/tasks/data/local/task-sync.service";
import type {
   LocalCategoryRecord,
   LocalTaskRecord,
} from "@/features/tasks/domain/task-sync.types";

export interface TaskItem {
   id: string;
   text: string;
   completed: boolean;
   status?: TaskStatus;
   dueDate?: string | null;
   createdAt?: string;
}

/** Derives the presentation status for a task item. */
export function getTaskStatus(task: TaskItem): TaskStatus {
   if (task.status) return task.status;
   return task.completed ? "COMPLETED" : "TODO";
}

export { formatDayDate };

export interface CategoryGroup {
   id?: string;
   name: string;
   isCollapsed: boolean;
   tasks: TaskItem[];
}

export interface CockpitTasksSectionProps {
   isLoggedIn: boolean;
   userId?: string | null;
   userTasks?: UserCategorizedTasks | null;
   challengeStartDate?: string;
   challengeId?: string;
   challengeStatus?: "UPCOMING" | "ACTIVE" | "COMPLETED";
   todayDate?: string;
   todayDayNumber?: number;
   totalChallengeDays?: number;
   onOpenHoursModal?: (dayNumber?: number) => void;
   isAdmin?: boolean;
}

/** Renders the participant's categorized task board and task actions. */
export function CockpitTasksSection({
   isLoggedIn,
   userId,
   userTasks,
   challengeStartDate,
   challengeId,
   challengeStatus,
   todayDate,
   todayDayNumber,
   totalChallengeDays = 7,
   onOpenHoursModal,
   isAdmin = false,
}: CockpitTasksSectionProps) {
   const [, startTransition] = useTransition();
   const linkableChallengeId =
      challengeId && challengeStatus !== "COMPLETED" ? challengeId : null;
   const [addModalType, setAddModalType] = useState<"daily" | "weekly" | null>(
      null
   );
   const [newTodoText, setNewTodoText] = useState("");
   const [selectedCategory, setSelectedCategory] = useState("");
   const [customCategory, setCustomCategory] = useState("");
   const [isCreatingCategory, setIsCreatingCategory] = useState(false);
   const [newTodoStatus, setNewTodoStatus] = useState<TaskStatus>("TODO");
   const [addTodoDateKey, setAddTodoDateKey] = useState<string>("");
   const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(
      () => new Set()
   );

   const toggleTaskExpand = (taskId: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setExpandedTaskIds((prev) => {
         const next = new Set(prev);
         if (next.has(taskId)) {
            next.delete(taskId);
         } else {
            next.add(taskId);
         }
         return next;
      });
   };

   const categoryInputRef = useRef<HTMLInputElement>(null);
   const categorySelectRef = useRef<HTMLButtonElement>(null);

   useEffect(() => {
      if (isCreatingCategory && addModalType) {
         const timer = setTimeout(() => {
            categoryInputRef.current?.focus();
            categoryInputRef.current?.select();
         }, 50);
         return () => clearTimeout(timer);
      }
   }, [isCreatingCategory, addModalType]);

   // Edit Task Modal State
   const [editTaskModal, setEditTaskModal] = useState<{
      id: string;
      text: string;
      completed: boolean;
      status: TaskStatus;
      dueDate?: string | null;
      createdAt?: string;
      catIdx: number;
      taskType: "daily" | "weekly";
   } | null>(null);
   const [editTaskInputText, setEditTaskInputText] = useState("");
   const [editTaskInputStatus, setEditTaskInputStatus] =
      useState<TaskStatus>("TODO");
   const [editTaskInputDueDate, setEditTaskInputDueDate] = useState<string>("");

   // Edit Category Modal State
   const [editCategoryModal, setEditCategoryModal] = useState<{
      id?: string;
      name: string;
      taskType: "daily" | "weekly";
   } | null>(null);
   const [editCategoryInputName, setEditCategoryInputName] = useState("");

   // Delete Category Confirmation Modal State
   const [deleteCategoryModal, setDeleteCategoryModal] = useState<{
      id?: string;
      name: string;
      taskType: "daily" | "weekly";
   } | null>(null);

   // Drag and Drop State
   const [draggedItem, setDraggedItem] = useState<{
      type: "task" | "category";
      id?: string;
      sourceCatIdx: number;
      sourceColumn: "daily" | "weekly";
      sourceDateKey?: string;
   } | null>(null);

   const [dragOverInfo, setDragOverInfo] = useState<{
      type: "task" | "category" | "column" | "day";
      targetId?: string;
      targetCatIdx?: number;
      targetColumn?: "daily" | "weekly";
      targetDateKey?: string;
      position?: "above" | "below";
   } | null>(null);

   const [dailyCategories, setDailyCategories] = useState<CategoryGroup[]>(
      () => {
         if (
            userTasks?.dailyCategories &&
            userTasks.dailyCategories.length > 0
         ) {
            return userTasks.dailyCategories
               .filter((c) => !c.isDeleted)
               .map((c) => ({
                  id: c.id,
                  name: c.name,
                  isCollapsed: false,
                  tasks: c.tasks
                     .filter((t) => !t.isDeleted)
                     .map((t) => ({
                        id: t.id,
                        text: t.title,
                        completed: t.isComplete,
                        status:
                           (t.status as TaskStatus) ||
                           (t.isComplete ? "COMPLETED" : "TODO"),
                        dueDate: t.dueDate ?? null,
                        createdAt: t.createdAt
                           ? new Date(t.createdAt).toISOString()
                           : undefined,
                     })),
               }));
         }
         return [];
      }
   );

   const [weeklyCategories, setWeeklyCategories] = useState<CategoryGroup[]>(
      () => {
         if (
            userTasks?.weeklyCategories &&
            userTasks.weeklyCategories.length > 0
         ) {
            return userTasks.weeklyCategories
               .filter((c) => !c.isDeleted)
               .map((c) => ({
                  id: c.id,
                  name: c.name,
                  isCollapsed: false,
                  tasks: c.tasks
                     .filter((t) => !t.isDeleted)
                     .map((t) => ({
                        id: t.id,
                        text: t.title,
                        completed: t.isComplete,
                        status:
                           (t.status as TaskStatus) ||
                           (t.isComplete ? "COMPLETED" : "TODO"),
                        dueDate: t.dueDate ?? null,
                        createdAt: t.createdAt
                           ? new Date(t.createdAt).toISOString()
                           : undefined,
                     })),
               }));
         }
         return [];
      }
   );

   const effectiveTodayDate = useMemo(() => {
      return todayDate || new Date().toISOString().slice(0, 10);
   }, [todayDate]);

   const dayOptions: ChallengeDayOption[] = useMemo(() => {
      if (challengeStartDate) {
         return getChallengeDayOptions(
            challengeStartDate,
            effectiveTodayDate,
            totalChallengeDays ?? 7
         ).slice(0, 7);
      }
      return getCalendarWeekDayOptions(effectiveTodayDate).slice(0, 7);
   }, [challengeStartDate, effectiveTodayDate, totalChallengeDays]);

   const todayDayOption = useMemo(() => {
      return dayOptions.find((d) => d.isToday) || dayOptions[0];
   }, [dayOptions]);

   const [selectedDateKey, setSelectedDateKey] = useState<string>(
      () => todayDayOption?.dateKey || effectiveTodayDate
   );
   const [selectedDayNumber, setSelectedDayNumber] = useState<number>(
      () => todayDayOption?.dayNumber || todayDayNumber || 1
   );

   const activeDayOption = useMemo(() => {
      return (
         dayOptions.find((d) => d.dateKey === selectedDateKey) ||
         todayDayOption ||
         dayOptions[0]
      );
   }, [dayOptions, selectedDateKey, todayDayOption]);

   const isActiveDayToday =
      activeDayOption?.isToday ?? selectedDateKey === effectiveTodayDate;
   const isActiveDayPast =
      activeDayOption?.isPast ?? selectedDateKey < effectiveTodayDate;

   const handleSelectDay = (opt: ChallengeDayOption) => {
      setSelectedDateKey(opt.dateKey);
      setSelectedDayNumber(opt.dayNumber);
   };

   const handleJumpToToday = () => {
      if (todayDayOption) {
         setSelectedDateKey(todayDayOption.dateKey);
         setSelectedDayNumber(todayDayOption.dayNumber);
      }
   };

   const getTaskDateKey = (task: TaskItem): string => {
      if (task.dueDate) {
         return typeof task.dueDate === "string"
            ? task.dueDate.slice(0, 10)
            : new Date(task.dueDate).toISOString().slice(0, 10);
      }
      if (task.createdAt) {
         return new Date(task.createdAt).toISOString().slice(0, 10);
      }
      return effectiveTodayDate;
   };

   const openAddDailyModal = (targetDateKey?: string) => {
      const rawDateKey = targetDateKey || selectedDateKey;
      const targetOpt = dayOptions.find((d) => d.dateKey === rawDateKey);
      const isTargetPast = targetOpt?.isPast ?? rawDateKey < effectiveTodayDate;

      // If target day is in the past, clamp to today or the first available non-past day
      const initialDateKey = isTargetPast
         ? todayDayOption?.dateKey ||
           dayOptions.find((d) => !d.isPast)?.dateKey ||
           effectiveTodayDate
         : rawDateKey;

      setAddTodoDateKey(initialDateKey);
      setNewTodoText("");
      if (dailyCategoryOptions.length > 0) {
         setSelectedCategory(dailyCategoryOptions[0]);
         setIsCreatingCategory(false);
      } else {
         setSelectedCategory("");
         setIsCreatingCategory(true);
      }
      setCustomCategory("");
      setNewTodoStatus("TODO");
      setAddModalType("daily");
   };

   const weeklyCategoryOptions = Array.from(
      new Set([
         ...(userTasks?.categories
            ?.filter((c) => c.taskType === "WEEKLY")
            .map((c) => c.name) ?? []),
         ...weeklyCategories.map((c) => c.name),
      ])
   );

   // Independent categories created specifically for daily tasks (unplanned/independent)
   const independentDailyCategoryOptions = Array.from(
      new Set([
         ...(userTasks?.categories
            ?.filter((c) => c.taskType === "DAILY")
            .map((c) => c.name) ?? []),
         ...dailyCategories
            .map((c) => c.name)
            .filter((name) => !weeklyCategoryOptions.includes(name)),
      ])
   ).filter((name) => !weeklyCategoryOptions.includes(name));

   // Daily inherits all weekly categories (parent categories) + independent daily categories
   const dailyCategoryOptions = Array.from(
      new Set([...weeklyCategoryOptions, ...independentDailyCategoryOptions])
   );

   const weeklyCategoryNameToId = new Map(
      userTasks?.categories
         ?.filter((c) => c.taskType === "WEEKLY")
         .map((c) => [c.name, c.id]) ?? []
   );

   const dailyCategoryNameToId = new Map([
      ...(userTasks?.categories?.map(
         (c) => [c.name, c.id] as [string, string]
      ) ?? []),
      ...weeklyCategories
         .filter((c) => Boolean(c.id))
         .map((c) => [c.name, c.id!] as [string, string]),
      ...dailyCategories
         .filter((c) => Boolean(c.id))
         .map((c) => [c.name, c.id!] as [string, string]),
   ]);

   useEffect(() => {
      const cleanup = initTaskSync(userId);
      let isCancelled = false;

      const handleSyncEvent = () => {
         if (!isCancelled) {
            logTaskSync("Live task sync event received, re-hydrating view...");
            hydrateFromIndexedDB();
         }
      };

      if (typeof window !== "undefined") {
         window.addEventListener(TASKS_SYNCED_EVENT, handleSyncEvent);
      }

      async function hydrateFromIndexedDB() {
         try {
            const localTasks = await getAllLocalTasks(userId ?? null);
            const localCats = await getAllLocalCategories(userId ?? null);

            if (isCancelled) return;

            if (localCats.length > 0 || localTasks.length > 0) {
               logTaskSync("Hydrated tasks from IndexedDB", {
                  cats: localCats.length,
                  tasks: localTasks.length,
               });

               const sortedCats = [...localCats]
                  .filter((c) => !c.isDeleted)
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
               const sortedTasks = [...localTasks]
                  .filter((t) => !t.isDeleted)
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

               const tasksToHeal: LocalTaskRecord[] = [];

               const dailyCats = sortedCats
                  .filter(
                     (c) =>
                        c.taskType === "DAILY" ||
                        sortedTasks.some(
                           (t) =>
                              t.categoryId === c.id && t.taskType === "DAILY"
                        )
                  )
                  .map((c) => ({
                     id: c.id,
                     name: c.name,
                     isCollapsed: false,
                     tasks: sortedTasks
                        .filter(
                           (t) =>
                              t.categoryId === c.id && t.taskType === "DAILY"
                        )
                        .map((t) => {
                           const effectiveDueDate = t.dueDate
                              ? typeof t.dueDate === "string"
                                 ? t.dueDate.slice(0, 10)
                                 : new Date(t.dueDate)
                                      .toISOString()
                                      .slice(0, 10)
                              : null;
                           const effectiveStatus =
                              (t.status as TaskStatus) ||
                              (t.isComplete ? "COMPLETED" : "TODO");

                           if (!t.status) {
                              tasksToHeal.push({
                                 ...t,
                                 dueDate: effectiveDueDate,
                                 status: effectiveStatus,
                              });
                           }

                           return {
                              id: t.id,
                              text: t.title,
                              completed: t.isComplete,
                              status: effectiveStatus,
                              dueDate: effectiveDueDate,
                              createdAt: t.createdAt,
                           };
                        }),
                  }));

               const weeklyCats = sortedCats
                  .filter((c) => c.taskType === "WEEKLY")
                  .map((c) => ({
                     id: c.id,
                     name: c.name,
                     isCollapsed: false,
                     tasks: sortedTasks
                        .filter(
                           (t) =>
                              t.categoryId === c.id && t.taskType === "WEEKLY"
                        )
                        .map((t) => {
                           const effectiveDueDate = t.dueDate
                              ? typeof t.dueDate === "string"
                                 ? t.dueDate.slice(0, 10)
                                 : new Date(t.dueDate)
                                      .toISOString()
                                      .slice(0, 10)
                              : null;
                           const effectiveStatus =
                              (t.status as TaskStatus) ||
                              (t.isComplete ? "COMPLETED" : "TODO");

                           if (!t.status) {
                              tasksToHeal.push({
                                 ...t,
                                 dueDate: effectiveDueDate,
                                 status: effectiveStatus,
                              });
                           }

                           return {
                              id: t.id,
                              text: t.title,
                              completed: t.isComplete,
                              status: effectiveStatus,
                              dueDate: effectiveDueDate,
                              createdAt: t.createdAt,
                           };
                        }),
                  }));

               if (tasksToHeal.length > 0) {
                  putLocalTasks(tasksToHeal).catch(() => {});
               }

               setDailyCategories(dailyCats);
               setWeeklyCategories(weeklyCats);
            } else if (userTasks && userTasks.categories.length > 0) {
               logTaskSync("Seeding IndexedDB from server userTasks...");
               const seedCats: LocalCategoryRecord[] = userTasks.categories
                  .filter((c) => !c.isDeleted)
                  .map((c) => ({
                     id: c.id,
                     userId: userId || null,
                     name: c.name,
                     taskType: c.taskType,
                     sortOrder: c.sortOrder ?? 0,
                     createdAt: new Date(c.createdAt).toISOString(),
                     updatedAt: new Date(c.updatedAt).toISOString(),
                     syncState: "synced",
                  }));

               const seedTasks: LocalTaskRecord[] = [
                  ...userTasks.dailyCategories
                     .filter((c) => !c.isDeleted)
                     .flatMap((c) => c.tasks.filter((t) => !t.isDeleted)),
                  ...userTasks.weeklyCategories
                     .filter((c) => !c.isDeleted)
                     .flatMap((c) => c.tasks.filter((t) => !t.isDeleted)),
               ].map((t) => ({
                  id: t.id,
                  userId: userId || null,
                  categoryId: t.categoryId,
                  title: t.title,
                  taskType: t.taskType,
                  sortOrder: t.sortOrder ?? 0,
                  isComplete: t.isComplete,
                  status:
                     (t.status as TaskStatus) ||
                     (t.isComplete ? "COMPLETED" : "TODO"),
                  dueDate: t.dueDate ?? null,
                  createdAt: new Date(t.createdAt).toISOString(),
                  updatedAt: new Date(t.updatedAt).toISOString(),
                  completedAt: t.completedAt
                     ? new Date(t.completedAt).toISOString()
                     : null,
                  syncState: "synced",
               }));

               await putLocalCategories(seedCats);
               await putLocalTasks(seedTasks);
            }
         } catch (err) {
            logTaskSync("Error hydrating from IndexedDB:", err);
         }
      }

      hydrateFromIndexedDB();

      return () => {
         isCancelled = true;
         if (typeof window !== "undefined") {
            window.removeEventListener(TASKS_SYNCED_EVENT, handleSyncEvent);
         }
         cleanup();
      };
   }, [userId, userTasks]);

   const toggleDailyCollapse = (index: number) => {
      setDailyCategories((prev) =>
         prev.map((cat, i) =>
            i === index ? { ...cat, isCollapsed: !cat.isCollapsed } : cat
         )
      );
   };

   const toggleWeeklyCollapse = (index: number) => {
      setWeeklyCategories((prev) =>
         prev.map((cat, i) =>
            i === index ? { ...cat, isCollapsed: !cat.isCollapsed } : cat
         )
      );
   };

   const setTaskStatus = (
      catIndex: number,
      taskId: string,
      taskType: "daily" | "weekly",
      nextStatusOrCompleted: TaskStatus | boolean
   ) => {
      const nextStatus: TaskStatus =
         typeof nextStatusOrCompleted === "boolean"
            ? nextStatusOrCompleted
               ? "COMPLETED"
               : "TODO"
            : nextStatusOrCompleted;
      const nextCompleted = nextStatus === "COMPLETED";

      if (taskType === "daily") {
         const targetTask = dailyCategories[catIndex]?.tasks.find(
            (t) => t.id === taskId
         );
         if (!targetTask) return;
         const currentStatus = getTaskStatus(targetTask);
         if (currentStatus === nextStatus) return;

         setDailyCategories((prev) =>
            prev.map((cat, i) =>
               i === catIndex
                  ? {
                       ...cat,
                       tasks: cat.tasks.map((t) =>
                          t.id === taskId
                             ? {
                                  ...t,
                                  completed: nextCompleted,
                                  status: nextStatus,
                               }
                             : t
                       ),
                    }
                  : cat
            )
         );

         const nowIso = new Date().toISOString();
         const cat = dailyCategories[catIndex];
         if (cat?.id) {
            putLocalTask({
               id: taskId,
               userId: userId ?? null,
               categoryId: cat.id,
               title: targetTask.text,
               taskType: "DAILY",
               isComplete: nextCompleted,
               status: nextStatus,
               dueDate: targetTask.dueDate ?? null,
               createdAt: targetTask.createdAt || nowIso,
               updatedAt: nowIso,
               completedAt: nextCompleted ? nowIso : null,
               syncState: "pending",
            }).catch(() => {});
         }

         if (isLoggedIn && userId) {
            enqueueMutation({
               id: crypto.randomUUID(),
               entityType: "TASK",
               action: "TOGGLE",
               payload: {
                  taskId,
                  isComplete: nextCompleted,
                  status: nextStatus,
               },
               createdAt: Date.now(),
               retryCount: 0,
            })
               .then(() => {
                  scheduleSync(userId);
               })
               .catch(() => {});

            trackLogRocketEvent("TaskStatusChanged", {
               taskId,
               taskType: "daily",
               status: nextStatus,
               isComplete: nextCompleted,
            });
         }

         logTaskSync("Task status updated", {
            taskId,
            status: nextStatus,
            isComplete: nextCompleted,
         });
      } else {
         const targetTask = weeklyCategories[catIndex]?.tasks.find(
            (t) => t.id === taskId
         );
         if (!targetTask) return;
         const currentStatus = getTaskStatus(targetTask);
         if (currentStatus === nextStatus) return;

         setWeeklyCategories((prev) =>
            prev.map((cat, i) =>
               i === catIndex
                  ? {
                       ...cat,
                       tasks: cat.tasks.map((t) =>
                          t.id === taskId
                             ? {
                                  ...t,
                                  completed: nextCompleted,
                                  status: nextStatus,
                               }
                             : t
                       ),
                    }
                  : cat
            )
         );

         const nowIso = new Date().toISOString();
         const cat = weeklyCategories[catIndex];
         if (cat?.id) {
            putLocalTask({
               id: taskId,
               userId: userId ?? null,
               categoryId: cat.id,
               title: targetTask.text,
               taskType: "WEEKLY",
               isComplete: nextCompleted,
               status: nextStatus,
               dueDate: targetTask.dueDate ?? null,
               createdAt: targetTask.createdAt || nowIso,
               updatedAt: nowIso,
               completedAt: nextCompleted ? nowIso : null,
               syncState: "pending",
            }).catch(() => {});
         }

         if (isLoggedIn && userId) {
            enqueueMutation({
               id: crypto.randomUUID(),
               entityType: "TASK",
               action: "TOGGLE",
               payload: {
                  taskId,
                  isComplete: nextCompleted,
                  status: nextStatus,
               },
               createdAt: Date.now(),
               retryCount: 0,
            })
               .then(() => {
                  scheduleSync(userId);
               })
               .catch(() => {});

            trackLogRocketEvent("TaskStatusChanged", {
               taskId,
               taskType: "weekly",
               status: nextStatus,
               isComplete: nextCompleted,
            });
         }

         logTaskSync("Task status updated", {
            taskId,
            status: nextStatus,
            isComplete: nextCompleted,
         });
      }
   };

   const toggleDailyTask = (catIndex: number, taskId: string) => {
      const targetTask = dailyCategories[catIndex]?.tasks.find(
         (t) => t.id === taskId
      );
      if (!targetTask) return;
      const currentStatus = getTaskStatus(targetTask);
      const nextStatus: TaskStatus =
         currentStatus === "COMPLETED" ? "TODO" : "COMPLETED";
      setTaskStatus(catIndex, taskId, "daily", nextStatus);
   };

   const toggleWeeklyTask = (catIndex: number, taskId: string) => {
      const targetTask = weeklyCategories[catIndex]?.tasks.find(
         (t) => t.id === taskId
      );
      if (!targetTask) return;
      const currentStatus = getTaskStatus(targetTask);
      const nextStatus: TaskStatus =
         currentStatus === "COMPLETED" ? "TODO" : "COMPLETED";
      setTaskStatus(catIndex, taskId, "weekly", nextStatus);
   };

   const handleDeleteTask = (
      catIndex: number,
      taskId: string,
      taskType: "daily" | "weekly"
   ) => {
      if (taskType === "daily") {
         const taskToDelete = dailyCategories[catIndex]?.tasks.find(
            (t) => t.id === taskId
         );
         if (taskToDelete) {
            const dateKey = getTaskDateKey(taskToDelete);
            const opt = dayOptions.find((d) => d.dateKey === dateKey);
            const isPast = opt?.isPast ?? dateKey < effectiveTodayDate;
            if (isPast) {
               return;
            }
         }
         setDailyCategories((prev) =>
            prev.map((cat, i) =>
               i === catIndex
                  ? {
                       ...cat,
                       tasks: cat.tasks.filter((t) => t.id !== taskId),
                    }
                  : cat
            )
         );
      } else {
         setWeeklyCategories((prev) =>
            prev.map((cat, i) =>
               i === catIndex
                  ? {
                       ...cat,
                       tasks: cat.tasks.filter((t) => t.id !== taskId),
                    }
                  : cat
            )
         );
      }

      deleteLocalTask(taskId).catch(() => {});

      if (isLoggedIn && userId) {
         enqueueMutation({
            id: crypto.randomUUID(),
            entityType: "TASK",
            action: "DELETE",
            payload: { taskId },
            createdAt: Date.now(),
            retryCount: 0,
         })
            .then(() => {
               scheduleSync(userId);
            })
            .catch(() => {});
      }

      logTaskSync("Task deleted", { taskId });
   };

   const handleSaveEditTask = (
      newText: string,
      newStatus: TaskStatus,
      newDueDate?: string | null
   ) => {
      if (!editTaskModal || !newText.trim()) return;
      const { id, catIdx, taskType } = editTaskModal;
      const trimmed = newText.trim();
      const nextCompleted = newStatus === "COMPLETED";
      const nowIso = new Date().toISOString();
      const resolvedDueDate =
         taskType === "daily"
            ? newDueDate !== undefined
               ? newDueDate
               : (editTaskModal.dueDate ?? selectedDateKey)
            : null;

      if (taskType === "daily" && resolvedDueDate) {
         const originalDateKey = editTaskModal.dueDate
            ? typeof editTaskModal.dueDate === "string"
               ? editTaskModal.dueDate.slice(0, 10)
               : new Date(editTaskModal.dueDate).toISOString().slice(0, 10)
            : editTaskModal.createdAt
              ? new Date(editTaskModal.createdAt).toISOString().slice(0, 10)
              : effectiveTodayDate;

         const check = validateMoveTaskChallengeDay(
            originalDateKey,
            resolvedDueDate,
            effectiveTodayDate
         );
         if (!check.ok) {
            return;
         }
      }

      if (taskType === "daily") {
         setDailyCategories((prev) =>
            prev.map((cat, i) =>
               i === catIdx
                  ? {
                       ...cat,
                       tasks: cat.tasks.map((t) =>
                          t.id === id
                             ? {
                                  ...t,
                                  text: trimmed,
                                  completed: nextCompleted,
                                  status: newStatus,
                                  dueDate: resolvedDueDate,
                               }
                             : t
                       ),
                    }
                  : cat
            )
         );
      } else {
         setWeeklyCategories((prev) =>
            prev.map((cat, i) =>
               i === catIdx
                  ? {
                       ...cat,
                       tasks: cat.tasks.map((t) =>
                          t.id === id
                             ? {
                                  ...t,
                                  text: trimmed,
                                  completed: nextCompleted,
                                  status: newStatus,
                               }
                             : t
                       ),
                    }
                  : cat
            )
         );
      }

      const cat =
         taskType === "daily"
            ? dailyCategories[catIdx]
            : weeklyCategories[catIdx];
      if (cat?.id) {
         putLocalTask({
            id,
            userId: userId ?? null,
            categoryId: cat.id,
            title: trimmed,
            taskType: taskType === "daily" ? "DAILY" : "WEEKLY",
            isComplete: nextCompleted,
            status: newStatus,
            dueDate: resolvedDueDate,
            createdAt: editTaskModal.createdAt || nowIso,
            updatedAt: nowIso,
            completedAt: nextCompleted ? nowIso : null,
            syncState: "pending",
         }).catch(() => {});
      }

      if (isLoggedIn && userId) {
         enqueueMutation({
            id: crypto.randomUUID(),
            entityType: "TASK",
            action: "UPDATE",
            payload: {
               taskId: id,
               title: trimmed,
               isComplete: nextCompleted,
               status: newStatus,
               dueDate: resolvedDueDate,
            },
            createdAt: Date.now(),
            retryCount: 0,
         })
            .then(() => {
               scheduleSync(userId);
            })
            .catch(() => {});

         startTransition(async () => {
            try {
               await updateTaskAction({
                  taskId: id,
                  title: trimmed,
                  isComplete: nextCompleted,
                  status: newStatus,
                  dueDate: resolvedDueDate,
               });
            } catch (err) {
               logTaskSync("Failed to update task on server", err);
            }
         });
      }

      logTaskSync("Task updated", {
         taskId: id,
         title: trimmed,
         status: newStatus,
         isComplete: nextCompleted,
         dueDate: resolvedDueDate,
      });
      setEditTaskModal(null);
   };

   const moveTaskToDay = (
      taskId: string,
      targetDateKey: string,
      sourceCatIdx?: number,
      sourceColumn: "daily" | "weekly" = "daily"
   ) => {
      const targetOpt = dayOptions.find((d) => d.dateKey === targetDateKey);
      const isTargetPast =
         targetOpt?.isPast ?? targetDateKey < effectiveTodayDate;

      // If source is weekly
      if (sourceColumn === "weekly") {
         if (isTargetPast) return;
         const foundWeeklyCatIdx =
            sourceCatIdx !== undefined
               ? sourceCatIdx
               : weeklyCategories.findIndex((c) =>
                    c.tasks.some((t) => t.id === taskId)
                 );
         if (foundWeeklyCatIdx === -1) return;
         const sourceCat = weeklyCategories[foundWeeklyCatIdx];
         let targetDailyIdx = dailyCategories.findIndex(
            (c) =>
               (sourceCat.id && c.id === sourceCat.id) ||
               c.name === sourceCat.name
         );
         let currentDailyCats = dailyCategories;
         if (targetDailyIdx === -1) {
            const newCatId = crypto.randomUUID();
            const newDailyCat: CategoryGroup = {
               id: newCatId,
               name: sourceCat.name,
               isCollapsed: false,
               tasks: [],
            };
            currentDailyCats = [...dailyCategories, newDailyCat];
            targetDailyIdx = currentDailyCats.length - 1;
            putLocalCategory({
               id: newCatId,
               userId: userId ?? null,
               name: sourceCat.name,
               taskType: "DAILY",
               sortOrder: targetDailyIdx,
               createdAt: new Date().toISOString(),
               updatedAt: new Date().toISOString(),
               syncState: "pending",
            }).catch(() => {});
            if (isLoggedIn && userId) {
               enqueueMutation({
                  id: crypto.randomUUID(),
                  entityType: "CATEGORY",
                  action: "CREATE",
                  payload: {
                     id: newCatId,
                     name: sourceCat.name,
                     taskType: "DAILY",
                     sortOrder: targetDailyIdx,
                  },
                  createdAt: Date.now(),
                  retryCount: 0,
               }).catch(() => {});
            }
         }

         const res = moveTaskBetweenCategories({
            taskId,
            sourceCategoryIndex: foundWeeklyCatIdx,
            sourceColumn: "weekly",
            targetCategoryIndex: targetDailyIdx,
            targetColumn: "daily",
            targetTaskIndex: currentDailyCats[targetDailyIdx].tasks.length,
            targetDueDate: targetDateKey,
            dailyCategories: currentDailyCats,
            weeklyCategories,
         });

         setDailyCategories(res.dailyCategories);
         setWeeklyCategories(res.weeklyCategories);

         if (res.movedTask && res.targetCategoryId) {
            const nowIso = new Date().toISOString();
            const isMovedComplete = Boolean(
               res.movedTask.completed ?? res.movedTask.isComplete
            );
            const movedStatus =
               (res.movedTask.status as TaskStatus) ||
               (isMovedComplete ? "COMPLETED" : "TODO");
            putLocalTask({
               id: res.movedTask.id,
               userId: userId ?? null,
               categoryId: res.targetCategoryId,
               title: res.movedTask.text ?? res.movedTask.title ?? "",
               taskType: "DAILY",
               sortOrder: currentDailyCats[targetDailyIdx].tasks.length,
               isComplete: isMovedComplete,
               status: movedStatus,
               dueDate: targetDateKey,
               createdAt: res.movedTask.createdAt
                  ? new Date(res.movedTask.createdAt).toISOString()
                  : nowIso,
               updatedAt: nowIso,
               completedAt: isMovedComplete ? nowIso : null,
               syncState: "pending",
            }).catch(() => {});

            if (isLoggedIn && userId) {
               enqueueMutation({
                  id: crypto.randomUUID(),
                  entityType: "TASK",
                  action: "MOVE",
                  payload: {
                     taskId: res.movedTask.id,
                     categoryId: res.targetCategoryId,
                     taskType: "DAILY",
                     sortOrder: currentDailyCats[targetDailyIdx].tasks.length,
                     dueDate: targetDateKey,
                  },
                  createdAt: Date.now(),
                  retryCount: 0,
               })
                  .then(() => scheduleSync(userId))
                  .catch(() => {});
            }
         }
         return;
      }

      // Source is daily
      let foundCatIdx = sourceCatIdx;
      let foundTask: TaskItem | undefined;
      if (foundCatIdx !== undefined && dailyCategories[foundCatIdx]) {
         foundTask = dailyCategories[foundCatIdx].tasks.find(
            (t) => t.id === taskId
         );
      }
      if (!foundTask) {
         for (let ci = 0; ci < dailyCategories.length; ci++) {
            const t = dailyCategories[ci].tasks.find(
               (item) => item.id === taskId
            );
            if (t) {
               foundCatIdx = ci;
               foundTask = t;
               break;
            }
         }
      }
      if (!foundTask || foundCatIdx === undefined) return;

      const sourceDateKey = getTaskDateKey(foundTask);
      const validation = validateMoveTaskChallengeDay(
         sourceDateKey,
         targetDateKey,
         effectiveTodayDate
      );
      if (!validation.ok) return;

      const nowIso = new Date().toISOString();
      const targetCat = dailyCategories[foundCatIdx];

      setDailyCategories((prev) =>
         prev.map((cat, ci) =>
            ci === foundCatIdx
               ? {
                    ...cat,
                    tasks: cat.tasks.map((t) =>
                       t.id === taskId ? { ...t, dueDate: targetDateKey } : t
                    ),
                 }
               : cat
         )
      );

      if (targetCat?.id) {
         const isComplete = Boolean(foundTask.completed);
         putLocalTask({
            id: foundTask.id,
            userId: userId ?? null,
            categoryId: targetCat.id,
            title: foundTask.text,
            taskType: "DAILY",
            isComplete,
            status: getTaskStatus(foundTask),
            dueDate: targetDateKey,
            createdAt: foundTask.createdAt
               ? new Date(foundTask.createdAt).toISOString()
               : nowIso,
            updatedAt: nowIso,
            completedAt: isComplete ? nowIso : null,
            syncState: "pending",
         }).catch(() => {});
      }

      if (isLoggedIn && userId) {
         enqueueMutation({
            id: crypto.randomUUID(),
            entityType: "TASK",
            action: "UPDATE",
            payload: {
               taskId: foundTask.id,
               dueDate: targetDateKey,
            },
            createdAt: Date.now(),
            retryCount: 0,
         })
            .then(() => {
               scheduleSync(userId);
            })
            .catch(() => {});

         startTransition(async () => {
            try {
               await updateTaskAction({
                  taskId: foundTask!.id,
                  dueDate: targetDateKey,
               });
            } catch (err) {
               logTaskSync("Failed to update task day on server", err);
            }
         });
      }

      logTaskSync("Task moved to day", {
         taskId,
         sourceDateKey,
         targetDateKey,
      });
   };

   const moveCategoryToDayAction = (
      catIdx: number,
      targetDateKey: string,
      sourceColumn: "daily" | "weekly" = "daily"
   ) => {
      const targetOpt = dayOptions.find((d) => d.dateKey === targetDateKey);
      const isTargetPast =
         targetOpt?.isPast ?? targetDateKey < effectiveTodayDate;

      if (sourceColumn === "weekly") {
         if (isTargetPast) return;
         if (catIdx < 0 || catIdx >= weeklyCategories.length) return;
         const sourceCat = weeklyCategories[catIdx];
         if (!sourceCat) return;

         const res = moveCategoryToDay<TaskItem, CategoryGroup>({
            categoryIndex: catIdx,
            sourceColumn: "weekly",
            targetDateKey,
            dailyCategories,
            weeklyCategories,
         });

         setDailyCategories(res.dailyCategories);
         setWeeklyCategories(res.weeklyCategories);

         if (res.movedCategory?.id) {
            const nowIso = new Date().toISOString();
            const catId = res.movedCategory.id;

            putLocalCategory({
               id: catId,
               userId: userId ?? null,
               name: res.movedCategory.name,
               taskType: "DAILY",
               sortOrder: dailyCategories.length,
               createdAt: nowIso,
               updatedAt: nowIso,
               syncState: "pending",
            }).catch(() => {});

            if (res.movedTasks.length > 0) {
               const tasksToUpdate: LocalTaskRecord[] = res.movedTasks.map(
                  (t, idx) => ({
                     id: t.id,
                     userId: userId ?? null,
                     categoryId: catId,
                     title: t.text || "",
                     taskType: "DAILY",
                     sortOrder: idx,
                     isComplete: Boolean(t.completed),
                     status: getTaskStatus(t),
                     dueDate: targetDateKey,
                     createdAt: t.createdAt || nowIso,
                     updatedAt: nowIso,
                     completedAt: t.completed ? nowIso : null,
                     syncState: "pending",
                  })
               );
               putLocalTasks(tasksToUpdate).catch(() => {});
            }

            const allCatsToUpdate: LocalCategoryRecord[] = [
               ...res.dailyCategories
                  .filter((c): c is typeof c & { id: string } => Boolean(c.id))
                  .map((c, idx) => ({
                     id: c.id,
                     userId: userId ?? null,
                     name: c.name,
                     taskType: "DAILY" as const,
                     sortOrder: idx,
                     createdAt: nowIso,
                     updatedAt: nowIso,
                     syncState: "pending" as const,
                  })),
               ...res.weeklyCategories
                  .filter((c): c is typeof c & { id: string } => Boolean(c.id))
                  .map((c, idx) => ({
                     id: c.id,
                     userId: userId ?? null,
                     name: c.name,
                     taskType: "WEEKLY" as const,
                     sortOrder: idx,
                     createdAt: nowIso,
                     updatedAt: nowIso,
                     syncState: "pending" as const,
                  })),
            ];
            putLocalCategories(allCatsToUpdate).catch(() => {});

            if (isLoggedIn && userId) {
               enqueueMutation({
                  id: crypto.randomUUID(),
                  entityType: "CATEGORY",
                  action: "MOVE",
                  payload: {
                     categoryId: res.movedCategory.id,
                     taskType: "DAILY",
                     sortOrder: dailyCategories.length,
                  },
                  createdAt: Date.now(),
                  retryCount: 0,
               })
                  .then(() => scheduleSync(userId))
                  .catch(() => {});

               for (const t of res.movedTasks) {
                  enqueueMutation({
                     id: crypto.randomUUID(),
                     entityType: "TASK",
                     action: "MOVE",
                     payload: {
                        taskId: t.id,
                        categoryId: catId,
                        taskType: "DAILY",
                        dueDate: targetDateKey,
                     },
                     createdAt: Date.now(),
                     retryCount: 0,
                  }).catch(() => {});
               }
               scheduleSync(userId);

               trackLogRocketEvent("WeeklyCategoryMovedToDay", {
                  categoryId: res.movedCategory.id,
                  targetDateKey,
               });
            }

            logTaskSync("Weekly category moved to day via drag and drop", {
               categoryId: res.movedCategory.id,
               targetDateKey,
            });
         }
         return;
      }

      // sourceColumn === "daily"
      if (catIdx < 0 || catIdx >= dailyCategories.length) return;
      const sourceCat = dailyCategories[catIdx];
      if (!sourceCat) return;

      const sourceDateKey = selectedDateKey;
      const validation = validateMoveTaskChallengeDay(
         sourceDateKey,
         targetDateKey,
         effectiveTodayDate
      );
      if (!validation.ok) return;

      if (sourceDateKey === targetDateKey) return;

      const res = moveCategoryToDay<TaskItem, CategoryGroup>({
         categoryIndex: catIdx,
         sourceColumn: "daily",
         sourceDateKey,
         targetDateKey,
         dailyCategories,
         weeklyCategories,
      });

      setDailyCategories(res.dailyCategories);

      if (res.movedTasks.length > 0 && sourceCat.id) {
         const nowIso = new Date().toISOString();
         const catId = sourceCat.id;

         const tasksToUpdate: LocalTaskRecord[] = res.movedTasks.map(
            (t, idx) => ({
               id: t.id,
               userId: userId ?? null,
               categoryId: catId,
               title: t.text || "",
               taskType: "DAILY",
               sortOrder: idx,
               isComplete: Boolean(t.completed),
               status: getTaskStatus(t),
               dueDate: targetDateKey,
               createdAt: t.createdAt || nowIso,
               updatedAt: nowIso,
               completedAt: t.completed ? nowIso : null,
               syncState: "pending",
            })
         );
         putLocalTasks(tasksToUpdate).catch(() => {});

         if (isLoggedIn && userId) {
            for (const t of res.movedTasks) {
               enqueueMutation({
                  id: crypto.randomUUID(),
                  entityType: "TASK",
                  action: "MOVE",
                  payload: {
                     taskId: t.id,
                     categoryId: catId,
                     taskType: "DAILY",
                     dueDate: targetDateKey,
                  },
                  createdAt: Date.now(),
                  retryCount: 0,
               }).catch(() => {});
            }
            scheduleSync(userId);

            trackLogRocketEvent("DailyCategoryMovedToDay", {
               categoryId: catId,
               targetDateKey,
               tasksCount: res.movedTasks.length,
            });
         }

         logTaskSync("Daily category moved to day via drag and drop", {
            categoryId: catId,
            tasksCount: res.movedTasks.length,
            targetDateKey,
         });
      }
   };

   const handleSaveEditCategory = (newName: string) => {
      if (!editCategoryModal || !newName.trim()) return;
      const oldName = editCategoryModal.name;
      const trimmed = newName.trim();
      const catType = editCategoryModal.taskType;
      const catId =
         editCategoryModal.id ||
         (catType === "daily"
            ? dailyCategoryNameToId.get(oldName) ||
              dailyCategories.find((c) => c.name === oldName)?.id
            : weeklyCategoryNameToId.get(oldName) ||
              weeklyCategories.find((c) => c.name === oldName)?.id);

      if (oldName === trimmed) {
         setEditCategoryModal(null);
         return;
      }

      setDailyCategories((prev) =>
         prev.map((cat) =>
            (catId && cat.id === catId) || cat.name === oldName
               ? { ...cat, name: trimmed }
               : cat
         )
      );
      setWeeklyCategories((prev) =>
         prev.map((cat) =>
            (catId && cat.id === catId) || cat.name === oldName
               ? { ...cat, name: trimmed }
               : cat
         )
      );

      if (catId) {
         putLocalCategory({
            id: catId,
            userId: userId ?? null,
            name: trimmed,
            taskType: catType === "daily" ? "DAILY" : "WEEKLY",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncState: "pending",
         }).catch(() => {});
      }

      if (isLoggedIn && userId && catId) {
         enqueueMutation({
            id: crypto.randomUUID(),
            entityType: "CATEGORY",
            action: "UPDATE",
            payload: { categoryId: catId, name: trimmed },
            createdAt: Date.now(),
            retryCount: 0,
         })
            .then(() => {
               scheduleSync(userId);
            })
            .catch(() => {});
      }

      logTaskSync("Category updated", { categoryId: catId, name: trimmed });
      setEditCategoryModal(null);
   };

   const handleConfirmDeleteCategory = () => {
      if (!deleteCategoryModal) return;
      const targetName = deleteCategoryModal.name;
      const catType = deleteCategoryModal.taskType;
      const catId =
         deleteCategoryModal.id ||
         dailyCategoryNameToId.get(targetName) ||
         weeklyCategoryNameToId.get(targetName) ||
         dailyCategories.find((c) => c.name === targetName)?.id ||
         weeklyCategories.find((c) => c.name === targetName)?.id;

      const dailyTargetCat = dailyCategories.find((c) =>
         catId ? c.id === catId : catType === "daily" && c.name === targetName
      );
      const hasPastTasks = Boolean(
         dailyTargetCat?.tasks.some((t) => {
            const dateKey = getTaskDateKey(t);
            const opt = dayOptions.find((d) => d.dateKey === dateKey);
            return opt?.isPast ?? dateKey < effectiveTodayDate;
         })
      );

      if (hasPastTasks) {
         setDeleteCategoryModal(null);
         return;
      }

      if (catType === "weekly") {
         setWeeklyCategories((prev) =>
            prev.filter((cat) =>
               catId ? cat.id !== catId : cat.name !== targetName
            )
         );
         setDailyCategories((prev) =>
            prev.filter((cat) =>
               catId ? cat.id !== catId : cat.name !== targetName
            )
         );
      } else {
         setDailyCategories((prev) =>
            prev.filter((cat) =>
               catId ? cat.id !== catId : cat.name !== targetName
            )
         );
      }

      if (catId) {
         deleteLocalCategory(catId).catch(() => {});
      }

      if (isLoggedIn && userId && catId) {
         enqueueMutation({
            id: crypto.randomUUID(),
            entityType: "CATEGORY",
            action: "DELETE",
            payload: { categoryId: catId },
            createdAt: Date.now(),
            retryCount: 0,
         })
            .then(() => {
               scheduleSync(userId);
            })
            .catch(() => {});
      }

      logTaskSync("Category deleted", { categoryId: catId, name: targetName });
      setDeleteCategoryModal(null);
   };

   const totalDailyTasks = dailyCategories.reduce(
      (acc, cat) => acc + cat.tasks.length,
      0
   );
   const completedDailyTasks = dailyCategories.reduce(
      (acc, cat) => acc + cat.tasks.filter((t) => t.completed).length,
      0
   );

   const dailyTasksForSelectedDay = useMemo(() => {
      return dailyCategories.flatMap((cat) =>
         cat.tasks.filter((t) => getTaskDateKey(t) === selectedDateKey)
      );
   }, [dailyCategories, selectedDateKey, effectiveTodayDate]);

   const completedDailyTasksForDay = dailyTasksForSelectedDay.filter(
      (t) => t.completed
   ).length;
   const totalDailyTasksForDay = dailyTasksForSelectedDay.length;

   const dayTaskCounts = useMemo(() => {
      const counts = new Map<string, { total: number; completed: number }>();
      for (const opt of dayOptions) {
         counts.set(opt.dateKey, { total: 0, completed: 0 });
      }
      for (const cat of dailyCategories) {
         for (const task of cat.tasks) {
            const key = getTaskDateKey(task);
            const entry = counts.get(key);
            if (entry) {
               entry.total += 1;
               if (task.completed) entry.completed += 1;
            } else {
               counts.set(key, { total: 1, completed: task.completed ? 1 : 0 });
            }
         }
      }
      return counts;
   }, [dayOptions, dailyCategories, effectiveTodayDate]);

   const totalWeeklyTasks = weeklyCategories.reduce(
      (acc, cat) => acc + cat.tasks.length,
      0
   );
   const completedWeeklyTasks = weeklyCategories.reduce(
      (acc, cat) => acc + cat.tasks.filter((t) => t.completed).length,
      0
   );

   const handleAddTodoSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTodoText.trim()) return;

      const trimmedCustom = customCategory.trim();
      // If user typed a custom name that matches an existing weekly category, link to that parent category
      const matchingWeekly = trimmedCustom
         ? weeklyCategories.find(
              (c) => c.name.toLowerCase() === trimmedCustom.toLowerCase()
           ) ||
           userTasks?.categories?.find(
              (c) =>
                 c.taskType === "WEEKLY" &&
                 c.name.toLowerCase() === trimmedCustom.toLowerCase()
           )
         : undefined;

      const isNew = Boolean(
         isCreatingCategory && trimmedCustom && !matchingWeekly
      );
      const targetCategoryName =
         (isCreatingCategory && trimmedCustom
            ? matchingWeekly?.name || trimmedCustom
            : selectedCategory) || "General";
      const taskType = addModalType === "daily" ? "DAILY" : "WEEKLY";
      const resolvedDueDate =
         addModalType === "daily" ? addTodoDateKey || selectedDateKey : null;

      if (addModalType === "daily" && resolvedDueDate) {
         const targetOpt = dayOptions.find(
            (d) => d.dateKey === resolvedDueDate
         );
         const isPast =
            targetOpt?.isPast ?? resolvedDueDate < effectiveTodayDate;
         if (isPast) {
            return;
         }
      }

      const newTaskId = crypto.randomUUID();
      const nextCompleted = newTodoStatus === "COMPLETED";
      const newTask: TaskItem = {
         id: newTaskId,
         text: newTodoText.trim(),
         completed: nextCompleted,
         status: newTodoStatus,
         dueDate: resolvedDueDate,
      };

      let targetCatId: string | undefined = undefined;

      if (addModalType === "daily") {
         const existingInDaily = dailyCategories.find(
            (c) => c.name === targetCategoryName
         );
         const existingInWeekly = weeklyCategories.find(
            (c) => c.name === targetCategoryName
         );
         const existingInServer = userTasks?.categories?.find(
            (c) => c.name === targetCategoryName
         );

         targetCatId =
            existingInDaily?.id ||
            existingInWeekly?.id ||
            existingInServer?.id ||
            (isNew
               ? crypto.randomUUID()
               : dailyCategoryNameToId.get(targetCategoryName) ||
                 weeklyCategoryNameToId.get(targetCategoryName) ||
                 crypto.randomUUID());

         setDailyCategories((prev) => {
            const existingIndex = prev.findIndex(
               (c) => c.name === targetCategoryName
            );
            if (existingIndex >= 0) {
               return prev.map((cat, i) =>
                  i === existingIndex
                     ? {
                          ...cat,
                          id: cat.id || targetCatId,
                          isCollapsed: false,
                          tasks: [...cat.tasks, newTask],
                       }
                     : cat
               );
            } else {
               return [
                  ...prev,
                  {
                     id: targetCatId,
                     name: targetCategoryName,
                     isCollapsed: false,
                     tasks: [newTask],
                  },
               ];
            }
         });
      } else {
         const existingInWeekly = weeklyCategories.find(
            (c) => c.name === targetCategoryName
         );
         const existingInServer = userTasks?.categories?.find(
            (c) => c.name === targetCategoryName
         );

         targetCatId =
            existingInWeekly?.id ||
            existingInServer?.id ||
            (isNew
               ? crypto.randomUUID()
               : weeklyCategoryNameToId.get(targetCategoryName) ||
                 crypto.randomUUID());

         setWeeklyCategories((prev) => {
            const existingIndex = prev.findIndex(
               (c) => c.name === targetCategoryName
            );
            if (existingIndex >= 0) {
               return prev.map((cat, i) =>
                  i === existingIndex
                     ? {
                          ...cat,
                          id: cat.id || targetCatId,
                          isCollapsed: false,
                          tasks: [...cat.tasks, newTask],
                       }
                     : cat
               );
            } else {
               return [
                  ...prev,
                  {
                     id: targetCatId,
                     name: targetCategoryName,
                     isCollapsed: false,
                     tasks: [newTask],
                  },
               ];
            }
         });
      }

      const nowIso = new Date().toISOString();

      if (isNew && targetCatId) {
         putLocalCategory({
            id: targetCatId,
            userId: userId ?? null,
            name: targetCategoryName,
            taskType: addModalType === "daily" ? "DAILY" : "WEEKLY",
            createdAt: nowIso,
            updatedAt: nowIso,
            syncState: "pending",
         }).catch(() => {});
      }

      if (targetCatId) {
         putLocalTask({
            id: newTaskId,
            userId: userId ?? null,
            categoryId: targetCatId,
            challengeId: linkableChallengeId,
            title: newTodoText.trim(),
            taskType,
            isComplete: nextCompleted,
            status: newTodoStatus,
            dueDate: resolvedDueDate,
            createdAt: nowIso,
            updatedAt: nowIso,
            completedAt: nextCompleted ? nowIso : null,
            syncState: "pending",
         }).catch(() => {});
      }

      if (isLoggedIn && userId) {
         if (isNew && targetCatId) {
            enqueueMutation({
               id: crypto.randomUUID(),
               entityType: "CATEGORY",
               action: "CREATE",
               payload: {
                  id: targetCatId,
                  name: targetCategoryName,
                  taskType: addModalType === "daily" ? "DAILY" : "WEEKLY",
               },
               createdAt: Date.now(),
               retryCount: 0,
            }).catch(() => {});
         }

         enqueueMutation({
            id: crypto.randomUUID(),
            entityType: "TASK",
            action: "CREATE",
            payload: {
               id: newTaskId,
               categoryId: targetCatId,
               challengeId: linkableChallengeId,
               title: newTodoText.trim(),
               taskType,
               isComplete: nextCompleted,
               status: newTodoStatus,
               dueDate: resolvedDueDate,
            },
            createdAt: Date.now() + 1,
            retryCount: 0,
         })
            .then(() => {
               scheduleSync(userId);
            })
            .catch(() => {});

         trackLogRocketEvent("TaskCreated", {
            taskType,
            isNewCategory: isNew,
         });
      }

      logTaskSync("Task created", {
         id: newTaskId,
         title: newTodoText.trim(),
         dueDate: resolvedDueDate,
      });

      setNewTodoText("");
      setNewTodoStatus("TODO");
      setCustomCategory("");
      setIsCreatingCategory(false);
      setAddModalType(null);
   };

   // ---------------------------------------------------------------------------
   // Drag and Drop Event Handlers
   // ---------------------------------------------------------------------------

   const handleTaskDragStart = (
      e: React.DragEvent,
      taskId: string,
      catIdx: number,
      column: "daily" | "weekly"
   ) => {
      e.stopPropagation();
      const pool = column === "daily" ? dailyCategories : weeklyCategories;
      const sourceTask = pool[catIdx]?.tasks.find((t) => t.id === taskId);
      const sourceDateKey = sourceTask
         ? getTaskDateKey(sourceTask)
         : column === "daily"
           ? selectedDateKey
           : undefined;

      setDraggedItem({
         type: "task",
         id: taskId,
         sourceCatIdx: catIdx,
         sourceColumn: column,
         sourceDateKey,
      });
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData(
         "application/json",
         JSON.stringify({ type: "task", taskId, catIdx, column, sourceDateKey })
      );

      const targetEl = e.currentTarget as HTMLElement;
      const cardEl = targetEl.closest<HTMLElement>('[data-drag-card="task"]');
      if (cardEl && e.dataTransfer && e.dataTransfer.setDragImage) {
         const rect = cardEl.getBoundingClientRect();
         const offsetX = Math.max(
            16,
            Math.min(e.clientX - rect.left, rect.width - 16)
         );
         const offsetY = Math.max(
            12,
            Math.min(e.clientY - rect.top, rect.height - 12)
         );
         e.dataTransfer.setDragImage(cardEl, offsetX, offsetY);
      }
   };

   const handleCategoryDragStart = (
      e: React.DragEvent,
      catIdx: number,
      column: "daily" | "weekly"
   ) => {
      e.stopPropagation();
      const sourceDateKey = column === "daily" ? selectedDateKey : undefined;
      setDraggedItem({
         type: "category",
         sourceCatIdx: catIdx,
         sourceColumn: column,
         sourceDateKey,
      });
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData(
         "application/json",
         JSON.stringify({ type: "category", catIdx, column, sourceDateKey })
      );

      const targetEl = e.currentTarget as HTMLElement;
      const cardEl = targetEl.closest<HTMLElement>(
         '[data-drag-card="category"]'
      );
      if (cardEl && e.dataTransfer && e.dataTransfer.setDragImage) {
         const rect = cardEl.getBoundingClientRect();
         const offsetX = Math.max(
            20,
            Math.min(e.clientX - rect.left, rect.width - 20)
         );
         const offsetY = 20;
         e.dataTransfer.setDragImage(cardEl, offsetX, offsetY);
      }
   };

   const handleDragEnd = () => {
      setDraggedItem(null);
      setDragOverInfo(null);
   };

   const handleTaskDragOver = (
      e: React.DragEvent,
      targetTaskId: string,
      targetCatIdx: number,
      targetColumn: "daily" | "weekly"
   ) => {
      if (!draggedItem) return;
      if (draggedItem.type === "category") {
         handleCategoryDragOver(e, targetCatIdx, targetColumn);
         return;
      }
      if (draggedItem.type !== "task") return;
      e.preventDefault();
      e.stopPropagation();

      if (
         targetColumn === "daily" &&
         draggedItem.sourceColumn === "weekly" &&
         isActiveDayPast
      ) {
         e.dataTransfer.dropEffect = "none";
         return;
      }

      e.dataTransfer.dropEffect = "move";
      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position = e.clientY < midY ? "above" : "below";

      setDragOverInfo({
         type: "task",
         targetId: targetTaskId,
         targetCatIdx,
         targetColumn,
         position,
      });
   };

   const handleCategoryDragOver = (
      e: React.DragEvent,
      targetCatIdx: number,
      targetColumn: "daily" | "weekly"
   ) => {
      if (!draggedItem) return;
      e.preventDefault();
      e.stopPropagation();

      if (
         targetColumn === "daily" &&
         draggedItem.sourceColumn === "weekly" &&
         isActiveDayPast
      ) {
         e.dataTransfer.dropEffect = "none";
         return;
      }

      e.dataTransfer.dropEffect = "move";
      if (draggedItem.type === "category") {
         const rect = e.currentTarget.getBoundingClientRect();
         const midY = rect.top + rect.height / 2;
         const position = e.clientY < midY ? "above" : "below";
         setDragOverInfo({
            type: "category",
            targetCatIdx,
            targetColumn,
            position,
         });
      } else if (draggedItem.type === "task") {
         setDragOverInfo({
            type: "category",
            targetCatIdx,
            targetColumn,
         });
      }
   };

   const handleColumnDragOver = (
      e: React.DragEvent,
      targetColumn: "daily" | "weekly"
   ) => {
      if (!draggedItem) return;
      if (
         targetColumn === "daily" &&
         draggedItem.sourceColumn === "weekly" &&
         isActiveDayPast
      ) {
         e.dataTransfer.dropEffect = "none";
         return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!dragOverInfo || dragOverInfo.targetColumn !== targetColumn) {
         setDragOverInfo({
            type: "column",
            targetColumn,
         });
      }
   };

   const handleDayPillDragOver = (
      e: React.DragEvent,
      opt: ChallengeDayOption
   ) => {
      if (!draggedItem) return;
      e.preventDefault();
      e.stopPropagation();

      if (draggedItem.sourceColumn === "daily") {
         const sourceDateKey = draggedItem.sourceDateKey || selectedDateKey;
         const validation = validateMoveTaskChallengeDay(
            sourceDateKey,
            opt.dateKey,
            effectiveTodayDate
         );
         if (!validation.ok) {
            e.dataTransfer.dropEffect = "none";
            if (!dragOverInfo || dragOverInfo.targetDateKey !== opt.dateKey) {
               setDragOverInfo({
                  type: "day",
                  targetDateKey: opt.dateKey,
               });
            }
            return;
         }
      } else if (draggedItem.sourceColumn === "weekly") {
         if (opt.isPast) {
            e.dataTransfer.dropEffect = "none";
            if (!dragOverInfo || dragOverInfo.targetDateKey !== opt.dateKey) {
               setDragOverInfo({
                  type: "day",
                  targetDateKey: opt.dateKey,
               });
            }
            return;
         }
      }

      e.dataTransfer.dropEffect = "move";
      if (!dragOverInfo || dragOverInfo.targetDateKey !== opt.dateKey) {
         setDragOverInfo({
            type: "day",
            targetDateKey: opt.dateKey,
         });
      }
   };

   const handleDayPillDrop = (e: React.DragEvent, opt: ChallengeDayOption) => {
      e.preventDefault();
      e.stopPropagation();

      if (!draggedItem) {
         handleDragEnd();
         return;
      }

      if (draggedItem.type === "category") {
         if (draggedItem.sourceColumn === "daily") {
            const sourceDateKey = draggedItem.sourceDateKey || selectedDateKey;
            const validation = validateMoveTaskChallengeDay(
               sourceDateKey,
               opt.dateKey,
               effectiveTodayDate
            );
            if (!validation.ok) {
               handleDragEnd();
               return;
            }
            moveCategoryToDayAction(
               draggedItem.sourceCatIdx,
               opt.dateKey,
               "daily"
            );
         } else if (draggedItem.sourceColumn === "weekly") {
            if (opt.isPast) {
               handleDragEnd();
               return;
            }
            moveCategoryToDayAction(
               draggedItem.sourceCatIdx,
               opt.dateKey,
               "weekly"
            );
         }
         handleDragEnd();
         return;
      }

      if (draggedItem.type === "task" && draggedItem.id) {
         if (draggedItem.sourceColumn === "daily") {
            const sourceDateKey = draggedItem.sourceDateKey || selectedDateKey;
            const validation = validateMoveTaskChallengeDay(
               sourceDateKey,
               opt.dateKey,
               effectiveTodayDate
            );
            if (!validation.ok) {
               handleDragEnd();
               return;
            }
            moveTaskToDay(
               draggedItem.id,
               opt.dateKey,
               draggedItem.sourceCatIdx,
               "daily"
            );
         } else if (draggedItem.sourceColumn === "weekly") {
            if (opt.isPast) {
               handleDragEnd();
               return;
            }
            moveTaskToDay(
               draggedItem.id,
               opt.dateKey,
               draggedItem.sourceCatIdx,
               "weekly"
            );
         }
      }

      handleDragEnd();
   };

   const handleTaskDrop = (
      e: React.DragEvent,
      targetTaskId: string,
      targetCatIdx: number,
      targetColumn: "daily" | "weekly"
   ) => {
      e.preventDefault();
      e.stopPropagation();

      if (!draggedItem) {
         handleDragEnd();
         return;
      }

      if (draggedItem.type === "category") {
         handleCategoryDrop(e, targetCatIdx, targetColumn);
         return;
      }

      if (draggedItem.type !== "task" || !draggedItem.id) {
         handleDragEnd();
         return;
      }

      if (
         targetColumn === "daily" &&
         draggedItem.sourceColumn === "weekly" &&
         isActiveDayPast
      ) {
         handleDragEnd();
         return;
      }

      const targetCategories =
         targetColumn === "daily" ? dailyCategories : weeklyCategories;
      const targetCat = targetCategories[targetCatIdx];
      if (!targetCat) {
         handleDragEnd();
         return;
      }

      const targetIndexInCat = targetCat.tasks.findIndex(
         (t) => t.id === targetTaskId
      );
      const destIdx =
         dragOverInfo?.position === "below"
            ? targetIndexInCat + 1
            : targetIndexInCat;

      const isMovingWeeklyToDaily =
         draggedItem.sourceColumn === "weekly" && targetColumn === "daily";
      const isMovingDailyToWeekly =
         draggedItem.sourceColumn === "daily" && targetColumn === "weekly";
      const targetDueDate = isMovingWeeklyToDaily
         ? selectedDateKey
         : isMovingDailyToWeekly
           ? null
           : undefined;

      const res = moveTaskBetweenCategories({
         taskId: draggedItem.id,
         sourceCategoryIndex: draggedItem.sourceCatIdx,
         sourceColumn: draggedItem.sourceColumn,
         targetCategoryIndex: targetCatIdx,
         targetColumn,
         targetTaskIndex: Math.max(0, destIdx),
         targetDueDate,
         dailyCategories,
         weeklyCategories,
      });

      setDailyCategories(res.dailyCategories);
      setWeeklyCategories(res.weeklyCategories);

      if (res.movedTask && res.targetCategoryId) {
         const nowIso = new Date().toISOString();
         const targetCats =
            res.targetTaskType === "DAILY"
               ? res.dailyCategories
               : res.weeklyCategories;
         const targetCatGroup = targetCats[targetCatIdx];

         if (targetCatGroup && targetCatGroup.tasks.length > 0) {
            const tasksToUpdate: LocalTaskRecord[] = targetCatGroup.tasks.map(
               (t, idx) => ({
                  id: t.id,
                  userId: userId ?? null,
                  categoryId: res.targetCategoryId!,
                  title: t.text,
                  taskType: res.targetTaskType,
                  sortOrder: idx,
                  isComplete: t.completed,
                  status: getTaskStatus(t),
                  dueDate: t.dueDate ?? null,
                  createdAt: t.createdAt || nowIso,
                  updatedAt: nowIso,
                  completedAt: t.completed ? nowIso : null,
                  syncState: "pending",
               })
            );
            putLocalTasks(tasksToUpdate).catch(() => {});
         } else {
            const isMovedComplete = Boolean(
               res.movedTask.completed ?? res.movedTask.isComplete
            );
            const movedStatus =
               (res.movedTask.status as TaskStatus) ||
               (isMovedComplete ? "COMPLETED" : "TODO");
            putLocalTask({
               id: res.movedTask.id,
               userId: userId ?? null,
               categoryId: res.targetCategoryId,
               title: res.movedTask.text ?? res.movedTask.title ?? "",
               taskType: res.targetTaskType,
               sortOrder: destIdx,
               isComplete: isMovedComplete,
               status: movedStatus,
               dueDate: res.movedTask.dueDate ?? null,
               createdAt: res.movedTask.createdAt
                  ? new Date(res.movedTask.createdAt).toISOString()
                  : nowIso,
               updatedAt: nowIso,
               completedAt: isMovedComplete ? nowIso : null,
               syncState: "pending",
            }).catch(() => {});
         }

         if (isLoggedIn && userId) {
            enqueueMutation({
               id: crypto.randomUUID(),
               entityType: "TASK",
               action: "MOVE",
               payload: {
                  taskId: res.movedTask.id,
                  categoryId: res.targetCategoryId,
                  taskType: res.targetTaskType,
                  sortOrder: destIdx,
                  dueDate: res.movedTask.dueDate ?? null,
               },
               createdAt: Date.now(),
               retryCount: 0,
            })
               .then(() => {
                  scheduleSync(userId);
               })
               .catch(() => {});

            trackLogRocketEvent("TaskMoved", {
               taskId: res.movedTask.id,
               targetTaskType: res.targetTaskType,
            });
         }

         logTaskSync("Task moved via drag and drop", {
            taskId: res.movedTask.id,
            targetCatIdx,
            targetColumn,
         });
      }

      handleDragEnd();
   };

   const handleCategoryDrop = (
      e: React.DragEvent,
      targetCatIdx: number,
      targetColumn: "daily" | "weekly"
   ) => {
      e.preventDefault();
      e.stopPropagation();

      if (!draggedItem) {
         handleDragEnd();
         return;
      }

      if (
         targetColumn === "daily" &&
         draggedItem.sourceColumn === "weekly" &&
         isActiveDayPast
      ) {
         handleDragEnd();
         return;
      }

      if (draggedItem.type === "category") {
         let destIndex: number;
         if (draggedItem.sourceColumn === targetColumn) {
            if (draggedItem.sourceCatIdx === targetCatIdx) {
               handleDragEnd();
               return;
            }
            destIndex = calculateReorderIndex(
               draggedItem.sourceCatIdx,
               targetCatIdx,
               dragOverInfo?.position || "above"
            );
         } else {
            destIndex =
               dragOverInfo?.position === "below"
                  ? targetCatIdx + 1
                  : targetCatIdx;
         }

         const isMovingWeeklyToDaily =
            draggedItem.sourceColumn === "weekly" && targetColumn === "daily";
         const isMovingDailyToWeekly =
            draggedItem.sourceColumn === "daily" && targetColumn === "weekly";
         const targetDueDate = isMovingWeeklyToDaily
            ? selectedDateKey
            : isMovingDailyToWeekly
              ? null
              : undefined;

         const res = moveCategoryBetweenColumns({
            categoryIndex: draggedItem.sourceCatIdx,
            sourceColumn: draggedItem.sourceColumn,
            targetColumn,
            targetIndex: destIndex,
            targetDueDate,
            dailyCategories,
            weeklyCategories,
         });

         setDailyCategories(res.dailyCategories);
         setWeeklyCategories(res.weeklyCategories);

         if (res.movedCategory?.id) {
            const nowIso = new Date().toISOString();
            const catId = res.movedCategory.id;
            const targetType = res.targetTaskType;

            putLocalCategory({
               id: catId,
               userId: userId ?? null,
               name: res.movedCategory.name,
               taskType: targetType,
               sortOrder: destIndex,
               createdAt: nowIso,
               updatedAt: nowIso,
               syncState: "pending",
            }).catch(() => {});

            // Cascade taskType and dueDate to all tasks inside this category in IndexedDB
            if (res.movedCategory.tasks && res.movedCategory.tasks.length > 0) {
               const tasksToUpdate: LocalTaskRecord[] =
                  res.movedCategory.tasks.map((t, idx) => ({
                     id: t.id,
                     userId: userId ?? null,
                     categoryId: catId,
                     title: t.text,
                     taskType: targetType,
                     sortOrder: idx,
                     isComplete: t.completed,
                     status: getTaskStatus(t),
                     dueDate: t.dueDate ?? null,
                     createdAt: t.createdAt || nowIso,
                     updatedAt: nowIso,
                     completedAt: t.completed ? nowIso : null,
                     syncState: "pending",
                  }));
               putLocalTasks(tasksToUpdate).catch(() => {});
            }

            // Persist updated sortOrder for all categories in both columns
            const allCatsToUpdate: LocalCategoryRecord[] = [
               ...res.dailyCategories
                  .filter((c): c is typeof c & { id: string } => Boolean(c.id))
                  .map((c, idx) => ({
                     id: c.id,
                     userId: userId ?? null,
                     name: c.name,
                     taskType: "DAILY" as const,
                     sortOrder: idx,
                     createdAt: nowIso,
                     updatedAt: nowIso,
                     syncState: "pending" as const,
                  })),
               ...res.weeklyCategories
                  .filter((c): c is typeof c & { id: string } => Boolean(c.id))
                  .map((c, idx) => ({
                     id: c.id,
                     userId: userId ?? null,
                     name: c.name,
                     taskType: "WEEKLY" as const,
                     sortOrder: idx,
                     createdAt: nowIso,
                     updatedAt: nowIso,
                     syncState: "pending" as const,
                  })),
            ];

            putLocalCategories(allCatsToUpdate).catch(() => {});

            if (isLoggedIn && userId) {
               enqueueMutation({
                  id: crypto.randomUUID(),
                  entityType: "CATEGORY",
                  action: "MOVE",
                  payload: {
                     categoryId: res.movedCategory.id,
                     taskType: res.targetTaskType,
                     sortOrder: destIndex,
                  },
                  createdAt: Date.now(),
                  retryCount: 0,
               })
                  .then(() => {
                     scheduleSync(userId);
                  })
                  .catch(() => {});

               if (
                  isMovingWeeklyToDaily &&
                  res.movedCategory.tasks &&
                  res.movedCategory.tasks.length > 0
               ) {
                  for (const t of res.movedCategory.tasks) {
                     enqueueMutation({
                        id: crypto.randomUUID(),
                        entityType: "TASK",
                        action: "MOVE",
                        payload: {
                           taskId: t.id,
                           categoryId: catId,
                           taskType: "DAILY",
                           dueDate: selectedDateKey,
                        },
                        createdAt: Date.now(),
                        retryCount: 0,
                     }).catch(() => {});
                  }
                  scheduleSync(userId);
               }

               trackLogRocketEvent("CategoryMoved", {
                  categoryId: res.movedCategory.id,
                  targetTaskType: res.targetTaskType,
               });
            }

            logTaskSync("Category moved via drag and drop", {
               categoryId: res.movedCategory.id,
               targetColumn,
            });
         }
      } else if (draggedItem.type === "task" && draggedItem.id) {
         // Dropping a task into a category header
         const isMovingWeeklyToDaily =
            draggedItem.sourceColumn === "weekly" && targetColumn === "daily";
         const isMovingDailyToWeekly =
            draggedItem.sourceColumn === "daily" && targetColumn === "weekly";
         const targetDueDate = isMovingWeeklyToDaily
            ? selectedDateKey
            : isMovingDailyToWeekly
              ? null
              : undefined;

         const res = moveTaskBetweenCategories({
            taskId: draggedItem.id,
            sourceCategoryIndex: draggedItem.sourceCatIdx,
            sourceColumn: draggedItem.sourceColumn,
            targetCategoryIndex: targetCatIdx,
            targetColumn,
            targetTaskIndex: 0,
            targetDueDate,
            dailyCategories,
            weeklyCategories,
         });

         setDailyCategories(res.dailyCategories);
         setWeeklyCategories(res.weeklyCategories);

         if (res.movedTask && res.targetCategoryId) {
            const nowIso = new Date().toISOString();
            const isMovedComplete = Boolean(
               res.movedTask.completed ?? res.movedTask.isComplete
            );
            const movedStatus =
               (res.movedTask.status as TaskStatus) ||
               (isMovedComplete ? "COMPLETED" : "TODO");
            putLocalTask({
               id: res.movedTask.id,
               userId: userId ?? null,
               categoryId: res.targetCategoryId,
               title: res.movedTask.text ?? res.movedTask.title ?? "",
               taskType: res.targetTaskType,
               sortOrder: 0,
               isComplete: isMovedComplete,
               status: movedStatus,
               dueDate: res.movedTask.dueDate ?? null,
               createdAt: res.movedTask.createdAt
                  ? new Date(res.movedTask.createdAt).toISOString()
                  : nowIso,
               updatedAt: nowIso,
               completedAt: isMovedComplete ? nowIso : null,
               syncState: "pending",
            }).catch(() => {});

            if (isLoggedIn && userId) {
               enqueueMutation({
                  id: crypto.randomUUID(),
                  entityType: "TASK",
                  action: "MOVE",
                  payload: {
                     taskId: res.movedTask.id,
                     categoryId: res.targetCategoryId,
                     taskType: res.targetTaskType,
                     sortOrder: 0,
                     dueDate: res.movedTask.dueDate ?? null,
                  },
                  createdAt: Date.now(),
                  retryCount: 0,
               })
                  .then(() => {
                     scheduleSync(userId);
                  })
                  .catch(() => {});
            }
         }
      }

      handleDragEnd();
   };

   const handleColumnDrop = (
      e: React.DragEvent,
      targetColumn: "daily" | "weekly"
   ) => {
      e.preventDefault();
      e.stopPropagation();

      if (!draggedItem) {
         handleDragEnd();
         return;
      }

      if (
         targetColumn === "daily" &&
         draggedItem.sourceColumn === "weekly" &&
         isActiveDayPast
      ) {
         handleDragEnd();
         return;
      }

      const targetCategories =
         targetColumn === "daily" ? dailyCategories : weeklyCategories;

      if (draggedItem.type === "category") {
         const destIndex = targetCategories.length;
         const isMovingWeeklyToDaily =
            draggedItem.sourceColumn === "weekly" && targetColumn === "daily";
         const isMovingDailyToWeekly =
            draggedItem.sourceColumn === "daily" && targetColumn === "weekly";
         const targetDueDate = isMovingWeeklyToDaily
            ? selectedDateKey
            : isMovingDailyToWeekly
              ? null
              : undefined;

         const res = moveCategoryBetweenColumns({
            categoryIndex: draggedItem.sourceCatIdx,
            sourceColumn: draggedItem.sourceColumn,
            targetColumn,
            targetIndex: destIndex,
            targetDueDate,
            dailyCategories,
            weeklyCategories,
         });

         setDailyCategories(res.dailyCategories);
         setWeeklyCategories(res.weeklyCategories);

         if (res.movedCategory?.id) {
            const nowIso = new Date().toISOString();
            const catId = res.movedCategory.id;
            const targetType = res.targetTaskType;

            putLocalCategory({
               id: catId,
               userId: userId ?? null,
               name: res.movedCategory.name,
               taskType: targetType,
               sortOrder: destIndex,
               createdAt: nowIso,
               updatedAt: nowIso,
               syncState: "pending",
            }).catch(() => {});

            if (res.movedCategory.tasks && res.movedCategory.tasks.length > 0) {
               const tasksToUpdate: LocalTaskRecord[] =
                  res.movedCategory.tasks.map((t, idx) => ({
                     id: t.id,
                     userId: userId ?? null,
                     categoryId: catId,
                     title: t.text,
                     taskType: targetType,
                     sortOrder: idx,
                     isComplete: t.completed,
                     status: getTaskStatus(t),
                     dueDate: t.dueDate ?? null,
                     createdAt: t.createdAt || nowIso,
                     updatedAt: nowIso,
                     completedAt: t.completed ? nowIso : null,
                     syncState: "pending",
                  }));
               putLocalTasks(tasksToUpdate).catch(() => {});
            }

            const allCatsToUpdate: LocalCategoryRecord[] = [
               ...res.dailyCategories
                  .filter((c): c is typeof c & { id: string } => Boolean(c.id))
                  .map((c, idx) => ({
                     id: c.id,
                     userId: userId ?? null,
                     name: c.name,
                     taskType: "DAILY" as const,
                     sortOrder: idx,
                     createdAt: nowIso,
                     updatedAt: nowIso,
                     syncState: "pending" as const,
                  })),
               ...res.weeklyCategories
                  .filter((c): c is typeof c & { id: string } => Boolean(c.id))
                  .map((c, idx) => ({
                     id: c.id,
                     userId: userId ?? null,
                     name: c.name,
                     taskType: "WEEKLY" as const,
                     sortOrder: idx,
                     createdAt: nowIso,
                     updatedAt: nowIso,
                     syncState: "pending" as const,
                  })),
            ];

            putLocalCategories(allCatsToUpdate).catch(() => {});

            if (isLoggedIn && userId) {
               enqueueMutation({
                  id: crypto.randomUUID(),
                  entityType: "CATEGORY",
                  action: "MOVE",
                  payload: {
                     categoryId: res.movedCategory.id,
                     taskType: res.targetTaskType,
                     sortOrder: destIndex,
                  },
                  createdAt: Date.now(),
                  retryCount: 0,
               })
                  .then(() => {
                     scheduleSync(userId);
                  })
                  .catch(() => {});
            }
         }
      } else if (draggedItem.type === "task" && draggedItem.id) {
         if (
            targetColumn === "daily" &&
            draggedItem.sourceColumn === "weekly"
         ) {
            const sourceCat = weeklyCategories[draggedItem.sourceCatIdx];
            if (sourceCat) {
               let targetDailyIdx = dailyCategories.findIndex(
                  (c) =>
                     (sourceCat.id && c.id === sourceCat.id) ||
                     c.name === sourceCat.name
               );
               let currentDailyCats = dailyCategories;
               if (targetDailyIdx === -1) {
                  const newCatId = crypto.randomUUID();
                  const newDailyCat: CategoryGroup = {
                     id: newCatId,
                     name: sourceCat.name,
                     isCollapsed: false,
                     tasks: [],
                  };
                  currentDailyCats = [...dailyCategories, newDailyCat];
                  targetDailyIdx = currentDailyCats.length - 1;

                  putLocalCategory({
                     id: newCatId,
                     userId: userId ?? null,
                     name: sourceCat.name,
                     taskType: "DAILY",
                     sortOrder: targetDailyIdx,
                     createdAt: new Date().toISOString(),
                     updatedAt: new Date().toISOString(),
                     syncState: "pending",
                  }).catch(() => {});

                  if (isLoggedIn && userId) {
                     enqueueMutation({
                        id: crypto.randomUUID(),
                        entityType: "CATEGORY",
                        action: "CREATE",
                        payload: {
                           id: newCatId,
                           name: sourceCat.name,
                           taskType: "DAILY",
                           sortOrder: targetDailyIdx,
                        },
                        createdAt: Date.now(),
                        retryCount: 0,
                     }).catch(() => {});
                  }
               }

               const res = moveTaskBetweenCategories({
                  taskId: draggedItem.id,
                  sourceCategoryIndex: draggedItem.sourceCatIdx,
                  sourceColumn: "weekly",
                  targetCategoryIndex: targetDailyIdx,
                  targetColumn: "daily",
                  targetTaskIndex:
                     currentDailyCats[targetDailyIdx].tasks.length,
                  targetDueDate: selectedDateKey,
                  dailyCategories: currentDailyCats,
                  weeklyCategories,
               });

               setDailyCategories(res.dailyCategories);
               setWeeklyCategories(res.weeklyCategories);

               if (res.movedTask && res.targetCategoryId) {
                  const nowIso = new Date().toISOString();
                  const isMovedComplete = Boolean(
                     res.movedTask.completed ?? res.movedTask.isComplete
                  );
                  const movedStatus =
                     (res.movedTask.status as TaskStatus) ||
                     (isMovedComplete ? "COMPLETED" : "TODO");
                  putLocalTask({
                     id: res.movedTask.id,
                     userId: userId ?? null,
                     categoryId: res.targetCategoryId,
                     title: res.movedTask.text ?? res.movedTask.title ?? "",
                     taskType: res.targetTaskType,
                     sortOrder: currentDailyCats[targetDailyIdx].tasks.length,
                     isComplete: isMovedComplete,
                     status: movedStatus,
                     dueDate: res.movedTask.dueDate ?? selectedDateKey,
                     createdAt: res.movedTask.createdAt
                        ? new Date(res.movedTask.createdAt).toISOString()
                        : nowIso,
                     updatedAt: nowIso,
                     completedAt: isMovedComplete ? nowIso : null,
                     syncState: "pending",
                  }).catch(() => {});

                  if (isLoggedIn && userId) {
                     enqueueMutation({
                        id: crypto.randomUUID(),
                        entityType: "TASK",
                        action: "MOVE",
                        payload: {
                           taskId: res.movedTask.id,
                           categoryId: res.targetCategoryId,
                           taskType: res.targetTaskType,
                           sortOrder:
                              currentDailyCats[targetDailyIdx].tasks.length,
                           dueDate: selectedDateKey,
                        },
                        createdAt: Date.now(),
                        retryCount: 0,
                     })
                        .then(() => {
                           scheduleSync(userId);
                        })
                        .catch(() => {});
                  }
               }
            }
         } else if (targetCategories.length > 0) {
            const lastCatIdx = targetCategories.length - 1;
            const isMovingWeeklyToDaily =
               draggedItem.sourceColumn === "weekly" &&
               targetColumn === "daily";
            const isMovingDailyToWeekly =
               draggedItem.sourceColumn === "daily" &&
               targetColumn === "weekly";
            const targetDueDate = isMovingWeeklyToDaily
               ? selectedDateKey
               : isMovingDailyToWeekly
                 ? null
                 : undefined;

            const res = moveTaskBetweenCategories({
               taskId: draggedItem.id,
               sourceCategoryIndex: draggedItem.sourceCatIdx,
               sourceColumn: draggedItem.sourceColumn,
               targetCategoryIndex: lastCatIdx,
               targetColumn,
               targetTaskIndex: targetCategories[lastCatIdx].tasks.length,
               targetDueDate,
               dailyCategories,
               weeklyCategories,
            });

            setDailyCategories(res.dailyCategories);
            setWeeklyCategories(res.weeklyCategories);

            if (res.movedTask && res.targetCategoryId) {
               const nowIso = new Date().toISOString();
               const isMovedComplete = Boolean(
                  res.movedTask.completed ?? res.movedTask.isComplete
               );
               const movedStatus =
                  (res.movedTask.status as TaskStatus) ||
                  (isMovedComplete ? "COMPLETED" : "TODO");
               putLocalTask({
                  id: res.movedTask.id,
                  userId: userId ?? null,
                  categoryId: res.targetCategoryId,
                  title: res.movedTask.text ?? res.movedTask.title ?? "",
                  taskType: res.targetTaskType,
                  sortOrder: targetCategories[lastCatIdx].tasks.length,
                  isComplete: isMovedComplete,
                  status: movedStatus,
                  dueDate: res.movedTask.dueDate ?? null,
                  createdAt: res.movedTask.createdAt
                     ? new Date(res.movedTask.createdAt).toISOString()
                     : nowIso,
                  updatedAt: nowIso,
                  completedAt: isMovedComplete ? nowIso : null,
                  syncState: "pending",
               }).catch(() => {});

               if (isLoggedIn && userId) {
                  enqueueMutation({
                     id: crypto.randomUUID(),
                     entityType: "TASK",
                     action: "MOVE",
                     payload: {
                        taskId: res.movedTask.id,
                        categoryId: res.targetCategoryId,
                        taskType: res.targetTaskType,
                        sortOrder: targetCategories[lastCatIdx].tasks.length,
                        dueDate: res.movedTask.dueDate ?? null,
                     },
                     createdAt: Date.now(),
                     retryCount: 0,
                  })
                     .then(() => {
                        scheduleSync(userId);
                     })
                     .catch(() => {});
               }
            }
         }
      }

      handleDragEnd();
   };

   return (
      <>
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Daily Todos */}
            <div
               onDragOver={(e) => handleColumnDragOver(e, "daily")}
               onDrop={(e) => handleColumnDrop(e, "daily")}
               className={`rounded-2xl border bg-surface-primary p-6 shadow-md flex flex-col justify-between space-y-5 transition-all ${
                  dragOverInfo?.type === "column" &&
                  dragOverInfo.targetColumn === "daily"
                     ? "border-brand-2 ring-1 ring-brand-2/50 bg-surface-secondary"
                     : "border-border-default"
               }`}
            >
               <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                     <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white">
                           Daily Todos
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-meta font-semibold bg-surface-nested text-text-secondary border border-border-strong inline-flex items-center gap-1.5">
                           {activeDayOption.shortLabel}
                           {isActiveDayToday && (
                              <span
                                 className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                                 title="Today"
                              />
                           )}
                           {isActiveDayPast && (
                              <span className="text-label text-text-tertiary flex items-center gap-1 font-normal">
                                 <Lock className="h-3 w-3 text-text-tertiary" />
                                 Locked
                              </span>
                           )}
                        </span>
                        {!isActiveDayToday && (
                           <button
                              type="button"
                              onClick={handleJumpToToday}
                              className="text-meta font-medium text-brand-2 hover:text-brand-1 underline transition-colors"
                           >
                              Today
                           </button>
                        )}
                     </div>
                     <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-text-secondary">
                           {completedDailyTasksForDay}/{totalDailyTasksForDay}{" "}
                           Completed
                        </span>
                     </div>
                  </div>

                  {/* 7-Day Pill Switcher (Fits all 7 days without horizontal scrolling) */}
                  <div
                     role="tablist"
                     aria-label="Challenge Day Tabs"
                     className="grid grid-cols-7 gap-1 sm:gap-1.5 w-full pt-0.5 pb-1"
                  >
                     {dayOptions.map((opt) => {
                        const isSelected = opt.dateKey === selectedDateKey;
                        const stats = dayTaskCounts.get(opt.dateKey) || {
                           total: 0,
                           completed: 0,
                        };
                        const allDone =
                           stats.total > 0 && stats.completed === stats.total;

                        const isDayDropTarget =
                           dragOverInfo?.type === "day" &&
                           dragOverInfo.targetDateKey === opt.dateKey;
                        let isDropAllowedOnOpt = true;
                        if (
                           draggedItem?.type === "task" ||
                           draggedItem?.type === "category"
                        ) {
                           if (draggedItem.sourceColumn === "daily") {
                              const sourceKey =
                                 draggedItem.sourceDateKey || selectedDateKey;
                              isDropAllowedOnOpt = validateMoveTaskChallengeDay(
                                 sourceKey,
                                 opt.dateKey,
                                 effectiveTodayDate
                              ).ok;
                           } else if (draggedItem.sourceColumn === "weekly") {
                              isDropAllowedOnOpt = !opt.isPast;
                           }
                        }

                        return (
                           <button
                              key={opt.dateKey}
                              type="button"
                              role="tab"
                              aria-selected={isSelected}
                              onClick={() => handleSelectDay(opt)}
                              onDragOver={(e) => handleDayPillDragOver(e, opt)}
                              onDragLeave={(e) => {
                                 e.preventDefault();
                                 if (
                                    dragOverInfo?.type === "day" &&
                                    dragOverInfo.targetDateKey === opt.dateKey
                                 ) {
                                    setDragOverInfo(null);
                                 }
                              }}
                              onDrop={(e) => handleDayPillDrop(e, opt)}
                              title={
                                 draggedItem?.type === "task"
                                    ? !isDropAllowedOnOpt
                                       ? `${opt.label} (Cannot move to past day)`
                                       : `Move task to ${opt.label}`
                                    : draggedItem?.type === "category"
                                      ? !isDropAllowedOnOpt
                                         ? `${opt.label} (Cannot move to past day)`
                                         : `Move category to ${opt.label}`
                                      : opt.isToday
                                        ? "Today"
                                        : opt.isYesterday
                                          ? `Yesterday (${opt.label})`
                                          : opt.label
                              }
                              className={`w-full min-w-0 py-1.5 px-0.5 sm:px-1 rounded-xl text-center border transition-all flex flex-col items-center justify-between min-h-[54px] sm:min-h-[58px] overflow-hidden ${
                                 (draggedItem?.type === "task" ||
                                    draggedItem?.type === "category") &&
                                 isDayDropTarget
                                    ? isDropAllowedOnOpt
                                       ? "bg-emerald-950/40 border-emerald-500 text-white shadow-md ring-2 ring-emerald-500 scale-[1.02]"
                                       : "bg-red-950/30 border-red-500/50 text-red-300 ring-2 ring-red-500/60 cursor-not-allowed opacity-60"
                                    : (draggedItem?.type === "task" ||
                                           draggedItem?.type === "category") &&
                                        !isDropAllowedOnOpt
                                      ? "bg-surface-primary border-border-default text-text-tertiary opacity-40 cursor-not-allowed border-dashed"
                                      : isSelected
                                        ? "bg-brand-1/15 border-brand-2 text-white shadow-sm ring-1 ring-brand-2/60"
                                        : "bg-surface-elevated border-border-strong text-text-tertiary hover:bg-surface-nested hover:text-white"
                              }`}
                           >
                              <span className="text-label sm:text-meta font-bold uppercase tracking-tight leading-none truncate max-w-full">
                                 {opt.isToday
                                    ? "Today"
                                    : opt.shortLabel.startsWith("Day ")
                                      ? `D${opt.dayNumber}`
                                      : opt.shortLabel.slice(0, 3)}
                              </span>
                              <span className="text-micro sm:text-caption opacity-75 mt-0.5 leading-none truncate max-w-full">
                                 {formatDayDate(opt.dateKey)}
                              </span>
                              <div className="mt-1 flex items-center justify-center gap-0.5 sm:gap-1 min-h-[14px] w-full">
                                 {draggedItem?.type === "task" &&
                                 !isDropAllowedOnOpt ? (
                                    <Lock className="h-2.5 w-2.5 text-red-400/70" />
                                 ) : (
                                    <>
                                       {opt.isToday && (
                                          <span
                                             className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                                isSelected
                                                   ? "bg-brand-2"
                                                   : "bg-emerald-400"
                                             }`}
                                             title="Today"
                                          />
                                       )}
                                       {stats.total > 0 && (
                                          <span
                                             className={`text-micro sm:text-caption font-semibold px-0.5 sm:px-1 rounded leading-tight truncate ${
                                                allDone
                                                   ? "bg-emerald-500/20 text-emerald-400"
                                                   : isSelected
                                                     ? "bg-brand-2/20 text-brand-2"
                                                     : "bg-surface-nested text-text-tertiary"
                                             }`}
                                          >
                                             {stats.completed}/{stats.total}
                                          </span>
                                       )}
                                    </>
                                 )}
                              </div>
                           </button>
                        );
                     })}
                  </div>

                  <div className="space-y-3">
                     {totalDailyTasksForDay === 0 ? (
                        <div className="rounded-xl border border-dashed border-border-strong bg-surface-tertiary/50 p-6 text-center space-y-2">
                           <Calendar className="h-6 w-6 text-text-tertiary mx-auto mb-1" />
                           <p className="text-sm font-medium text-text-secondary">
                              No todos scheduled for{" "}
                              {activeDayOption.shortLabel} (
                              {formatDayDate(activeDayOption.dateKey)})
                           </p>
                           <p className="text-xs text-text-tertiary">
                              {isActiveDayPast
                                 ? "This challenge day has passed. New tasks cannot be added to past days."
                                 : isActiveDayToday
                                   ? "Organize your daily study commitments by adding your first task."
                                   : `Plan ahead for ${activeDayOption.shortLabel} of the challenge.`}
                           </p>
                           {isActiveDayPast ? (
                              <div className="pt-2 flex items-center justify-center gap-1.5 text-xs text-text-tertiary">
                                 <Lock className="h-3.5 w-3.5 text-text-tertiary" />
                                 <span>
                                    Adding tasks to past days is locked
                                 </span>
                              </div>
                           ) : (
                              <div className="pt-2">
                                 <Button
                                    type="button"
                                    onClick={() =>
                                       openAddDailyModal(selectedDateKey)
                                    }
                                    className="h-8 px-4 rounded-full bg-surface-nested hover:bg-surface-nested text-white text-xs font-semibold border border-border-strong"
                                 >
                                    + Add todo for {activeDayOption.shortLabel}
                                 </Button>
                              </div>
                           )}
                        </div>
                     ) : (
                        dailyCategories.map((cat, catIdx) => {
                           const dayTasks = cat.tasks.filter(
                              (task) => getTaskDateKey(task) === selectedDateKey
                           );
                           if (dayTasks.length === 0 && cat.tasks.length > 0)
                              return null;

                           const isCatDragging =
                              draggedItem?.type === "category" &&
                              draggedItem.sourceColumn === "daily" &&
                              draggedItem.sourceCatIdx === catIdx;
                           const isCatOver =
                              dragOverInfo?.type === "category" &&
                              dragOverInfo.targetColumn === "daily" &&
                              dragOverInfo.targetCatIdx === catIdx;

                           return (
                              <div
                                 key={cat.id || cat.name}
                                 data-drag-card="category"
                                 onDragOver={(e) =>
                                    handleCategoryDragOver(e, catIdx, "daily")
                                 }
                                 onDrop={(e) =>
                                    handleCategoryDrop(e, catIdx, "daily")
                                 }
                                 className={`rounded-xl bg-surface-nested overflow-hidden border transition-all ${
                                    isCatDragging
                                       ? "opacity-30 border-dashed border-brand-2 bg-surface-elevated scale-[0.99]"
                                       : ""
                                 } ${
                                    isCatOver &&
                                    dragOverInfo?.position === "above"
                                       ? "border-t-2 border-t-[#e08a32] border-border-strong"
                                       : isCatOver &&
                                           dragOverInfo?.position === "below"
                                         ? "border-b-2 border-b-[#e08a32] border-border-strong"
                                         : isCatOver
                                           ? "border-brand-2"
                                           : "border-border-strong"
                                 }`}
                              >
                                 <ContextMenu modal={false}>
                                    <ContextMenuTrigger
                                       asChild
                                       disabled={!isLoggedIn}
                                    >
                                       <div
                                          draggable
                                          onDragStart={(e) =>
                                             handleCategoryDragStart(
                                                e,
                                                catIdx,
                                                "daily"
                                             )
                                          }
                                          onDragEnd={handleDragEnd}
                                          onClick={() =>
                                             toggleDailyCollapse(catIdx)
                                          }
                                          className="w-full flex items-center justify-between px-3 py-3 text-left font-medium text-sm text-white hover:bg-surface-nested transition-colors cursor-grab active:cursor-grabbing select-none"
                                       >
                                          <div
                                             className="p-1 -ml-1 mr-1 text-text-tertiary hover:text-brand-2 rounded transition-colors shrink-0"
                                             title="Drag category to reorder, move to day or across boards"
                                             aria-label={`Drag category ${cat.name}`}
                                          >
                                             <GripVertical className="h-4 w-4" />
                                          </div>
                                          <span className="truncate flex-1 pr-2">
                                             {cat.name}
                                          </span>
                                          <div
                                             className="flex items-center gap-1.5 shrink-0"
                                             onDragStart={(e) =>
                                                e.stopPropagation()
                                             }
                                             onClick={(e) =>
                                                e.stopPropagation()
                                             }
                                          >
                                             {isLoggedIn && (
                                                <DropdownMenu modal={false}>
                                                   <DropdownMenuTrigger asChild>
                                                      <button
                                                         type="button"
                                                         className="p-1 rounded-md text-text-tertiary hover:text-white hover:bg-input-bg data-[state=open]:text-white data-[state=open]:bg-input-bg transition-colors"
                                                         title="Category options"
                                                         aria-label={`Options for category ${cat.name}`}
                                                      >
                                                         <MoreVertical className="h-4 w-4" />
                                                      </button>
                                                   </DropdownMenuTrigger>
                                                   <DropdownMenuContent
                                                      align="end"
                                                      className="min-w-dropdown-min"
                                                   >
                                                      <CategoryMenuItems
                                                         cat={cat}
                                                         catType="daily"
                                                         dailyCategories={
                                                            dailyCategories
                                                         }
                                                         weeklyCategories={
                                                            weeklyCategories
                                                         }
                                                         selectedDateKey={
                                                            selectedDateKey
                                                         }
                                                         effectiveTodayDate={
                                                            effectiveTodayDate
                                                         }
                                                         dayOptions={dayOptions}
                                                         onMoveCategoryToDay={(
                                                            targetDateKey
                                                         ) =>
                                                            moveCategoryToDayAction(
                                                               catIdx,
                                                               targetDateKey,
                                                               "daily"
                                                            )
                                                         }
                                                         onRenameCategory={() => {
                                                            setEditCategoryModal(
                                                               {
                                                                  id: cat.id,
                                                                  name: cat.name,
                                                                  taskType:
                                                                     "daily",
                                                               }
                                                            );
                                                            setEditCategoryInputName(
                                                               cat.name
                                                            );
                                                         }}
                                                         onDeleteCategory={() => {
                                                            setDeleteCategoryModal(
                                                               {
                                                                  id: cat.id,
                                                                  name: cat.name,
                                                                  taskType:
                                                                     "daily",
                                                               }
                                                            );
                                                         }}
                                                         Item={DropdownMenuItem}
                                                         Separator={
                                                            DropdownMenuSeparator
                                                         }
                                                         Label={
                                                            DropdownMenuLabel
                                                         }
                                                      />
                                                   </DropdownMenuContent>
                                                </DropdownMenu>
                                             )}
                                             {cat.isCollapsed ? (
                                                <ChevronDown className="h-4 w-4 text-text-tertiary" />
                                             ) : (
                                                <ChevronUp className="h-4 w-4 text-text-tertiary" />
                                             )}
                                          </div>
                                       </div>
                                    </ContextMenuTrigger>
                                    {isLoggedIn && (
                                       <ContextMenuContent className="min-w-dropdown-min">
                                          <CategoryMenuItems
                                             cat={cat}
                                             catType="daily"
                                             dailyCategories={dailyCategories}
                                             weeklyCategories={weeklyCategories}
                                             selectedDateKey={selectedDateKey}
                                             effectiveTodayDate={
                                                effectiveTodayDate
                                             }
                                             dayOptions={dayOptions}
                                             onMoveCategoryToDay={(
                                                targetDateKey
                                             ) =>
                                                moveCategoryToDayAction(
                                                   catIdx,
                                                   targetDateKey,
                                                   "daily"
                                                )
                                             }
                                             onRenameCategory={() => {
                                                setEditCategoryModal({
                                                   id: cat.id,
                                                   name: cat.name,
                                                   taskType: "daily",
                                                });
                                                setEditCategoryInputName(
                                                   cat.name
                                                );
                                             }}
                                             onDeleteCategory={() => {
                                                setDeleteCategoryModal({
                                                   id: cat.id,
                                                   name: cat.name,
                                                   taskType: "daily",
                                                });
                                             }}
                                             Item={ContextMenuItem}
                                             Separator={ContextMenuSeparator}
                                             Label={ContextMenuLabel}
                                          />
                                       </ContextMenuContent>
                                    )}
                                 </ContextMenu>

                                 {!cat.isCollapsed && (
                                    <div className="px-4 pb-3 pt-1 space-y-2.5 border-t border-border-strong">
                                       {dayTasks.length === 0 ? (
                                          <p className="text-xs text-text-tertiary py-1">
                                             No daily tasks in this category for{" "}
                                             {activeDayOption.shortLabel}.
                                          </p>
                                       ) : (
                                          dayTasks.map((task) => {
                                             const isTaskDragging =
                                                draggedItem?.type === "task" &&
                                                draggedItem.id === task.id;
                                             const isTaskOver =
                                                dragOverInfo?.type === "task" &&
                                                dragOverInfo.targetId ===
                                                   task.id;

                                             return (
                                                <ContextMenu
                                                   key={task.id}
                                                   modal={false}
                                                >
                                                   <ContextMenuTrigger
                                                      asChild
                                                      disabled={!isLoggedIn}
                                                   >
                                                      <div
                                                         data-drag-card="task"
                                                         onDragOver={(e) =>
                                                            handleTaskDragOver(
                                                               e,
                                                               task.id,
                                                               catIdx,
                                                               "daily"
                                                            )
                                                         }
                                                         onDrop={(e) =>
                                                            handleTaskDrop(
                                                               e,
                                                               task.id,
                                                               catIdx,
                                                               "daily"
                                                            )
                                                         }
                                                         className={`flex items-start justify-between gap-2 p-1.5 rounded-lg hover:bg-surface-nested transition-all group ${
                                                            isTaskDragging
                                                               ? "opacity-30 border border-dashed border-brand-2 bg-surface-elevated"
                                                               : ""
                                                         } ${
                                                            isTaskOver &&
                                                            dragOverInfo?.position ===
                                                               "above"
                                                               ? "border-t-2 border-t-[#e08a32]"
                                                               : isTaskOver &&
                                                                   dragOverInfo?.position ===
                                                                      "below"
                                                                 ? "border-b-2 border-b-[#e08a32]"
                                                                 : ""
                                                         }`}
                                                      >
                                                         <div
                                                            draggable
                                                            onDragStart={(e) =>
                                                               handleTaskDragStart(
                                                                  e,
                                                                  task.id,
                                                                  catIdx,
                                                                  "daily"
                                                               )
                                                            }
                                                            onDragEnd={
                                                               handleDragEnd
                                                            }
                                                            onClick={(e) =>
                                                               e.stopPropagation()
                                                            }
                                                            className="p-1 -ml-1 text-text-tertiary hover:text-brand-2 cursor-grab active:cursor-grabbing rounded transition-colors shrink-0 mt-0.5"
                                                            title="Drag task to reorder or move across categories"
                                                            aria-label={`Drag task ${task.text}`}
                                                         >
                                                            <GripVertical className="h-3.5 w-3.5" />
                                                         </div>
                                                         {(() => {
                                                            const status =
                                                               getTaskStatus(
                                                                  task
                                                               );
                                                            return (
                                                               <>
                                                                  <div
                                                                     role="checkbox"
                                                                     aria-checked={
                                                                        status ===
                                                                        "COMPLETED"
                                                                     }
                                                                     onClick={() =>
                                                                        toggleDailyTask(
                                                                           catIdx,
                                                                           task.id
                                                                        )
                                                                     }
                                                                     className="flex items-start gap-3 cursor-pointer flex-1 min-w-0"
                                                                     title={
                                                                        status ===
                                                                        "COMPLETED"
                                                                           ? "Status: Completed. Click to reset to To-Do"
                                                                           : status ===
                                                                               "IN_PROGRESS"
                                                                             ? "Status: In Progress. Click to mark Completed"
                                                                             : status ===
                                                                                 "CROSSED_OUT"
                                                                               ? "Status: Crossed Out. Click to mark Completed"
                                                                               : "Status: To-Do. Click to mark Completed"
                                                                     }
                                                                  >
                                                                     <div
                                                                        className={`h-5 w-5 rounded flex items-center justify-center border transition-all shrink-0 mt-0.5 ${
                                                                           status ===
                                                                           "COMPLETED"
                                                                              ? "bg-white border-white text-text-inverse"
                                                                              : status ===
                                                                                  "IN_PROGRESS"
                                                                                ? "border-amber-400/80 bg-amber-500/15 text-amber-400"
                                                                                : status ===
                                                                                    "CROSSED_OUT"
                                                                                  ? "border-rose-500/80 bg-rose-500/15 text-rose-400"
                                                                                  : "border-white bg-transparent group-hover:border-gray-300"
                                                                        }`}
                                                                     >
                                                                        {status ===
                                                                           "COMPLETED" && (
                                                                           <Check className="h-3.5 w-3.5 stroke-[3]" />
                                                                        )}
                                                                        {status ===
                                                                           "IN_PROGRESS" && (
                                                                           <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                                                                        )}
                                                                        {status ===
                                                                           "CROSSED_OUT" && (
                                                                           <X className="h-3.5 w-3.5 stroke-[2.5]" />
                                                                        )}
                                                                     </div>
                                                                     <div className="flex-1 min-w-0">
                                                                        <span
                                                                           title={
                                                                              task.text
                                                                           }
                                                                           className={`text-sm break-words leading-snug block ${
                                                                              expandedTaskIds.has(
                                                                                 task.id
                                                                              )
                                                                                 ? ""
                                                                                 : "line-clamp-2"
                                                                           } ${
                                                                              status ===
                                                                              "COMPLETED"
                                                                                 ? "text-text-tertiary line-through"
                                                                                 : status ===
                                                                                     "CROSSED_OUT"
                                                                                   ? "text-text-tertiary line-through decoration-rose-500/60"
                                                                                   : status ===
                                                                                       "IN_PROGRESS"
                                                                                     ? "text-white font-medium"
                                                                                     : "text-white"
                                                                           }`}
                                                                        >
                                                                           {
                                                                              task.text
                                                                           }
                                                                        </span>
                                                                        {(task
                                                                           .text
                                                                           .length >
                                                                           45 ||
                                                                           task.text.includes(
                                                                              "\n"
                                                                           )) && (
                                                                           <button
                                                                              type="button"
                                                                              onClick={(
                                                                                 e
                                                                              ) =>
                                                                                 toggleTaskExpand(
                                                                                    task.id,
                                                                                    e
                                                                                 )
                                                                              }
                                                                              title={
                                                                                 expandedTaskIds.has(
                                                                                    task.id
                                                                                 )
                                                                                    ? "Show less"
                                                                                    : "Show full task description"
                                                                              }
                                                                              className="text-text-tertiary hover:text-white text-xs font-medium mt-0.5 inline-flex items-center gap-1 transition-colors select-none group/expand"
                                                                           >
                                                                              <span>
                                                                                 {expandedTaskIds.has(
                                                                                    task.id
                                                                                 )
                                                                                    ? "Show less"
                                                                                    : "Show more"}
                                                                              </span>
                                                                              <ChevronDown
                                                                                 className={`h-3 w-3 transition-transform duration-200 ${
                                                                                    expandedTaskIds.has(
                                                                                       task.id
                                                                                    )
                                                                                       ? "rotate-180"
                                                                                       : ""
                                                                                 }`}
                                                                              />
                                                                           </button>
                                                                        )}
                                                                     </div>
                                                                  </div>

                                                                  {status ===
                                                                     "COMPLETED" && (
                                                                     <button
                                                                        type="button"
                                                                        onClick={(
                                                                           e
                                                                        ) => {
                                                                           e.stopPropagation();
                                                                           setTaskStatus(
                                                                              catIdx,
                                                                              task.id,
                                                                              "daily",
                                                                              "TODO"
                                                                           );
                                                                        }}
                                                                        title="Status: Completed. Click to reset to To-Do"
                                                                        className="shrink-0 px-2 py-0.5 rounded-md text-label font-semibold tracking-wide uppercase transition-colors border mt-0.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                                                     >
                                                                        Completed
                                                                     </button>
                                                                  )}
                                                                  {status ===
                                                                     "IN_PROGRESS" && (
                                                                     <button
                                                                        type="button"
                                                                        onClick={(
                                                                           e
                                                                        ) => {
                                                                           e.stopPropagation();
                                                                           setTaskStatus(
                                                                              catIdx,
                                                                              task.id,
                                                                              "daily",
                                                                              "COMPLETED"
                                                                           );
                                                                        }}
                                                                        title="Status: In Progress. Click to mark Completed"
                                                                        className="shrink-0 px-2 py-0.5 rounded-md text-label font-semibold tracking-wide uppercase transition-colors border mt-0.5 bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                                                                     >
                                                                        In
                                                                        Progress
                                                                     </button>
                                                                  )}
                                                                  {status ===
                                                                     "CROSSED_OUT" && (
                                                                     <button
                                                                        type="button"
                                                                        onClick={(
                                                                           e
                                                                        ) => {
                                                                           e.stopPropagation();
                                                                           setTaskStatus(
                                                                              catIdx,
                                                                              task.id,
                                                                              "daily",
                                                                              "TODO"
                                                                           );
                                                                        }}
                                                                        title="Status: Crossed Out. Click to reset to To-Do"
                                                                        className="shrink-0 px-2 py-0.5 rounded-md text-label font-semibold tracking-wide uppercase transition-colors border mt-0.5 bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                                                                     >
                                                                        Crossed
                                                                        Out
                                                                     </button>
                                                                  )}
                                                               </>
                                                            );
                                                         })()}
                                                         {isLoggedIn && (
                                                            <DropdownMenu
                                                               modal={false}
                                                            >
                                                               <DropdownMenuTrigger
                                                                  asChild
                                                               >
                                                                  <button
                                                                     type="button"
                                                                     className="opacity-0 group-hover:opacity-100 sm:opacity-0 max-sm:opacity-100 data-[state=open]:opacity-100 p-1 text-text-tertiary hover:text-white rounded hover:bg-input-bg transition-opacity shrink-0 mt-0.5"
                                                                     title="Task options"
                                                                     aria-label={`Options for task ${task.text}`}
                                                                  >
                                                                     <MoreVertical className="h-3.5 w-3.5" />
                                                                  </button>
                                                               </DropdownMenuTrigger>
                                                               <DropdownMenuContent
                                                                  align="end"
                                                                  className="min-w-dropdown-min"
                                                               >
                                                                  <TaskMenuItems
                                                                     task={task}
                                                                     catIdx={
                                                                        catIdx
                                                                     }
                                                                     taskType="daily"
                                                                     effectiveTodayDate={
                                                                        effectiveTodayDate
                                                                     }
                                                                     dayOptions={
                                                                        dayOptions
                                                                     }
                                                                     selectedDateKey={
                                                                        selectedDateKey
                                                                     }
                                                                     onSetStatus={(
                                                                        status
                                                                     ) =>
                                                                        setTaskStatus(
                                                                           catIdx,
                                                                           task.id,
                                                                           "daily",
                                                                           status
                                                                        )
                                                                     }
                                                                     onMoveToDay={(
                                                                        targetDateKey
                                                                     ) =>
                                                                        moveTaskToDay(
                                                                           task.id,
                                                                           targetDateKey,
                                                                           catIdx,
                                                                           "daily"
                                                                        )
                                                                     }
                                                                     onEditTask={() => {
                                                                        setEditTaskModal(
                                                                           {
                                                                              id: task.id,
                                                                              text: task.text,
                                                                              completed:
                                                                                 task.completed,
                                                                              status:
                                                                                 getTaskStatus(
                                                                                    task
                                                                                 ),
                                                                              dueDate:
                                                                                 task.dueDate ??
                                                                                 null,
                                                                              createdAt:
                                                                                 task.createdAt,
                                                                              catIdx,
                                                                              taskType:
                                                                                 "daily",
                                                                           }
                                                                        );
                                                                        setEditTaskInputText(
                                                                           task.text
                                                                        );
                                                                        setEditTaskInputStatus(
                                                                           getTaskStatus(
                                                                              task
                                                                           )
                                                                        );
                                                                        setEditTaskInputDueDate(
                                                                           task.dueDate ||
                                                                              selectedDateKey
                                                                        );
                                                                     }}
                                                                     onDeleteTask={() =>
                                                                        handleDeleteTask(
                                                                           catIdx,
                                                                           task.id,
                                                                           "daily"
                                                                        )
                                                                     }
                                                                     Item={
                                                                        DropdownMenuItem
                                                                     }
                                                                     Separator={
                                                                        DropdownMenuSeparator
                                                                     }
                                                                     Label={
                                                                        DropdownMenuLabel
                                                                     }
                                                                  />
                                                               </DropdownMenuContent>
                                                            </DropdownMenu>
                                                         )}
                                                      </div>
                                                   </ContextMenuTrigger>
                                                   {isLoggedIn && (
                                                      <ContextMenuContent className="min-w-dropdown-min">
                                                         <TaskMenuItems
                                                            task={task}
                                                            catIdx={catIdx}
                                                            taskType="daily"
                                                            effectiveTodayDate={
                                                               effectiveTodayDate
                                                            }
                                                            dayOptions={
                                                               dayOptions
                                                            }
                                                            selectedDateKey={
                                                               selectedDateKey
                                                            }
                                                            onSetStatus={(
                                                               status
                                                            ) =>
                                                               setTaskStatus(
                                                                  catIdx,
                                                                  task.id,
                                                                  "daily",
                                                                  status
                                                               )
                                                            }
                                                            onMoveToDay={(
                                                               targetDateKey
                                                            ) =>
                                                               moveTaskToDay(
                                                                  task.id,
                                                                  targetDateKey,
                                                                  catIdx,
                                                                  "daily"
                                                               )
                                                            }
                                                            onEditTask={() => {
                                                               setEditTaskModal(
                                                                  {
                                                                     id: task.id,
                                                                     text: task.text,
                                                                     completed:
                                                                        task.completed,
                                                                     status:
                                                                        getTaskStatus(
                                                                           task
                                                                        ),
                                                                     dueDate:
                                                                        task.dueDate ??
                                                                        null,
                                                                     createdAt:
                                                                        task.createdAt,
                                                                     catIdx,
                                                                     taskType:
                                                                        "daily",
                                                                  }
                                                               );
                                                               setEditTaskInputText(
                                                                  task.text
                                                               );
                                                               setEditTaskInputStatus(
                                                                  getTaskStatus(
                                                                     task
                                                                  )
                                                               );
                                                               setEditTaskInputDueDate(
                                                                  task.dueDate ||
                                                                     selectedDateKey
                                                               );
                                                            }}
                                                            onDeleteTask={() =>
                                                               handleDeleteTask(
                                                                  catIdx,
                                                                  task.id,
                                                                  "daily"
                                                               )
                                                            }
                                                            Item={
                                                               ContextMenuItem
                                                            }
                                                            Separator={
                                                               ContextMenuSeparator
                                                            }
                                                            Label={
                                                               ContextMenuLabel
                                                            }
                                                         />
                                                      </ContextMenuContent>
                                                   )}
                                                </ContextMenu>
                                             );
                                          })
                                       )}
                                    </div>
                                 )}
                              </div>
                           );
                        })
                     )}
                  </div>
               </div>

               <div className="pt-2 text-center">
                  {isActiveDayPast ? (
                     <Button
                        type="button"
                        disabled
                        className="h-10 px-6 rounded-full bg-surface-elevated text-text-tertiary text-xs font-semibold border border-border-default cursor-not-allowed inline-flex items-center gap-1.5 shadow-none"
                        title="Adding tasks to past challenge days is locked"
                     >
                        <Lock className="h-3.5 w-3.5 text-text-tertiary" />
                        <span>Past day locked (new tasks blocked)</span>
                     </Button>
                  ) : (
                     <Button
                        type="button"
                        onClick={() => openAddDailyModal(selectedDateKey)}
                        className="h-10 px-6 rounded-full bg-white text-black text-xs font-bold hover:bg-white/90 shadow-sm inline-flex items-center gap-1.5"
                     >
                        {totalDailyTasksForDay === 0
                           ? `+ Add first todo for ${activeDayOption.shortLabel}`
                           : `+ Add more todos for ${activeDayOption.shortLabel}`}
                     </Button>
                  )}
               </div>
            </div>

            {/* Weekly Todos */}
            <div
               onDragOver={(e) => handleColumnDragOver(e, "weekly")}
               onDrop={(e) => handleColumnDrop(e, "weekly")}
               className={`rounded-2xl border bg-surface-primary p-6 shadow-md flex flex-col justify-between space-y-5 transition-all ${
                  dragOverInfo?.type === "column" &&
                  dragOverInfo.targetColumn === "weekly"
                     ? "border-brand-2 ring-1 ring-brand-2/50 bg-surface-secondary"
                     : "border-border-default"
               }`}
            >
               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <h3 className="text-lg font-bold text-white">
                        Weekly Todos
                     </h3>
                     <span className="text-xs font-semibold text-text-secondary">
                        {completedWeeklyTasks}/{totalWeeklyTasks} Completed
                     </span>
                  </div>

                  <div className="space-y-3">
                     {weeklyCategories.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border-strong bg-surface-tertiary/50 p-6 text-center">
                           <p className="text-sm font-medium text-text-secondary">
                              No weekly todos yet
                           </p>
                           <p className="text-xs text-text-tertiary mt-1">
                              Set your weekly milestones and track them across
                              the challenge.
                           </p>
                        </div>
                     ) : (
                        weeklyCategories.map((cat, catIdx) => {
                           const isCatDragging =
                              draggedItem?.type === "category" &&
                              draggedItem.sourceColumn === "weekly" &&
                              draggedItem.sourceCatIdx === catIdx;
                           const isCatOver =
                              dragOverInfo?.type === "category" &&
                              dragOverInfo.targetColumn === "weekly" &&
                              dragOverInfo.targetCatIdx === catIdx;

                           return (
                              <div
                                 key={cat.id || cat.name}
                                 data-drag-card="category"
                                 onDragOver={(e) =>
                                    handleCategoryDragOver(e, catIdx, "weekly")
                                 }
                                 onDrop={(e) =>
                                    handleCategoryDrop(e, catIdx, "weekly")
                                 }
                                 className={`rounded-xl bg-surface-nested overflow-hidden border transition-all ${
                                    isCatDragging
                                       ? "opacity-30 border-dashed border-brand-2 bg-surface-elevated scale-[0.99]"
                                       : ""
                                 } ${
                                    isCatOver &&
                                    dragOverInfo?.position === "above"
                                       ? "border-t-2 border-t-[#e08a32] border-border-strong"
                                       : isCatOver &&
                                           dragOverInfo?.position === "below"
                                         ? "border-b-2 border-b-[#e08a32] border-border-strong"
                                         : isCatOver
                                           ? "border-brand-2"
                                           : "border-border-strong"
                                 }`}
                              >
                                 <ContextMenu modal={false}>
                                    <ContextMenuTrigger
                                       asChild
                                       disabled={!isLoggedIn}
                                    >
                                       <div
                                          draggable
                                          onDragStart={(e) =>
                                             handleCategoryDragStart(
                                                e,
                                                catIdx,
                                                "weekly"
                                             )
                                          }
                                          onDragEnd={handleDragEnd}
                                          onClick={() =>
                                             toggleWeeklyCollapse(catIdx)
                                          }
                                          className="w-full flex items-center justify-between px-3 py-3 text-left font-medium text-sm text-white hover:bg-surface-nested transition-colors cursor-grab active:cursor-grabbing select-none"
                                       >
                                          <div
                                             className="p-1 -ml-1 mr-1 text-text-tertiary hover:text-brand-2 rounded transition-colors shrink-0"
                                             title="Drag category to reorder, move to day or across boards"
                                             aria-label={`Drag category ${cat.name}`}
                                          >
                                             <GripVertical className="h-4 w-4" />
                                          </div>
                                          <span className="truncate flex-1 pr-2">
                                             {cat.name}
                                          </span>
                                          <div
                                             className="flex items-center gap-1.5 shrink-0"
                                             onDragStart={(e) =>
                                                e.stopPropagation()
                                             }
                                             onClick={(e) =>
                                                e.stopPropagation()
                                             }
                                          >
                                             {isLoggedIn && (
                                                <DropdownMenu modal={false}>
                                                   <DropdownMenuTrigger asChild>
                                                      <button
                                                         type="button"
                                                         className="p-1 rounded-md text-text-tertiary hover:text-white hover:bg-input-bg data-[state=open]:text-white data-[state=open]:bg-input-bg transition-colors"
                                                         title="Category options"
                                                         aria-label={`Options for category ${cat.name}`}
                                                      >
                                                         <MoreVertical className="h-4 w-4" />
                                                      </button>
                                                   </DropdownMenuTrigger>
                                                   <DropdownMenuContent
                                                      align="end"
                                                      className="min-w-dropdown-min"
                                                   >
                                                      <CategoryMenuItems
                                                         cat={cat}
                                                         catType="weekly"
                                                         dailyCategories={
                                                            dailyCategories
                                                         }
                                                         weeklyCategories={
                                                            weeklyCategories
                                                         }
                                                         selectedDateKey={
                                                            selectedDateKey
                                                         }
                                                         effectiveTodayDate={
                                                            effectiveTodayDate
                                                         }
                                                         dayOptions={dayOptions}
                                                         onMoveCategoryToDay={(
                                                            targetDateKey
                                                         ) =>
                                                            moveCategoryToDayAction(
                                                               catIdx,
                                                               targetDateKey,
                                                               "weekly"
                                                            )
                                                         }
                                                         onRenameCategory={() => {
                                                            setEditCategoryModal(
                                                               {
                                                                  id: cat.id,
                                                                  name: cat.name,
                                                                  taskType:
                                                                     "weekly",
                                                               }
                                                            );
                                                            setEditCategoryInputName(
                                                               cat.name
                                                            );
                                                         }}
                                                         onDeleteCategory={() => {
                                                            setDeleteCategoryModal(
                                                               {
                                                                  id: cat.id,
                                                                  name: cat.name,
                                                                  taskType:
                                                                     "weekly",
                                                               }
                                                            );
                                                         }}
                                                         Item={DropdownMenuItem}
                                                         Separator={
                                                            DropdownMenuSeparator
                                                         }
                                                         Label={
                                                            DropdownMenuLabel
                                                         }
                                                      />
                                                   </DropdownMenuContent>
                                                </DropdownMenu>
                                             )}
                                             {cat.isCollapsed ? (
                                                <ChevronDown className="h-4 w-4 text-text-tertiary" />
                                             ) : (
                                                <ChevronUp className="h-4 w-4 text-text-tertiary" />
                                             )}
                                          </div>
                                       </div>
                                    </ContextMenuTrigger>
                                    {isLoggedIn && (
                                       <ContextMenuContent className="min-w-dropdown-min">
                                          <CategoryMenuItems
                                             cat={cat}
                                             catType="weekly"
                                             dailyCategories={dailyCategories}
                                             weeklyCategories={weeklyCategories}
                                             selectedDateKey={selectedDateKey}
                                             effectiveTodayDate={
                                                effectiveTodayDate
                                             }
                                             dayOptions={dayOptions}
                                             onMoveCategoryToDay={(
                                                targetDateKey
                                             ) =>
                                                moveCategoryToDayAction(
                                                   catIdx,
                                                   targetDateKey,
                                                   "weekly"
                                                )
                                             }
                                             onRenameCategory={() => {
                                                setEditCategoryModal({
                                                   id: cat.id,
                                                   name: cat.name,
                                                   taskType: "weekly",
                                                });
                                                setEditCategoryInputName(
                                                   cat.name
                                                );
                                             }}
                                             onDeleteCategory={() => {
                                                setDeleteCategoryModal({
                                                   id: cat.id,
                                                   name: cat.name,
                                                   taskType: "weekly",
                                                });
                                             }}
                                             Item={ContextMenuItem}
                                             Separator={ContextMenuSeparator}
                                             Label={ContextMenuLabel}
                                          />
                                       </ContextMenuContent>
                                    )}
                                 </ContextMenu>

                                 {!cat.isCollapsed && (
                                    <div className="px-4 pb-3 pt-1 space-y-2.5 border-t border-border-strong">
                                       {cat.tasks.length === 0 ? (
                                          <p className="text-xs text-text-tertiary py-1">
                                             No weekly tasks in this category.
                                          </p>
                                       ) : (
                                          cat.tasks.map((task) => {
                                             const isTaskDragging =
                                                draggedItem?.type === "task" &&
                                                draggedItem.id === task.id;
                                             const isTaskOver =
                                                dragOverInfo?.type === "task" &&
                                                dragOverInfo.targetId ===
                                                   task.id;

                                             return (
                                                <ContextMenu
                                                   key={task.id}
                                                   modal={false}
                                                >
                                                   <ContextMenuTrigger
                                                      asChild
                                                      disabled={!isLoggedIn}
                                                   >
                                                      <div
                                                         data-drag-card="task"
                                                         onDragOver={(e) =>
                                                            handleTaskDragOver(
                                                               e,
                                                               task.id,
                                                               catIdx,
                                                               "weekly"
                                                            )
                                                         }
                                                         onDrop={(e) =>
                                                            handleTaskDrop(
                                                               e,
                                                               task.id,
                                                               catIdx,
                                                               "weekly"
                                                            )
                                                         }
                                                         className={`flex items-start justify-between gap-2 p-1.5 rounded-lg hover:bg-surface-nested transition-all group ${
                                                            isTaskDragging
                                                               ? "opacity-30 border border-dashed border-brand-2 bg-surface-elevated"
                                                               : ""
                                                         } ${
                                                            isTaskOver &&
                                                            dragOverInfo?.position ===
                                                               "above"
                                                               ? "border-t-2 border-t-[#e08a32]"
                                                               : isTaskOver &&
                                                                   dragOverInfo?.position ===
                                                                      "below"
                                                                 ? "border-b-2 border-b-[#e08a32]"
                                                                 : ""
                                                         }`}
                                                      >
                                                         <div
                                                            draggable
                                                            onDragStart={(e) =>
                                                               handleTaskDragStart(
                                                                  e,
                                                                  task.id,
                                                                  catIdx,
                                                                  "weekly"
                                                               )
                                                            }
                                                            onDragEnd={
                                                               handleDragEnd
                                                            }
                                                            onClick={(e) =>
                                                               e.stopPropagation()
                                                            }
                                                            className="p-1 -ml-1 text-text-tertiary hover:text-brand-2 cursor-grab active:cursor-grabbing rounded transition-colors shrink-0 mt-0.5"
                                                            title="Drag task to reorder or move across categories"
                                                            aria-label={`Drag task ${task.text}`}
                                                         >
                                                            <GripVertical className="h-3.5 w-3.5" />
                                                         </div>
                                                         {(() => {
                                                            const status =
                                                               getTaskStatus(
                                                                  task
                                                               );
                                                            return (
                                                               <>
                                                                  <div
                                                                     role="checkbox"
                                                                     aria-checked={
                                                                        status ===
                                                                        "COMPLETED"
                                                                     }
                                                                     onClick={() =>
                                                                        toggleWeeklyTask(
                                                                           catIdx,
                                                                           task.id
                                                                        )
                                                                     }
                                                                     className="flex items-start gap-3 cursor-pointer flex-1 min-w-0"
                                                                     title={
                                                                        status ===
                                                                        "COMPLETED"
                                                                           ? "Status: Completed. Click to reset to To-Do"
                                                                           : status ===
                                                                               "IN_PROGRESS"
                                                                             ? "Status: In Progress. Click to mark Completed"
                                                                             : status ===
                                                                                 "CROSSED_OUT"
                                                                               ? "Status: Crossed Out. Click to mark Completed"
                                                                               : "Status: To-Do. Click to mark Completed"
                                                                     }
                                                                  >
                                                                     <div
                                                                        className={`h-5 w-5 rounded flex items-center justify-center border transition-all shrink-0 mt-0.5 ${
                                                                           status ===
                                                                           "COMPLETED"
                                                                              ? "bg-white border-white text-text-inverse"
                                                                              : status ===
                                                                                  "IN_PROGRESS"
                                                                                ? "border-amber-400/80 bg-amber-500/15 text-amber-400"
                                                                                : status ===
                                                                                    "CROSSED_OUT"
                                                                                  ? "border-rose-500/80 bg-rose-500/15 text-rose-400"
                                                                                  : "border-white bg-transparent group-hover:border-gray-300"
                                                                        }`}
                                                                     >
                                                                        {status ===
                                                                           "COMPLETED" && (
                                                                           <Check className="h-3.5 w-3.5 stroke-[3]" />
                                                                        )}
                                                                        {status ===
                                                                           "IN_PROGRESS" && (
                                                                           <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                                                                        )}
                                                                        {status ===
                                                                           "CROSSED_OUT" && (
                                                                           <X className="h-3.5 w-3.5 stroke-[2.5]" />
                                                                        )}
                                                                     </div>
                                                                     <div className="flex-1 min-w-0">
                                                                        <span
                                                                           title={
                                                                              task.text
                                                                           }
                                                                           className={`text-sm break-words leading-snug block ${
                                                                              expandedTaskIds.has(
                                                                                 task.id
                                                                              )
                                                                                 ? ""
                                                                                 : "line-clamp-2"
                                                                           } ${
                                                                              status ===
                                                                              "COMPLETED"
                                                                                 ? "text-text-tertiary line-through"
                                                                                 : status ===
                                                                                     "CROSSED_OUT"
                                                                                   ? "text-text-tertiary line-through decoration-rose-500/60"
                                                                                   : status ===
                                                                                       "IN_PROGRESS"
                                                                                     ? "text-white font-medium"
                                                                                     : "text-white"
                                                                           }`}
                                                                        >
                                                                           {
                                                                              task.text
                                                                           }
                                                                        </span>
                                                                        {(task
                                                                           .text
                                                                           .length >
                                                                           45 ||
                                                                           task.text.includes(
                                                                              "\n"
                                                                           )) && (
                                                                           <button
                                                                              type="button"
                                                                              onClick={(
                                                                                 e
                                                                              ) =>
                                                                                 toggleTaskExpand(
                                                                                    task.id,
                                                                                    e
                                                                                 )
                                                                              }
                                                                              title={
                                                                                 expandedTaskIds.has(
                                                                                    task.id
                                                                                 )
                                                                                    ? "Show less"
                                                                                    : "Show full task description"
                                                                              }
                                                                              className="text-text-tertiary hover:text-white text-xs font-medium mt-0.5 inline-flex items-center gap-1 transition-colors select-none group/expand"
                                                                           >
                                                                              <span>
                                                                                 {expandedTaskIds.has(
                                                                                    task.id
                                                                                 )
                                                                                    ? "Show less"
                                                                                    : "Show more"}
                                                                              </span>
                                                                              <ChevronDown
                                                                                 className={`h-3 w-3 transition-transform duration-200 ${
                                                                                    expandedTaskIds.has(
                                                                                       task.id
                                                                                    )
                                                                                       ? "rotate-180"
                                                                                       : ""
                                                                                 }`}
                                                                              />
                                                                           </button>
                                                                        )}
                                                                     </div>
                                                                  </div>

                                                                  {status ===
                                                                     "COMPLETED" && (
                                                                     <button
                                                                        type="button"
                                                                        onClick={(
                                                                           e
                                                                        ) => {
                                                                           e.stopPropagation();
                                                                           setTaskStatus(
                                                                              catIdx,
                                                                              task.id,
                                                                              "weekly",
                                                                              "TODO"
                                                                           );
                                                                        }}
                                                                        title="Status: Completed. Click to reset to To-Do"
                                                                        className="shrink-0 px-2 py-0.5 rounded-md text-label font-semibold tracking-wide uppercase transition-colors border mt-0.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                                                     >
                                                                        Completed
                                                                     </button>
                                                                  )}
                                                                  {status ===
                                                                     "IN_PROGRESS" && (
                                                                     <button
                                                                        type="button"
                                                                        onClick={(
                                                                           e
                                                                        ) => {
                                                                           e.stopPropagation();
                                                                           setTaskStatus(
                                                                              catIdx,
                                                                              task.id,
                                                                              "weekly",
                                                                              "COMPLETED"
                                                                           );
                                                                        }}
                                                                        title="Status: In Progress. Click to mark Completed"
                                                                        className="shrink-0 px-2 py-0.5 rounded-md text-label font-semibold tracking-wide uppercase transition-colors border mt-0.5 bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                                                                     >
                                                                        In
                                                                        Progress
                                                                     </button>
                                                                  )}
                                                                  {status ===
                                                                     "CROSSED_OUT" && (
                                                                     <button
                                                                        type="button"
                                                                        onClick={(
                                                                           e
                                                                        ) => {
                                                                           e.stopPropagation();
                                                                           setTaskStatus(
                                                                              catIdx,
                                                                              task.id,
                                                                              "weekly",
                                                                              "TODO"
                                                                           );
                                                                        }}
                                                                        title="Status: Crossed Out. Click to reset to To-Do"
                                                                        className="shrink-0 px-2 py-0.5 rounded-md text-label font-semibold tracking-wide uppercase transition-colors border mt-0.5 bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                                                                     >
                                                                        Crossed
                                                                        Out
                                                                     </button>
                                                                  )}
                                                               </>
                                                            );
                                                         })()}
                                                         {isLoggedIn && (
                                                            <DropdownMenu
                                                               modal={false}
                                                            >
                                                               <DropdownMenuTrigger
                                                                  asChild
                                                               >
                                                                  <button
                                                                     type="button"
                                                                     className="opacity-0 group-hover:opacity-100 sm:opacity-0 max-sm:opacity-100 data-[state=open]:opacity-100 p-1 text-text-tertiary hover:text-white rounded hover:bg-input-bg transition-opacity shrink-0 mt-0.5"
                                                                     title="Task options"
                                                                     aria-label={`Options for task ${task.text}`}
                                                                  >
                                                                     <MoreVertical className="h-3.5 w-3.5" />
                                                                  </button>
                                                               </DropdownMenuTrigger>
                                                               <DropdownMenuContent
                                                                  align="end"
                                                                  className="min-w-dropdown-min"
                                                               >
                                                                  <TaskMenuItems
                                                                     task={task}
                                                                     catIdx={
                                                                        catIdx
                                                                     }
                                                                     taskType="weekly"
                                                                     effectiveTodayDate={
                                                                        effectiveTodayDate
                                                                     }
                                                                     dayOptions={
                                                                        dayOptions
                                                                     }
                                                                     selectedDateKey={
                                                                        selectedDateKey
                                                                     }
                                                                     onSetStatus={(
                                                                        status
                                                                     ) =>
                                                                        setTaskStatus(
                                                                           catIdx,
                                                                           task.id,
                                                                           "weekly",
                                                                           status
                                                                        )
                                                                     }
                                                                     onMoveToDay={(
                                                                        targetDateKey
                                                                     ) =>
                                                                        moveTaskToDay(
                                                                           task.id,
                                                                           targetDateKey,
                                                                           catIdx,
                                                                           "weekly"
                                                                        )
                                                                     }
                                                                     onEditTask={() => {
                                                                        setEditTaskModal(
                                                                           {
                                                                              id: task.id,
                                                                              text: task.text,
                                                                              completed:
                                                                                 task.completed,
                                                                              status:
                                                                                 getTaskStatus(
                                                                                    task
                                                                                 ),
                                                                              dueDate:
                                                                                 task.dueDate ??
                                                                                 null,
                                                                              createdAt:
                                                                                 task.createdAt,
                                                                              catIdx,
                                                                              taskType:
                                                                                 "weekly",
                                                                           }
                                                                        );
                                                                        setEditTaskInputText(
                                                                           task.text
                                                                        );
                                                                        setEditTaskInputStatus(
                                                                           getTaskStatus(
                                                                              task
                                                                           )
                                                                        );
                                                                        setEditTaskInputDueDate(
                                                                           task.dueDate ||
                                                                              selectedDateKey
                                                                        );
                                                                     }}
                                                                     onDeleteTask={() =>
                                                                        handleDeleteTask(
                                                                           catIdx,
                                                                           task.id,
                                                                           "weekly"
                                                                        )
                                                                     }
                                                                     Item={
                                                                        DropdownMenuItem
                                                                     }
                                                                     Separator={
                                                                        DropdownMenuSeparator
                                                                     }
                                                                     Label={
                                                                        DropdownMenuLabel
                                                                     }
                                                                  />
                                                               </DropdownMenuContent>
                                                            </DropdownMenu>
                                                         )}
                                                      </div>
                                                   </ContextMenuTrigger>
                                                   {isLoggedIn && (
                                                      <ContextMenuContent className="min-w-dropdown-min">
                                                         <TaskMenuItems
                                                            task={task}
                                                            catIdx={catIdx}
                                                            taskType="weekly"
                                                            effectiveTodayDate={
                                                               effectiveTodayDate
                                                            }
                                                            dayOptions={
                                                               dayOptions
                                                            }
                                                            selectedDateKey={
                                                               selectedDateKey
                                                            }
                                                            onSetStatus={(
                                                               status
                                                            ) =>
                                                               setTaskStatus(
                                                                  catIdx,
                                                                  task.id,
                                                                  "weekly",
                                                                  status
                                                               )
                                                            }
                                                            onMoveToDay={(
                                                               targetDateKey
                                                            ) =>
                                                               moveTaskToDay(
                                                                  task.id,
                                                                  targetDateKey,
                                                                  catIdx,
                                                                  "weekly"
                                                               )
                                                            }
                                                            onEditTask={() => {
                                                               setEditTaskModal(
                                                                  {
                                                                     id: task.id,
                                                                     text: task.text,
                                                                     completed:
                                                                        task.completed,
                                                                     status:
                                                                        getTaskStatus(
                                                                           task
                                                                        ),
                                                                     dueDate:
                                                                        task.dueDate ??
                                                                        null,
                                                                     createdAt:
                                                                        task.createdAt,
                                                                     catIdx,
                                                                     taskType:
                                                                        "weekly",
                                                                  }
                                                               );
                                                               setEditTaskInputText(
                                                                  task.text
                                                               );
                                                               setEditTaskInputStatus(
                                                                  getTaskStatus(
                                                                     task
                                                                  )
                                                               );
                                                               setEditTaskInputDueDate(
                                                                  task.dueDate ||
                                                                     selectedDateKey
                                                               );
                                                            }}
                                                            onDeleteTask={() =>
                                                               handleDeleteTask(
                                                                  catIdx,
                                                                  task.id,
                                                                  "weekly"
                                                               )
                                                            }
                                                            Item={
                                                               ContextMenuItem
                                                            }
                                                            Separator={
                                                               ContextMenuSeparator
                                                            }
                                                            Label={
                                                               ContextMenuLabel
                                                            }
                                                         />
                                                      </ContextMenuContent>
                                                   )}
                                                </ContextMenu>
                                             );
                                          })
                                       )}
                                    </div>
                                 )}
                              </div>
                           );
                        })
                     )}
                  </div>
               </div>

               <div className="pt-2 text-center">
                  <Button
                     type="button"
                     onClick={() => {
                        setAddModalType("weekly");
                        if (weeklyCategoryOptions.length > 0) {
                           setSelectedCategory(weeklyCategoryOptions[0]);
                           setIsCreatingCategory(false);
                        } else {
                           setSelectedCategory("");
                           setIsCreatingCategory(true);
                        }
                     }}
                     className="h-10 px-6 rounded-full bg-white text-black text-xs font-bold hover:bg-white/90 shadow-sm inline-flex items-center gap-1.5"
                  >
                     {weeklyCategories.length === 0
                        ? "+ Add first todo"
                        : "+ Add more todos"}
                  </Button>
               </div>
            </div>
         </div>

         {/* Add Todo Modal */}
         <Dialog
            open={Boolean(addModalType)}
            onOpenChange={(open) => {
               if (!open) setAddModalType(null);
            }}
         >
            <DialogContent className="max-w-md rounded-2xl border-border-strong bg-surface-nested p-6 space-y-5">
               <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-bold text-white">
                     Add {addModalType === "daily" ? "Daily" : "Weekly"} Todo
                  </DialogTitle>
               </div>

               <form onSubmit={handleAddTodoSubmit} className="space-y-4">
                  <div>
                     <Label
                        htmlFor="add-todo-content"
                        className="block text-xs font-medium text-text-secondary mb-1.5"
                     >
                        Todo Content
                     </Label>
                     <Input
                        id="add-todo-content"
                        type="text"
                        placeholder="What needs to get done?"
                        value={newTodoText}
                        onChange={(e) => setNewTodoText(e.target.value)}
                        autoFocus
                        required
                        className="h-11 bg-input-bg border-input-border text-text-primary placeholder-text-secondary rounded-xl"
                     />
                  </div>

                  <div role="group" aria-labelledby="add-todo-category">
                     <Label
                        id="add-todo-category"
                        className="block text-xs font-medium text-text-secondary mb-1.5"
                     >
                        Todo Category
                     </Label>
                     {!isCreatingCategory ? (
                        <div className="flex gap-2">
                           <Select
                              value={selectedCategory}
                              onValueChange={(value) => {
                                 if (value === "__NEW__") {
                                    setIsCreatingCategory(true);
                                    setTimeout(() => {
                                       categoryInputRef.current?.focus();
                                       categoryInputRef.current?.select();
                                    }, 50);
                                 } else {
                                    setSelectedCategory(value);
                                 }
                              }}
                           >
                              <SelectTrigger
                                 ref={categorySelectRef}
                                 data-testid="todo-category-select"
                                 className="h-11 w-full rounded-xl border-input-border bg-input-bg px-3 text-sm text-text-primary"
                              >
                                 <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                              <SelectContent>
                                 {addModalType === "daily" ? (
                                    <>
                                       {weeklyCategoryOptions.length > 0 && (
                                          <SelectGroup>
                                             <SelectLabel>
                                                Weekly Categories (Inherited)
                                             </SelectLabel>
                                             {weeklyCategoryOptions.map(
                                                (catName) => (
                                                   <SelectItem
                                                      key={catName}
                                                      value={catName}
                                                   >
                                                      {catName}
                                                   </SelectItem>
                                                )
                                             )}
                                          </SelectGroup>
                                       )}
                                       {independentDailyCategoryOptions.length >
                                          0 && (
                                          <SelectGroup>
                                             <SelectLabel>
                                                Independent Daily Categories
                                             </SelectLabel>
                                             {independentDailyCategoryOptions.map(
                                                (catName) => (
                                                   <SelectItem
                                                      key={catName}
                                                      value={catName}
                                                   >
                                                      {catName}
                                                   </SelectItem>
                                                )
                                             )}
                                          </SelectGroup>
                                       )}
                                       <SelectItem value="__NEW__">
                                          + Create Independent Category...
                                       </SelectItem>
                                    </>
                                 ) : (
                                    <>
                                       {weeklyCategoryOptions.map((catName) => (
                                          <SelectItem
                                             key={catName}
                                             value={catName}
                                          >
                                             {catName}
                                          </SelectItem>
                                       ))}
                                       <SelectItem value="__NEW__">
                                          + Create New Category...
                                       </SelectItem>
                                    </>
                                 )}
                              </SelectContent>
                           </Select>
                        </div>
                     ) : (
                        <div className="flex gap-2">
                           <Input
                              ref={categoryInputRef}
                              type="text"
                              placeholder={
                                 addModalType === "daily"
                                    ? "Independent category name (e.g. Unplanned, Urgent)"
                                    : "Category name"
                              }
                              value={customCategory}
                              onChange={(e) =>
                                 setCustomCategory(e.target.value)
                              }
                              autoFocus
                              className="h-11 bg-input-bg border-input-border text-text-primary rounded-xl"
                           />
                           {(addModalType === "daily"
                              ? dailyCategoryOptions
                              : weeklyCategoryOptions
                           ).length > 0 && (
                              <Button
                                 type="button"
                                 variant="outline"
                                 onClick={() => {
                                    setIsCreatingCategory(false);
                                    setTimeout(() => {
                                       categorySelectRef.current?.focus();
                                    }, 50);
                                 }}
                                 className="h-11 border-input-border text-xs text-white"
                              >
                                 Back
                              </Button>
                           )}
                        </div>
                     )}
                  </div>

                  {addModalType === "daily" && (
                     <div role="group" aria-labelledby="add-todo-day">
                        <Label
                           id="add-todo-day"
                           className="block text-xs font-medium text-text-secondary mb-1.5 flex items-center justify-between"
                        >
                           <span>Assigned Challenge Day</span>
                           <span className="text-meta text-brand-2 font-semibold">
                              {formatDayDate(addTodoDateKey || selectedDateKey)}
                           </span>
                        </Label>
                        <div className="grid grid-cols-7 gap-1 w-full pb-1">
                           {dayOptions.map((opt) => {
                              const isSelected =
                                 (addTodoDateKey || selectedDateKey) ===
                                 opt.dateKey;
                              const isPastDay =
                                 opt.isPast ?? opt.dateKey < effectiveTodayDate;

                              if (isPastDay) {
                                 return (
                                    <button
                                       key={opt.dateKey}
                                       type="button"
                                       disabled
                                       title={`${opt.label} (Past Day — Locked for new tasks)`}
                                       className="py-1.5 px-1 flex flex-col items-center justify-center rounded-xl text-xs font-semibold border border-border-default bg-surface-primary text-text-tertiary opacity-40 cursor-not-allowed overflow-hidden"
                                    >
                                       <span className="text-label uppercase font-bold tracking-wider leading-none truncate max-w-full">
                                          {opt.isToday
                                             ? "Today"
                                             : opt.shortLabel.startsWith("Day ")
                                               ? `D${opt.dayNumber}`
                                               : opt.shortLabel.slice(0, 3)}
                                       </span>
                                       <span className="text-caption opacity-60 mt-0.5 leading-none truncate max-w-full">
                                          {formatDayDate(opt.dateKey)}
                                       </span>
                                       <span className="text-micro text-text-tertiary mt-1 flex items-center justify-center">
                                          <Lock className="h-2 w-2" />
                                       </span>
                                    </button>
                                 );
                              }

                              return (
                                 <button
                                    key={opt.dateKey}
                                    type="button"
                                    onClick={() =>
                                       setAddTodoDateKey(opt.dateKey)
                                    }
                                    title={
                                       opt.isToday
                                          ? "Today"
                                          : opt.isYesterday
                                            ? `Yesterday (${opt.label})`
                                            : opt.label
                                    }
                                    className={`py-1.5 px-1 flex flex-col items-center justify-center rounded-xl text-xs font-semibold border transition-all overflow-hidden ${
                                       isSelected
                                          ? "bg-brand-2 text-white border-brand-2 shadow-sm shadow-brand-2/30 ring-1 ring-brand-2"
                                          : "bg-surface-elevated text-text-tertiary border-border-strong hover:text-white hover:bg-surface-nested"
                                    }`}
                                 >
                                    <span className="text-label uppercase font-bold tracking-wider leading-none truncate max-w-full">
                                       {opt.isToday
                                          ? "Today"
                                          : opt.shortLabel.startsWith("Day ")
                                            ? `D${opt.dayNumber}`
                                            : opt.shortLabel.slice(0, 3)}
                                    </span>
                                    <span className="text-caption opacity-80 mt-0.5 leading-none truncate max-w-full">
                                       {formatDayDate(opt.dateKey)}
                                    </span>
                                    {opt.isToday && (
                                       <span
                                          className={`h-1 w-1 rounded-full mt-1 ${
                                             isSelected
                                                ? "bg-white"
                                                : "bg-brand-2"
                                          }`}
                                       />
                                    )}
                                 </button>
                              );
                           })}
                        </div>
                     </div>
                  )}

                  <div role="group" aria-labelledby="add-todo-status">
                     <Label
                        id="add-todo-status"
                        className="block text-xs font-medium text-text-secondary mb-1.5"
                     >
                        Initial Status
                     </Label>
                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                           type="button"
                           onClick={() => setNewTodoStatus("TODO")}
                           className={`flex items-center justify-center gap-1.5 h-10 px-2 rounded-xl text-xs font-semibold border transition-all ${
                              newTodoStatus === "TODO"
                                 ? "bg-surface-nested text-white border-white/30 shadow-inner ring-1 ring-white/20"
                                 : "bg-surface-elevated text-text-tertiary border-border-strong hover:text-white hover:bg-surface-nested"
                           }`}
                        >
                           <span
                              className={`h-2 w-2 rounded-full ${
                                 newTodoStatus === "TODO"
                                    ? "bg-white"
                                    : "bg-input-bg"
                              }`}
                           />
                           <span>To-Do</span>
                        </button>
                        <button
                           type="button"
                           onClick={() => setNewTodoStatus("IN_PROGRESS")}
                           className={`flex items-center justify-center gap-1.5 h-10 px-2 rounded-xl text-xs font-semibold border transition-all ${
                              newTodoStatus === "IN_PROGRESS"
                                 ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-inner ring-1 ring-amber-500/30"
                                 : "bg-surface-elevated text-text-tertiary border-border-strong hover:text-white hover:bg-surface-nested"
                           }`}
                        >
                           <span
                              className={`h-2 w-2 rounded-full ${
                                 newTodoStatus === "IN_PROGRESS"
                                    ? "bg-amber-400"
                                    : "bg-input-bg"
                              }`}
                           />
                           <span>In Progress</span>
                        </button>
                        <button
                           type="button"
                           onClick={() => setNewTodoStatus("COMPLETED")}
                           className={`flex items-center justify-center gap-1.5 h-10 px-2 rounded-xl text-xs font-semibold border transition-all ${
                              newTodoStatus === "COMPLETED"
                                 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-inner ring-1 ring-emerald-500/30"
                                 : "bg-surface-elevated text-text-tertiary border-border-strong hover:text-white hover:bg-surface-nested"
                           }`}
                        >
                           <Check
                              className={`h-3.5 w-3.5 ${
                                 newTodoStatus === "COMPLETED"
                                    ? "text-emerald-400 stroke-[3]"
                                    : "text-text-tertiary"
                              }`}
                           />
                           <span>Completed</span>
                        </button>
                        <button
                           type="button"
                           onClick={() => setNewTodoStatus("CROSSED_OUT")}
                           className={`flex items-center justify-center gap-1.5 h-10 px-2 rounded-xl text-xs font-semibold border transition-all ${
                              newTodoStatus === "CROSSED_OUT"
                                 ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-inner ring-1 ring-rose-500/30"
                                 : "bg-surface-elevated text-text-tertiary border-border-strong hover:text-white hover:bg-surface-nested"
                           }`}
                        >
                           <X
                              className={`h-3.5 w-3.5 ${
                                 newTodoStatus === "CROSSED_OUT"
                                    ? "text-rose-400 stroke-[2.5]"
                                    : "text-text-tertiary"
                              }`}
                           />
                           <span>Crossed Out</span>
                        </button>
                     </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3">
                     <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setAddModalType(null)}
                        className="h-11 px-5 rounded-xl bg-input-bg text-white hover:bg-input-bg text-xs font-medium"
                     >
                        Cancel
                     </Button>
                     <Button
                        type="submit"
                        className="h-11 px-6 rounded-xl bg-white text-text-inverse hover:bg-white/90 text-xs font-semibold"
                     >
                        Submit
                     </Button>
                  </div>
               </form>
            </DialogContent>
         </Dialog>

         {/* Edit Task Modal */}
         <Dialog
            open={Boolean(editTaskModal)}
            onOpenChange={(open) => {
               if (!open) setEditTaskModal(null);
            }}
         >
            <DialogContent className="max-w-md rounded-2xl border-border-strong bg-surface-nested p-6 space-y-5">
               <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-bold text-white">
                     Edit Task
                  </DialogTitle>
               </div>
               <form
                  onSubmit={(e) => {
                     e.preventDefault();
                     handleSaveEditTask(
                        editTaskInputText,
                        editTaskInputStatus,
                        editTaskInputDueDate
                     );
                  }}
                  className="space-y-4"
               >
                  <div>
                     <Label
                        htmlFor="edit-task-title"
                        className="block text-xs font-medium text-text-secondary mb-1.5"
                     >
                        Task Title
                     </Label>
                     <Input
                        id="edit-task-title"
                        type="text"
                        value={editTaskInputText}
                        onChange={(e) => setEditTaskInputText(e.target.value)}
                        autoFocus
                        required
                        className="h-11 bg-input-bg border-input-border text-text-primary rounded-xl"
                     />
                  </div>

                  {editTaskModal?.taskType === "daily" && (
                     <div role="group" aria-labelledby="edit-task-day">
                        <Label
                           id="edit-task-day"
                           className="block text-xs font-medium text-text-secondary mb-1.5 flex items-center justify-between"
                        >
                           <span>Assigned Challenge Day</span>
                           <span className="text-meta text-brand-2 font-semibold">
                              {formatDayDate(editTaskInputDueDate)}
                           </span>
                        </Label>
                        <div className="grid grid-cols-7 gap-1 w-full pb-1">
                           {dayOptions.map((opt) => {
                              const isSelected =
                                 editTaskInputDueDate === opt.dateKey;
                              const originalDateKey = editTaskModal?.dueDate
                                 ? typeof editTaskModal.dueDate === "string"
                                    ? editTaskModal.dueDate.slice(0, 10)
                                    : new Date(editTaskModal.dueDate)
                                         .toISOString()
                                         .slice(0, 10)
                                 : "";
                              const isOriginalDate =
                                 originalDateKey === opt.dateKey;
                              const isPastDay =
                                 opt.isPast ?? opt.dateKey < effectiveTodayDate;
                              const isBlockedPastDay =
                                 isPastDay && !isOriginalDate;

                              if (isBlockedPastDay) {
                                 return (
                                    <button
                                       key={opt.dateKey}
                                       type="button"
                                       disabled
                                       title={`${opt.label} (Past Day — Locked)`}
                                       className="py-1.5 px-1 flex flex-col items-center justify-center rounded-xl text-xs font-semibold border border-border-default bg-surface-primary text-text-tertiary opacity-40 cursor-not-allowed overflow-hidden"
                                    >
                                       <span className="text-label uppercase font-bold tracking-wider leading-none truncate max-w-full">
                                          {opt.isToday
                                             ? "Today"
                                             : opt.shortLabel.startsWith("Day ")
                                               ? `D${opt.dayNumber}`
                                               : opt.shortLabel.slice(0, 3)}
                                       </span>
                                       <span className="text-caption opacity-60 mt-0.5 leading-none truncate max-w-full">
                                          {formatDayDate(opt.dateKey)}
                                       </span>
                                       <span className="text-micro text-text-tertiary mt-1 flex items-center justify-center">
                                          <Lock className="h-2 w-2" />
                                       </span>
                                    </button>
                                 );
                              }

                              return (
                                 <button
                                    key={opt.dateKey}
                                    type="button"
                                    onClick={() =>
                                       setEditTaskInputDueDate(opt.dateKey)
                                    }
                                    title={
                                       opt.isToday
                                          ? "Today"
                                          : opt.isYesterday
                                            ? `Yesterday (${opt.label})`
                                            : opt.label
                                    }
                                    className={`py-1.5 px-1 flex flex-col items-center justify-center rounded-xl text-xs font-semibold border transition-all overflow-hidden ${
                                       isSelected
                                          ? "bg-brand-2 text-white border-brand-2 shadow-sm shadow-brand-2/30 ring-1 ring-brand-2"
                                          : "bg-surface-elevated text-text-tertiary border-border-strong hover:text-white hover:bg-surface-nested"
                                    }`}
                                 >
                                    <span className="text-label uppercase font-bold tracking-wider leading-none truncate max-w-full">
                                       {opt.isToday
                                          ? "Today"
                                          : opt.shortLabel.startsWith("Day ")
                                            ? `D${opt.dayNumber}`
                                            : opt.shortLabel.slice(0, 3)}
                                    </span>
                                    <span className="text-caption opacity-80 mt-0.5 leading-none truncate max-w-full">
                                       {formatDayDate(opt.dateKey)}
                                    </span>
                                    {opt.isToday && (
                                       <span
                                          className={`h-1 w-1 rounded-full mt-1 ${
                                             isSelected
                                                ? "bg-white"
                                                : "bg-brand-2"
                                          }`}
                                       />
                                    )}
                                 </button>
                              );
                           })}
                        </div>
                     </div>
                  )}

                  <div role="group" aria-labelledby="edit-task-status">
                     <Label
                        id="edit-task-status"
                        className="block text-xs font-medium text-text-secondary mb-1.5"
                     >
                        Task Status
                     </Label>
                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                           type="button"
                           onClick={() => setEditTaskInputStatus("TODO")}
                           className={`flex items-center justify-center gap-1.5 h-10 px-2 rounded-xl text-xs font-semibold border transition-all ${
                              editTaskInputStatus === "TODO"
                                 ? "bg-surface-nested text-white border-white/30 shadow-inner ring-1 ring-white/20"
                                 : "bg-surface-elevated text-text-tertiary border-border-strong hover:text-white hover:bg-surface-nested"
                           }`}
                        >
                           <span
                              className={`h-2 w-2 rounded-full ${
                                 editTaskInputStatus === "TODO"
                                    ? "bg-white"
                                    : "bg-input-bg"
                              }`}
                           />
                           <span>To-Do</span>
                        </button>
                        <button
                           type="button"
                           onClick={() => setEditTaskInputStatus("IN_PROGRESS")}
                           className={`flex items-center justify-center gap-1.5 h-10 px-2 rounded-xl text-xs font-semibold border transition-all ${
                              editTaskInputStatus === "IN_PROGRESS"
                                 ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-inner ring-1 ring-amber-500/30"
                                 : "bg-surface-elevated text-text-tertiary border-border-strong hover:text-white hover:bg-surface-nested"
                           }`}
                        >
                           <span
                              className={`h-2 w-2 rounded-full ${
                                 editTaskInputStatus === "IN_PROGRESS"
                                    ? "bg-amber-400"
                                    : "bg-input-bg"
                              }`}
                           />
                           <span>In Progress</span>
                        </button>
                        <button
                           type="button"
                           onClick={() => setEditTaskInputStatus("COMPLETED")}
                           className={`flex items-center justify-center gap-1.5 h-10 px-2 rounded-xl text-xs font-semibold border transition-all ${
                              editTaskInputStatus === "COMPLETED"
                                 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-inner ring-1 ring-emerald-500/30"
                                 : "bg-surface-elevated text-text-tertiary border-border-strong hover:text-white hover:bg-surface-nested"
                           }`}
                        >
                           <Check
                              className={`h-3.5 w-3.5 ${
                                 editTaskInputStatus === "COMPLETED"
                                    ? "text-emerald-400 stroke-[3]"
                                    : "text-text-tertiary"
                              }`}
                           />
                           <span>Completed</span>
                        </button>
                        <button
                           type="button"
                           onClick={() => setEditTaskInputStatus("CROSSED_OUT")}
                           className={`flex items-center justify-center gap-1.5 h-10 px-2 rounded-xl text-xs font-semibold border transition-all ${
                              editTaskInputStatus === "CROSSED_OUT"
                                 ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-inner ring-1 ring-rose-500/30"
                                 : "bg-surface-elevated text-text-tertiary border-border-strong hover:text-white hover:bg-surface-nested"
                           }`}
                        >
                           <X
                              className={`h-3.5 w-3.5 ${
                                 editTaskInputStatus === "CROSSED_OUT"
                                    ? "text-rose-400 stroke-[2.5]"
                                    : "text-text-tertiary"
                              }`}
                           />
                           <span>Crossed Out</span>
                        </button>
                     </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3">
                     <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setEditTaskModal(null)}
                        className="h-11 px-5 rounded-xl bg-input-bg text-white hover:bg-input-bg text-xs font-medium"
                     >
                        Cancel
                     </Button>
                     <Button
                        type="submit"
                        className="h-11 px-6 rounded-xl bg-white text-text-inverse hover:bg-white/90 text-xs font-semibold"
                     >
                        Save Changes
                     </Button>
                  </div>
               </form>
            </DialogContent>
         </Dialog>

         {/* Rename Category Modal */}
         <Dialog
            open={Boolean(editCategoryModal)}
            onOpenChange={(open) => {
               if (!open) setEditCategoryModal(null);
            }}
         >
            <DialogContent className="max-w-md rounded-2xl border-border-strong bg-surface-nested p-6 space-y-5">
               <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-bold text-white">
                     Rename Category
                  </DialogTitle>
               </div>
               <form
                  onSubmit={(e) => {
                     e.preventDefault();
                     handleSaveEditCategory(editCategoryInputName);
                  }}
                  className="space-y-4"
               >
                  <div>
                     <Label
                        htmlFor="edit-category-name"
                        className="block text-xs font-medium text-text-secondary mb-1.5"
                     >
                        Category Name
                     </Label>
                     <Input
                        id="edit-category-name"
                        type="text"
                        value={editCategoryInputName}
                        onChange={(e) =>
                           setEditCategoryInputName(e.target.value)
                        }
                        autoFocus
                        required
                        className="h-11 bg-input-bg border-input-border text-text-primary rounded-xl"
                     />
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-3">
                     <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setEditCategoryModal(null)}
                        className="h-11 px-5 rounded-xl bg-input-bg text-white hover:bg-input-bg text-xs font-medium"
                     >
                        Cancel
                     </Button>
                     <Button
                        type="submit"
                        className="h-11 px-6 rounded-xl bg-white text-text-inverse hover:bg-white/90 text-xs font-semibold"
                     >
                        Save Changes
                     </Button>
                  </div>
               </form>
            </DialogContent>
         </Dialog>

         {/* Delete Category Confirmation Modal */}
         <AlertDialog
            open={Boolean(deleteCategoryModal)}
            onOpenChange={(open) => {
               if (!open) setDeleteCategoryModal(null);
            }}
         >
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>Delete Category</AlertDialogTitle>
                  <AlertDialogDescription>
                     Are you sure you want to delete{" "}
                     <span className="font-semibold text-white">
                        &quot;{deleteCategoryModal?.name}&quot;
                     </span>
                     ? All daily and weekly tasks inside this category will also
                     be permanently deleted.
                  </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                     onClick={() => handleConfirmDeleteCategory()}
                  >
                     Delete Category
                  </AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      </>
   );
}
