import { Calendar, Clock, AlertCircle } from "lucide-react";
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
      <div className="rounded-3xl border border-[#262626] bg-[#141414] p-5 sm:p-7 shadow-xl space-y-4">
         <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
            <div className="flex items-center gap-2">
               <Calendar className="h-5 w-5 text-[#3b82f6]" />
               <h2 className="text-base sm:text-lg font-bold text-[#f4f3f6]">
                  Daily Study History
               </h2>
            </div>
            <span className="text-xs text-[#868686]">
               {isFallback
                  ? "0 Days Logged"
                  : `${dailyHistory.length} Days Recorded`}
            </span>
         </div>

         {isFallback ? (
            <div className="rounded-2xl border border-dashed border-[#292929] bg-[#1a1a1a]/40 p-8 text-center space-y-2 my-2">
               <Clock className="h-8 w-8 mx-auto text-[#545454]" />
               <p className="text-sm font-semibold text-[#d1d1d1]">
                  No Study Sessions Recorded
               </p>
               <p className="text-xs text-[#868686] max-w-md mx-auto">
                  This scholar was not enrolled in this challenge. Daily study
                  hours, leave days, and audit trails only appear for enrolled
                  participants.
               </p>
            </div>
         ) : dailyHistory.length === 0 ? (
            <p className="text-center py-8 text-xs text-[#868686]">
               No challenge days recorded yet.
            </p>
         ) : (
            <>
               {/* Mobile View: Cards */}
               <div className="sm:hidden space-y-2.5">
                  {dailyHistory.map((day) => (
                     <div
                        key={day.dayNumber}
                        className="rounded-2xl border border-[#262626] bg-[#1a1a1a] p-3.5 space-y-2"
                     >
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white">
                                 Day {day.dayNumber}
                              </span>
                              <span className="text-xs text-[#868686]">
                                 {day.dateFormatted} ({day.weekday})
                              </span>
                           </div>

                           {day.isLeave && (
                              <span className="px-2 py-0.5 rounded-full bg-[#451a03] border border-[#f59e0b]/40 text-[#fcd34d] text-[10px] font-semibold inline-flex items-center gap-1">
                                 <span>🌴</span>
                                 On Leave
                              </span>
                           )}
                           {day.isToday && !day.isLeave && (
                              <span className="px-2 py-0.5 rounded-full bg-[#144520] border border-[#22c55e]/40 text-[#85ff93] text-[10px] font-semibold">
                                 Today
                              </span>
                           )}
                           {day.isYesterday && !day.isLeave && (
                              <span className="px-2 py-0.5 rounded-full bg-[#1c1c1c] border border-[#383838] text-[#d1d1d1] text-[10px] font-medium">
                                 Yesterday
                              </span>
                           )}
                           {day.isFuture && (
                              <span className="px-2 py-0.5 rounded-full bg-[#1c1c1c] border border-[#2b2b2b] text-[#737373] text-[10px] font-medium">
                                 Upcoming
                              </span>
                           )}
                        </div>

                        <div className="flex items-baseline justify-between pt-1 border-t border-[#262626] text-xs">
                           <div>
                              <span className="text-[#868686]">Logged: </span>
                              <span
                                 className={`font-bold font-sans font-sans-tabular ${
                                    day.isLeave
                                       ? "text-[#fcd34d]"
                                       : "text-white"
                                 }`}
                              >
                                 {day.durationClock}
                              </span>
                              <span className="text-[11px] text-[#868686] ml-1">
                                 {day.isLeave
                                    ? "(Leave Day)"
                                    : `(${day.durationHuman})`}
                              </span>
                           </div>

                           <div>
                              <span className="text-[#868686]">Total: </span>
                              <span className="font-semibold font-sans font-sans-tabular text-[#d1d1d1]">
                                 {day.isFuture ? "—" : day.cumulativeClock}
                              </span>
                           </div>
                        </div>

                        {day.isOverride && (
                           <div className="pt-1 flex items-center gap-1.5 text-[10px] text-[#f59e0b]">
                              <AlertCircle className="h-3 w-3" />
                              <span>Host / Admin adjustment</span>
                           </div>
                        )}
                        {day.isLeave && !day.isOverride && (
                           <div className="pt-1 flex items-center gap-1.5 text-[10px] text-[#fcd34d]">
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
                        <tr className="border-b border-[#262626] text-[11px] font-bold text-[#868686] uppercase tracking-wider">
                           <th className="py-3 px-3">Day</th>
                           <th className="py-3 px-3">Date</th>
                           <th className="py-3 px-3">Status</th>
                           <th className="py-3 px-3">Logged Duration</th>
                           <th className="py-3 px-3">Cumulative</th>
                           <th className="py-3 px-3 text-right">Notes</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-[#222222]">
                        {dailyHistory.map((day) => (
                           <tr
                              key={day.dayNumber}
                              className={`transition-colors ${
                                 day.isLeave
                                    ? "bg-[#451a03]/15 hover:bg-[#451a03]/25"
                                    : day.isToday
                                      ? "bg-[#144520]/15 hover:bg-[#144520]/25"
                                      : "hover:bg-[#1a1a1a]"
                              }`}
                           >
                              <td className="py-3 px-3 font-bold text-white">
                                 Day {day.dayNumber}
                              </td>
                              <td className="py-3 px-3 text-[#d1d1d1]">
                                 {day.dateFormatted}{" "}
                                 <span className="text-[#868686]">
                                    ({day.weekday})
                                 </span>
                              </td>
                              <td className="py-3 px-3">
                                 {day.isLeave ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#451a03] border border-[#f59e0b]/40 text-[#fcd34d] text-[10px] font-semibold">
                                       <span>🌴</span>
                                       On Leave
                                    </span>
                                 ) : day.isToday ? (
                                    <span className="px-2 py-0.5 rounded-full bg-[#144520] border border-[#22c55e]/40 text-[#85ff93] text-[10px] font-semibold">
                                       Today
                                    </span>
                                 ) : day.isYesterday ? (
                                    <span className="px-2 py-0.5 rounded-full bg-[#1c1c1c] border border-[#383838] text-[#d1d1d1] text-[10px] font-medium">
                                       Yesterday
                                    </span>
                                 ) : day.isFuture ? (
                                    <span className="text-[#666666] text-[11px]">
                                       Upcoming
                                    </span>
                                 ) : (
                                    <span className="text-[#868686] text-[11px]">
                                       Past
                                    </span>
                                 )}
                              </td>
                              <td className="py-3 px-3 font-sans font-sans-tabular">
                                 <div className="flex items-center gap-1.5">
                                    <Clock
                                       className={`h-3.5 w-3.5 ${
                                          day.isLeave
                                             ? "text-[#f59e0b]"
                                             : "text-[#22c55e]"
                                       }`}
                                    />
                                    <span
                                       className={`font-bold text-xs ${
                                          day.isLeave
                                             ? "text-[#fcd34d]"
                                             : "text-white"
                                       }`}
                                    >
                                       {day.durationClock}
                                    </span>
                                    <span className="text-[11px] text-[#868686]">
                                       {day.isLeave
                                          ? "(Leave)"
                                          : `(${day.durationHuman})`}
                                    </span>
                                 </div>
                              </td>
                              <td className="py-3 px-3 font-sans font-sans-tabular text-[#d1d1d1]">
                                 {day.isFuture ? "—" : day.cumulativeClock}
                              </td>
                              <td className="py-3 px-3 text-right">
                                 {day.isOverride ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#451a03] border border-[#f59e0b]/40 text-[#fcd34d] text-[10px] font-semibold">
                                       <AlertCircle className="h-2.5 w-2.5" />
                                       Host Override
                                    </span>
                                 ) : day.isLeave ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#291705] border border-[#f59e0b]/30 text-[#fcd34d] text-[10px] font-medium">
                                       <span>🌴</span>
                                       Marked as Leave
                                    </span>
                                 ) : (
                                    <span className="text-[#666666] text-[11px]">
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
