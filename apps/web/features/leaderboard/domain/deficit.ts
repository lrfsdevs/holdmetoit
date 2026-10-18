import { DurationRangeError } from "@/features/study-logs/domain/duration";

export class DeficitCalculationError extends Error {
   constructor(message: string) {
      super(message);
      this.name = "DeficitCalculationError";
   }
}

/**
 * Remaining deficit in seconds (Law L3 / FEAT-LEAD-03):
 * max(0, targetSeconds - loggedSeconds)
 */
export function calculateRemainingDeficit(
   targetSeconds: number,
   loggedSeconds: number
): number {
   assertNonNegativeInteger("targetSeconds", targetSeconds);
   assertNonNegativeInteger("loggedSeconds", loggedSeconds);

   return Math.max(0, targetSeconds - loggedSeconds);
}

/**
 * Required daily catch-up pace in seconds per day (Law L3 / FEAT-LEAD-03):
 * deficitSeconds / daysRemaining
 *
 * Returns an exact numeric quotient (may be fractional) for downstream formatting.
 */
export function calculateRequiredDailyPace(
   deficitSeconds: number,
   daysRemaining: number
): number {
   assertNonNegativeInteger("deficitSeconds", deficitSeconds);

   if (!Number.isInteger(daysRemaining)) {
      throw new DeficitCalculationError("daysRemaining must be an integer.");
   }

   if (daysRemaining <= 0) {
      throw new DeficitCalculationError(
         "daysRemaining must be greater than 0 to calculate a daily pace."
      );
   }

   if (deficitSeconds === 0) {
      return 0;
   }

   return deficitSeconds / daysRemaining;
}

function assertNonNegativeInteger(label: string, value: number): void {
   if (!Number.isInteger(value)) {
      throw new DurationRangeError(`${label} must be an integer.`);
   }

   if (value < 0) {
      throw new DurationRangeError(`${label} cannot be negative.`);
   }
}
