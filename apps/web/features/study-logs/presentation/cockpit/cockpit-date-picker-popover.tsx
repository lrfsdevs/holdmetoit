"use client";

import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import {
   Popover,
   PopoverTrigger,
   PopoverContent,
} from "@/components/ui/popover";
import {
   getCalendarMonthGrid,
   formatDayDate,
   type CalendarMonthCell,
} from "@/features/study-logs/domain/challenge-day";
import { cn } from "@/lib/utils";

export interface CockpitDatePickerPopoverProps {
   selectedDateKey: string;
   todayDateKey: string;
   weekRangeLabel: string;
   onSelectDate: (dateKey: string) => void;
   activeWeekDateKeys?: string[];
   mode?: "daily" | "weekly";
   disabled?: boolean;
   className?: string;
}

export function CockpitDatePickerPopover({
   selectedDateKey,
   todayDateKey,
   weekRangeLabel,
   onSelectDate,
   activeWeekDateKeys = [],
   mode = "daily",
   disabled = false,
   className,
}: CockpitDatePickerPopoverProps) {
   const [isOpen, setIsOpen] = useState(false);

   const initialYearMonth = useMemo(() => {
      try {
         const parts = selectedDateKey.split("-").map(Number);
         if (parts.length === 3 && parts[0] && parts[1]) {
            return { year: parts[0], month: parts[1] - 1 };
         }
      } catch {}
      const now = new Date();
      return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
   }, [selectedDateKey]);

   const [viewYear, setViewYear] = useState(initialYearMonth.year);
   const [viewMonth, setViewMonth] = useState(initialYearMonth.month);

   const handleOpenChange = (open: boolean) => {
      if (open) {
         try {
            const parts = selectedDateKey.split("-").map(Number);
            if (parts.length === 3 && parts[0] && parts[1]) {
               setViewYear(parts[0]);
               setViewMonth(parts[1] - 1);
            }
         } catch {}
      }
      setIsOpen(open);
   };

   const handlePreviousMonth = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (viewMonth === 0) {
         setViewYear((y) => y - 1);
         setViewMonth(11);
      } else {
         setViewMonth((m) => m - 1);
      }
   };

   const handleNextMonth = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (viewMonth === 11) {
         setViewYear((y) => y + 1);
         setViewMonth(0);
      } else {
         setViewMonth((m) => m + 1);
      }
   };

   const handleSelectDay = (cell: CalendarMonthCell) => {
      onSelectDate(cell.dateKey);
      setIsOpen(false);
   };

   const handleJumpToToday = (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelectDate(todayDateKey);
      setIsOpen(false);
   };

   const monthGrid = useMemo(() => {
      return getCalendarMonthGrid(viewYear, viewMonth);
   }, [viewYear, viewMonth]);

   const WEEKDAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

   return (
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
         <PopoverTrigger asChild>
            <button
               type="button"
               disabled={disabled}
               aria-label={
                  mode === "weekly"
                     ? `Current week: ${weekRangeLabel}. Click to pick week`
                     : `Current week: ${weekRangeLabel}. Click to pick date`
               }
               className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded text-caption font-semibold text-text-primary hover:text-white hover:bg-surface-secondary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-2",
                  disabled && "opacity-50 cursor-not-allowed",
                  className
               )}
            >
               <Calendar className="h-3.5 w-3.5 text-brand-2 shrink-0" />
               <span className="select-none tracking-tight">
                  {weekRangeLabel}
               </span>
            </button>
         </PopoverTrigger>
         <PopoverContent
            align="center"
            sideOffset={6}
            className="w-68 sm:w-72 p-3 bg-surface-primary border border-border-default rounded-xl shadow-2xl z-50 text-text-primary"
         >
            {/* Header: Prev month, Month Year Title, Next month */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border-subtle">
               <button
                  type="button"
                  aria-label="Previous month"
                  onClick={handlePreviousMonth}
                  className="p-1 rounded text-text-tertiary hover:text-white hover:bg-surface-secondary transition-colors"
               >
                  <ChevronLeft className="h-4 w-4" />
               </button>
               <span className="text-xs font-bold text-white select-none">
                  {monthGrid.monthName}
               </span>
               <button
                  type="button"
                  aria-label="Next month"
                  onClick={handleNextMonth}
                  className="p-1 rounded text-text-tertiary hover:text-white hover:bg-surface-secondary transition-colors"
               >
                  <ChevronRight className="h-4 w-4" />
               </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
               {WEEKDAY_HEADERS.map((day) => (
                  <span
                     key={day}
                     className="text-micro font-medium text-text-tertiary select-none"
                  >
                     {day}
                  </span>
               ))}
            </div>

            {/* Month grid days */}
            <div className="grid grid-cols-7 gap-1">
               {monthGrid.weeks.flatMap((week, wIdx) =>
                  week.map((cell) => {
                     const isSelected =
                        mode === "weekly"
                           ? activeWeekDateKeys.includes(cell.dateKey)
                           : cell.dateKey === selectedDateKey;
                     const isToday = cell.dateKey === todayDateKey;
                     const isInActiveWeek = activeWeekDateKeys.includes(
                        cell.dateKey
                     );

                     return (
                        <button
                           key={`${wIdx}-${cell.dateKey}`}
                           type="button"
                           onClick={() => handleSelectDay(cell)}
                           aria-label={`Select ${cell.dateKey}`}
                           className={cn(
                              "h-7 w-7 sm:h-8 sm:w-8 mx-auto rounded-lg text-caption flex items-center justify-center transition-colors relative select-none",
                              isSelected
                                 ? cn(
                                      "bg-brand-2 text-white font-bold shadow-sm",
                                      mode === "weekly" && "rounded-none",
                                      mode === "weekly" &&
                                         cell.weekdayIndex === 0 &&
                                         "rounded-l-lg",
                                      mode === "weekly" &&
                                         cell.weekdayIndex === 6 &&
                                         "rounded-r-lg"
                                   )
                                 : isInActiveWeek
                                   ? "bg-surface-nested text-text-primary hover:bg-surface-secondary"
                                   : cell.isCurrentMonth
                                     ? "text-text-primary hover:bg-surface-secondary"
                                     : "text-text-tertiary/40 hover:bg-surface-secondary/40",
                              isToday &&
                                 !isSelected &&
                                 "ring-1 ring-emerald-400 font-semibold text-emerald-400",
                              isToday &&
                                 isSelected &&
                                 mode === "weekly" &&
                                 "ring-1 ring-emerald-300"
                           )}
                        >
                           <span>{cell.dayOfMonth}</span>
                           {isToday && (
                              <span
                                 className={cn(
                                    "absolute bottom-0.5 h-1 w-1 rounded-full",
                                    isSelected && mode !== "weekly"
                                       ? "bg-white"
                                       : "bg-emerald-400"
                                 )}
                                 title="Today"
                              />
                           )}
                        </button>
                     );
                  })
               )}
            </div>

            {/* Quick jump to Today / This Week button */}
            <div className="mt-2 pt-2 border-t border-border-subtle flex items-center justify-between">
               <button
                  type="button"
                  onClick={handleJumpToToday}
                  className="text-micro font-medium text-brand-2 hover:text-brand-1 hover:underline transition-colors"
               >
                  {mode === "weekly" ? "Jump to This Week" : "Jump to Today"}
               </button>
               <span className="text-micro text-text-tertiary">
                  {mode === "weekly"
                     ? weekRangeLabel
                     : formatDayDate(todayDateKey)}
               </span>
            </div>
         </PopoverContent>
      </Popover>
   );
}

