"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
   captureLogRocketException,
   trackLogRocketEvent,
} from "@/core/observability/logrocket";
import { logStudyTimeAction } from "@/features/study-logs/api/log-study-time.actions";
import {
   decomposeSecondsToParts,
   MAX_COUNTED_DAILY_STUDY_SECONDS,
   MAX_DAILY_LOG_SECONDS,
} from "@/features/study-logs/domain/duration";
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

   const handleHoursChange = (raw: string) => {
      if (raw === "") {
         setHours("");
         return;
      }
      const clean = raw.replace(/\D/g, "");
      if (clean === "") {
         setHours("");
         return;
      }
      const val = parseInt(clean, 10);
      if (isNaN(val)) return;
      const clamped = Math.max(0, Math.min(24, val));
      setHours(String(clamped));
      if (clamped > 0) {
         setIsLeaveMode(false);
      }
   };

   const handleMinutesChange = (raw: string) => {
      if (raw === "") {
         setMinutes("");
         return;
      }
      const clean = raw.replace(/\D/g, "");
      if (clean === "") {
         setMinutes("");
         return;
      }
      const val = parseInt(clean, 10);
      if (isNaN(val)) return;
      const clamped = Math.max(0, Math.min(59, val));
      setMinutes(String(clamped));
      if (clamped > 0) {
         setIsLeaveMode(false);
      }
   };

   const handleSecondsChange = (raw: string) => {
      if (raw === "") {
         setSeconds("");
         return;
      }
      const clean = raw.replace(/\D/g, "");
      if (clean === "") {
         setSeconds("");
         return;
      }
      const val = parseInt(clean, 10);
      if (isNaN(val)) return;
      const clamped = Math.max(0, Math.min(59, val));
      setSeconds(String(clamped));
      if (clamped > 0) {
         setIsLeaveMode(false);
      }
   };

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

      if (isNaN(h) || isNaN(m) || isNaN(s) || h < 0 || m < 0 || s < 0) {
         setFeedback(
            "Please enter valid positive numbers for hours, minutes, and seconds."
         );
         return;
      }

      if (m > 59 || s > 59) {
         setFeedback("Minutes and seconds must be between 0 and 59.");
         return;
      }

      const totalSeconds = h * 3600 + m * 60 + s;
      if (totalSeconds > MAX_DAILY_LOG_SECONDS) {
         setFeedback("A single day cannot exceed 24:00:00 of study time.");
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
      <Dialog
         open={isOpen}
         onOpenChange={(open) => {
            if (!open) onClose();
         }}
      >
         <DialogContent className="max-w-md rounded-2xl border-border-strong bg-surface-nested p-6 space-y-5">
            <div className="flex items-center justify-between">
               <div>
                  <DialogTitle className="text-xl font-bold text-white">
                     {headerTitle}
                  </DialogTitle>
                  <p className="text-xs text-text-tertiary mt-0.5">
                     Day {selectedDayNumber} • {selectedDate}
                  </p>
               </div>
            </div>

            {/* Missed Yesterday Quick Toggle Banner (Preserved for UX) */}
            {showYesterdayOption && (
               <div className="flex gap-2">
                  <button
                     type="button"
                     onClick={() => handleDateChange(todayDayNumber)}
                     className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
                        isToday
                           ? "bg-white text-text-inverse"
                           : "bg-surface-elevated text-text-tertiary hover:text-white"
                     }`}
                  >
                     Today ({todayDate})
                  </button>
                  <button
                     type="button"
                     onClick={() => handleDateChange(yesterdayDayNumber!)}
                     className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
                        isYesterday
                           ? "bg-white text-text-inverse"
                           : "bg-surface-elevated text-text-tertiary hover:text-white"
                     }`}
                  >
                     Yesterday ({yesterdayDate})
                  </button>
               </div>
            )}

            {/* Day Selector (2-card layout for participants, 7-day grid for admins) */}
            <div className="space-y-2">
               <div className="flex items-center justify-between text-xs font-medium text-text-tertiary">
                  <span>
                     {isAdmin ? "Challenge Week Days" : "Select Day to Log"}
                  </span>
                  <span className="text-text-tertiary font-sans-tabular">
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
                              className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between min-h-control-lg relative ${
                                 isSelected
                                    ? "bg-white text-text-inverse border-white shadow-lg ring-2 ring-brand-2"
                                    : "bg-surface-elevated text-text-secondary border-border-strong hover:bg-surface-nested hover:border-border-strong hover:text-white"
                              }`}
                           >
                              <div className="flex items-center justify-between w-full">
                                 <span
                                    className={`text-xs font-bold uppercase tracking-wider ${
                                       isSelected
                                          ? "text-text-inverse"
                                          : "text-white"
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
                                       className={`inline-flex items-center gap-1 text-label font-semibold px-2 py-0.5 rounded-full ${
                                          isSelected
                                             ? "bg-brand-2/20 text-brand-1 border border-brand-2/30"
                                             : "bg-brand-2/20 text-brand-2 border border-brand-2/40"
                                       }`}
                                    >
                                       <span className="h-1.5 w-1.5 rounded-full bg-brand-2" />
                                       🌴 Leave
                                    </span>
                                 ) : hasLogged ? (
                                    <span
                                       className={`inline-flex items-center gap-1 text-label font-semibold px-1.5 py-0.5 rounded-full ${
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
                                             ? "bg-brand-2"
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
                                          ? "text-text-tertiary"
                                          : "text-text-tertiary"
                                    }`}
                                 >
                                    {opt.weekday}, {formatDayDate(opt.dateKey)}
                                 </span>
                                 <span
                                    className={`text-label font-semibold font-sans-tabular ${
                                       isSelected
                                          ? "text-text-tertiary"
                                          : "text-text-tertiary"
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
                                    ? "bg-white text-text-inverse font-bold shadow-md"
                                    : !isAllowed
                                      ? "bg-surface-elevated/40 text-text-tertiary cursor-not-allowed border border-transparent"
                                      : "bg-surface-elevated text-text-secondary hover:bg-surface-nested hover:text-white border border-border-strong"
                              }`}
                              title={
                                 opt.isFuture
                                    ? "Future date (cannot log yet)"
                                    : !isAllowed
                                      ? "Past date (locked - only today/yesterday editable)"
                                      : opt.label
                              }
                           >
                              <span className="text-label uppercase tracking-wider opacity-75 leading-none">
                                 {opt.weekday}
                              </span>
                              <span className="text-xs font-semibold mt-1 leading-none">
                                 {opt.isToday ? "Today" : `D${opt.dayNumber}`}
                              </span>
                              {isDayLeave && isAllowed ? (
                                 <span
                                    className="h-1.5 w-1.5 rounded-full mt-1 bg-brand-2"
                                    title="Leave"
                                 />
                              ) : hasLogged && isAllowed ? (
                                 <span
                                    className={`h-1.5 w-1.5 rounded-full mt-1 ${
                                       isSelected
                                          ? "bg-surface-page"
                                          : "bg-feedback-success"
                                    }`}
                                 />
                              ) : null}
                           </button>
                        );
                     })}
                  </div>
               )}

               {/* Date Picker Input (Guarded with max=todayDate, min=yesterdayDate for regular users) */}
               <div className="flex items-center justify-between gap-3 bg-surface-elevated px-3 py-2 rounded-xl border border-border-strong">
                  <Label
                     htmlFor="log-date-picker"
                     className="text-xs font-medium text-text-tertiary flex items-center gap-1.5 cursor-pointer"
                  >
                     <Calendar className="h-3.5 w-3.5 text-text-tertiary" />
                     <span>Or pick date</span>
                  </Label>
                  <Input
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
                     className="w-auto h-9 min-h-0 bg-surface-nested border-input-border text-white text-xs px-2.5 py-1 rounded-lg focus:border-white focus:bg-surface-nested font-sans-tabular"
                  />
               </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
               {isSelectedDateLeave && (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-brand-2/10 border border-brand-2/30 text-xs animate-in fade-in">
                     <span className="text-lg leading-none">🌴</span>
                     <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                           <span>Marked as Leave Day</span>
                           <span className="px-1.5 py-0.5 rounded text-label font-sans-tabular bg-brand-2/20 text-brand-2 border border-brand-2/30">
                              00:00:00
                           </span>
                        </div>
                        <p className="text-meta text-text-tertiary mt-0.5">
                           Day {selectedDayNumber} ({selectedDate}) is recorded
                           as an approved leave day.
                        </p>
                     </div>
                  </div>
               )}

               <div className="grid grid-cols-3 gap-3">
                  <div>
                     <Label
                        htmlFor="daily-hours-hours"
                        className="block text-xs font-medium text-text-secondary mb-1"
                     >
                        Hours
                     </Label>
                     <Input
                        id="daily-hours-hours"
                        type="number"
                        min="0"
                        max="24"
                        placeholder="0"
                        value={hours}
                        onChange={(e) => handleHoursChange(e.target.value)}
                        className="h-11 bg-input-bg border-input-border text-white text-center font-sans font-sans-tabular text-base rounded-xl"
                     />
                  </div>
                  <div>
                     <Label
                        htmlFor="daily-hours-minutes"
                        className="block text-xs font-medium text-text-secondary mb-1"
                     >
                        Minutes
                     </Label>
                     <Input
                        id="daily-hours-minutes"
                        type="number"
                        min="0"
                        max="59"
                        placeholder="0"
                        value={minutes}
                        onChange={(e) => handleMinutesChange(e.target.value)}
                        className="h-11 bg-input-bg border-input-border text-white text-center font-sans font-sans-tabular text-base rounded-xl"
                     />
                  </div>
                  <div>
                     <Label
                        htmlFor="daily-hours-seconds"
                        className="block text-xs font-medium text-text-secondary mb-1"
                     >
                        Seconds
                     </Label>
                     <Input
                        id="daily-hours-seconds"
                        type="number"
                        min="0"
                        max="59"
                        placeholder="0"
                        value={seconds}
                        onChange={(e) => handleSecondsChange(e.target.value)}
                        className="h-11 bg-input-bg border-input-border text-white text-center font-sans font-sans-tabular text-base rounded-xl"
                     />
                  </div>
               </div>

               {(() => {
                  const enteredSeconds =
                     parseInt(hours || "0", 10) * 3600 +
                     parseInt(minutes || "0", 10) * 60 +
                     parseInt(seconds || "0", 10);
                  if (enteredSeconds > 0 && !isSelectedDateLeave) {
                     const countedRewardSeconds = Math.min(
                        enteredSeconds,
                        MAX_COUNTED_DAILY_STUDY_SECONDS
                     );
                     const coins = Math.floor(countedRewardSeconds / 36);
                     return (
                        <div className="space-y-2">
                           {enteredSeconds >
                              MAX_COUNTED_DAILY_STUDY_SECONDS && (
                              <div
                                 data-testid="daily-cap-notice"
                                 className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 animate-in fade-in"
                              >
                                 <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                                 <div className="text-left">
                                    <p className="font-semibold text-amber-300">
                                       14-Hour Scoring Cap Active
                                    </p>
                                    <p className="text-amber-200/80 mt-0.5 leading-relaxed">
                                       To support healthy habits, a maximum of
                                       14:00:00 counts toward challenge scoring
                                       and coin rewards. Your actual logged
                                       hours remain preserved in your history.
                                    </p>
                                 </div>
                              </div>
                           )}
                           <div
                              data-testid="projected-reward-banner"
                              className="flex items-center justify-between px-3 py-2 rounded-xl bg-brand-1/10 border border-brand-1/25 text-xs text-brand-1 animate-in fade-in"
                           >
                              <span className="flex items-center gap-1.5 font-medium">
                                 <CoinsIcon className="h-3.5 w-3.5" />
                                 Estimated Study Reward
                              </span>
                              <span className="font-semibold tabular-nums">
                                 +{coins} coin{coins === 1 ? "" : "s"}
                                 {enteredSeconds >
                                    MAX_COUNTED_DAILY_STUDY_SECONDS &&
                                    " (max/day)"}
                              </span>
                           </div>
                        </div>
                     );
                  }
                  return null;
               })()}

               {feedback && (
                  <p className="text-xs text-feedback-error-text bg-feedback-error-bg p-2.5 rounded-lg border border-feedback-error-text/30">
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
                        className="h-10 px-4 rounded-xl bg-input-bg text-white hover:bg-input-bg text-xs font-medium"
                     >
                        Cancel
                     </Button>
                     {plannedLeaveDays !== undefined && (
                        <span className="text-meta font-sans-tabular text-text-tertiary">
                           🌴 Leaves:{" "}
                           <strong className="text-white">
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
                              ? "bg-brand-2/20 border border-brand-2/60 text-brand-2 hover:bg-brand-2/30"
                              : "bg-input-bg border-none text-white hover:bg-input-bg"
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
                        className="h-10 px-5 rounded-xl bg-white text-text-inverse hover:bg-white/90 text-xs font-bold"
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
         </DialogContent>
      </Dialog>
   );
}
