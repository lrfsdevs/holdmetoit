import { describe, expect, it, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChallengeManageTab } from "./challenge-manage-tab";
import type {
   ChallengeScoreboardViewModel,
   ScoreboardStandingEntry,
} from "@/features/leaderboard/data/leaderboard-data";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const replaceStateMock = vi.fn();

vi.mock("next/navigation", () => ({
   useRouter: () => ({
      push: pushMock,
      refresh: refreshMock,
   }),
}));

vi.mock("next/image", () => ({
   default: ({ src, alt, ...rest }: any) =>
      createElement("img", { src, alt, ...rest }),
}));

vi.mock("next/link", () => ({
   default: ({ href, children, ...rest }: any) =>
      createElement("a", { href, ...rest }, children),
}));

vi.mock(
   "@/features/study-logs/presentation/admin-hours-override-modal",
   () => ({
      AdminHoursOverrideModal: () =>
         createElement("div", { "data-testid": "admin-hours-override-modal" }),
   })
);

vi.mock("./admin-target-override-modal", () => ({
   AdminTargetOverrideModal: () =>
      createElement("div", { "data-testid": "admin-target-override-modal" }),
}));

vi.mock("./challenge-image-input", () => ({
   ChallengeImageInput: () =>
      createElement("div", { "data-testid": "challenge-image-input" }),
}));

vi.mock("@/features/challenges/api/challenge-admin.actions", () => ({
   deleteChallengeAction: vi.fn(),
   kickoffChallengeAction: vi.fn(),
   lockChallengeResultsAction: vi.fn(),
   reassignParticipantTeamAction: vi.fn(),
   removeChallengeParticipantAction: vi.fn(),
   unlockChallengeResultsAction: vi.fn(),
   updateChallengeAction: vi.fn(),
}));

vi.mock("@/features/challenges/api/punishment-pfp.actions", () => ({
   discardChallengeImageUploadAction: vi.fn(),
}));

function createStanding(
   id: string,
   name: string,
   username: string,
   teamId: string,
   teamName: string,
   seconds: number
): ScoreboardStandingEntry {
   return {
      rank: 1,
      userId: `user-${id}`,
      participantId: id,
      username,
      displayName: name,
      image: null,
      teamId,
      teamName,
      teamColor: "#ff9900",
      teamIcon: null,
      totalLoggedSeconds: seconds,
      totalLoggedClock: "01:00:00",
      todayLoggedSeconds: seconds,
      todayLoggedClock: "01:00:00",
      targetSeconds: 36000,
      targetClock: "10:00:00",
      completionPercentage: 10,
      paceStatus: "on-track",
      paceLabel: "On Track",
      weeklyTasksCompletedCount: 1,
      weeklyTasksTotalCount: 1,
      status: "ACTIVE",
      deficitSeconds: 0,
      dailyLogs: {
         "2026-10-01": seconds,
      },
   };
}

const mockStandings: ScoreboardStandingEntry[] = [
   createStanding("p1", "Alice Smith", "alicesmith", "team-1", "Bees", 3600),
   createStanding("p2", "Bob Jones", "bobjones", "team-1", "Bees", 3500),
   createStanding(
      "p3",
      "Charlie Brown",
      "charlieb",
      "team-2",
      "Butterflies",
      3400
   ),
   createStanding("p4", "David Clark", "davidc", "team-2", "Butterflies", 3300),
   createStanding("p5", "Emma Watson", "emmaw", "team-1", "Bees", 3200),
   createStanding(
      "p6",
      "Frank Wright",
      "frankw",
      "team-2",
      "Butterflies",
      3100
   ),
   createStanding("p7", "Grace Hopper", "graceh", "team-1", "Bees", 3000),
   createStanding("p8", "Henry Ford", "henryf", "team-2", "Butterflies", 2900),
   createStanding("p9", "Iris West", "irisw", "team-1", "Bees", 2800),
   createStanding(
      "p10",
      "Morgan Freeman",
      "morgan",
      "team-2",
      "Butterflies",
      2700
   ),
];

const mockChallenge: ChallengeScoreboardViewModel = {
   id: "chal-manage-1",
   title: "Study Battle",
   heroImageUrl: null,
   eventBannerUrl: null,
   punishmentPfpUrl: null,
   format: "TEAM_VS_TEAM",
   status: "ACTIVE",
   startAt: "2026-10-01T00:00:00.000Z",
   endAt: "2026-10-08T00:00:00.000Z",
   daysRemaining: 4,
   totalDays: 7,
   currentDayNumber: 3,
   timeRemainingHuman: "4d",
   teams: [
      {
         id: "team-1",
         name: "Bees",
         color: "#ff9900",
         iconEmoji: "🐝",
         mascotUrl: null,
         sortOrder: 0,
         companionCount: 5,
         totalLoggedSeconds: 16100,
         totalLoggedClock: "04:28:20",
         targetSeconds: 180000,
         targetClock: "50:00:00",
         targetHours: 50,
         completionPercentage: 9,
         isLeader: true,
      },
      {
         id: "team-2",
         name: "Butterflies",
         color: "#3399ff",
         iconEmoji: "🦋",
         mascotUrl: null,
         sortOrder: 1,
         companionCount: 5,
         totalLoggedSeconds: 15400,
         totalLoggedClock: "04:16:40",
         targetSeconds: 180000,
         targetClock: "50:00:00",
         targetHours: 50,
         completionPercentage: 8,
         isLeader: false,
      },
   ],
   matchHeader: {
      hasMatchup: true,
      teamA: null,
      teamB: null,
      leaderTeamId: "team-1",
      leaderSide: "a",
      leadMarginSeconds: 700,
      leadMarginClock: "00:11:40",
      leadMarginHuman: "11m 40s",
      ratioPercentageA: 51,
      ratioPercentageB: 49,
   },
   standings: mockStandings,
   punishmentWall: {
      punishmentPfpUrl: "https://example.com/pfp.png",
      flaggedMembers: [],
      isEventCompleted: false,
   },
   currentUser: {
      isLoggedIn: true,
      isEnrolled: true,
      participantId: "p1",
      isWrappedSeen: false,
      isFeedbackFilled: false,
   },
};