export interface CockpitWeekNavigatorProps {
   selectedDateKey: string;
   todayDateKey: string;
   weekRangeLabel: string;
   onPreviousWeek: () => void;
   onNextWeek: () => void;
   onSelectDate: (dateKey: string) => void;
   activeWeekDateKeys?: string[];
   mode?: "daily" | "weekly";
   showToday?: boolean;
   onJumpToToday?: () => void;
   disabled?: boolean;
   className?: string;
}

export function CockpitWeekNavigator({
   selectedDateKey,
   todayDateKey,
   weekRangeLabel,
   onPreviousWeek,
   onNextWeek,
   onSelectDate,
   activeWeekDateKeys = [],
   mode = "daily",
   showToday = false,
   onJumpToToday,
   disabled = false,
   className,
}: CockpitWeekNavigatorProps) {
   return (
      <div
         className={cn(
            "inline-flex items-center gap-0.5 bg-surface-nested/80 border border-border-subtle hover:border-border-default rounded-lg px-1 py-0.5 transition-colors shrink-0",
            className
         )}
      >
         <button
            type="button"
            aria-label={
               mode === "weekly"
                  ? "Previous week for weekly todos"
                  : "Previous week"
            }
            data-testid={mode === "weekly" ? "weekly-prev-week" : undefined}
            onClick={onPreviousWeek}
            disabled={disabled}
            className="p-1 rounded text-text-tertiary hover:text-white hover:bg-surface-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
         >
            <ChevronLeft className="h-3.5 w-3.5" />
         </button>

         <CockpitDatePickerPopover
            selectedDateKey={selectedDateKey}
            todayDateKey={todayDateKey}
            weekRangeLabel={weekRangeLabel}
            onSelectDate={onSelectDate}
            activeWeekDateKeys={activeWeekDateKeys}
            mode={mode}
            disabled={disabled}
         />

         <button
            type="button"
            aria-label={
               mode === "weekly" ? "Next week for weekly todos" : "Next week"
            }
            data-testid={mode === "weekly" ? "weekly-next-week" : undefined}
            onClick={onNextWeek}
            disabled={disabled}
            className="p-1 rounded text-text-tertiary hover:text-white hover:bg-surface-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
         >
            <ChevronRight className="h-3.5 w-3.5" />
         </button>

         {showToday && onJumpToToday && (
            <>
               <div className="h-3.5 w-px bg-border-strong mx-0.5 shrink-0" />
               <button
                  type="button"
                  onClick={onJumpToToday}
                  aria-label={mode === "weekly" ? "This week" : "Today"}
                  data-testid={
                     mode === "weekly" ? "weekly-jump-this-week" : undefined
                  }
                  className="px-1.5 py-0.5 rounded text-meta font-medium text-brand-2 hover:text-brand-1 hover:bg-surface-secondary transition-colors shrink-0"
               >
                  {mode === "weekly" ? "This Week" : "Today"}
               </button>
            </>
         )}
      </div>
   );
}
