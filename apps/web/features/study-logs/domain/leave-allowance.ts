// ---------------------------------------------------------------------------
// Leave Allowance Domain Rules (Law L7 — Pure Domain Isolation)
// ---------------------------------------------------------------------------

export const MAX_LEAVES_ERROR = "Maximum leaves taken for the challenge";

export class MaximumLeavesExceededError extends Error {
   constructor(message = MAX_LEAVES_ERROR) {
      super(message);
      this.name = "MaximumLeavesExceededError";
   }
}

export interface LeaveAllowanceInput {
   plannedLeaveDays: number;
   usedLeaveDays: number;
   isExistingLogLeave?: boolean;
}

export interface LeaveAllowanceResult {
   allowed: boolean;
   nextUsedLeaveDays: number;
   error?: string;
}

/**
 * Validates whether a participant can take a leave day and computes the updated leave count.
 *
 * Rules:
 * 1. If the day being saved is NOT a leave day (`isLeave: false`):
 *    - If previously it was a leave day, `usedLeaveDays` is decremented by 1 (clamped to 0).
 *    - If previously not a leave day, `usedLeaveDays` is unchanged.
 *    - Always allowed.
 * 2. If the day being saved IS a leave day (`isLeave: true`):
 *    - If previously already marked as a leave day, it is an idempotent re-save -> allowed, count unchanged.
 *    - If previously not a leave day (or a fresh log):
 *      - If `usedLeaveDays >= plannedLeaveDays`, disallowed with MAX_LEAVES_ERROR.
 *      - Otherwise allowed, and `nextUsedLeaveDays = usedLeaveDays + 1`.
 */
export function validateLeaveAllowance(
   input: LeaveAllowanceInput & { isLeave: boolean }
): LeaveAllowanceResult {
   const {
      plannedLeaveDays,
      usedLeaveDays,
      isExistingLogLeave = false,
      isLeave,
   } = input;

   if (!isLeave) {
      const nextUsed = isExistingLogLeave
         ? Math.max(0, usedLeaveDays - 1)
         : usedLeaveDays;
      return {
         allowed: true,
         nextUsedLeaveDays: nextUsed,
      };
   }

   // User is marking this day as a leave
   if (isExistingLogLeave) {
      // Already counted as leave for this day; re-saving leave is idempotent
      return {
         allowed: true,
         nextUsedLeaveDays: usedLeaveDays,
      };
   }

   // Transitioning from normal study day (or new day) to leave day
   if (usedLeaveDays >= plannedLeaveDays) {
      return {
         allowed: false,
         nextUsedLeaveDays: usedLeaveDays,
         error: MAX_LEAVES_ERROR,
      };
   }

   return {
      allowed: true,
      nextUsedLeaveDays: usedLeaveDays + 1,
   };
}

export function assertLeaveAllowance(
   input: LeaveAllowanceInput & { isLeave: boolean }
): number {
   const result = validateLeaveAllowance(input);
   if (!result.allowed) {
      throw new MaximumLeavesExceededError(result.error);
   }
   return result.nextUsedLeaveDays;
}
