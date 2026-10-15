export type ChallengeStatus = "UPCOMING" | "ACTIVE" | "COMPLETED";

export class ChallengeStateError extends Error {
   constructor(message: string) {
      super(message);
      this.name = "ChallengeStateError";
   }
}

/**
 * Calculates challenge lifecycle status dynamically based on timestamps (startAt and endAt).
 */
export function calculateChallengeStatus(
   challenge: { startAt: Date | string; endAt: Date | string },
   now = new Date()
): ChallengeStatus {
   const currentTime = now.getTime();
   const startTime = new Date(challenge.startAt).getTime();
   const endTime = new Date(challenge.endAt).getTime();

   if (currentTime < startTime) {
      return "UPCOMING";
   }
   if (currentTime >= endTime) {
      return "COMPLETED";
   }
   return "ACTIVE";
}

/**
 * Validates if a challenge can transition from its current status to ACTIVE (Kickoff).
 */
export function canKickoffChallenge(status: ChallengeStatus): boolean {
   return status === "UPCOMING";
}

/**
 * Participant declarations lock once the challenge starts (status !== "UPCOMING").
 */
export function areDeclarationsLocked(status: ChallengeStatus): boolean {
   return status !== "UPCOMING";
}

export function canEditDeclarations(status: ChallengeStatus): boolean {
   return status === "UPCOMING";
}

export function canLogStudyTime(
   status: ChallengeStatus,
   resultsLockedAt?: Date | string | null
): boolean {
   if (status === "UPCOMING") {
      return false;
   }
   if (resultsLockedAt !== undefined) {
      return resultsLockedAt == null;
   }
   return status === "ACTIVE";
}

export function isChallengeReadOnly(
   status: ChallengeStatus,
   resultsLockedAt?: Date | string | null
): boolean {
   if (resultsLockedAt !== undefined) {
      return resultsLockedAt != null;
   }
   return status === "COMPLETED";
}

/**
 * Asserts that a challenge can be kicked off; throws ChallengeStateError otherwise.
 */
export function assertCanKickoffChallenge(status: ChallengeStatus): void {
   if (status === "ACTIVE") {
      throw new ChallengeStateError("Challenge is already active.");
   }
   if (status === "COMPLETED") {
      throw new ChallengeStateError(
         "Cannot start a challenge that is already completed."
      );
   }
}

export interface ChallengeLifecycleLockTarget {
   status?: ChallengeStatus;
   startAt?: Date | string;
   endAt?: Date | string;
   resultsLockedAt?: Date | string | null;
}

/**
 * Validates if a challenge can transition from its current status to COMPLETED (Lock Final Results).
 * Allows locking when ACTIVE (early host lock) or COMPLETED (natural expiry),
 * provided the results have not already been locked (resultsLockedAt is null/undefined).
 */
export function canLockChallenge(
   statusOrChallenge: ChallengeStatus | ChallengeLifecycleLockTarget,
   resultsLockedAt?: Date | string | null
): boolean {
   let status: ChallengeStatus;
   let lockedAt = resultsLockedAt;

   if (typeof statusOrChallenge === "string") {
      status = statusOrChallenge;
   } else {
      status =
         statusOrChallenge.status ??
         (statusOrChallenge.startAt && statusOrChallenge.endAt
            ? calculateChallengeStatus({
                 startAt: statusOrChallenge.startAt,
                 endAt: statusOrChallenge.endAt,
              })
            : "COMPLETED");
      if (lockedAt === undefined) {
         lockedAt = statusOrChallenge.resultsLockedAt;
      }
   }

   if (status === "UPCOMING") {
      return false;
   }
   if (lockedAt != null) {
      return false;
   }
   return true;
}

/**
 * Asserts that a challenge can be locked; throws ChallengeStateError otherwise.
 */
export function assertCanLockChallenge(
   statusOrChallenge: ChallengeStatus | ChallengeLifecycleLockTarget,
   resultsLockedAt?: Date | string | null
): void {
   let status: ChallengeStatus;
   let lockedAt = resultsLockedAt;

   if (typeof statusOrChallenge === "string") {
      status = statusOrChallenge;
   } else {
      status =
         statusOrChallenge.status ??
         (statusOrChallenge.startAt && statusOrChallenge.endAt
            ? calculateChallengeStatus({
                 startAt: statusOrChallenge.startAt,
                 endAt: statusOrChallenge.endAt,
              })
            : "COMPLETED");
      if (lockedAt === undefined) {
         lockedAt = statusOrChallenge.resultsLockedAt;
      }
   }

   if (status === "UPCOMING") {
      throw new ChallengeStateError(
         "Cannot lock final results on an event that has not started yet."
      );
   }
   if (lockedAt != null) {
      throw new ChallengeStateError(
         "Challenge results are already locked and finalized."
      );
   }
}

/**
 * Checks if challenge results have already been locked and finalized.
 */
export function isChallengeResultsLocked(challenge: {
   resultsLockedAt?: Date | string | null;
}): boolean {
   return challenge.resultsLockedAt != null;
}

export interface ChallengeCreationInput {
   title: string;
   format: "TEAM_VS_TEAM" | "DUOS" | "SOLOS";
   startAt: Date | string;
   endAt: Date | string;
   eventBannerUrl?: string | null;
   punishmentPfpUrl?: string | null;
   rewardCoins?: number | null;
   isBettingEnabled?: boolean;
   teams: Array<{
      name: string;
      color?: string | null;
      iconEmoji?: string | null;
      mascotUrl?: string | null;
   }>;
}

/**
 * Validates challenge setup parameters for the challenge creator wizard (FEAT-CHAL-01).
 */
export function validateChallengeCreation(input: ChallengeCreationInput): {
   valid: boolean;
   errors: Record<string, string>;
} {
   const errors: Record<string, string> = {};

   const title = input.title?.trim() ?? "";
   if (!title) {
      errors.title = "Challenge title is required.";
   } else if (title.length < 3) {
      errors.title = "Challenge title must be at least 3 characters.";
   } else if (title.length > 80) {
      errors.title = "Challenge title cannot exceed 80 characters.";
   }

   const start = new Date(input.startAt);
   const end = new Date(input.endAt);

   if (Number.isNaN(start.getTime())) {
      errors.startAt = "Start date is invalid.";
   }
   if (Number.isNaN(end.getTime())) {
      errors.endAt = "End date is invalid.";
   }
   if (!errors.startAt && !errors.endAt && end.getTime() <= start.getTime()) {
      errors.endAt = "End time must be after start time.";
   }

   if (!input.teams || input.teams.length === 0) {
      errors.teams = "At least one team/house roster must be configured.";
   } else {
      const trimmedNames = input.teams.map((t) => t.name?.trim() ?? "");
      if (trimmedNames.some((name) => !name)) {
         errors.teams = "All teams must have a non-empty name.";
      }
      const uniqueNames = new Set(trimmedNames.map((n) => n.toLowerCase()));
      if (uniqueNames.size !== trimmedNames.length) {
         errors.teams = "Team names must be unique within the challenge.";
      }

      if (input.format === "TEAM_VS_TEAM" && input.teams.length < 2) {
         errors.teams =
            "Team vs Team format requires at least 2 competing teams.";
      }
   }

   return {
      valid: Object.keys(errors).length === 0,
      errors,
   };
}
