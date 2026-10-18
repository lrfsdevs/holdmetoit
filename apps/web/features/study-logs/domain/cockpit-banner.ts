/**
 * Pure domain logic for dashboard cockpit banner variant selection and text formatting (Law L7).
 * Zero dependencies on React, Next.js, or Prisma.
 */

export type BannerVariant =
   | "STUDIED_TODAY"
   | "NOT_LOGGED_TODAY"
   | "FORGOT_YESTERDAY"
   | "ON_LEAVE_TODAY"
   | "CHALLENGE_COMPLETED"
   | "ENROLL_SOLO"
   | "ENROLL_GROUP"
   | "ENROLL_DUO"
   | "ENROLLED_UPCOMING"
   | "NONE";

export interface BannerEvaluationInput {
   isEnrolled: boolean;
   hasChallenge?: boolean;
   challengeStatus?: "UPCOMING" | "ACTIVE" | "COMPLETED" | null;
   challengeFormat?: "TEAM_VS_TEAM" | "DUOS" | "SOLOS" | null;
   todayLoggedSeconds: number;
   todayIsLeave?: boolean;
   isYesterdayMissed: boolean;
   isResultsLocked?: boolean;
}

/**
 * Determines which banner variant to render based on user participation,
 * challenge lifecycle status, lock finalization, and daily logging recency.
 */
export function determineBannerVariant(
   input: BannerEvaluationInput
): BannerVariant {
   // If explicitly flagged as no challenge, render nothing
   if (input.hasChallenge === false) {
      return "NONE";
   }

   // 1. Not enrolled in a challenge: Prompt enrollment based on format only if an event exists
   if (!input.isEnrolled) {
      if (input.challengeFormat === "SOLOS") return "ENROLL_SOLO";
      if (input.challengeFormat === "DUOS") return "ENROLL_DUO";
      if (input.challengeFormat === "TEAM_VS_TEAM") return "ENROLL_GROUP";
      return "NONE";
   }

   // 2. Challenge results are locked: Display outcome / standings placement
   if (input.isResultsLocked) {
      return "CHALLENGE_COMPLETED";
   }

   // 3. Challenge has not kicked off yet, but user is enrolled
   if (input.challengeStatus === "UPCOMING") {
      return "ENROLLED_UPCOMING";
   }

   // 4. Challenge is ACTIVE:
   // Missing yesterday takes priority so participant can record leave or recover deficit
   if (input.isYesterdayMissed) {
      return "FORGOT_YESTERDAY";
   }

   // User is on leave today
   if (input.todayIsLeave) {
      return "ON_LEAVE_TODAY";
   }

   // User has logged today
   if (input.todayLoggedSeconds > 0) {
      return "STUDIED_TODAY";
   }

   // User has not logged today
   return "NOT_LOGGED_TODAY";
}

/**
 * Formats seconds logged today into clean copy (e.g. "13 hours", "1 hour", "2h 30m").
 */
export function formatStudiedTodayHours(seconds: number): string {
   if (seconds <= 0) return "0 hours";
   const hours = Math.floor(seconds / 3600);
   const minutes = Math.floor((seconds % 3600) / 60);

   if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
   }
   if (hours > 0) {
      return `${hours} ${hours === 1 ? "hour" : "hours"}`;
   }
   return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

/**
 * Formats a 1-based numerical rank to an ordinal string (e.g., 1 -> "1st", 2 -> "2nd", 3 -> "3rd").
 */
export function formatOrdinalRank(rank: number): string {
   if (!Number.isInteger(rank) || rank <= 0) {
      return `${rank}`;
   }
   const j = rank % 10;
   const k = rank % 100;
   if (j === 1 && k !== 11) {
      return `${rank}st`;
   }
   if (j === 2 && k !== 12) {
      return `${rank}nd`;
   }
   if (j === 3 && k !== 13) {
      return `${rank}rd`;
   }
   return `${rank}th`;
}
