import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChallengeSummaryTab } from "./challenge-summary-tab";
import type {
   ChallengeScoreboardViewModel,
   ScoreboardStandingEntry,
   ScoreboardTeam,
} from "@/features/leaderboard/domain/leaderboard.types";

const LOCKED_AT = "2026-10-12T00:00:00.000Z";

function buildTeam(overrides: Partial<ScoreboardTeam> = {}): ScoreboardTeam {
   return {
      id: "team-bees",
      name: "Honey Bees",
      color: "#d9822b",
      iconEmoji: "🐝",
      mascotUrl: null,
      sortOrder: 0,
      companionCount: 1,
      totalLoggedSeconds: 72_000,
      totalLoggedClock: "20:00:00",
      targetSeconds: 72_000,
      targetClock: "20:00:00",
      targetHours: 20,
      completionPercentage: 100,
      isLeader: true,
      ...overrides,
   };
}

function buildStanding(
   overrides: Partial<ScoreboardStandingEntry> = {}
): ScoreboardStandingEntry {
   return {
      rank: 1,
      participantId: "part-1",
      userId: "user-1",
      displayName: "AuraStudier",
      username: "aura",
      image: null,
      teamId: "team-bees",
      teamName: "Honey Bees",
      teamColor: "#d9822b",
      teamIcon: "🐝",
      totalLoggedSeconds: 72_000,
      totalLoggedClock: "20:00:00",
      todayLoggedSeconds: 0,
      todayLoggedClock: "00:00:00",
      targetSeconds: 72_000,
      targetClock: "20:00:00",
      completionPercentage: 100,
      weeklyTasksCompletedCount: 2,
      weeklyTasksTotalCount: 2,
      paceStatus: "serene",
      paceLabel: "Completed",
      status: "NORMAL",
      deficitSeconds: 0,
      dailyLogs: {
         "2026-10-05": 36_000,
         "2026-10-06": 36_000,
      },
      ...overrides,
   };
}

function buildChallenge(
   overrides: Partial<ChallengeScoreboardViewModel> = {}
): ChallengeScoreboardViewModel {
   return {
      id: "chal-1",
      title: "October Team Battle",
      heroImageUrl: null,
      eventBannerUrl: null,
      punishmentPfpUrl: null,
      format: "TEAM_VS_TEAM",
      status: "COMPLETED",
      resultsLockedAt: LOCKED_AT,
      startAt: "2026-10-05T00:00:00.000Z",
      endAt: "2026-10-12T00:00:00.000Z",
      daysRemaining: 0,
      totalDays: 7,
      currentDayNumber: 7,
      timeRemainingHuman: "Event concluded",
      teams: [buildTeam()],
      matchHeader: {
         hasMatchup: false,
         teamA: null,
         teamB: null,
         leadMarginSeconds: 0,
         leadMarginClock: "00:00:00",
         leadMarginHuman: "0 minutes",
         leaderTeamId: null,
         leaderSide: "tie",
         ratioPercentageA: 0,
         ratioPercentageB: 0,
      },
      standings: [buildStanding()],
      punishmentWall: {
         punishmentPfpUrl: "",
         flaggedMembers: [],
         isEventCompleted: true,
      },
      currentUser: {
         isLoggedIn: true,
         isEnrolled: true,
         participantId: "part-1",
         isWrappedSeen: false,
         isFeedbackFilled: false,
      },
      ...overrides,
   };
}

describe("ChallengeSummaryTab", () => {
   it("renders challenge summary with Obsidian design tokens and zero deprecated hex values", () => {
      const challenge = buildChallenge();
      const html = renderToStaticMarkup(
         <ChallengeSummaryTab challenge={challenge} />
      );

      // Verifies ratified Obsidian tokens are applied
      expect(html).toContain("bg-[#141414]");
      expect(html).toContain("border-[#292929]");
      expect(html).toContain("bg-[#1c1c1c]");
      expect(html).toContain("text-[#f4f3f6]");
      expect(html).toContain("font-display");

      // Verifies team winner pill uses Obsidian amber token
      expect(html).toContain("border-amber-500/30");
      expect(html).toContain("bg-amber-500/15");
      expect(html).toContain("text-amber-300");

      // Verifies daily study bar fill uses Emerald
      expect(html).toContain("bg-[#22c55e]");

      // Verifies typography system: font-display for title, font-sans-tabular for numbers, no font-mono
      expect(html).toContain("font-display");
      expect(html).toContain("font-sans-tabular");
      expect(html).not.toContain("font-mono");

      // Verifies strict exclusion of foreign/deprecated prototype hex codes
      expect(html).not.toContain("#242424");
      expect(html).not.toContain("#2d2d2d");
      expect(html).not.toContain("#333333");
      expect(html).not.toContain("#f5d547");
      expect(html).not.toContain("#86e3b8");
      expect(html).not.toContain("#8db8ff");
      expect(html).not.toContain("#ff6b5e");
   });

   it("renders participant wrapped block with Saved verdict using Serpents theme", () => {
      const challenge = buildChallenge();
      const html = renderToStaticMarkup(
         <ChallengeSummaryTab challenge={challenge} />
      );

      expect(html).toContain("Your wrapped");
      expect(html).toContain("AuraStudier");
      expect(html).toContain("Saved");
      expect(html).toContain("bg-[#144520]");
      expect(html).toContain("text-[#85ff93]");
      expect(html).toContain("border-[#22c55e]/40");
   });

   it("renders Punished verdict with Crimson theme and reason list when participant fails hours", () => {
      const standing = buildStanding({
         totalLoggedSeconds: 10_000,
         totalLoggedClock: "02:46:40",
         paceStatus: "punished",
         status: "PUNISHED",
      });
      const challenge = buildChallenge({
         standings: [standing],
      });

      const html = renderToStaticMarkup(
         <ChallengeSummaryTab challenge={challenge} />
      );

      expect(html).toContain("Punished");
      expect(html).toContain("bg-[#401010]");
      expect(html).toContain("text-[#ff5757]");
      expect(html).toContain("border-[#ef4444]/40");
      expect(html).toContain("missed target hours");
   });

   it("renders Excused verdict with Raven theme when participant is excused", () => {
      const standing = buildStanding({
         paceStatus: "excused",
         status: "EXCUSED",
      });
      const challenge = buildChallenge({
         standings: [standing],
      });

      const html = renderToStaticMarkup(
         <ChallengeSummaryTab challenge={challenge} />
      );

      expect(html).toContain("Excused");
      expect(html).toContain("bg-[#102d40]");
      expect(html).toContain("text-[#85d6ff]");
      expect(html).toContain("border-[#3b82f6]/40");
   });

   it("renders empty state when there are 0 participants", () => {
      const challenge = buildChallenge({
         standings: [],
      });

      const html = renderToStaticMarkup(
         <ChallengeSummaryTab challenge={challenge} />
      );

      expect(html).toContain("No wrapped data yet");
   });

   it("renders guest spectator note when viewer is not enrolled", () => {
      const challenge = buildChallenge({
         currentUser: {
            isLoggedIn: false,
            isEnrolled: false,
            participantId: null,
            isWrappedSeen: false,
            isFeedbackFilled: false,
         },
      });

      const html = renderToStaticMarkup(
         <ChallengeSummaryTab challenge={challenge} />
      );

      expect(html).toContain(
         "Sign in and join a challenge to unlock your personal wrapped"
      );
      expect(html).not.toContain("Your wrapped");
   });
});
