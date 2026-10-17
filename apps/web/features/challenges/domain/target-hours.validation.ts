import {
   MAX_WEEKLY_TARGET_SECONDS,
   MIN_WEEKLY_TARGET_SECONDS,
} from "@/features/study-logs/domain/duration";

export type TargetValidationResult =
   { ok: true } | { ok: false; code: string; message: string };

/**
 * Validates declared weekly target study time in seconds (Law L7 / Law L8).
 * Must be an integer between MIN_WEEKLY_TARGET_SECONDS (1h) and MAX_WEEKLY_TARGET_SECONDS (105h).
 */
export function validateWeeklyTargetSeconds(
   targetSeconds: number
): TargetValidationResult {
   if (!Number.isInteger(targetSeconds)) {
      return {
         ok: false,
         code: "INVALID_TARGET",
         message: "Weekly target must be a whole number of seconds.",
      };
   }

   if (targetSeconds < MIN_WEEKLY_TARGET_SECONDS) {
      return {
         ok: false,
         code: "TARGET_TOO_LOW",
         message: "Weekly target must be at least 1 hour.",
      };
   }

   if (targetSeconds > MAX_WEEKLY_TARGET_SECONDS) {
      return {
         ok: false,
         code: "TARGET_TOO_HIGH",
         message: "Weekly target cannot exceed 105 hours.",
      };
   }

   return { ok: true };
}

export function validateWeeklyGoalDescriptions(
   descriptions: string[]
): TargetValidationResult {
   const trimmed = descriptions.map((d) => d.trim());
   if (trimmed.length < 1 || trimmed.length > 10) {
      return {
         ok: false,
         code: "INVALID_GOAL_COUNT",
         message: "You must declare between 1 and 10 weekly goals.",
      };
   }
   if (trimmed.some((d) => d.length === 0)) {
      return {
         ok: false,
         code: "EMPTY_GOAL",
         message: "Weekly goals cannot be empty.",
      };
   }
   return { ok: true };
}
