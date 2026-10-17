import { SECONDS_PER_COIN } from "./economy-constants";

export class InvalidDurationError extends Error {
   readonly code = "INVALID_DURATION";
   constructor(
      message = "Eligible study duration must be a valid, non-negative integer of seconds."
   ) {
      super(message);
      this.name = "InvalidDurationError";
   }
}

export class InvalidProgressError extends Error {
   readonly code = "INVALID_PROGRESS";
   constructor(
      message = `Current reward progress must be an integer between 0 and ${SECONDS_PER_COIN - 1} seconds.`
   ) {
      super(message);
      this.name = "InvalidProgressError";
   }
}

export interface CalculateRewardInput {
   eligibleSeconds: number;
   currentProgressSeconds?: number;
}

export interface CalculateRewardResult {
   /** Whole coins awarded from this calculation */
   coinsCredited: number;
   /** Total seconds converted into whole coins */
   fractionalSecondsConsumed: number;
   /** Unrewarded remainder seconds preserved for future sessions (0 to 35) */
   fractionalSecondsRemaining: number;
   /** Sum of input eligibleSeconds and previous progress */
   totalSecondsEvaluated: number;
}

/**
 * Calculates exact whole coin rewards and updates fractional progress.
 *
 * Mathematical Invariant:
 * 1 coin = 36 eligible seconds.
 * coinsCredited = Math.floor((currentProgress + eligibleSeconds) / 36)
 * fractionalSecondsRemaining = (currentProgress + eligibleSeconds) % 36
 *
 * Guarantees that multiple short sessions cumulatively yield the exact same whole coins
 * as a continuous session of the combined duration, without losing fractional progress.
 */
export function calculateStudyReward(
   input: CalculateRewardInput
): CalculateRewardResult {
   const { eligibleSeconds, currentProgressSeconds = 0 } = input;

   if (!Number.isSafeInteger(eligibleSeconds) || eligibleSeconds < 0) {
      throw new InvalidDurationError(
         `Eligible seconds must be a non-negative safe integer (received: ${eligibleSeconds}).`
      );
   }

   if (
      !Number.isSafeInteger(currentProgressSeconds) ||
      currentProgressSeconds < 0 ||
      currentProgressSeconds >= SECONDS_PER_COIN
   ) {
      throw new InvalidProgressError(
         `Current progress must be an integer between 0 and ${SECONDS_PER_COIN - 1} (received: ${currentProgressSeconds}).`
      );
   }

   const totalSecondsEvaluated = currentProgressSeconds + eligibleSeconds;
   const coinsCredited = Math.floor(totalSecondsEvaluated / SECONDS_PER_COIN);
   const fractionalSecondsRemaining = totalSecondsEvaluated % SECONDS_PER_COIN;
   const fractionalSecondsConsumed = coinsCredited * SECONDS_PER_COIN;

   return {
      coinsCredited,
      fractionalSecondsConsumed,
      fractionalSecondsRemaining,
      totalSecondsEvaluated,
   };
}
