import { BarChart3 } from "lucide-react";
import type { ParticipantDailyHistoryEntry } from "../domain/participant-stats.types";

interface ParticipantProgressChartProps {
   dailyHistory: ParticipantDailyHistoryEntry[];
}

export function ParticipantProgressChart({
   dailyHistory,
}: ParticipantProgressChartProps) {
   const maxDurationSeconds = Math.max(
      ...dailyHistory.map((d) => d.durationSeconds),
      3600 // minimum 1h scale
   );

   return (
      <div className="rounded-3xl border border-border-default bg-surface-primary p-5 sm:p-7 shadow-xl space-y-4">
         <div className="flex items-center justify-between pb-3 border-b border-border-default">
            <div className="flex items-center gap-2">
               <BarChart3 className="h-5 w-5 text-feedback-success" />
               <h2 className="text-base sm:text-lg font-bold text-text-primary">
                  Study Progress Across Challenge Days
               </h2>
            </div>
            <div className="flex items-center gap-4 text-xs text-text-tertiary">
               <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-feedback-success" />
                  Logged
               </span>
               <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-1" />
                  Admin Override
               </span>
               <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-1" />
                  Leave
               </span>
               <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-surface-nested" />
                  Rest / 0h
               </span>
            </div>
         </div>

         {/* Chart Canvas */}
         <div className="pt-6 pb-2">
            <div className="h-44 sm:h-52 w-full flex items-end justify-between gap-1.5 sm:gap-3 px-2">
               {dailyHistory.map((day) => {
                  const heightPercent =
                     maxDurationSeconds > 0
                        ? Math.max(
                             day.durationSeconds > 0 ? 8 : 3,
                             Math.round(
                                (day.durationSeconds / maxDurationSeconds) * 100
                             )
                          )
                        : 3;

                  let barColor = "bg-surface-nested hover:bg-surface-nested";
                  if (day.isLeave) {
                     barColor = "bg-brand-2 hover:bg-brand-1";
                  } else if (day.isOverride) {
                     barColor = "bg-brand-1 hover:bg-brand-1-light";
                  } else if (day.durationSeconds > 0) {
                     barColor = "bg-feedback-success hover:bg-feedback-success";
                  }

                  return (
                     <div
                        key={day.dayNumber}
                        className="flex-1 flex flex-col items-center h-full justify-end group relative"
                     >
                        {/* Floating Tooltip */}
                        <div className="absolute -top-12 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none z-10 bg-surface-elevated border border-border-strong px-2.5 py-1.5 rounded-xl shadow-xl whitespace-nowrap text-center text-xs">
                           <p className="font-bold text-white">
                              {day.label}:{" "}
                              {day.isLeave
                                 ? "🌴 On Leave (00:00:00)"
                                 : day.durationClock}
                           </p>
                           <p className="text-label text-text-tertiary">
                              {day.isFuture
                                 ? "Upcoming Day"
                                 : `Cumulative: ${day.cumulativeClock}`}
                           </p>
                        </div>

                        {/* Duration Label above Bar (Desktop only, if > 0) */}
                        <span
                           className={`hidden sm:block text-label font-sans font-sans-tabular mb-1 group-hover:text-white transition-colors ${
                              day.isLeave
                                 ? "text-brand-1 font-semibold"
                                 : "text-text-tertiary"
                           }`}
                        >
                           {day.isLeave
                              ? "Leave"
                              : day.durationSeconds > 0
                                ? day.durationHuman
                                : "0m"}
                        </span>

                        {/* The Bar */}
                        <div
                           className="w-full max-w-[42px] rounded-t-lg transition-all duration-300 relative overflow-hidden"
                           style={{ height: `${heightPercent}%` }}
                        >
                           <div
                              className={`w-full h-full ${barColor} transition-colors`}
                           />
                        </div>

                        {/* Day Label at bottom */}
                        <div className="mt-2.5 flex flex-col items-center">
                           <span
                              className={`text-meta font-semibold ${
                                 day.isToday
                                    ? "text-feedback-success"
                                    : "text-text-tertiary"
                              }`}
                           >
                              D{day.dayNumber}
                           </span>
                           <span className="text-caption text-text-tertiary">
                              {day.weekday}
                           </span>
                        </div>
                     </div>
                  );
               })}
            </div>
         </div>

         {/* Accessible Table for Screen Readers */}
         <table className="sr-only">
            <caption>Daily study progress in seconds</caption>
            <thead>
               <tr>
                  <th>Day</th>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Cumulative Duration</th>
               </tr>
            </thead>
            <tbody>
               {dailyHistory.map((day) => (
                  <tr key={day.dayNumber}>
                     <td>{day.label}</td>
                     <td>{day.dateFormatted}</td>
                     <td>{day.durationClock}</td>
                     <td>{day.cumulativeClock}</td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
   );
}
