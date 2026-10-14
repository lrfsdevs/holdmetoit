import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type {
   ChallengeScoreboardViewModel,
   ScoreboardStandingEntry,
   ScoreboardTeam,
} from "@/features/leaderboard/domain/leaderboard.types";
import { ChallengeWrappedModal } from "./challenge-wrapped-modal";

vi.mock("@/features/wrapped/api/wrapped.actions", () => ({
   markWrappedSeenAction: vi.fn().mockResolvedValue({ ok: true }),
   markWrappedSeenIfExpiredAction: vi.fn().mockResolvedValue({ ok: true }),
}));

const LOCKED_AT = "2026-10-12T00:00:00.000Z";

const modalState = {
   isOpen: true,
   slideIndex: 0,
   revealed: false,
};

vi.mock("react", async (importOriginal) => {
   const actual = await importOriginal<typeof import("react")>();
   return {
      ...actual,
      useState: (initial: unknown) => {
         if (initial === false && modalState.isOpen) {
            return [modalState.isOpen, vi.fn()];
         }
         if (initial === 0) {
            return [modalState.slideIndex, vi.fn()];
         }
         return actual.useState(initial);
      },
   };
});

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
   viewerOverride: Partial<ChallengeScoreboardViewModel["currentUser"]> = {},
   standings: ScoreboardStandingEntry[] = [buildStanding()],
   teams: ScoreboardTeam[] = [buildTeam()]
): ChallengeScoreboardViewModel {
   return {
      id: "challenge-1",
      title: "Obsidian Sprint",
      heroImageUrl: null,
      eventBannerUrl: null,
      punishmentPfpUrl: null,
      format: "TEAM_VS_TEAM",
      status: "COMPLETED",
      resultsLockedAt: LOCKED_AT,
      startAt: "2026-10-05T00:00:00.000Z",
      endAt: LOCKED_AT,
      daysRemaining: 0,
      totalDays: 7,
      currentDayNumber: 7,
      timeRemainingHuman: "Event concluded",
      teams,
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
      standings,
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
         ...viewerOverride,
      },
   };
}

