const SECONDS_PER_DAY = 86_400;
const MILLISECONDS_PER_DAY = SECONDS_PER_DAY * 1_000;

export interface ChallengeDayBucket {
   dayNumber: number;
   dateKey: string;
}

function toDate(value: Date | string): Date {
   return value instanceof Date ? value : new Date(value);
}

function formatUtcDateKey(date: Date): string {
   return date.toISOString().slice(0, 10);
}

export function formatDayDate(dateKey: string): string {
   try {
      const parts = dateKey.split("-").map(Number);
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
         const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
         return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
         });
      }
   } catch {}
   return dateKey;
}

export function getChallengeDayNumber(
   startAt: Date | string,
   now: Date | string
): number {
   const elapsedMilliseconds =
      toDate(now).getTime() - toDate(startAt).getTime();

   if (elapsedMilliseconds < 0) {
      return 0;
   }

   return Math.floor(elapsedMilliseconds / MILLISECONDS_PER_DAY) + 1;
}

export function getChallengeDayDateKey(
   startAt: Date | string,
   dayNumber: number
): string {
   if (!Number.isInteger(dayNumber) || dayNumber < 1) {
      throw new RangeError("Challenge day number must be a positive integer.");
   }

   const dayStart = new Date(
      toDate(startAt).getTime() + (dayNumber - 1) * MILLISECONDS_PER_DAY
   );

   return formatUtcDateKey(dayStart);
}

export function calculateChallengeTotalDays(
   startAt: Date | string,
   endAt?: Date | string | null,
   fallbackDays = 7
): number {
   if (!endAt) return fallbackDays;
   const diffMs = toDate(endAt).getTime() - toDate(startAt).getTime();
   if (diffMs <= 0) return fallbackDays;
   return Math.max(1, Math.ceil(diffMs / MILLISECONDS_PER_DAY));
}

export function getChallengeDayBuckets(
   startAt: Date | string,
   now: Date | string,
   totalDays?: number
): { current: ChallengeDayBucket; previous: ChallengeDayBucket | null } {
   const rawDayNumber = getChallengeDayNumber(startAt, now);
   const currentDayNumber =
      totalDays && totalDays > 0
         ? Math.max(1, Math.min(totalDays, rawDayNumber))
         : Math.max(1, rawDayNumber);
   const current = {
      dayNumber: currentDayNumber,
      dateKey: getChallengeDayDateKey(startAt, currentDayNumber),
   };

   if (currentDayNumber === 1) {
      return { current, previous: null };
   }

   const previousDayNumber = currentDayNumber - 1;
   return {
      current,
      previous: {
         dayNumber: previousDayNumber,
         dateKey: getChallengeDayDateKey(startAt, previousDayNumber),
      },
   };
}

export function getChallengeDayFromDateKey(
   startAt: Date | string,
   dateKey: string
): number {
   if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      throw new TypeError("dateKey must be in YYYY-MM-DD format.");
   }

   const day1Key = getChallengeDayDateKey(startAt, 1);
   const [y1, m1, d1] = day1Key.split("-").map(Number);
   const [y2, m2, d2] = dateKey.split("-").map(Number);
   const utc1 = Date.UTC(y1, m1 - 1, d1);
   const utc2 = Date.UTC(y2, m2 - 1, d2);
   const diffDays = Math.round((utc2 - utc1) / MILLISECONDS_PER_DAY);
   return diffDays + 1;
}

export interface ChallengeDayOption {
   dayNumber: number;
   dateKey: string;
   label: string;
   shortLabel: string;
   weekday: string;
   isToday: boolean;
   isYesterday: boolean;
   isFuture: boolean;
   isPast: boolean;
}

