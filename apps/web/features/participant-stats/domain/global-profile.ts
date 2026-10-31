import {
   formatSecondsToClock,
   formatSecondsToHuman,
} from "@/features/study-logs/domain/duration";

export interface StudyStreaksResult {
   currentStreak: number;
   longestStreak: number;
   totalActiveStudyDays: number;
}

/** Formats a Date object to a UTC `YYYY-MM-DD` string key. */
export function toUtcDateKey(date: Date): string {
   const year = date.getUTCFullYear();
   const month = String(date.getUTCMonth() + 1).padStart(2, "0");
   const day = String(date.getUTCDate()).padStart(2, "0");
   return `${year}-${month}-${day}`;
}

/**
 * Calculates current streak, longest streak, and total active study days.
 * Pure domain function with zero database or framework dependencies (Law L7).
 *
 * @param studyDateKeys Array of dates when study occurred (in YYYY-MM-DD format or ISO strings).
 * @param referenceDate Base date used to determine "today" (defaults to current system time).
 */
export function calculateStudyStreaks(
   studyDateKeys: string[],
   referenceDate: Date = new Date()
): StudyStreaksResult {
   if (!studyDateKeys || studyDateKeys.length === 0) {
      return {
         currentStreak: 0,
         longestStreak: 0,
         totalActiveStudyDays: 0,
      };
   }

   // 1. Normalize dates to clean YYYY-MM-DD and deduplicate
   const dateSet = new Set<string>();
   for (const raw of studyDateKeys) {
      if (!raw) continue;
      const key = raw.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
         dateSet.add(key);
      }
   }

   const sortedDates = Array.from(dateSet).sort();
   const totalActiveStudyDays = sortedDates.length;

   if (totalActiveStudyDays === 0) {
      return {
         currentStreak: 0,
         longestStreak: 0,
         totalActiveStudyDays: 0,
      };
   }

   // 2. Compute Longest Streak across entire history
   let longestStreak = 1;
   let currentRun = 1;

   for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(`${sortedDates[i - 1]}T00:00:00.000Z`);
      const currDate = new Date(`${sortedDates[i]}T00:00:00.000Z`);

      const diffMs = currDate.getTime() - prevDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
         currentRun++;
         if (currentRun > longestStreak) {
            longestStreak = currentRun;
         }
      } else {
         currentRun = 1;
      }
   }

   // 3. Compute Current Streak relative to referenceDate ("today")
   const refUtc = new Date(
      Date.UTC(
         referenceDate.getUTCFullYear(),
         referenceDate.getUTCMonth(),
         referenceDate.getUTCDate()
      )
   );

   const todayKey = toUtcDateKey(refUtc);

   const yesterdayDate = new Date(refUtc.getTime() - 24 * 60 * 60 * 1000);
   const yesterdayKey = toUtcDateKey(yesterdayDate);

   let currentStreak = 0;

   // If user studied today, streak starts from today and counts backwards
   // If user has not studied yet today, streak is still active if they studied yesterday
   let checkDate: Date | null = null;
   if (dateSet.has(todayKey)) {
      checkDate = refUtc;
   } else if (dateSet.has(yesterdayKey)) {
      checkDate = yesterdayDate;
   }

   if (checkDate) {
      while (true) {
         const key = toUtcDateKey(checkDate);
         if (dateSet.has(key)) {
            currentStreak++;
            checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
         } else {
            break;
         }
      }
   }

   return {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      totalActiveStudyDays,
   };
}

/** Formats lifetime study seconds into hours, clock, and human friendly strings. */
export function formatLifetimeStudyStats(totalSeconds: number): {
   lifetimeStudySeconds: number;
   lifetimeStudyHours: number;
   lifetimeStudyClock: string;
   lifetimeStudyHuman: string;
} {
   const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
   const lifetimeStudyHours = Math.round((safeSeconds / 3600) * 10) / 10;
   const lifetimeStudyClock = formatSecondsToClock(safeSeconds);
   const lifetimeStudyHuman = formatSecondsToHuman(safeSeconds);

   return {
      lifetimeStudySeconds: safeSeconds,
      lifetimeStudyHours,
      lifetimeStudyClock,
      lifetimeStudyHuman,
   };
}