describe("ChallengeManageTab - Roster Search & State Persistence (Issue #92)", () => {
   beforeEach(() => {
      vi.clearAllMocks();

      const mockLocation = {
         href: "https://holdmetoit.com/challenge/chal-manage-1?tab=manage",
         pathname: "/challenge/chal-manage-1",
         search: "?tab=manage",
         hash: "",
      };

      globalThis.window = {
         location: mockLocation as unknown as Location,
         history: {
            replaceState: replaceStateMock,
         } as unknown as History,
         addEventListener: vi.fn(),
         removeEventListener: vi.fn(),
      } as unknown as Window & typeof globalThis;
   });

   it("renders full participant list paginated (first page contains first 8 participants)", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeManageTab, {
            challenge: mockChallenge,
         })
      );

      // Page 1 should contain p1..p8
      expect(html).toContain("Alice Smith");
      expect(html).toContain("Henry Ford");
      // Page 1 should NOT contain p9 or p10
      expect(html).not.toContain("Iris West");
      expect(html).not.toContain("Morgan Freeman");
   });

   it("filters roster by initialRosterSearch prop and shows matching participant", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeManageTab, {
            challenge: mockChallenge,
            initialRosterSearch: "morgan",
         })
      );

      expect(html).toContain("Morgan Freeman");
      expect(html).not.toContain("Alice Smith");
      expect(html).not.toContain("Bob Jones");
   });

   it("filters roster by initialRosterTeamFilter prop and shows only that team's members", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeManageTab, {
            challenge: mockChallenge,
            initialRosterTeamFilter: "team-2",
         })
      );

      // Team 2 members: Charlie, David, Frank, Henry, Morgan
      expect(html).toContain("Charlie Brown");
      expect(html).toContain("David Clark");
      expect(html).toContain("Morgan Freeman");
      // Team 1 members should not appear
      expect(html).not.toContain("Alice Smith");
      expect(html).not.toContain("Bob Jones");
   });

   it("renders page 2 when initialRosterPage=2", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeManageTab, {
            challenge: mockChallenge,
            initialRosterPage: 2,
         })
      );

      // Page 2 should contain p9 (Iris) and p10 (Morgan)
      expect(html).toContain("Iris West");
      expect(html).toContain("Morgan Freeman");
      // Page 2 should not contain p1 (Alice)
      expect(html).not.toContain("Alice Smith");
   });

   it("reads initial state from window.location.search when props are omitted", () => {
      globalThis.window.location.search =
         "?tab=manage&search=grace&team=team-1&page=1";

      const html = renderToStaticMarkup(
         createElement(ChallengeManageTab, {
            challenge: mockChallenge,
         })
      );

      expect(html).toContain("Grace Hopper");
      expect(html).not.toContain("Morgan Freeman");
   });

   it("renders empty roster state when search yields no matches", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeManageTab, {
            challenge: mockChallenge,
            initialRosterSearch: "nonexistent-scholar",
         })
      );

      expect(html).toContain(
         "No scholars match your roster search or team filter."
      );
      expect(html).toContain("Reset filters");
   });

   it("filters by both search and team filter simultaneously", () => {
      // Morgan is on team-2; searching for Morgan with team-1 filter should yield 0 results
      const htmlMismatch = renderToStaticMarkup(
         createElement(ChallengeManageTab, {
            challenge: mockChallenge,
            initialRosterSearch: "morgan",
            initialRosterTeamFilter: "team-1",
         })
      );
      expect(htmlMismatch).toContain(
         "No scholars match your roster search or team filter."
      );

      // Searching for Morgan with team-2 filter should show Morgan
      const htmlMatch = renderToStaticMarkup(
         createElement(ChallengeManageTab, {
            challenge: mockChallenge,
            initialRosterSearch: "morgan",
            initialRosterTeamFilter: "team-2",
         })
      );
      expect(htmlMatch).toContain("Morgan Freeman");
      expect(htmlMatch).not.toContain("Alice Smith");
   });

   it("renders empty state message when challenge has no participants enrolled", () => {
      const emptyChallenge = {
         ...mockChallenge,
         standings: [],
      };
      const html = renderToStaticMarkup(
         createElement(ChallengeManageTab, {
            challenge: emptyChallenge,
         })
      );

      expect(html).toContain(
         "No scholars have enrolled in this challenge yet."
      );
   });
});
