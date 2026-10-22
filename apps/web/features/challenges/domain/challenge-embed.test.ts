import { describe, expect, it } from "vitest";

import { buildChallengeDescription } from "./challenge-embed";
import type { ChallengeScoreboardViewModel } from "@/features/leaderboard/domain/leaderboard.types";

type MatchHeader = ChallengeScoreboardViewModel["matchHeader"];

const NO_MATCHUP: MatchHeader = {
   hasMatchup: false,
   teamA: null,
   teamB: null,
   leadMarginSeconds: 0,
   leadMarginClock: "00:00:00",
   leadMarginHuman: "0m",
   leaderTeamId: null,
   leaderSide: "tie",
   ratioPercentageA: 0,
   ratioPercentageB: 0,
};

function makeTeam(
   name: string,
   totalLoggedClock: string,
   isLeader: boolean
): ChallengeScoreboardViewModel["teams"][number] {
   return {
      id: name.toLowerCase(),
      name,
      color: null,
      iconEmoji: null,
      mascotUrl: null,
      sortOrder: 0,
      companionCount: 0,
      totalLoggedSeconds: 0,
      totalLoggedClock,
      targetSeconds: 0,
      targetClock: "00:00:00",
      targetHours: 0,
      completionPercentage: 0,
      isLeader,
   };
}

function makeChallenge(
   overrides: Partial<ChallengeScoreboardViewModel>
): ChallengeScoreboardViewModel {
   const bees = makeTeam("Bees", "45:12:00", true);
   const butterflies = makeTeam("Butterflies", "42:30:00", false);

   return {
      id: "challenge-1",
      title: "October Battle",
      format: "TEAM_VS_TEAM",
      status: "ACTIVE",
      heroImageUrl: null,
      eventBannerUrl: null,
      punishmentPfpUrl: null,
      startAt: "2026-10-01T00:00:00Z",
      endAt: "2026-10-31T00:00:00Z",
      totalDays: 30,
      currentDayNumber: 14,
      daysRemaining: 16,
      timeRemainingHuman: "16 days",
      resultsLockedAt: null,
      teams: [bees, butterflies],
      matchHeader: {
         hasMatchup: true,
         teamA: bees,
         teamB: butterflies,
         leadMarginSeconds: 9720,
         leadMarginClock: "02:42:00",
         leadMarginHuman: "2h 42m",
         leaderTeamId: bees.id,
         leaderSide: "a",
         ratioPercentageA: 52,
         ratioPercentageB: 48,
      },
      standings: Array.from({ length: 33 }, (_, i) => ({
         rank: i + 1,
         participantId: `p${i}`,
         userId: `u${i}`,
         displayName: `User ${i}`,
         username: null,
         image: null,
         teamId: i % 2 === 0 ? bees.id : butterflies.id,
         teamName: i % 2 === 0 ? "Bees" : "Butterflies",
         teamColor: null,
         teamIcon: null,
         totalLoggedSeconds: 0,
         totalLoggedClock: "00:00:00",
         todayLoggedSeconds: 0,
         todayLoggedClock: "00:00:00",
         targetSeconds: 0,
         targetClock: "00:00:00",
         completionPercentage: 0,
         weeklyTasksCompletedCount: 0,
         weeklyTasksTotalCount: 0,
         paceStatus: "on-track" as const,
         paceLabel: "On Track",
         deficitSeconds: 0,
      })),
      currentUser: {
         isLoggedIn: false,
         isEnrolled: false,
         participantId: null,
         isWrappedSeen: false,
         isFeedbackFilled: false,
      },
      ...overrides,
   };
}

describe("buildChallengeDescription", () => {
   describe("SOLOS format", () => {
      it("returns format label, participant count and phase for an ACTIVE solo challenge", () => {
         const challenge = makeChallenge({
            format: "SOLOS",
            status: "ACTIVE",
            totalDays: 30,
            matchHeader: NO_MATCHUP,
         });

         expect(buildChallengeDescription(challenge)).toBe(
            "Solo Challenge • 33 participants | 30-day challenge • Live now"
         );
      });

      it("includes 'Starting soon' for an UPCOMING solo challenge", () => {
         const challenge = makeChallenge({
            format: "SOLOS",
            status: "UPCOMING",
            totalDays: 14,
            matchHeader: NO_MATCHUP,
         });

         expect(buildChallengeDescription(challenge)).toBe(
            "Solo Challenge • 33 participants | 14-day challenge • Starting soon"
         );
      });

      it("includes 'Results locked' for a COMPLETED solo challenge", () => {
         const challenge = makeChallenge({
            format: "SOLOS",
            status: "COMPLETED",
            totalDays: 30,
            matchHeader: NO_MATCHUP,
         });

         expect(buildChallengeDescription(challenge)).toBe(
            "Solo Challenge • 33 participants | 30-day challenge • Results locked"
         );
      });

      it("uses singular 'participant' when there is exactly one entrant", () => {
         const challenge = makeChallenge({
            format: "SOLOS",
            standings: [makeChallenge({}).standings[0]],
            matchHeader: NO_MATCHUP,
         });

         expect(buildChallengeDescription(challenge)).toContain(
            "1 participant |"
         );
      });
   });

   describe("DUOS format", () => {
      it("names both sides without scores for an ACTIVE duo challenge", () => {
         const challenge = makeChallenge({ format: "DUOS", status: "ACTIVE" });

         expect(buildChallengeDescription(challenge)).toBe(
            "Duo Battle • 33 participants | 30-day challenge • Live now | Bees vs Butterflies"
         );
      });

      it("omits the matchup when matchup data is not available", () => {
         const challenge = makeChallenge({
            format: "DUOS",
            status: "UPCOMING",
            matchHeader: NO_MATCHUP,
         });

         const result = buildChallengeDescription(challenge);

         expect(result).not.toContain("vs");
         expect(result).toBe(
            "Duo Battle • 33 participants | 30-day challenge • Starting soon"
         );
      });
   });

   describe("TEAM_VS_TEAM format", () => {
      it("names both teams for an ACTIVE team challenge", () => {
         const challenge = makeChallenge({
            format: "TEAM_VS_TEAM",
            status: "ACTIVE",
         });

         expect(buildChallengeDescription(challenge)).toBe(
            "Team Battle • 33 participants | 30-day challenge • Live now | Bees vs Butterflies"
         );
      });

      it("includes 'Results locked' and the matchup for a COMPLETED team challenge", () => {
         const challenge = makeChallenge({
            format: "TEAM_VS_TEAM",
            status: "COMPLETED",
         });

         const result = buildChallengeDescription(challenge);

         expect(result).toContain("Results locked");
         expect(result).toContain("Bees vs Butterflies");
      });
   });

   describe("stable-content guarantees", () => {
      it("never includes live scores, lead margins, or day counters", () => {
         const result = buildChallengeDescription(
            makeChallenge({ format: "TEAM_VS_TEAM", status: "ACTIVE" })
         );

         expect(result).not.toMatch(/\d{2}:\d{2}:\d{2}/);
         expect(result).not.toContain("leads");
         expect(result).not.toContain("Tied");
         expect(result).not.toContain("remaining");
         expect(result).not.toContain("Day 14");
      });

      it("falls back to a neutral phase for unknown statuses", () => {
         const challenge = makeChallenge({
            format: "SOLOS",
            status:
               "DRAFT" as unknown as ChallengeScoreboardViewModel["status"],
            matchHeader: NO_MATCHUP,
         });

         expect(buildChallengeDescription(challenge)).toBe(
            "Solo Challenge • 33 participants | 30-day challenge"
         );
      });
   });
});
