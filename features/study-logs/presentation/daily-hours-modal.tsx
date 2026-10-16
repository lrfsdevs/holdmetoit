"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
   captureLogRocketException,
   trackLogRocketEvent,
} from "@/core/observability/logrocket";
import { logStudyTimeAction } from "@/features/study-logs/api/log-study-time.actions";
import { decomposeSecondsToParts } from "@/features/study-logs/domain/duration";
import {
   formatDayDate,
   getChallengeDayFromDateKey,
   getChallengeDayOptions,
   type ChallengeDayOption,
} from "@/features/study-logs/domain/challenge-day";
import { CoinsIcon } from "@/features/economy/presentation/coins-icon";

export interface DailyHoursModalProps {
   challengeId: string;
   isOpen: boolean;
   onClose: () => void;
   todayDate: string;
   todayDayNumber: number;
   yesterdayDate?: string;
   yesterdayDayNumber?: number;
   isYesterdayMissed?: boolean;
   initialDayNumber?: number;
   todayLoggedSeconds?: number;
   todayIsLeave?: boolean;
   yesterdayLoggedSeconds?: number;
   yesterdayIsLeave?: boolean;
   existingLogs?: Record<string, number>;
   existingLeaves?: Record<string, boolean>;
   initialHours?: number;
   initialMinutes?: number;
   initialSeconds?: number;
   onSuccess?: () => void;
   challengeStartDate?: string;
   totalChallengeDays?: number;
   isAdmin?: boolean;
   plannedLeaveDays?: number;
   usedLeaveDays?: number;
}

