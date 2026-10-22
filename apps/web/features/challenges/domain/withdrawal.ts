import type { ChallengeStatus } from "./challenge-lifecycle";

export type WithdrawalBlockCode =
   "ALREADY_WITHDRAWN" | "RESULTS_LOCKED" | "CHALLENGE_COMPLETED";

export type WithdrawalEligibility =
   | { allowed: true }
   | { allowed: false; code: WithdrawalBlockCode; message: string };

/**
 * Resolves whether a participant may withdraw themselves. Withdrawal is
 * self-service until the host locks results; after that the record is final.
 */
export function resolveWithdrawalEligibility(input: {
   isWithdrawn: boolean;
   resultsLockedAt: Date | string | null;
   status: ChallengeStatus;
}): WithdrawalEligibility {
   if (input.isWithdrawn) {
      return {
         allowed: false,
         code: "ALREADY_WITHDRAWN",
         message: "You have already withdrawn from this challenge.",
      };
   }

   if (input.resultsLockedAt != null) {
      return {
         allowed: false,
         code: "RESULTS_LOCKED",
         message: "Results are locked; withdrawal is no longer possible.",
      };
   }

   if (input.status === "COMPLETED") {
      return {
         allowed: false,
         code: "CHALLENGE_COMPLETED",
         message: "This challenge has already concluded.",
      };
   }

   return { allowed: true };
}
