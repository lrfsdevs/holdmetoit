import { Calendar, Clock, AlertCircle } from "lucide-react";
import { MAX_COUNTED_DAILY_STUDY_SECONDS } from "@/features/study-logs/domain/duration";
import type { ParticipantDailyHistoryEntry } from "../domain/participant-stats.types";

interface ParticipantDailyHistoryProps {
   dailyHistory: ParticipantDailyHistoryEntry[];
   isFallback?: boolean;
}

export function ParticipantDailyHistory({
   dailyHistory,
   isFallback = false,
}: ParticipantDailyHistoryProps) {
   return (
      <div className="rounded-3xl border border-border-default bg-surface-primary p-5 sm:p-7 shadow-xl space-y-4">
         <div className="flex items-center justify-between pb-3 border-b border-border-default">
            <div className="flex items-center gap-2">
               <Calendar className="h-5 w-5 text-feedback-info" />
               <h2 className="text-base sm:text-lg font-bold text-text-primary">
                  Daily Study History
               </h2>
            </div>
            <span className="text-xs text-text-tertiary">
               {isFallback
                  ? "0 Days Logged"
                  : `${dailyHistory.length} Days Recorded`}
            </span>
         </div>

         {isFallback ? (
            <div className="rounded-2xl border border-dashed border-border-default bg-surface-tertiary/40 p-8 text-center space-y-2 my-2">
               <Clock className="h-8 w-8 mx-auto text-text-tertiary" />
               <p className="text-sm font-semibold text-text-secondary">
                  No Study Sessions Recorded
               </p>
               <p className="text-xs text-text-tertiary max-w-md mx-auto">
                  This scholar was not enrolled in this challenge. Daily study
                  hours, leave days, and audit trails only appear for enrolled
                  participants.
               </p>
            </div>
         ) : dailyHistory.length === 0 ? (
            <p className="text-center py-8 text-xs text-text-tertiary">
               No challenge days recorded yet.
            </p>
         ) : (
            <>
               {/* Mobile View: Cards */}
               <div className="sm:hidden space-y-2.5">
                  {dailyHistory.map((day) => (
                     <div
                        key={day.dayNumber}
                        className="rounded-2xl border border-border-default bg-surface-tertiary p-3.5 space-y-2"
                     >
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white">
                                 Day {day.dayNumber}
                              </span>
                              <span className="text-xs text-text-tertiary">
                                 {day.dateFormatted} ({day.weekday})
                              </span>
                           </div>

                           {day.isLeave && (
                              <span className="px-2 py-0.5 rounded-full bg-brand-1/15 border border-brand-1/40 text-brand-1 text-label font-semibold inline-flex items-center gap-1">
                                 <span>🌴</span>
                                 On Leave
                              </span>
                           )}
                           {day.isToday && !day.isLeave && (
                              <span className="px-2 py-0.5 rounded-full bg-feedback-success-bg border border-feedback-success/40 text-feedback-success-text text-label font-semibold">
                                 Today
                              </span>
                           )}
                           {day.isYesterday && !day.isLeave && (
                              <span className="px-2 py-0.5 rounded-full bg-surface-elevated border border-border-strong text-text-secondary text-label font-medium">
                                 Yesterday
                              </span>
                           )}
                           {day.isFuture && (
                              <span className="px-2 py-0.5 rounded-full bg-surface-elevated border border-border-default text-text-tertiary text-label font-medium">
                                 Upcoming
                              </span>
                           )}
                        </div>

                        <div className="flex items-baseline justify-between pt-1 border-t border-border-default text-xs">
                           <div>
                              <span className="text-text-tertiary">
                                 Logged:{" "}
                              </span>
                              <span
                                 className={`font-bold font-sans font-sans-tabular ${
                                    day.isLeave ? "text-brand-1" : "text-white"
                                 }`}
                              >
                                 {day.durationClock}
                              </span>
                              {day.durationSeconds >
                                 MAX_COUNTED_DAILY_STUDY_SECONDS && (
                                 <span className="ml-1.5 px-1.5 py-0.5 rounded text-label font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                                    14h counted
                                 </span>
                              )}
                              <span className="text-meta text-text-tertiary ml-1">
                                 {day.isLeave
                                    ? "(Leave Day)"
                                    : `(${day.durationHuman})`}
                              </span>
                           </div>

                           <div>
                              <span className="text-text-tertiary">
                                 Total:{" "}
                              </span>
                              <span className="font-semibold font-sans font-sans-tabular text-text-secondary">
                                 {day.isFuture ? "—" : day.cumulativeClock}
                              </span>
                           </div>
                        </div>

                        {day.isOverride && (
                           <div className="pt-1 flex items-center gap-1.5 text-label text-brand-1">
                              <AlertCircle className="h-3 w-3" />
                              <span>Host / Admin adjustment</span>
                           </div>
                        )}
                        {day.isLeave && !day.isOverride && (
                           <div className="pt-1 flex items-center gap-1.5 text-label text-brand-1">
                              <span>🌴</span>
                              <span>Marked as Leave</span>
                           </div>
                        )}
                     </div>
                  ))}
               </div>

               {/* Desktop View: Table */}
               <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                     <thead>
                        <tr className="border-b border-border-default text-meta font-bold text-text-tertiary uppercase tracking-wider">
                           <th className="py-3 px-3">Day</th>
                           <th className="py-3 px-3">Date</th>
                           <th className="py-3 px-3">Status</th>
                           <th className="py-3 px-3">Logged Duration</th>
                           <th className="py-3 px-3">Cumulative</th>
                           <th className="py-3 px-3 text-right">Notes</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border-subtle">
                        {dailyHistory.map((day) => (
                           <tr
                              key={day.dayNumber}
                              className={`transition-colors ${
                                 day.isLeave
                                    ? "bg-brand-1/15/15 hover:bg-brand-1/15/25"
                                    : day.isToday
                                      ? "bg-feedback-success-bg/15 hover:bg-feedback-success-bg/25"
                                      : "hover:bg-surface-tertiary"
                              }`}
                           >
                              <td className="py-3 px-3 font-bold text-white">
                                 Day {day.dayNumber}
                              </td>
                              <td className="py-3 px-3 text-text-secondary">
                                 {day.dateFormatted}{" "}
                                 <span className="text-text-tertiary">
                                    ({day.weekday})
                                 </span>
                              </td>
                              <td className="py-3 px-3">
                                 {day.isLeave ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-1/15 border border-brand-1/40 text-brand-1 text-label font-semibold">
                                       <span>🌴</span>
                                       On Leave
                                    </span>
                                 ) : day.isToday ? (
                                    <span className="px-2 py-0.5 rounded-full bg-feedback-success-bg border border-feedback-success/40 text-feedback-success-text text-label font-semibold">
                                       Today
                                    </span>
                                 ) : day.isYesterday ? (
                                    <span className="px-2 py-0.5 rounded-full bg-surface-elevated border border-border-strong text-text-secondary text-label font-medium">
                                       Yesterday
                                    </span>
                                 ) : day.isFuture ? (
                                    <span className="text-text-tertiary text-meta">
                                       Upcoming
                                    </span>
                                 ) : (
                                    <span className="text-text-tertiary text-meta">
                                       Past
                                    </span>
                                 )}
                              </td>
                              <td className="py-3 px-3 font-sans font-sans-tabular">
                                 <div className="flex items-center gap-1.5">
                                    <Clock
                                       className={`h-3.5 w-3.5 ${
                                          day.isLeave
                                             ? "text-brand-1"
                                             : "text-feedback-success"
                                       }`}
                                    />
                                    <span
                                       className={`font-bold text-xs ${
                                          day.isLeave
                                             ? "text-brand-1"
                                             : "text-white"
                                       }`}
                                    >
                                       {day.durationClock}
                                    </span>
                                    {day.durationSeconds >
                                       MAX_COUNTED_DAILY_STUDY_SECONDS && (
                                       <span className="px-1.5 py-0.5 rounded text-label font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                                          14h counted
                                       </span>
                                    )}
                                    <span className="text-meta text-text-tertiary">
                                       {day.isLeave
                                          ? "(Leave)"
                                          : `(${day.durationHuman})`}
                                    </span>
                                 </div>
                              </td>
                              <td className="py-3 px-3 font-sans font-sans-tabular text-text-secondary">
                                 {day.isFuture ? "—" : day.cumulativeClock}
                              </td>
                              <td className="py-3 px-3 text-right">
                                 {day.isOverride ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-1/15 border border-brand-1/40 text-brand-1 text-label font-semibold">
                                       <AlertCircle className="h-2.5 w-2.5" />
                                       Host Override
                                    </span>
                                 ) : day.isLeave ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-1/15 border border-brand-1/30 text-brand-1 text-label font-medium">
                                       <span>🌴</span>
                                       Marked as Leave
                                    </span>
                                 ) : (
                                    <span className="text-text-tertiary text-meta">
                                       —
                                    </span>
                                 )}
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </>
         )}
      </div>
   );
}
