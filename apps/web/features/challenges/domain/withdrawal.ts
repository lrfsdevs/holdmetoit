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

/**
 * Checks whether a study log was recorded on or before a participant's withdrawal timestamp (GH-#210).
 * Preserves historical study hours logged prior to mid-challenge departure while ignoring post-withdrawal logs.
 */
export function isStudyLogBeforeWithdrawal(
   log: {
      createdAt?: Date | string | null;
      logDate?: Date | string | null;
   },
   withdrawalAt?: Date | string | null
): boolean {
   if (!withdrawalAt) {
      return true;
   }

   const withdrawalDate =
      withdrawalAt instanceof Date ? withdrawalAt : new Date(withdrawalAt);
   const withdrawalTime = withdrawalDate.getTime();
   if (Number.isNaN(withdrawalTime)) {
      return true;
   }

   if (log.createdAt != null) {
      const createdDate =
         log.createdAt instanceof Date
            ? log.createdAt
            : new Date(log.createdAt);
      const createdTime = createdDate.getTime();
      if (!Number.isNaN(createdTime)) {
         return createdTime <= withdrawalTime;
      }
   }

   if (log.logDate != null) {
      const logDate =
         log.logDate instanceof Date ? log.logDate : new Date(log.logDate);
      if (!Number.isNaN(logDate.getTime())) {
         const logDateKey = logDate.toISOString().slice(0, 10);
         const withdrawalDateKey = withdrawalDate.toISOString().slice(0, 10);
         return logDateKey <= withdrawalDateKey;
      }
   }

   return true;
}

/**
 * Filters a list of study logs to only those recorded on or before a participant's withdrawal timestamp (GH-#210).
 */
export function filterLogsBeforeWithdrawal<
   T extends {
      durationSeconds: number;
      createdAt?: Date | string | null;
      logDate?: Date | string | null;
   },
>(logs: readonly T[], withdrawalAt?: Date | string | null): T[] {
   return logs.filter((log) => isStudyLogBeforeWithdrawal(log, withdrawalAt));
}