export function getChallengeDayOptions(
   startAt: Date | string,
   now: Date | string = new Date(),
   totalDays = 7
): ChallengeDayOption[] {
   const rawCurrentDayNumber = getChallengeDayNumber(startAt, now);
   const options: ChallengeDayOption[] = [];

   const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

   for (let d = 1; d <= totalDays; d++) {
      const dateKey = getChallengeDayDateKey(startAt, d);
      const [year, month, day] = dateKey.split("-").map(Number);
      const dateObj = new Date(Date.UTC(year, month - 1, day));
      const weekday = WEEKDAYS[dateObj.getUTCDay()];

      const isToday = rawCurrentDayNumber > 0 && d === rawCurrentDayNumber;
      const isYesterday =
         rawCurrentDayNumber > 1 && d === rawCurrentDayNumber - 1;
      const isFuture = rawCurrentDayNumber === 0 || d > rawCurrentDayNumber;
      const isPast = rawCurrentDayNumber > 0 && d < rawCurrentDayNumber;

      let label = `Day ${d} (${weekday})`;
      if (isToday) label = `Today (Day ${d})`;
      else if (isYesterday) label = `Yesterday (Day ${d})`;

      options.push({
         dayNumber: d,
         dateKey,
         label,
         shortLabel: `Day ${d}`,
         weekday,
         isToday,
         isYesterday,
         isFuture,
         isPast,
      });
   }

   return options;
}

export function getCalendarWeekDayOptions(
   anchorDate: Date | string = new Date(),
   today?: Date | string
): ChallengeDayOption[] {
   const anchor = toDate(anchorDate);
   const anchorYear = anchor.getUTCFullYear();
   const anchorMonth = anchor.getUTCMonth();
   const anchorDateNum = anchor.getUTCDate();
   const anchorUtc = Date.UTC(anchorYear, anchorMonth, anchorDateNum);
   const anchorObj = new Date(anchorUtc);

   let todayUtc: number;
   if (today !== undefined) {
      const todayDate = toDate(today);
      todayUtc = Date.UTC(
         todayDate.getUTCFullYear(),
         todayDate.getUTCMonth(),
         todayDate.getUTCDate()
      );
   } else {
      todayUtc = anchorUtc;
   }
   const todayDateKey = formatUtcDateKey(new Date(todayUtc));

   // ISO week: Monday = 1, Sunday = 7
   const dayOfWeek = anchorObj.getUTCDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
   const daysSinceMonday = (dayOfWeek + 6) % 7;
   const mondayUtc = anchorUtc - daysSinceMonday * MILLISECONDS_PER_DAY;

   const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
   const options: ChallengeDayOption[] = [];

   for (let i = 0; i < 7; i++) {
      const dayUtc = mondayUtc + i * MILLISECONDS_PER_DAY;
      const dayDate = new Date(dayUtc);
      const dateKey = formatUtcDateKey(dayDate);
      const weekday = WEEKDAYS[dayDate.getUTCDay()];
      const dayNumber = i + 1;
      const isToday = dateKey === todayDateKey;
      const isYesterday = dayUtc === todayUtc - MILLISECONDS_PER_DAY;
      const isFuture = dayUtc > todayUtc;
      const isPast = dayUtc < todayUtc;

      let label = `Day ${dayNumber} (${weekday})`;
      if (isToday) label = `Today (${weekday})`;
      else if (isYesterday) label = `Yesterday (${weekday})`;

      options.push({
         dayNumber,
         dateKey,
         label,
         shortLabel: weekday,
         weekday,
         isToday,
         isYesterday,
         isFuture,
         isPast,
      });
   }

   return options;
}

export function getAdjacentWeekAnchor(
   currentAnchor: Date | string,
   offsetWeeks: number
): string {
   const anchor = toDate(currentAnchor);
   const anchorUtc = Date.UTC(
      anchor.getUTCFullYear(),
      anchor.getUTCMonth(),
      anchor.getUTCDate()
   );
   const targetUtc = anchorUtc + offsetWeeks * 7 * MILLISECONDS_PER_DAY;
   return formatUtcDateKey(new Date(targetUtc));
}