/** Renders the daily study-hours and leave logging modal. */
export function DailyHoursModal({
   challengeId,
   isOpen,
   onClose,
   todayDate,
   todayDayNumber,
   yesterdayDate,
   yesterdayDayNumber,
   isYesterdayMissed = false,
   initialDayNumber,
   todayLoggedSeconds = 0,
   todayIsLeave = false,
   yesterdayLoggedSeconds = 0,
   yesterdayIsLeave = false,
   existingLogs,
   existingLeaves,
   initialHours = 0,
   initialMinutes = 0,
   initialSeconds = 0,
   onSuccess,
   challengeStartDate,
   totalChallengeDays = 7,
   isAdmin = false,
   plannedLeaveDays,
   usedLeaveDays,
}: DailyHoursModalProps) {
   const router = useRouter();
   const showYesterdayOption = Boolean(isYesterdayMissed && yesterdayDate);

   // Derive start date if not explicitly provided
   const effectiveStartDate = useMemo(() => {
      if (challengeStartDate) return challengeStartDate;
      const [y, m, d] = todayDate.split("-").map(Number);
      const todayUtc = Date.UTC(y, m - 1, d);
      const startUtc = new Date(todayUtc - (todayDayNumber - 1) * 86_400_000);
      return startUtc.toISOString().slice(0, 10);
   }, [challengeStartDate, todayDate, todayDayNumber]);

   // Generate selectable challenge days for the week
   const dayOptions: ChallengeDayOption[] = useMemo(() => {
      return getChallengeDayOptions(
         effectiveStartDate,
         todayDate,
         totalChallengeDays
      );
   }, [effectiveStartDate, todayDate, totalChallengeDays]);

   const visibleDayOptions = useMemo(() => {
      if (isAdmin) {
         return dayOptions;
      }
      const editable = dayOptions.filter((d) => d.isToday || d.isYesterday);
      return editable.length > 0
         ? editable
         : [dayOptions.find((d) => d.isToday) || dayOptions[0]];
   }, [dayOptions, isAdmin]);

   const yesterdayOption = useMemo(
      () => dayOptions.find((d) => d.isYesterday),
      [dayOptions]
   );
   const effectiveYesterdayDate = yesterdayDate || yesterdayOption?.dateKey;
   const effectiveYesterdayDayNumber =
      yesterdayDayNumber ?? yesterdayOption?.dayNumber;

   const isAllowedInitialDay =
      initialDayNumber !== undefined &&
      (isAdmin
         ? initialDayNumber >= 1 && initialDayNumber <= totalChallengeDays
         : initialDayNumber === todayDayNumber ||
           (showYesterdayOption &&
              effectiveYesterdayDayNumber !== undefined &&
              initialDayNumber === effectiveYesterdayDayNumber));

   const initialDayNumberToUse = isAllowedInitialDay
      ? initialDayNumber!
      : todayDayNumber;

   const initialDateToUse =
      initialDayNumberToUse === effectiveYesterdayDayNumber &&
      effectiveYesterdayDate
         ? effectiveYesterdayDate
         : todayDate;

   const getExistingSecondsForDate = (date: string): number => {
      if (existingLogs && date in existingLogs) {
         return existingLogs[date];
      }
      if (date === todayDate) return todayLoggedSeconds ?? 0;
      if (date === yesterdayDate) return yesterdayLoggedSeconds ?? 0;
      return 0;
   };

   const getExistingIsLeaveForDate = (date: string): boolean => {
      if (existingLeaves && date in existingLeaves) {
         return Boolean(existingLeaves[date]);
      }
      if (date === todayDate) return Boolean(todayIsLeave);
      if (date === yesterdayDate) return Boolean(yesterdayIsLeave);
      return false;
   };

   const getInitialInputValues = (date: string) => {
      if (initialHours > 0 || initialMinutes > 0 || initialSeconds > 0) {
         return {
            hours: initialHours > 0 ? String(initialHours) : "",
            minutes: initialMinutes > 0 ? String(initialMinutes) : "",
            seconds: initialSeconds > 0 ? String(initialSeconds) : "",
         };
      }
      const existing = getExistingSecondsForDate(date);
      const isLeave = getExistingIsLeaveForDate(date);
      if (existing > 0) {
         const parts = decomposeSecondsToParts(existing);
         return {
            hours: String(parts.hours),
            minutes: String(parts.minutes),
            seconds: String(parts.seconds),
         };
      }
      if (isLeave) {
         return { hours: "0", minutes: "0", seconds: "0" };
      }
      return { hours: "", minutes: "", seconds: "" };
   };

   const initialInputs = getInitialInputValues(initialDateToUse);
   const [selectedDayNumber, setSelectedDayNumber] = useState(
      initialDayNumberToUse
   );
   const [selectedDate, setSelectedDate] = useState(initialDateToUse);
   const [hours, setHours] = useState(initialInputs.hours);
   const [minutes, setMinutes] = useState(initialInputs.minutes);
   const [seconds, setSeconds] = useState(initialInputs.seconds);
   const [isLeaveMode, setIsLeaveMode] = useState<boolean>(() =>
      getExistingIsLeaveForDate(initialDateToUse)
   );
   const [leavePending, setLeavePending] = useState<boolean>(false);
   const [feedback, setFeedback] = useState<string | null>(null);
   const [isPending, startTransition] = useTransition();

   const populateInputsForDate = (date: string) => {
      const existing = getExistingSecondsForDate(date);
      const isLeave = getExistingIsLeaveForDate(date);
      setIsLeaveMode(isLeave);
      if (existing > 0) {
         const parts = decomposeSecondsToParts(existing);
         setHours(String(parts.hours));
         setMinutes(String(parts.minutes));
         setSeconds(String(parts.seconds));
      } else if (isLeave) {
         setHours("0");
         setMinutes("0");
         setSeconds("0");
      } else {
         setHours("");
         setMinutes("");
         setSeconds("");
      }
   };

   useEffect(() => {
      if (isOpen) {
         const isAllowedDay =
            initialDayNumber !== undefined &&
            (isAdmin
               ? initialDayNumber >= 1 && initialDayNumber <= todayDayNumber
               : initialDayNumber === todayDayNumber ||
                 (showYesterdayOption &&
                    effectiveYesterdayDayNumber !== undefined &&
                    initialDayNumber === effectiveYesterdayDayNumber));

         const dayNumberToUse = isAllowedDay
            ? initialDayNumber!
            : todayDayNumber;

         const dateToUse =
            dayNumberToUse === effectiveYesterdayDayNumber &&
            effectiveYesterdayDate
               ? effectiveYesterdayDate
               : todayDate;

         setSelectedDayNumber(dayNumberToUse);
         setSelectedDate(dateToUse);

         if (initialHours > 0 || initialMinutes > 0 || initialSeconds > 0) {
            setHours(initialHours > 0 ? String(initialHours) : "");
            setMinutes(initialMinutes > 0 ? String(initialMinutes) : "");
            setSeconds(initialSeconds > 0 ? String(initialSeconds) : "");
            setIsLeaveMode(false);
         } else {
            populateInputsForDate(dateToUse);
         }
         setFeedback(null);
      }
   }, [
      isOpen,
      initialDayNumber,
      todayDate,
      todayDayNumber,
      yesterdayDate,
      yesterdayDayNumber,
      showYesterdayOption,
      todayLoggedSeconds,
      todayIsLeave,
      yesterdayLoggedSeconds,
      yesterdayIsLeave,
      existingLeaves,
      initialHours,
      initialMinutes,
      initialSeconds,
      dayOptions,
   ]);

   if (!isOpen) return null;

   const isToday =
      selectedDayNumber === todayDayNumber || selectedDate === todayDate;
   const isYesterday =
      (yesterdayDayNumber !== undefined &&
         selectedDayNumber === yesterdayDayNumber) ||
      (yesterdayDate !== undefined && selectedDate === yesterdayDate);

   const isSelectedDateLeave =
      isLeaveMode || getExistingIsLeaveForDate(selectedDate);
   const currentLoggedSeconds = getExistingSecondsForDate(selectedDate);
   const isUpdating = currentLoggedSeconds > 0 || isSelectedDateLeave;

   const handleDateChange = (newDayNumber: number) => {
      const newDate =
         newDayNumber === yesterdayDayNumber && yesterdayDate
            ? yesterdayDate
            : dayOptions.find((d) => d.dayNumber === newDayNumber)?.dateKey ||
              todayDate;

      const isToday = newDayNumber === todayDayNumber;
      const isYesterday =
         yesterdayDayNumber !== undefined &&
         newDayNumber === yesterdayDayNumber;
      if (newDayNumber > todayDayNumber) {
         setFeedback("Cannot log study time for future dates.");
         return;
      }
      if (!isAdmin && !isToday && !isYesterday) {
         setFeedback(
            "Participants can only log study time for today or yesterday. Contact a moderator to adjust earlier days."
         );
         return;
      }

      setSelectedDayNumber(newDayNumber);
      setSelectedDate(newDate);
      populateInputsForDate(newDate);
      setFeedback(null);
   };

   const handleSelectDay = (dayNum: number, dateKey: string) => {
      const isToday = dayNum === todayDayNumber || dateKey === todayDate;
      const isYesterday =
         (yesterdayDayNumber !== undefined && dayNum === yesterdayDayNumber) ||
         (yesterdayDate !== undefined && dateKey === yesterdayDate);

      if (dayNum > todayDayNumber || dateKey > todayDate) {
         setFeedback("Cannot log study time for future dates.");
         return;
      }
      if (!isAdmin && !isToday && !isYesterday) {
         setFeedback(
            "Participants can only log study time for today or yesterday. Contact a moderator to adjust earlier days."
         );
         return;
      }

      setSelectedDayNumber(dayNum);
      setSelectedDate(dateKey);
      populateInputsForDate(dateKey);
      setFeedback(null);
   };

   const handleDateInputChange = (newDate: string) => {
      if (!newDate) return;

      if (newDate > todayDate) {
         setFeedback("Cannot log study time for future dates.");
         return;
      }

      const isToday = newDate === todayDate;
      const isYesterday =
         yesterdayDate !== undefined && newDate === yesterdayDate;

      if (!isAdmin && !isToday && !isYesterday) {
         setFeedback(
            "Participants can only log study time for today or yesterday. Contact a moderator to adjust earlier days."
         );
         return;
      }

      const newDayNumber = isToday
         ? todayDayNumber
         : (yesterdayDayNumber ??
           getChallengeDayFromDateKey(effectiveStartDate, newDate));

      setSelectedDate(newDate);
      setSelectedDayNumber(newDayNumber);
      populateInputsForDate(newDate);
      setFeedback(null);
   };

   const handleLog = (
      h: number,
      m: number,
      s: number,
      isLeave: boolean = false
   ) => {
      setFeedback(null);

      // Guard: Prevent logging for future dates
      if (selectedDate > todayDate || selectedDayNumber > todayDayNumber) {
         setFeedback("Cannot log study time for future dates.");
         return;
      }

      // Guard: Prevent logging for dates prior to challenge start
      if (selectedDayNumber < 1) {
         setFeedback(
            "Cannot log study time for dates before the challenge started."
         );
         return;
      }

      // Guard: Participants can only log today or yesterday
      const isToday =
         selectedDayNumber === todayDayNumber || selectedDate === todayDate;
      const isYesterday =
         (yesterdayDayNumber !== undefined &&
            selectedDayNumber === yesterdayDayNumber) ||
         (yesterdayDate !== undefined && selectedDate === yesterdayDate);

      if (!isAdmin && !isToday && !isYesterday) {
         setFeedback(
            "Participants can only log study time for today or yesterday. Contact a moderator to adjust earlier days."
         );
         return;
      }

      startTransition(async () => {
         try {
            const result = await logStudyTimeAction({
               challengeId,
               challengeDay: selectedDayNumber,
               date: selectedDate,
               hours: h,
               minutes: m,
               seconds: s,
               isLeave,
            });

            if (result.ok) {
               trackLogRocketEvent("StudyTimeLogged", {
                  challengeId,
                  challengeDay: selectedDayNumber,
                  date: selectedDate,
                  hours: h,
                  minutes: m,
                  seconds: s,
                  isLeave,
               });
               router.refresh();
               onSuccess?.();
               onClose();
            } else {
               setFeedback(result.message);
            }
         } catch (error) {
            captureLogRocketException(error, {
               tags: { action: "log-study-time" },
               extra: {
                  challengeId,
                  challengeDay: selectedDayNumber,
                  date: selectedDate,
                  isLeave,
               },
            });
            setFeedback("Could not save study time. Please try again.");
         } finally {
            setLeavePending(false);
         }
      });
   };

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const h = parseInt(hours || "0", 10);
      const m = parseInt(minutes || "0", 10);
      const s = parseInt(seconds || "0", 10);

      if (isNaN(h) || isNaN(m) || isNaN(s)) {
         setFeedback(
            "Please enter valid positive numbers for hours, minutes, and seconds."
         );
         return;
      }

      const isLeave = h === 0 && m === 0 && s === 0 ? isLeaveMode : false;
      handleLog(h, m, s, isLeave);
   };

   const handleMarkAsLeave = () => {
      if (
         !isSelectedDateLeave &&
         plannedLeaveDays !== undefined &&
         usedLeaveDays !== undefined &&
         usedLeaveDays >= plannedLeaveDays
      ) {
         setFeedback("Maximum leaves taken for the challenge");
         return;
      }

      setLeavePending(true);
      if (isSelectedDateLeave) {
         setIsLeaveMode(false);
         setHours("0");
         setMinutes("0");
         setSeconds("0");
         handleLog(0, 0, 0, false);
      } else {
         setIsLeaveMode(true);
         setHours("0");
         setMinutes("0");
         setSeconds("0");
         handleLog(0, 0, 0, true);
      }
   };

   const headerTitle = isToday
      ? "How much did you study today?"
      : isYesterday
        ? "How much did you study yesterday?"
        : `How much did you study on Day ${selectedDayNumber}?`;

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
         <div className="w-full max-w-md rounded-2xl border border-[#434343] bg-[#292929] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
               <div>
                  <h3 className="text-xl font-bold text-[#ffffff]">
                     {headerTitle}
                  </h3>
                  <p className="text-xs text-[#868686] mt-0.5">
                     Day {selectedDayNumber} • {selectedDate}
                  </p>
               </div>
               <button
                  type="button"
                  onClick={onClose}
                  className="text-[#868686] hover:text-[#ffffff] transition-colors"
               >
                  <X className="h-5 w-5" />
               </button>
            </div>

            {/* Missed Yesterday Quick Toggle Banner (Preserved for UX) */}
            {showYesterdayOption && (
               <div className="flex gap-2">
                  <button
                     type="button"
                     onClick={() => handleDateChange(todayDayNumber)}
                     className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
                        isToday
                           ? "bg-[#ffffff] text-[#0d0d0d]"
                           : "bg-[#1c1c1c] text-[#868686] hover:text-[#ffffff]"
                     }`}
                  >
                     Today ({todayDate})
                  </button>
                  <button
                     type="button"
                     onClick={() => handleDateChange(yesterdayDayNumber!)}
                     className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
                        isYesterday
                           ? "bg-[#ffffff] text-[#0d0d0d]"
                           : "bg-[#1c1c1c] text-[#868686] hover:text-[#ffffff]"
                     }`}
                  >
                     Yesterday ({yesterdayDate})
                  </button>
               </div>
            )}

            {/* Day Selector (2-card layout for participants, 7-day grid for admins) */}
            <div className="space-y-2">
               <div className="flex items-center justify-between text-xs font-medium text-[#868686]">
                  <span>
                     {isAdmin ? "Challenge Week Days" : "Select Day to Log"}
                  </span>
                  <span className="text-[#a1a1a1] font-sans-tabular">
                     {selectedDate}
                  </span>
               </div>

               {visibleDayOptions.length <= 2 ? (
                  <div
                     className={`grid ${
                        visibleDayOptions.length === 1
                           ? "grid-cols-1"
                           : "grid-cols-2"
                     } gap-2.5 w-full pb-1`}
                  >
                     {visibleDayOptions.map((opt) => {
                        const isSelected = selectedDayNumber === opt.dayNumber;
                        const hasLogged = Boolean(
                           existingLogs &&
                           opt.dateKey in existingLogs &&
                           existingLogs[opt.dateKey] > 0
                        );
                        const isDayLeave = Boolean(
                           (existingLeaves && existingLeaves[opt.dateKey]) ||
                           (opt.dateKey === selectedDate && isLeaveMode)
                        );

                        return (
                           <button
                              key={opt.dayNumber}
                              type="button"
                              onClick={() =>
                                 handleSelectDay(opt.dayNumber, opt.dateKey)
                              }
                              className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between min-h-[74px] relative ${
                                 isSelected
                                    ? "bg-[#ffffff] text-[#0d0d0d] border-[#ffffff] shadow-lg ring-2 ring-[#e08a32]"
                                    : "bg-[#1c1c1c] text-[#d1d1d1] border-[#383838] hover:bg-[#262626] hover:border-[#4d4d4d] hover:text-[#ffffff]"
                              }`}
                           >
                              <div className="flex items-center justify-between w-full">
                                 <span
                                    className={`text-xs font-bold uppercase tracking-wider ${
                                       isSelected
                                          ? "text-[#0d0d0d]"
                                          : "text-[#ffffff]"
                                    }`}
                                 >
                                    {opt.isToday
                                       ? "Today"
                                       : opt.isYesterday
                                         ? "Yesterday"
                                         : `Day ${opt.dayNumber}`}
                                 </span>
                                 {isDayLeave ? (
                                    <span
                                       className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                          isSelected
                                             ? "bg-[#e08a32]/20 text-[#a85a08] border border-[#e08a32]/30"
                                             : "bg-[#e08a32]/20 text-[#e08a32] border border-[#e08a32]/40"
                                       }`}
                                    >
                                       <span className="h-1.5 w-1.5 rounded-full bg-[#e08a32]" />
                                       🌴 Leave
                                    </span>
                                 ) : hasLogged ? (
                                    <span
                                       className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                          isSelected
                                             ? "bg-emerald-100 text-emerald-800"
                                             : "bg-emerald-500/20 text-emerald-400"
                                       }`}
                                    >
                                       <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                       Logged
                                    </span>
                                 ) : opt.isToday ? (
                                    <span
                                       className={`h-2 w-2 rounded-full ${
                                          isSelected
                                             ? "bg-[#e08a32]"
                                             : "bg-emerald-400"
                                       }`}
                                       title="Today"
                                    />
                                 ) : null}
                              </div>

                              <div className="mt-2 flex items-baseline justify-between w-full">
                                 <span
                                    className={`text-xs font-medium ${
                                       isSelected
                                          ? "text-[#4a4a4a]"
                                          : "text-[#868686]"
                                    }`}
                                 >
                                    {opt.weekday}, {formatDayDate(opt.dateKey)}
                                 </span>
                                 <span
                                    className={`text-[10px] font-semibold font-sans-tabular ${
                                       isSelected
                                          ? "text-[#555555]"
                                          : "text-[#707070]"
                                    }`}
                                 >
                                    D{opt.dayNumber}
                                 </span>
                              </div>
                           </button>
                        );
                     })}
                  </div>
               ) : (
                  <div className="grid grid-cols-7 gap-1 w-full pb-1">
                     {visibleDayOptions.map((opt) => {
                        const isSelected = selectedDayNumber === opt.dayNumber;
                        const isAllowed = isAdmin
                           ? !opt.isFuture
                           : opt.isToday || opt.isYesterday;
                        const hasLogged = Boolean(
                           existingLogs &&
                           opt.dateKey in existingLogs &&
                           existingLogs[opt.dateKey] > 0
                        );
                        const isDayLeave = Boolean(
                           (existingLeaves && existingLeaves[opt.dateKey]) ||
                           (opt.dateKey === selectedDate && isLeaveMode)
                        );

                        return (
                           <button
                              key={opt.dayNumber}
                              type="button"
                              disabled={!isAllowed}
                              onClick={() =>
                                 handleSelectDay(opt.dayNumber, opt.dateKey)
                              }
                              className={`w-full min-w-0 py-1.5 px-0.5 sm:px-1 rounded-xl text-center flex flex-col items-center justify-center transition-all ${
                                 isSelected
                                    ? "bg-[#ffffff] text-[#0d0d0d] font-bold shadow-md"
                                    : !isAllowed
                                      ? "bg-[#1c1c1c]/40 text-[#545454] cursor-not-allowed border border-transparent"
                                      : "bg-[#1c1c1c] text-[#d1d1d1] hover:bg-[#2f2f2f] hover:text-[#ffffff] border border-[#383838]"
                              }`}
                              title={
                                 opt.isFuture
                                    ? "Future date (cannot log yet)"
                                    : !isAllowed
                                      ? "Past date (locked - only today/yesterday editable)"
                                      : opt.label
                              }
                           >
                              <span className="text-[10px] uppercase tracking-wider opacity-75 leading-none">
                                 {opt.weekday}
                              </span>
                              <span className="text-xs font-semibold mt-1 leading-none">
                                 {opt.isToday ? "Today" : `D${opt.dayNumber}`}
                              </span>
                              {isDayLeave && isAllowed ? (
                                 <span
                                    className="h-1.5 w-1.5 rounded-full mt-1 bg-[#e08a32]"
                                    title="Leave"
                                 />
                              ) : hasLogged && isAllowed ? (
                                 <span
                                    className={`h-1.5 w-1.5 rounded-full mt-1 ${
                                       isSelected
                                          ? "bg-[#0d0d0d]"
                                          : "bg-[#22c55e]"
                                    }`}
                                 />
                              ) : null}
                           </button>
                        );
                     })}
                  </div>
               )}

               {/* Date Picker Input (Guarded with max=todayDate, min=yesterdayDate for regular users) */}
               <div className="flex items-center justify-between gap-3 bg-[#1c1c1c] px-3 py-2 rounded-xl border border-[#383838]">
                  <label
                     htmlFor="log-date-picker"
                     className="text-xs font-medium text-[#868686] flex items-center gap-1.5 cursor-pointer"
                  >
                     <Calendar className="h-3.5 w-3.5 text-[#a1a1a1]" />
                     <span>Or pick date</span>
                  </label>
                  <input
                     id="log-date-picker"
                     type="date"
                     min={
                        isAdmin
                           ? dayOptions[0]?.dateKey || todayDate
                           : effectiveYesterdayDate || todayDate
                     }
                     max={todayDate}
                     value={selectedDate}
                     onChange={(e) => handleDateInputChange(e.target.value)}
                     className="bg-[#292929] border border-[#484848] text-[#ffffff] text-xs px-2.5 py-1 rounded-lg focus:outline-none focus:border-[#ffffff] font-sans-tabular"
                  />
               </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
               {isSelectedDateLeave && (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#e08a32]/10 border border-[#e08a32]/30 text-xs animate-in fade-in">
                     <span className="text-lg leading-none">🌴</span>
                     <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[#ffffff] flex items-center gap-1.5">
                           <span>Marked as Leave Day</span>
                           <span className="px-1.5 py-0.5 rounded text-[10px] font-sans-tabular bg-[#e08a32]/20 text-[#e08a32] border border-[#e08a32]/30">
                              00:00:00
                           </span>
                        </div>
                        <p className="text-[11px] text-[#a1a1a1] mt-0.5">
                           Day {selectedDayNumber} ({selectedDate}) is recorded
                           as an approved leave day.
                        </p>
                     </div>
                  </div>
               )}

               <div className="grid grid-cols-3 gap-3">
                  <div>
                     <label className="block text-xs font-medium text-[#d1d1d1] mb-1">
                        Hours
                     </label>
                     <Input
                        type="number"
                        min="0"
                        max="24"
                        placeholder="0"
                        value={hours}
                        onChange={(e) => {
                           setHours(e.target.value);
                           if (parseInt(e.target.value, 10) > 0) {
                              setIsLeaveMode(false);
                           }
                        }}
                        className="h-11 bg-[#545454] border-[#484848] text-[#ffffff] text-center font-sans font-sans-tabular text-base rounded-xl"
                     />
                  </div>
                  <div>
                     <label className="block text-xs font-medium text-[#d1d1d1] mb-1">
                        Minutes
                     </label>
                     <Input
                        type="number"
                        min="0"
                        max="59"
                        placeholder="0"
                        value={minutes}
                        onChange={(e) => {
                           setMinutes(e.target.value);
                           if (parseInt(e.target.value, 10) > 0) {
                              setIsLeaveMode(false);
                           }
                        }}
                        className="h-11 bg-[#545454] border-[#484848] text-[#ffffff] text-center font-sans font-sans-tabular text-base rounded-xl"
                     />
                  </div>
                  <div>
                     <label className="block text-xs font-medium text-[#d1d1d1] mb-1">
                        Seconds
                     </label>
                     <Input
                        type="number"
                        min="0"
                        max="59"
                        placeholder="0"
                        value={seconds}
                        onChange={(e) => {
                           setSeconds(e.target.value);
                           if (parseInt(e.target.value, 10) > 0) {
                              setIsLeaveMode(false);
                           }
                        }}
                        className="h-11 bg-[#545454] border-[#484848] text-[#ffffff] text-center font-sans font-sans-tabular text-base rounded-xl"
                     />
                  </div>
               </div>

               {(() => {
                  const enteredSeconds =
                     parseInt(hours || "0", 10) * 3600 +
                     parseInt(minutes || "0", 10) * 60 +
                     parseInt(seconds || "0", 10);
                  if (enteredSeconds > 0 && !isSelectedDateLeave) {
                     const coins = Math.floor(enteredSeconds / 36);
                     return (
                        <div
                           data-testid="projected-reward-banner"
                           className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/25 text-xs text-[#f59e0b] animate-in fade-in"
                        >
                           <span className="flex items-center gap-1.5 font-medium">
                              <CoinsIcon className="h-3.5 w-3.5" />
                              Estimated Study Reward
                           </span>
                           <span className="font-semibold tabular-nums">
                              +{coins} coin{coins === 1 ? "" : "s"}
                           </span>
                        </div>
                     );
                  }
                  return null;
               })()}

               {feedback && (
                  <p className="text-xs text-[#ff5757] bg-[#381717] p-2.5 rounded-lg border border-[#ff5757]/30">
                     {feedback}
                  </p>
               )}

               <div className="flex items-center justify-between gap-2 pt-3">
                  <div className="flex items-center gap-2">
                     <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        disabled={isPending}
                        className="h-10 px-4 rounded-xl bg-[#4a4a4a] text-[#ffffff] hover:bg-[#5a5a5a] text-xs font-medium"
                     >
                        Cancel
                     </Button>
                     {plannedLeaveDays !== undefined && (
                        <span className="text-[11px] font-sans-tabular text-[#a1a1a1]">
                           🌴 Leaves:{" "}
                           <strong className="text-[#ffffff]">
                              {usedLeaveDays ?? 0}
                           </strong>
                           /{plannedLeaveDays}
                        </span>
                     )}
                  </div>

                  <div className="flex items-center gap-2">
                     <Button
                        type="button"
                        variant="outline"
                        onClick={handleMarkAsLeave}
                        disabled={isPending}
                        className={`h-10 px-3.5 rounded-xl text-xs font-semibold transition-all ${
                           isSelectedDateLeave
                              ? "bg-[#e08a32]/20 border border-[#e08a32]/60 text-[#e08a32] hover:bg-[#e08a32]/30"
                              : "bg-[#4a4a4a] border-none text-[#ffffff] hover:bg-[#5a5a5a]"
                        }`}
                     >
                        {leavePending
                           ? isSelectedDateLeave
                              ? "Removing Leave..."
                              : "Marking as Leave..."
                           : isSelectedDateLeave
                             ? "🌴 Remove Leave"
                             : "🌴 Mark as Leave"}
                     </Button>
                     <Button
                        type="submit"
                        disabled={isPending}
                        className="h-10 px-5 rounded-xl bg-[#ffffff] text-[#0d0d0d] hover:bg-[#e0e0e0] text-xs font-bold"
                     >
                        {isPending && !leavePending
                           ? "Logging..."
                           : isUpdating
                             ? "Update Hours"
                             : "Submit"}
                     </Button>
                  </div>
               </div>
            </form>
         </div>
      </div>
   );
}