describe("ChallengeWrappedModal design token migration & responsive layout", () => {
   it("renders dialog scrim, card with 16:9 desktop ratio, and correctly sized arrow icons", () => {
      modalState.isOpen = true;
      modalState.slideIndex = 0;
      const challenge = buildChallenge();
      const markup = renderToStaticMarkup(
         <ChallengeWrappedModal challenge={challenge} />
      );

      // Scrim
      expect(markup).toContain("bg-black/80 backdrop-blur-md");
      // Mobile portrait + Desktop 16:9 card surface
      expect(markup).toContain("max-w-[400px]");
      expect(markup).toContain("md:max-w-[840px]");
      expect(markup).toContain("md:aspect-[16/9]");
      expect(markup).toContain(
         "bg-[#141414] border border-[#292929] text-[#f4f3f6]"
      );
      // Desktop 2-column grid
      expect(markup).toContain("md:grid md:grid-cols-2");
      // Header close button & step dots
      expect(markup).toContain("bg-[#1c1c1c] text-[#868686]");
      // Action button has whitespace-nowrap and sized arrow icon
      expect(markup).toContain("whitespace-nowrap");
      expect(markup).toContain("w-4 h-4 shrink-0");
      expect(markup).toContain("bg-[#22c55e] text-[#0d0d0d]");
      // No prototype styles or variables
      expect(markup).not.toContain("var(--");
      expect(markup).not.toContain("grayscale");
      expect(markup).not.toContain("#e5e5e5");
      expect(markup).not.toContain("#d4d4d4");
      expect(markup).not.toContain("#bbbbbb");
      expect(markup).not.toContain("#cccccc");
      expect(markup).not.toContain("#14161c");
      expect(markup).not.toContain("#f4f5f7");
      expect(markup).not.toContain("#555555");
   });

   it("renders slide 3 verdict ring with Emerald tone when user is saved", () => {
      modalState.isOpen = true;
      modalState.slideIndex = 3;
      const challenge = buildChallenge();
      const markup = renderToStaticMarkup(
         <ChallengeWrappedModal challenge={challenge} />
      );

      // Emerald ring stroke
      expect(markup).toContain('stroke="#22c55e"');
      // Dynamic saved stamp classes
      expect(markup).toContain("border-[#22c55e]");
      expect(markup).toContain("text-[#22c55e]");
      expect(markup).toContain("bg-[#144520]/80");
   });

   it("renders slide 3 verdict ring with Crimson tone when user is punished", () => {
      modalState.isOpen = true;
      modalState.slideIndex = 3;
      const punishedParticipant = buildStanding({
         status: "PUNISHED",
         paceStatus: "punished",
         weeklyTasksCompletedCount: 0,
         totalLoggedSeconds: 10_000,
         totalLoggedClock: "02:46:40",
      });
      const challenge = buildChallenge({}, [punishedParticipant]);
      const markup = renderToStaticMarkup(
         <ChallengeWrappedModal challenge={challenge} />
      );

      // Crimson ring stroke
      expect(markup).toContain('stroke="#ef4444"');
      // Dynamic punished stamp classes
      expect(markup).toContain("border-[#ef4444]");
      expect(markup).toContain("text-[#ef4444]");
      expect(markup).toContain("bg-[#401010]/80");
   });

   it("renders slide 3 verdict ring with Azure tone when user is excused", () => {
      modalState.isOpen = true;
      modalState.slideIndex = 3;
      const excusedParticipant = buildStanding({
         paceStatus: "excused",
      });
      const challenge = buildChallenge({}, [excusedParticipant]);
      const markup = renderToStaticMarkup(
         <ChallengeWrappedModal challenge={challenge} />
      );

      // Azure ring stroke
      expect(markup).toContain('stroke="#3b82f6"');
      // Dynamic excused stamp classes
      expect(markup).toContain("border-[#3b82f6]");
      expect(markup).toContain("text-[#3b82f6]");
      expect(markup).toContain("bg-[#102d40]/80");
   });

   it("positions best day label to the left with text-anchor end when best day is on right side of chart", () => {
      modalState.isOpen = true;
      modalState.slideIndex = 2;
      const participantWithBestDayOnRight = buildStanding({
         dailyLogs: {
            "2026-10-05": 3600,
            "2026-10-11": 36_000,
         },
      });
      const challenge = buildChallenge({}, [participantWithBestDayOnRight]);
      const markup = renderToStaticMarkup(
         <ChallengeWrappedModal challenge={challenge} />
      );

      // Best day text should anchor to end and be positioned to the left of the dot
      expect(markup).toContain('text-anchor="end"');
      expect(markup).toContain('x="307"');
      expect(markup).toContain("Best day");
      expect(markup).not.toContain('x="325"');
   });

   it("positions best day label to the right with text-anchor start when best day is on left side of chart", () => {
      modalState.isOpen = true;
      modalState.slideIndex = 2;
      const participantWithBestDayOnLeft = buildStanding({
         dailyLogs: {
            "2026-10-05": 36_000,
            "2026-10-11": 3600,
         },
      });
      const challenge = buildChallenge({}, [participantWithBestDayOnLeft]);
      const markup = renderToStaticMarkup(
         <ChallengeWrappedModal challenge={challenge} />
      );

      // Best day text should anchor to start and be positioned to the right of the dot
      expect(markup).toContain('text-anchor="start"');
      expect(markup).toContain('x="41"');
      expect(markup).toContain("Best day");
      expect(markup).not.toContain('x="23"');
   });

   it("always opens at slide 0 (intro) as the active visible slide", () => {
      modalState.isOpen = true;
      modalState.slideIndex = 0;
      const challenge = buildChallenge({
         isWrappedSeen: false,
         isFeedbackFilled: false,
      });

      const markup = renderToStaticMarkup(
         <ChallengeWrappedModal challenge={challenge} />
      );

      // Slide 0 content is present and active
      expect(markup).toContain("Show me");
      expect(markup).toContain("Wrapped");
      expect(markup).toContain("Maybe later");
      // Slide 0 has visible translate class
      expect(markup).toContain("translate-x-0 opacity-100 visible");
      // Later slides have invisible pointer-events-none class
      expect(markup).toContain(
         "translate-x-[30px] opacity-0 invisible pointer-events-none"
      );
   });
});
