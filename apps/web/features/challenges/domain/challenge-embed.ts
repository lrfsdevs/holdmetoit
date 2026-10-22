import type { ChallengeScoreboardViewModel } from "@/features/leaderboard/domain/leaderboard.types";

/**
 * Maps a challenge format to its short embed label.
 */
function getFormatLabel(format: ChallengeScoreboardViewModel["format"]) {
   if (format === "SOLOS") return "Solo Challenge";
   if (format === "DUOS") return "Duo Battle";
   return "Team Battle";
}

/**
 * Describes the challenge phase
 */
function getPhaseLabel(
   status: ChallengeScoreboardViewModel["status"],
   totalDays: number
) {
   const duration = `${totalDays}-day challenge`;

   if (status === "ACTIVE") return `${duration} • Live now`;
   if (status === "UPCOMING") return `${duration} • Starting soon`;
   if (status === "COMPLETED") return `${duration} • Results locked`;
   return duration;
}

/**
 * Builds a format-aware Discord embed description from a challenge scoreboard.
 */
export function buildChallengeDescription(
   challenge: ChallengeScoreboardViewModel
): string {
   const { format, status, standings, matchHeader, totalDays } = challenge;

   const participantCount = standings.length;
   const participantLabel = `${participantCount} participant${participantCount !== 1 ? "s" : ""}`;

   const parts: string[] = [
      `${getFormatLabel(format)} • ${participantLabel}`,
      getPhaseLabel(status, totalDays),
   ];

   if (
      format !== "SOLOS" &&
      matchHeader.hasMatchup &&
      matchHeader.teamA &&
      matchHeader.teamB
   ) {
      parts.push(`${matchHeader.teamA.name} vs ${matchHeader.teamB.name}`);
   }

   return parts.join(" | ");
}
