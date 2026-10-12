import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardWrapped } from "./dashboard-wrapped";
import type {
   ChallengeScoreboardViewModel,
   ScoreboardStandingEntry,
   ScoreboardTeam,
} from "@/features/leaderboard/data/leaderboard-data";

vi.mock("@/features/wrapped/api/wrapped.actions", () => ({
   markWrappedSeenAction: vi.fn().mockResolvedValue({ ok: true }),
   markWrappedSeenIfExpiredAction: vi.fn().mockResolvedValue({ ok: true }),
}));

const NOW = new Date("2026-10-13T00:00:00.000Z");
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
         isWrappedSeen: true,
         isFeedbackFilled: false,
      },
      ...overrides,
   };
}

describe("DashboardWrapped", () => {
   it("renders WrappedShyCard when challenge is completed and enrolled within 3 days", () => {
      const challenge = buildChallenge();
      const html = renderToStaticMarkup(
         <DashboardWrapped challenge={challenge} />
      );

      expect(html).toContain('id="wrapped-shy-card"');
      expect(html).toContain("October Team Battle");
      expect(html).toContain("Accountability: Saved");
   });

   it("returns null when user is not enrolled", () => {
      const challenge = buildChallenge({
         currentUser: {
            isLoggedIn: true,
            isEnrolled: false,
            participantId: null,
            isWrappedSeen: false,
            isFeedbackFilled: false,
         },
      });

      const html = renderToStaticMarkup(
         <DashboardWrapped challenge={challenge} />
      );

      expect(html).toBe("");
   });

   it("returns null when challenge is not completed and results are not locked", () => {
      const challenge = buildChallenge({
         status: "ACTIVE",
         resultsLockedAt: null,
         endAt: "2026-10-20T00:00:00.000Z",
      });

      const html = renderToStaticMarkup(
         <DashboardWrapped challenge={challenge} />
      );

      expect(html).toBe("");
   });

   it("returns null when the 3-day window has expired", () => {
      const challenge = buildChallenge({
         resultsLockedAt: "2026-10-01T00:00:00.000Z",
         endAt: "2026-10-01T00:00:00.000Z",
      });

      const html = renderToStaticMarkup(
         <DashboardWrapped challenge={challenge} />
      );

      expect(html).toBe("");
   });
});