export function formatWeekRange(
   startDateKey: string,
   endDateKey: string
): string {
   try {
      const startParts = startDateKey.split("-").map(Number);
      const endParts = endDateKey.split("-").map(Number);
      if (
         startParts.length === 3 &&
         startParts[0] &&
         startParts[1] &&
         startParts[2] &&
         endParts.length === 3 &&
         endParts[0] &&
         endParts[1] &&
         endParts[2]
      ) {
         const startDate = new Date(
            Date.UTC(startParts[0], startParts[1] - 1, startParts[2])
         );
         const endDate = new Date(
            Date.UTC(endParts[0], endParts[1] - 1, endParts[2])
         );

         const startMonth = startDate.toLocaleDateString("en-US", {
            month: "short",
            timeZone: "UTC",
         });
         const endMonth = endDate.toLocaleDateString("en-US", {
            month: "short",
            timeZone: "UTC",
         });
         const startDay = startParts[2];
         const endDay = endParts[2];
         const startYear = startParts[0];
         const endYear = endParts[0];

         if (startYear !== endYear) {
            return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`;
         }
         if (startMonth !== endMonth) {
            return `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
         }
         return `${startMonth} ${startDay} – ${endDay}`;
      }
   } catch {}
   return `${startDateKey} – ${endDateKey}`;
}

export function isSameCalendarWeek(
   dateKeyA: string,
   dateKeyB: string
): boolean {
   try {
      const getMondayUtc = (key: string): number => {
         const [y, m, d] = key.split("-").map(Number);
         if (!y || !m || !d) return NaN;
         const utc = Date.UTC(y, m - 1, d);
         const day = new Date(utc).getUTCDay();
         const diff = (day + 6) % 7;
         return utc - diff * MILLISECONDS_PER_DAY;
      };

      const monA = getMondayUtc(dateKeyA);
      const monB = getMondayUtc(dateKeyB);
      return !Number.isNaN(monA) && monA === monB;
   } catch {
      return false;
   }
}

export interface CalendarMonthCell {
   dateKey: string;
   dayOfMonth: number;
   isCurrentMonth: boolean;
   weekdayIndex: number;
}

export interface CalendarMonthGrid {
   year: number;
   month: number;
   monthName: string;
   weeks: CalendarMonthCell[][];
}

export function getCalendarMonthGrid(
   yearOrDate: number | Date | string,
   monthIndex?: number
): CalendarMonthGrid {
   let targetYear: number;
   let targetMonth: number;

   if (typeof yearOrDate === "number" && monthIndex !== undefined) {
      targetYear = yearOrDate;
      targetMonth = monthIndex;
   } else {
      const d = toDate(yearOrDate as Date | string);
      targetYear = d.getUTCFullYear();
      targetMonth = d.getUTCMonth();
   }

   const firstDayOfMonthUtc = Date.UTC(targetYear, targetMonth, 1);
   const firstDayObj = new Date(firstDayOfMonthUtc);
   const monthName = firstDayObj.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
   });

   // ISO week starting on Monday: (day + 6) % 7 gives days since Monday
   const firstDayOfWeek = firstDayObj.getUTCDay();
   const daysSinceMonday = (firstDayOfWeek + 6) % 7;
   const gridStartUtc =
      firstDayOfMonthUtc - daysSinceMonday * MILLISECONDS_PER_DAY;

   // Last day of month
   const lastDayOfMonthUtc = Date.UTC(targetYear, targetMonth + 1, 0);
   const lastDayObj = new Date(lastDayOfMonthUtc);
   const lastDayOfWeek = lastDayObj.getUTCDay();
   const daysUntilSunday = (7 - (((lastDayOfWeek + 6) % 7) + 1)) % 7;
   const gridEndUtc =
      lastDayOfMonthUtc + daysUntilSunday * MILLISECONDS_PER_DAY;

   const totalDays =
      Math.round((gridEndUtc - gridStartUtc) / MILLISECONDS_PER_DAY) + 1;
   const totalWeeks = Math.ceil(totalDays / 7);

   const weeks: CalendarMonthCell[][] = [];

   for (let w = 0; w < totalWeeks; w++) {
      const week: CalendarMonthCell[] = [];
      for (let d = 0; d < 7; d++) {
         const currentUtc = gridStartUtc + (w * 7 + d) * MILLISECONDS_PER_DAY;
         const currentObj = new Date(currentUtc);
         const dateKey = formatUtcDateKey(currentObj);
         const isCurrentMonth = currentObj.getUTCMonth() === targetMonth;
         week.push({
            dateKey,
            dayOfMonth: currentObj.getUTCDate(),
            isCurrentMonth,
            weekdayIndex: d,
         });
      }
      weeks.push(week);
   }

   return {
      year: targetYear,
      month: targetMonth,
      monthName,
      weeks,
   };
}

