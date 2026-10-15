import {
   MAX_DAILY_LOG_SECONDS,
   DurationRangeError,
} from "@/features/study-logs/domain/duration";

export type ValidationResult =
   { ok: true } | { ok: false; code: string; message: string };

/** Validates a daily study duration against integer and 24-hour constraints. */
export function validateDailyLogDurationSeconds(
   durationSeconds: number
): ValidationResult {
   if (!Number.isInteger(durationSeconds)) {
      return {
         ok: false,
         code: "INVALID_DURATION",
         message: "Study time must be a whole number of seconds.",
      };
   }

   if (durationSeconds < 0) {
      return {
         ok: false,
         code: "NEGATIVE_DURATION",
         message: "Study time cannot be negative.",
      };
   }

   if (durationSeconds > MAX_DAILY_LOG_SECONDS) {
      return {
         ok: false,
         code: "DAILY_LIMIT_EXCEEDED",
         message: "A single day cannot exceed 24:00:00 of study time.",
      };
   }

   return { ok: true };
}

/** Converts validated hour, minute, and second fields into total seconds. */
export function composeDurationSeconds(
   hours: number,
   minutes: number,
   seconds: number
): number {
   for (const [label, value] of [
      ["hours", hours],
      ["minutes", minutes],
      ["seconds", seconds],
   ] as const) {
      if (!Number.isInteger(value) || value < 0) {
         throw new DurationRangeError(
            `${label} must be a non-negative integer.`
         );
      }
   }

   if (minutes > 59 || seconds > 59) {
      throw new DurationRangeError(
         "Minutes and seconds must be between 0 and 59."
      );
   }

   return hours * 3_600 + minutes * 60 + seconds;
}
