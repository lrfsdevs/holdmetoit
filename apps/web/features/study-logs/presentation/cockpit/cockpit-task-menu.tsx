"use client";

import React from "react";
import {
   Check,
   RotateCcw,
   Calendar,
   ArrowRight,
   Pencil,
   Trash2,
   Trophy,
   User,
} from "lucide-react";
import {
   formatDayDate,
   validateMoveTaskChallengeDay,
   type ChallengeDayOption,
} from "@/features/study-logs/domain/challenge-day";
import type { TaskStatus } from "@/features/tasks/domain/task.types";
import type { TaskItem, CategoryGroup } from "./cockpit-tasks-section";

interface TaskMenuItemsProps {
   task: TaskItem;
   catIdx: number;
   taskType: "daily" | "weekly";
   effectiveTodayDate: string;
   dayOptions: ChallengeDayOption[];
   selectedDateKey: string;
   isChallengeActive?: boolean;
   linkableChallengeId?: string | null;
   onToggleChallengeScope?: (newChallengeId: string | null) => void;
   onSetStatus: (status: TaskStatus) => void;
   onMoveToDay: (targetDateKey: string) => void;
   onEditTask: () => void;
   onDeleteTask: () => void;
   Item: React.ElementType;
   Separator: React.ElementType;
   Label: React.ElementType;
}