export function isChallengeDayInPast(
   startAt: Date | string,
   target: { dayNumber?: number; dateKey?: string },
   now: Date | string = new Date()
): boolean {
   const currentDay = getChallengeDayNumber(startAt, now);
   if (currentDay === 0) return false;
   if (target.dayNumber !== undefined) {
      return target.dayNumber < currentDay;
   }
   if (target.dateKey) {
      const todayKey = getChallengeDayDateKey(startAt, currentDay);
      return target.dateKey < todayKey;
   }
   return false;
}

export type ValidateAddTaskDayResult =
   { ok: true } | { ok: false; code: "PAST_DAY_NOT_ALLOWED"; message: string };

export function validateAddTaskChallengeDay(
   isPastDay: boolean,
   options?: { isChallengeActive?: boolean }
): ValidateAddTaskDayResult {
   if (options?.isChallengeActive === false) {
      return { ok: true };
   }
   if (isPastDay) {
      return {
         ok: false,
         code: "PAST_DAY_NOT_ALLOWED",
         message: "Adding new todo tasks to past challenge days is locked.",
      };
   }
   return { ok: true };
}

export type ValidateMoveTaskDayResult =
   | { ok: true }
   | {
        ok: false;
        code: "PAST_DAY_MOVE_NOT_ALLOWED" | "TARGET_DAY_IN_PAST";
        message: string;
     };

/**
 * Validates moving a daily todo task between challenge days.
 * - Tasks on previous (past) days can be moved to another day (today or future).
 * - Moving tasks from present or future days to a day that has already passed in the challenge is strictly forbidden.
 */
export interface ValidateMoveTaskOptions {
   isChallengeActive?: boolean;
}

export function validateMoveTaskChallengeDay(
   sourceDateKey: string,
   targetDateKey: string,
   todayDateKey: string,
   options?: ValidateMoveTaskOptions
): ValidateMoveTaskDayResult {
   if (options?.isChallengeActive === false) {
      return { ok: true };
   }
   const isTargetPast = targetDateKey < todayDateKey;
   const isSourcePast = sourceDateKey < todayDateKey;

   // Cannot move from present or future to a day that has already passed
   if (!isSourcePast && isTargetPast) {
      return {
         ok: false,
         code: "PAST_DAY_MOVE_NOT_ALLOWED",
         message:
            "Cannot move tasks from present or future days to a day that has already passed.",
      };
   }

   // Cannot move into a past day that has already concluded
   if (isTargetPast && sourceDateKey !== targetDateKey) {
      return {
         ok: false,
         code: "TARGET_DAY_IN_PAST",
         message:
            "Cannot move tasks into a past challenge day that has already concluded.",
      };
   }

   return { ok: true };
}

export type ValidateChallengeDayResult =
   | { ok: true; dayNumber: number; dateKey: string }
   | { ok: false; code: string; message: string };

export function validateStudyLogChallengeDay(
   startAt: Date | string,
   input: { challengeDay?: number; date?: string },
   now: Date | string = new Date(),
   options: { allowPastDays?: boolean; totalDays?: number } = {}
): ValidateChallengeDayResult {
   const totalDays = options.totalDays ?? 7;
   const rawCurrentDayNumber = getChallengeDayNumber(startAt, now);
   const currentDayNumber =
      totalDays > 0
         ? Math.max(0, Math.min(totalDays, rawCurrentDayNumber))
         : rawCurrentDayNumber;
   if (currentDayNumber === 0) {
      return {
         ok: false,
         code: "FUTURE_DATE_NOT_ALLOWED",
         message: "Cannot log study time for future dates.",
      };
   }

   const todayDateKey = getChallengeDayDateKey(startAt, currentDayNumber);
   const day1DateKey = getChallengeDayDateKey(startAt, 1);
   const yesterdayDayNumber =
      currentDayNumber > 1 ? currentDayNumber - 1 : null;
   const yesterdayDateKey = yesterdayDayNumber
      ? getChallengeDayDateKey(startAt, yesterdayDayNumber)
      : null;

   let resolvedDayNumber: number;
   let resolvedDateKey: string;

   if (input.date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
         return {
            ok: false,
            code: "INVALID_DATE_FORMAT",
            message: "Date must be in YYYY-MM-DD format.",
         };
      }
      resolvedDayNumber = getChallengeDayFromDateKey(startAt, input.date);
      resolvedDateKey = input.date;

      if (
         input.challengeDay !== undefined &&
         input.challengeDay !== resolvedDayNumber
      ) {
         return {
            ok: false,
            code: "MISMATCHED_DATE_AND_DAY",
            message: "The provided challenge day and date do not match.",
         };
      }
   } else if (input.challengeDay !== undefined) {
      if (!Number.isInteger(input.challengeDay) || input.challengeDay < 1) {
         return {
            ok: false,
            code: "DATE_BEFORE_CHALLENGE",
            message:
               "Cannot log study time for days before the challenge started.",
         };
      }
      resolvedDayNumber = input.challengeDay;
      resolvedDateKey = getChallengeDayDateKey(startAt, resolvedDayNumber);
   } else {
      return {
         ok: false,
         code: "MISSING_DAY_OR_DATE",
         message: "Please specify a challenge day or date to log study time.",
      };
   }

   if (resolvedDayNumber < 1 || resolvedDateKey < day1DateKey) {
      return {
         ok: false,
         code: "DATE_BEFORE_CHALLENGE",
         message:
            "Cannot log study time for dates before the challenge started.",
      };
   }

   if (
      currentDayNumber === 0 ||
      resolvedDayNumber > currentDayNumber ||
      resolvedDateKey > todayDateKey
   ) {
      return {
         ok: false,
         code: "FUTURE_DATE_NOT_ALLOWED",
         message: "Cannot log study time for future dates.",
      };
   }

   if (options.allowPastDays) {
      return {
         ok: true,
         dayNumber: resolvedDayNumber,
         dateKey: resolvedDateKey,
      };
   }

   const isToday =
      currentDayNumber > 0 &&
      resolvedDayNumber === currentDayNumber &&
      resolvedDateKey === todayDateKey;
   const isYesterday =
      yesterdayDayNumber !== null &&
      resolvedDayNumber === yesterdayDayNumber &&
      resolvedDateKey === yesterdayDateKey;

   if (!isToday && !isYesterday) {
      return {
         ok: false,
         code: "ONLY_TODAY_OR_YESTERDAY_ALLOWED",
         message:
            "Participants can only log study time for today or yesterday. Contact a moderator to adjust earlier days.",
      };
   }

   return {
      ok: true,
      dayNumber: resolvedDayNumber,
      dateKey: resolvedDateKey,
   };
}

export function validateAdminOverrideChallengeDay(
   startAt: Date | string,
   input: { challengeDay?: number; date?: string },
   now: Date | string = new Date(),
   options: { totalDays?: number } = {}
): ValidateChallengeDayResult {
   return validateStudyLogChallengeDay(startAt, input, now, {
      allowPastDays: true,
      totalDays: options.totalDays,
   });
}