export function TaskMenuItems({
   task,
   taskType,
   effectiveTodayDate,
   dayOptions,
   isChallengeActive = true,
   linkableChallengeId,
   onToggleChallengeScope,
   onSetStatus,
   onMoveToDay,
   onEditTask,
   onDeleteTask,
   Item,
   Separator,
   Label,
}: TaskMenuItemsProps) {
   const status: TaskStatus =
      task.status || (task.completed ? "COMPLETED" : "TODO");

   const isTaskOnPastDay =
      taskType === "daily" &&
      (() => {
         const dateKey = task.dueDate
            ? typeof task.dueDate === "string"
               ? task.dueDate.slice(0, 10)
               : new Date(task.dueDate).toISOString().slice(0, 10)
            : task.createdAt
              ? new Date(task.createdAt).toISOString().slice(0, 10)
              : effectiveTodayDate;
         const targetOpt = dayOptions.find((d) => d.dateKey === dateKey);
         return targetOpt?.isPast ?? dateKey < effectiveTodayDate;
      })();

   const moveDaysConfig =
      taskType === "daily"
         ? (() => {
              const taskDateKey = task.dueDate
                 ? typeof task.dueDate === "string"
                    ? task.dueDate.slice(0, 10)
                    : new Date(task.dueDate).toISOString().slice(0, 10)
                 : task.createdAt
                   ? new Date(task.createdAt).toISOString().slice(0, 10)
                   : effectiveTodayDate;

              const sourceOpt = dayOptions.find(
                 (d) => d.dateKey === taskDateKey
              );
              const isSourcePast =
                 sourceOpt?.isPast ?? taskDateKey < effectiveTodayDate;

              const eligibleDays = dayOptions.filter((opt) => {
                 if (opt.dateKey === taskDateKey) return false;
                 return validateMoveTaskChallengeDay(
                    taskDateKey,
                    opt.dateKey,
                    effectiveTodayDate,
                    { isChallengeActive }
                 ).ok;
              });

              if (eligibleDays.length === 0) return null;

              const todayOpt = eligibleDays.find(
                 (d) => d.dateKey === effectiveTodayDate
              );
              const otherEligible = eligibleDays.filter(
                 (d) => d.dateKey !== effectiveTodayDate
              );

              return { isSourcePast, todayOpt, otherEligible };
           })()
         : null;

   return (
      <>
         {status === "COMPLETED" ? (
            <Item
               onSelect={() => onSetStatus("TODO")}
               onClick={() => onSetStatus("TODO")}
               className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-text-secondary rounded-lg hover:bg-surface-nested transition-colors text-left"
            >
               <RotateCcw className="h-3.5 w-3.5 text-text-tertiary" />
               <span>Reset to To-Do</span>
            </Item>
         ) : (
            <Item
               onSelect={() => onSetStatus("COMPLETED")}
               onClick={() => onSetStatus("COMPLETED")}
               className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-emerald-300 rounded-lg hover:bg-emerald-500/10 transition-colors text-left"
            >
               <Check className="h-3.5 w-3.5 text-emerald-400" />
               <span>Mark as Completed</span>
            </Item>
         )}

         <Separator />
         <Label>Status</Label>

         <Item
            onSelect={() => onSetStatus("IN_PROGRESS")}
            onClick={() => onSetStatus("IN_PROGRESS")}
            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-left ${
               status === "IN_PROGRESS"
                  ? "text-white bg-surface-nested"
                  : "text-text-tertiary hover:bg-surface-nested hover:text-text-secondary"
            }`}
         >
            <div className="flex items-center gap-2">
               <span
                  className={`h-2 w-2 rounded-full ${
                     status === "IN_PROGRESS" ? "bg-amber-400" : "bg-input-bg"
                  }`}
               />
               <span>In Progress</span>
            </div>
            {status === "IN_PROGRESS" && (
               <Check className="h-3 w-3 text-amber-400" />
            )}
         </Item>

         <Item
            onSelect={() => onSetStatus("COMPLETED")}
            onClick={() => onSetStatus("COMPLETED")}
            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-left ${
               status === "COMPLETED"
                  ? "text-white bg-surface-nested"
                  : "text-text-tertiary hover:bg-surface-nested hover:text-text-secondary"
            }`}
         >
            <div className="flex items-center gap-2">
               <span
                  className={`h-2 w-2 rounded-full ${
                     status === "COMPLETED" ? "bg-emerald-400" : "bg-input-bg"
                  }`}
               />
               <span>Completed</span>
            </div>
            {status === "COMPLETED" && (
               <Check className="h-3 w-3 text-emerald-400" />
            )}
         </Item>

         <Item
            onSelect={() => onSetStatus("CROSSED_OUT")}
            onClick={() => onSetStatus("CROSSED_OUT")}
            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-left ${
               status === "CROSSED_OUT"
                  ? "text-white bg-surface-nested"
                  : "text-text-tertiary hover:bg-surface-nested hover:text-text-secondary"
            }`}
         >
            <div className="flex items-center gap-2">
               <span
                  className={`h-2 w-2 rounded-full ${
                     status === "CROSSED_OUT" ? "bg-rose-400" : "bg-input-bg"
                  }`}
               />
               <span>Crossed Out</span>
            </div>
            {status === "CROSSED_OUT" && (
               <Check className="h-3 w-3 text-rose-400" />
            )}
         </Item>

         {status !== "TODO" && (
            <Item
               onSelect={() => onSetStatus("TODO")}
               onClick={() => onSetStatus("TODO")}
               className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-text-tertiary hover:bg-surface-nested hover:text-text-secondary rounded-lg transition-colors text-left"
            >
               <RotateCcw className="h-3 w-3 text-text-tertiary" />
               <span>Reset to To-Do</span>
            </Item>
         )}

         {moveDaysConfig && (
            <>
               <Separator />
               <div className="px-3 py-1 text-label font-semibold tracking-wider uppercase text-text-tertiary flex items-center justify-between">
                  <span>Move to Day</span>
                  {moveDaysConfig.isSourcePast && (
                     <span className="text-caption text-amber-400 font-medium normal-case">
                        From past day
                     </span>
                  )}
               </div>
               {moveDaysConfig.todayOpt && (
                  <Item
                     onSelect={() => onMoveToDay(effectiveTodayDate)}
                     onClick={() => onMoveToDay(effectiveTodayDate)}
                     className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors text-left"
                  >
                     {moveDaysConfig.isSourcePast ? (
                        <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
                     ) : (
                        <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                     )}
                     <span>
                        {moveDaysConfig.isSourcePast
                           ? "Roll over to Today"
                           : "Move to Today"}
                     </span>
                  </Item>
               )}
               {moveDaysConfig.otherEligible.map((opt) => (
                  <Item
                     key={opt.dateKey}
                     onSelect={() => onMoveToDay(opt.dateKey)}
                     onClick={() => onMoveToDay(opt.dateKey)}
                     className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-nested hover:text-white rounded-lg transition-colors text-left"
                  >
                     <ArrowRight className="h-3 w-3 text-text-tertiary" />
                     <span>
                        Move to {opt.shortLabel} ({formatDayDate(opt.dateKey)})
                     </span>
                  </Item>
               ))}
            </>
         )}

         {taskType === "weekly" &&
            linkableChallengeId &&
            onToggleChallengeScope && (
               <>
                  <Separator />
                  <div className="px-3 py-1 text-label font-semibold tracking-wider uppercase text-text-tertiary">
                     Goal Scope
                  </div>
                  {task.challengeId === linkableChallengeId ? (
                     <Item
                        onSelect={() => onToggleChallengeScope(null)}
                        onClick={() => onToggleChallengeScope(null)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-text-secondary rounded-lg hover:bg-surface-nested transition-colors text-left"
                     >
                        <User className="h-3.5 w-3.5 text-text-tertiary" />
                        <span>Convert to Personal Goal</span>
                     </Item>
                  ) : (
                     <Item
                        onSelect={() =>
                           onToggleChallengeScope(linkableChallengeId)
                        }
                        onClick={() =>
                           onToggleChallengeScope(linkableChallengeId)
                        }
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-amber-300 rounded-lg hover:bg-amber-500/10 transition-colors text-left"
                     >
                        <Trophy className="h-3.5 w-3.5 text-amber-400" />
                        <span>Set as Challenge Goal</span>
                     </Item>
                  )}
               </>
            )}

         <Separator />

         <Item
            onSelect={onEditTask}
            onClick={onEditTask}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-text-primary rounded-lg hover:bg-surface-nested transition-colors text-left"
         >
            <Pencil className="h-3.5 w-3.5 text-text-tertiary" />
            <span>Edit Task</span>
         </Item>

         {Boolean(isChallengeActive && isTaskOnPastDay) ? (
            <Item
               disabled
               className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-text-tertiary cursor-not-allowed text-left opacity-50"
               title="Tasks on past challenge days cannot be deleted"
            >
               <Trash2 className="h-3.5 w-3.5 text-text-tertiary" />
               <span>Delete Task (Locked)</span>
            </Item>
         ) : (
            <Item
               onSelect={onDeleteTask}
               onClick={onDeleteTask}
               className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-400 rounded-lg hover:bg-red-500/10 hover:text-red-300 transition-colors text-left"
            >
               <Trash2 className="h-3.5 w-3.5 text-red-400" />
               <span>Delete Task</span>
            </Item>
         )}
      </>
   );
}

interface CategoryMenuItemsProps {
   cat: CategoryGroup;
   catType: "daily" | "weekly";
   dailyCategories: CategoryGroup[];
   weeklyCategories: CategoryGroup[];
   selectedDateKey: string;
   effectiveTodayDate: string;
   dayOptions: ChallengeDayOption[];
   isChallengeActive?: boolean;
   onMoveCategoryToDay: (targetDateKey: string) => void;
   onRenameCategory: () => void;
   onDeleteCategory: () => void;
   Item: React.ElementType;
   Separator: React.ElementType;
   Label: React.ElementType;
}

export function CategoryMenuItems({
   cat,
   catType,
   dailyCategories,
   weeklyCategories,
   selectedDateKey,
   effectiveTodayDate,
   dayOptions,
   isChallengeActive = true,
   onMoveCategoryToDay,
   onRenameCategory,
   onDeleteCategory,
   Item,
   Separator,
   Label,
}: CategoryMenuItemsProps) {
   const isDaily = catType === "daily";
   const catIdx = isDaily
      ? dailyCategories.findIndex((c) =>
           cat.id ? c.id === cat.id : c.name === cat.name
        )
      : weeklyCategories.findIndex((c) =>
           cat.id ? c.id === cat.id : c.name === cat.name
        );

   const eligibleDays =
      catIdx === -1
         ? []
         : dayOptions.filter((opt) => {
              if (isDaily) {
                 if (opt.dateKey === selectedDateKey) return false;
                 return validateMoveTaskChallengeDay(
                    selectedDateKey,
                    opt.dateKey,
                    effectiveTodayDate,
                    { isChallengeActive }
                 ).ok;
              }
              return isChallengeActive ? !opt.isPast : true;
           });

   const todayOpt = eligibleDays.find((d) => d.dateKey === effectiveTodayDate);
   const otherEligible = eligibleDays.filter(
      (d) => d.dateKey !== effectiveTodayDate
   );

   const dailyTargetCat = dailyCategories.find((c) =>
      cat.id ? c.id === cat.id : catType === "daily" && c.name === cat.name
   );

   const targetCat =
      catType === "daily"
         ? dailyTargetCat
         : weeklyCategories.find((c) =>
              cat.id ? c.id === cat.id : c.name === cat.name
           );

   const relevantDailyCat = catType === "daily" ? targetCat : dailyTargetCat;

   const hasPastTasks = Boolean(
      isChallengeActive &&
      relevantDailyCat?.tasks.some((t) => {
         const dateKey = t.dueDate
            ? typeof t.dueDate === "string"
               ? t.dueDate.slice(0, 10)
               : new Date(t.dueDate).toISOString().slice(0, 10)
            : t.createdAt
              ? new Date(t.createdAt).toISOString().slice(0, 10)
              : effectiveTodayDate;
         const opt = dayOptions.find((d) => d.dateKey === dateKey);
         return opt?.isPast ?? dateKey < effectiveTodayDate;
      })
   );

   return (
      <>
         {eligibleDays.length > 0 && (
            <div className="py-0.5">
               <Label>Move Category to Day</Label>
               {todayOpt && (
                  <Item
                     onSelect={() => onMoveCategoryToDay(effectiveTodayDate)}
                     onClick={() => onMoveCategoryToDay(effectiveTodayDate)}
                     className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors text-left"
                  >
                     <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                     <span>Move to Today</span>
                  </Item>
               )}
               {otherEligible.map((opt) => (
                  <Item
                     key={opt.dateKey}
                     onSelect={() => onMoveCategoryToDay(opt.dateKey)}
                     onClick={() => onMoveCategoryToDay(opt.dateKey)}
                     className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-nested hover:text-white rounded-lg transition-colors text-left"
                  >
                     <ArrowRight className="h-3 w-3 text-text-tertiary" />
                     <span>
                        Move to {opt.shortLabel} ({formatDayDate(opt.dateKey)})
                     </span>
                  </Item>
               ))}
               <Separator />
            </div>
         )}

         <Item
            onSelect={onRenameCategory}
            onClick={onRenameCategory}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-text-primary rounded-lg hover:bg-surface-nested transition-colors text-left"
         >
            <Pencil className="h-3.5 w-3.5 text-text-tertiary" />
            <span>Rename Category</span>
         </Item>

         {hasPastTasks ? (
            <Item
               disabled
               className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-text-tertiary cursor-not-allowed text-left opacity-50"
               title="Categories containing tasks on past challenge days cannot be deleted"
            >
               <Trash2 className="h-3.5 w-3.5 text-text-tertiary" />
               <span>Delete Category (Locked)</span>
            </Item>
         ) : (
            <Item
               onSelect={onDeleteCategory}
               onClick={onDeleteCategory}
               className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-400 rounded-lg hover:bg-red-500/10 hover:text-red-300 transition-colors text-left"
            >
               <Trash2 className="h-3.5 w-3.5 text-red-400" />
               <span>Delete Category</span>
            </Item>
         )}
      </>
   );
}
