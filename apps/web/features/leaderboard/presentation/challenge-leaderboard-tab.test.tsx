// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChallengeLeaderboardTab } from "./challenge-leaderboard-tab";
import type { ChallengeScoreboardViewModel } from "../domain/leaderboard.types";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
   useRouter: () => ({
      push: vi.fn(),
      refresh: mockRefresh,
   }),
}));

vi.mock("@/features/accountability/presentation/admin-pardon-modal", () => ({
   AdminPardonModal: ({
      isOpen,
      participant,
      onSuccess,
   }: {
      isOpen: boolean;
      participant: any;
      onSuccess?: () => void;
   }) =>
      isOpen && participant
         ? createElement(
              "div",
              {
                 "data-testid": "admin-pardon-modal",
                 "data-participant-id": participant.participantId,
                 "data-participant-name": participant.displayName,
              },
              createElement(
                 "button",
                 {
                    "data-testid": "mock-pardon-success-btn",
                    onClick: () => onSuccess?.(),
                 },
                 "Confirm Pardon"
              )
           )
         : null,
}));

vi.mock("@/features/challenges/presentation/edit-duo-team-modal", () => ({
   EditDuoTeamModal: ({
      isOpen,
      currentName,
      currentEmoji,
   }: {
      isOpen: boolean;
      currentName: string;
      currentEmoji: string;
   }) =>
      isOpen
         ? createElement(
              "div",
              { "data-testid": "edit-duo-modal" },
              `${currentEmoji} ${currentName}`
           )
         : null,
}));

vi.mock("@/components/ui/select", () => ({
   Select: ({ children, value }: any) =>
      createElement(
         "div",
         { "data-testid": "select-root", "data-value": value },
         children
      ),
   SelectTrigger: ({ children, ...props }: any) =>
      createElement("button", props, children),
   SelectValue: ({ placeholder }: any) =>
      createElement("span", null, placeholder),
   SelectContent: ({ children }: any) =>
      createElement("div", { "data-testid": "select-content" }, children),
   SelectItem: ({ children, value }: any) =>
      createElement("div", { "data-value": value, value }, children),
}));

describe("ChallengeLeaderboardTab", () => {
   const mockChallenge: ChallengeScoreboardViewModel = {
      id: "test-challenge-1",
      title: "Midterm Reading Week Sprint",
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
      timeRemainingHuman: "4d 00h 00m",
      teams: [
         {
            id: "team-serpents",
            name: "Serpents",
            color: "#22c55e",
            iconEmoji: "🐍",
            mascotUrl: null,
            sortOrder: 0,
            companionCount: 1,
            totalLoggedSeconds: 25_200, // 7h
            totalLoggedClock: "07:00:00",
            targetSeconds: 126_000, // 35h
            targetClock: "35:00:00",
            targetHours: 35,
            completionPercentage: 20,
            isLeader: true,
         },
         {
            id: "team-raven",
            name: "Raven",
            color: "#3b82f6",
            iconEmoji: "🦅",
            mascotUrl: null,
            sortOrder: 1,
            companionCount: 0,
            totalLoggedSeconds: 0,
            totalLoggedClock: "00:00:00",
            targetSeconds: 0,
            targetClock: "00:00:00",
            targetHours: 0,
            completionPercentage: 0,
            isLeader: false,
         },
      ],
      matchHeader: {
         hasMatchup: true,
         teamA: {
            id: "team-serpents",
            name: "Serpents",
            color: "#22c55e",
            iconEmoji: "🐍",
            mascotUrl: null,
            sortOrder: 0,
            companionCount: 1,
            totalLoggedSeconds: 25_200,
            totalLoggedClock: "07:00:00",
            targetSeconds: 126_000,
            targetClock: "35:00:00",
            targetHours: 35,
            completionPercentage: 20,
            isLeader: true,
         },
         teamB: {
            id: "team-raven",
            name: "Raven",
            color: "#3b82f6",
            iconEmoji: "🦅",
            mascotUrl: null,
            sortOrder: 1,
            companionCount: 0,
            totalLoggedSeconds: 0,
            totalLoggedClock: "00:00:00",
            targetSeconds: 0,
            targetClock: "00:00:00",
            targetHours: 0,
            completionPercentage: 0,
            isLeader: false,
         },
         leadMarginSeconds: 25_200,
         leadMarginClock: "07:00:00",
         leadMarginHuman: "7 hours",
         leaderTeamId: "team-serpents",
         leaderSide: "a",
         ratioPercentageA: 100,
         ratioPercentageB: 0,
      },
      standings: [
         {
            rank: 1,
            participantId: "part-1",
            userId: "user-1",
            displayName: "Afnan",
            username: "afnan",
            image: null,
            teamId: "team-serpents",
            teamName: "Serpents",
            teamColor: "#22c55e",
            teamIcon: "🐍",
            totalLoggedSeconds: 25_200,
            totalLoggedClock: "07:00:00",
            todayLoggedSeconds: 14_400,
            todayLoggedClock: "04:00:00",
            targetSeconds: 126_000,
            targetClock: "35:00:00",
            completionPercentage: 20,
            weeklyTasksCompletedCount: 0,
            weeklyTasksTotalCount: 0,
            paceStatus: "catch-up",
            paceLabel: "Catch-Up",
            deficitSeconds: 100_800,
         },
      ],
      currentUser: {
         isLoggedIn: true,
         isEnrolled: true,
         participantId: "part-1",
         isWrappedSeen: false,
         isFeedbackFilled: false,
      },
   };

   it("renders 100% share for Team A and 0% share for Team B (never defaulting 0% to 50%)", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: mockChallenge,
         })
      );

      // Tug of war labels
      expect(html).toContain("Share: 100%");
      expect(html).toContain("Share: 0%");
      expect(html).not.toContain("Share: 50%");
   });

   it("renders dynamic weekly targets instead of hardcoded 120h", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: mockChallenge,
         })
      );

      expect(html).toContain("Weekly Target: 35h");
      expect(html).toContain("Weekly Target: 0h");
      expect(html).not.toContain("Weekly Target: 120h");
   });

   it("renders team card progress bar with completionPercentage rather than matchup share", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: mockChallenge,
         })
      );

      // Team Serpents card has 20% completion (7h/35h), NOT 100% (match share)
      expect(html).toContain("width:20%");
      // Team Raven card has 0% completion, NOT 50%
      expect(html).toContain("width:0%");
   });

   it("renders mobile-first card layout and desktop table with today's hours", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: mockChallenge,
         })
      );

      // Mobile header elements
      expect(html).toContain("Rank");
      expect(html).toContain("Participant");
      expect(html).toContain("Total Hours");

      // Mobile card values
      expect(html).toContain("+04:00:00");
      expect(html).toContain("07:00:00");
      expect(html).toContain("/35:00:00");
      expect(html).toContain("Serpents");
      expect(html).toContain("afnan");
      expect(html).not.toContain("Edit hr");
   });

   it("renders Edit hr buttons for mods and devs when isAdmin is true", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: mockChallenge,
            isAdmin: true,
         })
      );

      expect(html).toContain("Edit hr");
   });

   it("renders pagination controls when standings exceed page size", () => {
      const manyStandings = Array.from({ length: 15 }, (_, i) => ({
         ...mockChallenge.standings[0]!,
         participantId: `part-${i + 1}`,
         userId: `user-${i + 1}`,
         displayName: `Scholar ${i + 1}`,
         username: `scholar_${i + 1}`,
         rank: i + 1,
      }));

      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: {
               ...mockChallenge,
               standings: manyStandings,
            },
         })
      );

      expect(html).toContain("Showing");
      expect(html).toContain("1–10");
      expect(html).toContain("15");
      expect(html).toContain("scholars");
      expect(html).toContain("Next");
   });

   it("renders search input, team filter dropdown, and View by Team mode toggle", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: mockChallenge,
         })
      );

      // Search input
      expect(html).toContain("Search scholar by name, @handle...");
      // View mode toggle buttons
      expect(html).toContain("Overall Rank");
      expect(html).toContain("View by Team");
      // Team + pace filters are Radix Selects; assert their triggers
      expect(html).toContain('data-testid="leaderboard-team-select"');
      expect(html).toContain('data-testid="leaderboard-pace-select"');
   });

   it("renders teams side-by-side in a responsive grid when initialViewMode is 'team'", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: mockChallenge,
            initialViewMode: "team",
         })
      );

      // Verify side-by-side grid classes are present
      expect(html).toContain(
         "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start"
      );

      // Both teams are rendered
      expect(html).toContain("Serpents");
      expect(html).toContain("Raven");

      // Serpents has participant afnan (#1 in team, #1 overall)
      expect(html).toContain("#1");
      expect(html).toContain("afnan");
      expect(html).toContain("Leading House");

      // Raven has empty message since no scholars enrolled yet in mockChallenge
      expect(html).toContain("No scholars in Raven match the active filters.");
   });

   it("renders full width single column when only one team exists in View by Team mode", () => {
      const singleTeamChallenge: ChallengeScoreboardViewModel = {
         ...mockChallenge,
         teams: [mockChallenge.teams[0]!],
      };

      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: singleTeamChallenge,
            initialViewMode: "team",
         })
      );

      // Should NOT have lg:grid-cols-2 when there is only 1 team
      expect(html).not.toContain("lg:grid-cols-2");
      expect(html).toContain("Serpents");
   });

   it("renders dynamic team colors for head-to-head cards and pill badges", () => {
      const customChallenge: ChallengeScoreboardViewModel = {
         ...mockChallenge,
         teams: [
            {
               ...mockChallenge.teams[0]!,
               name: "Honey Bees",
               color: "#d9822b",
               iconEmoji: "🐝",
            },
            {
               ...mockChallenge.teams[1]!,
               name: "Lavender Butterflies",
               color: "#9986b8",
               iconEmoji: "🦋",
            },
         ],
         matchHeader: {
            ...mockChallenge.matchHeader,
            teamA: {
               ...mockChallenge.matchHeader.teamA!,
               name: "Honey Bees",
               color: "#d9822b",
               iconEmoji: "🐝",
            },
            teamB: {
               ...mockChallenge.matchHeader.teamB!,
               name: "Lavender Butterflies",
               color: "#9986b8",
               iconEmoji: "🦋",
            },
         },
      };

      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: customChallenge,
         })
      );

      // Honey Bees color (rgb 217, 130, 43)
      expect(html).toContain("rgba(217, 130, 43, 0.14)");
      expect(html).toContain("rgba(217, 130, 43, 0.45)");
      expect(html).toContain("background-color:#d9822b");

      // Lavender Butterflies color (rgb 153, 134, 184)
      expect(html).toContain("rgba(153, 134, 184, 0.14)");
      expect(html).toContain("rgba(153, 134, 184, 0.45)");
      expect(html).toContain("background-color:#9986b8");
   });

   it("renders Today's LB toggle button and ranks scholars by todayLoggedSeconds when initialViewMode is 'today'", () => {
      const multiScholarChallenge: ChallengeScoreboardViewModel = {
         ...mockChallenge,
         standings: [
            {
               ...mockChallenge.standings[0]!,
               participantId: "part-1",
               displayName: "Overall Leader",
               username: "overall_leader",
               totalLoggedSeconds: 50_000,
               totalLoggedClock: "13:53:20",
               todayLoggedSeconds: 3_600,
               todayLoggedClock: "01:00:00",
               rank: 1,
            },
            {
               ...mockChallenge.standings[0]!,
               participantId: "part-2",
               displayName: "Today Champion",
               username: "today_champion",
               totalLoggedSeconds: 20_000,
               totalLoggedClock: "05:33:20",
               todayLoggedSeconds: 14_400,
               todayLoggedClock: "04:00:00",
               rank: 2,
            },
         ],
      };

      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: multiScholarChallenge,
            initialViewMode: "today",
         })
      );

      // Segmented switcher contains all 3 views
      expect(html).toContain("Today&#x27;s LB");
      expect(html).toContain("Overall Rank");
      expect(html).toContain("View by Team");

      // Mobile header reflects Today's Hours
      expect(html).toContain("Today&#x27;s Hours");

      // Today's LB does NOT render Total hours table column or target hours fraction
      expect(html).not.toContain(">Total hours<");
      expect(html).not.toContain("/ 35:00:00");

      // In Today's LB view, "today_champion" with 4h today is ranked above "overall_leader" with 1h today
      const indexTodayChampion = html.indexOf("today_champion");
      const indexOverallLeader = html.indexOf("overall_leader");
      expect(indexTodayChampion).toBeGreaterThan(-1);
      expect(indexOverallLeader).toBeGreaterThan(-1);
      expect(indexTodayChampion).toBeLessThan(indexOverallLeader);
   });

   it("hides View by Team and ignores team mode for SOLOS challenges", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: { ...mockChallenge, format: "SOLOS" },
            initialViewMode: "team",
         })
      );

      expect(html).not.toContain("View by Team");
      expect(html).toContain("Overall Rank");
      expect(html).not.toContain("lg:grid-cols-2");
      expect(html).toContain("afnan");
   });

   it("preserves view mode in participant profile links when initialViewMode is 'today' and omits query when 'individual'", () => {
      const todayChallenge: ChallengeScoreboardViewModel = {
         ...mockChallenge,
         standings: [
            {
               ...mockChallenge.standings[0]!,
               participantId: "part-test-123",
               displayName: "Today Scholar",
            },
         ],
      };

      const todayHtml = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: todayChallenge,
            initialViewMode: "today",
         })
      );

      // Links should contain ?view=today
      expect(todayHtml).toContain(
         `/profile/user-1?challengeId=${todayChallenge.id}`
      );

      const defaultHtml = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: todayChallenge,
            initialViewMode: "individual",
         })
      );

      // Default (overall rank) links should NOT have ?view=
      expect(defaultHtml).toContain(
         `/profile/user-1?challengeId=${todayChallenge.id}`
      );
      expect(defaultHtml).not.toContain(
         `/profile/user-1?challengeId=${todayChallenge.id}&view=`
      );
   });

   it("keeps the head-to-head VS panel for team-vs-team challenges", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: mockChallenge,
         })
      );

      expect(html).toContain("Total Challenge Log");
      expect(html).toMatch(/>\s*VS\s*</);
   });

   it("renders dynamic Leading crown badge and margin delta on Team A when Team A leads", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: mockChallenge,
         })
      );

      // Team A (Serpents) leads
      expect(html).toContain('data-testid="team-a-leading-badge"');
      expect(html).toContain('data-testid="team-a-lead-margin"');
      expect(html).toContain("+7 hours ahead");

      // Team B (Raven) does not have leading badge or margin delta
      expect(html).not.toContain('data-testid="team-b-leading-badge"');
      expect(html).not.toContain('data-testid="team-b-lead-margin"');
   });

   it("renders dynamic Leading crown badge and margin delta on Team B when Team B leads while keeping slots anchored", () => {
      const teamBLeadingChallenge: ChallengeScoreboardViewModel = {
         ...mockChallenge,
         matchHeader: {
            ...mockChallenge.matchHeader,
            leaderSide: "b",
            leaderTeamId: "team-raven",
            leadMarginSeconds: 10_800,
            leadMarginClock: "03:00:00",
            leadMarginHuman: "3 hours",
            leadMarginDelta: "+3h ahead",
            ratioPercentageA: 40,
            ratioPercentageB: 60,
         },
      };

      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: teamBLeadingChallenge,
         })
      );

      // Team B (Raven) leads
      expect(html).toContain('data-testid="team-b-leading-badge"');
      expect(html).toContain('data-testid="team-b-lead-margin"');
      expect(html).toContain("+3h ahead");

      // Team A (Serpents) remains in Slot 1 without leading indicators
      expect(html).not.toContain('data-testid="team-a-leading-badge"');
      expect(html).not.toContain('data-testid="team-a-lead-margin"');

      // Slot 1 is still Serpents and Slot 2 is still Raven (anchored)
      const serpentsIndex = html.indexOf("Serpents");
      const vsIndex = html.indexOf("VS");
      const ravenIndex = html.indexOf("Raven");
      expect(serpentsIndex).toBeLessThan(vsIndex);
      expect(vsIndex).toBeLessThan(ravenIndex);
   });

   it("does not render Leading crown badge on either card when teams are tied", () => {
      const tiedChallenge: ChallengeScoreboardViewModel = {
         ...mockChallenge,
         matchHeader: {
            ...mockChallenge.matchHeader,
            leaderSide: "tie",
            leaderTeamId: null,
            leadMarginSeconds: 0,
            leadMarginClock: "00:00:00",
            leadMarginHuman: "0s",
            leadMarginDelta: "Tied",
            ratioPercentageA: 50,
            ratioPercentageB: 50,
         },
      };

      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: tiedChallenge,
         })
      );

      expect(html).not.toContain('data-testid="team-a-leading-badge"');
      expect(html).not.toContain('data-testid="team-b-leading-badge"');
      expect(html).not.toContain('data-testid="team-a-lead-margin"');
      expect(html).not.toContain('data-testid="team-b-lead-margin"');
   });

   it("removes the head-to-head VS panel for DUOS challenges", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: { ...mockChallenge, format: "DUOS" },
         })
      );

      expect(html).not.toContain("Total Challenge Log");
      expect(html).not.toMatch(/>\s*VS\s*</);
      // Top-3 podium still provides the summary.
      expect(html).toContain("Top Contributor · Rank 1");
   });

   it("defaults DUOS challenges to the team view without an explicit view prop", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: { ...mockChallenge, format: "DUOS" },
         })
      );

      expect(html).toContain(
         "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start"
      );
      expect(html).toContain("Leading House");
   });

   it("shows the edit control only on the caller's duo and only when allowed", () => {
      const duoChallenge: ChallengeScoreboardViewModel = {
         ...mockChallenge,
         format: "DUOS",
         currentUser: {
            ...mockChallenge.currentUser,
            teamId: "team-serpents",
            teamName: "Serpents",
            teamIcon: "🐍",
            canEditDuoTeam: true,
         },
      };

      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, { challenge: duoChallenge })
      );

      expect(html).toContain('data-testid="edit-duo-team-team-serpents"');
      expect(html).not.toContain('data-testid="edit-duo-team-team-raven"');

      const lockedHtml = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: {
               ...duoChallenge,
               currentUser: {
                  ...duoChallenge.currentUser,
                  canEditDuoTeam: false,
               },
            },
         })
      );

      expect(lockedHtml).not.toContain('data-testid="edit-duo-team-');
   });

   it("normalizes duo battle card header and scholar blocks to consistent 2-line structures regardless of name and goal lengths", () => {
      const duoChallengeWithLongNamesAndGoals: ChallengeScoreboardViewModel = {
         ...mockChallenge,
         format: "DUOS",
         teams: [
            {
               id: "team-1",
               name: "Justice for chunaid khan super long team name",
               color: "#ef4444",
               iconEmoji: "🔥",
               mascotUrl: null,
               sortOrder: 0,
               companionCount: 2,
               totalLoggedSeconds: 185_400,
               totalLoggedClock: "51:30:00",
               targetSeconds: 309_600,
               targetClock: "86:00:00",
               targetHours: 86,
               completionPercentage: 59,
               isLeader: true,
            },
            {
               id: "team-2",
               name: "can't think of a name",
               color: "#f97316",
               iconEmoji: "🎃",
               mascotUrl: null,
               sortOrder: 1,
               companionCount: 2,
               totalLoggedSeconds: 220_800,
               totalLoggedClock: "61:20:00",
               targetSeconds: 259_200,
               targetClock: "72:00:00",
               targetHours: 72,
               completionPercentage: 85,
               isLeader: false,
            },
         ],
         standings: [
            {
               rank: 1,
               participantId: "part-1",
               userId: "user-1",
               displayName: "Afnan",
               username: "afnan6969",
               image: null,
               teamId: "team-1",
               teamName: "Justice for chunaid khan super long team name",
               teamColor: "#ef4444",
               teamIcon: "🔥",
               totalLoggedSeconds: 121_839,
               totalLoggedClock: "33:50:39",
               todayLoggedSeconds: 4_963,
               todayLoggedClock: "01:22:43",
               targetSeconds: 144_000,
               targetClock: "40:00:00",
               completionPercentage: 84,
               weeklyTasksCompletedCount: 2,
               weeklyTasksTotalCount: 2,
               paceStatus: "catch-up",
               paceLabel: "Catch-Up",
               deficitSeconds: 22_161,
            },
            {
               rank: 2,
               participantId: "part-2",
               userId: "user-2",
               displayName:
                  "* . ୨ 'miyu ♡. ' super long special styled display name",
               username: "chaoticreampan_with_long_handle",
               image: null,
               teamId: "team-1",
               teamName: "Justice for chunaid khan super long team name",
               teamColor: "#ef4444",
               teamIcon: "🔥",
               totalLoggedSeconds: 63_561,
               totalLoggedClock: "17:39:21",
               todayLoggedSeconds: 0,
               todayLoggedClock: "00:00:00",
               targetSeconds: 165_600,
               targetClock: "46:00:00",
               completionPercentage: 38,
               weeklyTasksCompletedCount: 1,
               weeklyTasksTotalCount: 3,
               paceStatus: "catch-up",
               paceLabel: "Catch-Up",
               deficitSeconds: 102_039,
            },
         ],
      };

      const html = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: duoChallengeWithLongNamesAndGoals,
            isAdmin: true,
         })
      );

      // 1. Team cards render with consistent styling
      expect(html).toContain("Justice for chunaid khan super long team name");
      expect(html).toContain("can&#x27;t think of a name");
      expect(html).toContain("Weekly Target: 86h • Completed: 59%");
      expect(html).toContain("Weekly Target: 72h • Completed: 85%");

      // 2. Scholar blocks render with min-h-[68px] normalized block heights
      expect(html).toContain("min-h-[68px]");
      expect(html).toContain("33:50:39");
      expect(html).toContain("/40:00:00");
      expect(html).toContain("+01:22:43");
      expect(html).toContain("17:39:21");
      expect(html).toContain("/46:00:00");
      expect(html).toContain("+00:00:00");

      // 3. Admin controls are cleanly embedded
      expect(html).toContain("Edit hr");
      expect(html).toContain("Edit target");
   });

   it("canonicalizes DUOS participant links against the team default", () => {
      const duoChallenge: ChallengeScoreboardViewModel = {
         ...mockChallenge,
         format: "DUOS",
         standings: [
            {
               ...mockChallenge.standings[0]!,
               participantId: "part-duo-1",
            },
         ],
      };

      const teamHtml = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, { challenge: duoChallenge })
      );

      expect(teamHtml).toContain(
         `/profile/user-1?challengeId=${duoChallenge.id}`
      );
      expect(teamHtml).not.toContain(`&view=team`);

      const individualHtml = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: duoChallenge,
            initialViewMode: "individual",
         })
      );

      expect(individualHtml).toContain(
         `/profile/user-1?challengeId=${duoChallenge.id}`
      );
   });

   it("only renders trophy rank badges when the global leaderboard flag is enabled", () => {
      const challengeWithTrophies: ChallengeScoreboardViewModel = {
         ...mockChallenge,
         standings: [{ ...mockChallenge.standings[0]!, trophies: 12 }],
      };

      const hiddenHtml = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: challengeWithTrophies,
         })
      );

      expect(hiddenHtml).not.toContain('data-testid="trophy-role-badge"');
      expect(hiddenHtml).not.toContain("Recruit");

      const shownHtml = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: challengeWithTrophies,
            isGlobalLeaderboardEnabled: true,
         })
      );

      expect(shownHtml).toContain('data-testid="trophy-role-badge"');
      expect(shownHtml).toContain("Recruit");
   });

   describe("Unassigned Scholars in Team View Mode (GH-#209 / KAN-70)", () => {
      const challengeWithUnassigned: ChallengeScoreboardViewModel = {
         ...mockChallenge,
         standings: [
            ...mockChallenge.standings,
            {
               rank: 2,
               participantId: "part-unassigned-1",
               userId: "user-unassigned-1",
               displayName: "Klara Scholar",
               username: "klara",
               image: null,
               teamId: "no-assigned",
               teamName: "Unassigned",
               teamColor: null,
               teamIcon: "⏳",
               totalLoggedSeconds: 18_000,
               totalLoggedClock: "05:00:00",
               todayLoggedSeconds: 7_200,
               todayLoggedClock: "02:00:00",
               targetSeconds: 126_000,
               targetClock: "35:00:00",
               completionPercentage: 14,
               weeklyTasksCompletedCount: 1,
               weeklyTasksTotalCount: 3,
               paceStatus: "on-track",
               paceLabel: "On Track",
               deficitSeconds: 108_000,
            },
         ],
      };

      it("renders unassigned scholars card alongside house cards in team view mode", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: challengeWithUnassigned,
               initialViewMode: "team",
            })
         );

         // Unassigned card exists
         expect(html).toContain('data-testid="unassigned-scholars-card"');
         expect(html).toContain("Unassigned Scholars");
         expect(html).toContain("1 unassigned");
         expect(html).toContain("Awaiting house assignment");

         // Scholar details are rendered with platform username
         expect(html).toContain("klara");
         expect(html).not.toContain("@klara");
         expect(html).toContain(
            'data-testid="unassigned-pill-part-unassigned-1"'
         );
         expect(html).toContain("⏳ Unassigned");
         expect(html).toContain("05:00:00");
         expect(html).toContain("+02:00:00");
      });

      it("renders 1-click shortcut link to Manage tab for hosts/admins", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: challengeWithUnassigned,
               initialViewMode: "team",
               isAdmin: true,
            })
         );

         expect(html).toContain('data-testid="assign-unassigned-scholars-btn"');
         expect(html).toContain(
            `/challenge/${challengeWithUnassigned.id}?tab=manage&amp;team=UNASSIGNED`
         );
         expect(html).toContain("Assign in Roster");
         expect(html).toContain("Edit hr");
         expect(html).toContain("Edit target");
      });

      it("does not render admin assign shortcut button or edit buttons for regular participants", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: challengeWithUnassigned,
               initialViewMode: "team",
               isAdmin: false,
            })
         );

         expect(html).not.toContain(
            'data-testid="assign-unassigned-scholars-btn"'
         );
         expect(html).not.toContain(
            `/challenge/${challengeWithUnassigned.id}?tab=manage`
         );
         expect(html).toContain("1 scholar");
      });

      it("renders UNASSIGNED option in team filter dropdown when unassigned scholars exist", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: challengeWithUnassigned,
            })
         );

         expect(html).toContain('value="UNASSIGNED"');
         expect(html).toContain("⏳ Unassigned (1)");
      });

      it("does not render unassigned scholars card or dropdown option when all participants belong to houses", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: mockChallenge,
               initialViewMode: "team",
            })
         );

         expect(html).not.toContain('data-testid="unassigned-scholars-card"');
         expect(html).not.toContain('value="UNASSIGNED"');
         expect(html).not.toContain("Awaiting house assignment");
      });
   });

   describe("Desktop Standings Table Progress & Pace Status Columns (GH-#208 / KAN-69)", () => {
      it("renders dedicated Progress and Pace Status column headers in desktop table", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: mockChallenge,
            })
         );

         expect(html).toContain(">Progress<");
         expect(html).toContain(">Pace Status<");
         expect(html).toContain("20%");
         expect(html).toContain("width:20%");
         expect(html).toContain("Catch-Up");
      });

      it("renders semantic pace status badges for serene, on-track, catch-up, punished, and excused", () => {
         const variedChallenge: ChallengeScoreboardViewModel = {
            ...mockChallenge,
            standings: [
               {
                  ...mockChallenge.standings[0]!,
                  participantId: "part-serene",
                  displayName: "Scholar Serene",
                  username: null,
                  completionPercentage: 100,
                  paceStatus: "serene",
                  paceLabel: "Serene",
               },
               {
                  ...mockChallenge.standings[0]!,
                  participantId: "part-ontrack",
                  displayName: "Scholar OnTrack",
                  username: null,
                  completionPercentage: 50,
                  paceStatus: "on-track",
                  paceLabel: "On Track",
               },
               {
                  ...mockChallenge.standings[0]!,
                  participantId: "part-catchup",
                  displayName: "Scholar CatchUp",
                  username: null,
                  completionPercentage: 25,
                  paceStatus: "catch-up",
                  paceLabel: "Catch-Up",
               },
               {
                  ...mockChallenge.standings[0]!,
                  participantId: "part-punished",
                  displayName: "Scholar Punished",
                  username: null,
                  completionPercentage: 10,
                  paceStatus: "punished",
                  paceLabel: "Punished",
               },
               {
                  ...mockChallenge.standings[0]!,
                  participantId: "part-excused",
                  displayName: "Scholar Excused",
                  username: null,
                  completionPercentage: 80,
                  paceStatus: "excused",
                  paceLabel: "Excused",
               },
            ],
         };

         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: variedChallenge,
            })
         );

         expect(html).toContain("Scholar Serene");
         expect(html).toContain("100%");
         expect(html).toContain("Serene");
         expect(html).toContain("Scholar OnTrack");
         expect(html).toContain("50%");
         expect(html).toContain("On Track");
         expect(html).toContain("Scholar CatchUp");
         expect(html).toContain("25%");
         expect(html).toContain("Catch-Up");
         expect(html).toContain("Scholar Punished");
         expect(html).toContain("10%");
         expect(html).toContain("Punished");
         expect(html).toContain("Scholar Excused");
         expect(html).toContain("80%");
         expect(html).toContain("Excused");
      });

      it("omits Progress and Pace Status columns in Today's LB view mode", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: mockChallenge,
               initialViewMode: "today",
            })
         );

         expect(html).not.toContain(">Progress<");
         expect(html).not.toContain(">Pace Status<");
         expect(html).toContain("Today&#x27;s hours");
      });

      it("safely handles 0% and caps 100%+ progress bar widths", () => {
         const extremeProgressChallenge: ChallengeScoreboardViewModel = {
            ...mockChallenge,
            standings: [
               {
                  ...mockChallenge.standings[0]!,
                  participantId: "part-zero",
                  displayName: "Zero Scholar",
                  completionPercentage: 0,
                  paceStatus: "catch-up",
               },
               {
                  ...mockChallenge.standings[0]!,
                  participantId: "part-over",
                  displayName: "Overachiever Scholar",
                  completionPercentage: 125,
                  paceStatus: "serene",
               },
            ],
         };

         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: extremeProgressChallenge,
            })
         );

         expect(html).toContain("0%");
         expect(html).toContain("width:0%");
         expect(html).toContain("125%");
         expect(html).toContain("width:100%");
      });

      it("renders Punished badge for uncompleted scholars and Completed badge for finished scholars on locked challenges (GH-#217)", () => {
         const lockedChallenge: ChallengeScoreboardViewModel = {
            ...mockChallenge,
            status: "COMPLETED",
            resultsLockedAt: "2026-10-08T00:00:00.000Z",
            standings: [
               {
                  ...mockChallenge.standings[0]!,
                  participantId: "part-completed",
                  displayName: "Champion Scholar",
                  username: null,
                  completionPercentage: 100,
                  deficitSeconds: 0,
                  paceStatus: "serene",
                  paceLabel: "Completed",
               },
               {
                  ...mockChallenge.standings[0]!,
                  participantId: "part-uncompleted",
                  displayName: "Deficit Scholar",
                  username: null,
                  completionPercentage: 14,
                  deficitSeconds: 108_000,
                  paceStatus: "punished",
                  paceLabel: "Punished",
               },
            ],
         };

         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: lockedChallenge,
            })
         );

         expect(html).toContain("Champion Scholar");
         expect(html).toContain("100%");
         expect(html).toContain("Completed");
         expect(html).toContain("bg-feedback-success-bg");

         expect(html).toContain("Deficit Scholar");
         expect(html).toContain("14%");
         expect(html).toContain("Punished");
         expect(html).toContain("bg-feedback-error-bg");
      });
   });

   describe("Admin Quick-Pardon Trigger (FEAT-PUN-04 / GH-#211)", () => {
      const lockedChallenge: ChallengeScoreboardViewModel = {
         ...mockChallenge,
         status: "COMPLETED",
         resultsLockedAt: "2026-10-08T00:00:00.000Z",
         standings: [
            {
               ...mockChallenge.standings[0]!,
               participantId: "part-punished",
               userId: "user-punished",
               displayName: "Punished Scholar",
               username: "punished_one",
               teamName: "Serpents",
               paceStatus: "punished",
               status: "PUNISHED",
            },
            {
               ...mockChallenge.standings[0]!,
               participantId: "part-serene",
               userId: "user-serene",
               displayName: "Serene Scholar",
               username: "serene_one",
               teamName: "Serpents",
               paceStatus: "serene",
               status: "ACTIVE",
            },
            {
               ...mockChallenge.standings[0]!,
               participantId: "part-excused",
               userId: "user-excused",
               displayName: "Excused Scholar",
               username: "excused_one",
               teamName: "Serpents",
               paceStatus: "excused",
               status: "EXCUSED",
            },
         ],
      };

      it("renders Pardon button for punished participants when isAdmin is true on completed/locked challenges", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: lockedChallenge,
               isAdmin: true,
               initialViewMode: "individual",
            })
         );

         expect(html).toContain('data-testid="admin-pardon-button"');
         expect(html).toContain("Pardon");
         expect(html).toContain("Edit hr");
         expect(html).toContain("Edit target");
      });

      it("does not render Pardon button for regular participants or spectators (isAdmin: false)", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: lockedChallenge,
               isAdmin: false,
               initialViewMode: "individual",
            })
         );

         expect(html).not.toContain('data-testid="admin-pardon-button"');
         expect(html).not.toContain("Admin: Grant Pardon");
      });

      it("does not render Pardon button when challenge is still active / unlocked even if isAdmin is true", () => {
         const activeChallenge: ChallengeScoreboardViewModel = {
            ...lockedChallenge,
            status: "ACTIVE",
            resultsLockedAt: null,
            standings: [
               {
                  ...lockedChallenge.standings[0]!,
                  paceStatus: "catch-up",
                  status: "ACTIVE",
               },
            ],
         };

         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: activeChallenge,
               isAdmin: true,
               initialViewMode: "individual",
            })
         );

         expect(html).not.toContain('data-testid="admin-pardon-button"');
      });

      it("renders Pardon button in Team View mode for punished house members and unassigned scholars", () => {
         const teamChallengeWithUnassigned: ChallengeScoreboardViewModel = {
            ...lockedChallenge,
            standings: [
               ...lockedChallenge.standings,
               {
                  ...lockedChallenge.standings[0]!,
                  participantId: "part-unassigned-punished",
                  userId: "user-unassigned",
                  displayName: "Unassigned Punished Scholar",
                  teamId: "no-assigned",
                  teamName: "Unassigned",
                  paceStatus: "punished",
                  status: "PUNISHED",
               },
            ],
         };

         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: teamChallengeWithUnassigned,
               isAdmin: true,
               initialViewMode: "team",
            })
         );

         expect(html).toContain('data-testid="admin-pardon-button"');
      });

      it("opens AdminPardonModal with pre-selected participant on click and triggers router.refresh on success", () => {
         mockRefresh.mockClear();

         render(
            createElement(ChallengeLeaderboardTab, {
               challenge: lockedChallenge,
               isAdmin: true,
               initialViewMode: "individual",
            })
         );

         // Initially modal is not open
         expect(screen.queryByTestId("admin-pardon-modal")).toBeNull();

         // Find pardon button and click it
         const pardonButtons = screen.getAllByTestId("admin-pardon-button");
         expect(pardonButtons.length).toBeGreaterThan(0);
         fireEvent.click(pardonButtons[0]!);

         // Modal should now be open with the punished participant
         const modal = screen.getByTestId("admin-pardon-modal");
         expect(modal).not.toBeNull();
         expect(modal.getAttribute("data-participant-id")).toBe(
            "part-punished"
         );
         expect(modal.getAttribute("data-participant-name")).toBe(
            "Punished Scholar"
         );

         // Simulate successful pardon
         const successBtn = screen.getByTestId("mock-pardon-success-btn");
         fireEvent.click(successBtn);

         // router.refresh should have been triggered
         expect(mockRefresh).toHaveBeenCalled();
      });
   });

   describe("Admin compact icon actions and aligned table layout", () => {
      it("renders dedicated Actions column in desktop table when isAdmin is true", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: mockChallenge,
               isAdmin: true,
               initialViewMode: "individual",
            })
         );

         expect(html).toContain("Actions");
         expect(html).toContain("Edit hr");
         expect(html).toContain("Edit target");
      });

      it("does not render Actions column when isAdmin is false", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: mockChallenge,
               isAdmin: false,
               initialViewMode: "individual",
            })
         );

         expect(html).not.toContain("Actions");
         expect(html).not.toContain("Edit hr");
         expect(html).not.toContain("Edit target");
      });

      it("preserves identical total hours cell structure between regular and admin views", () => {
         const userHtml = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: mockChallenge,
               isAdmin: false,
               initialViewMode: "individual",
            })
         );

         const adminHtml = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: mockChallenge,
               isAdmin: true,
               initialViewMode: "individual",
            })
         );

         // Both user and admin views render total hours on a single line with whitespace-nowrap
         expect(userHtml).toContain("07:00:00");
         expect(userHtml).toContain("/ 35:00:00");
         expect(adminHtml).toContain("07:00:00");
         expect(adminHtml).toContain("/ 35:00:00");
      });
   });

   describe("Day Selector & Historical Daily Standings (GH-#248 / KAN-94)", () => {
      const challengeWithDailyLogs: ChallengeScoreboardViewModel = {
         ...mockChallenge,
         startAt: "2026-10-01T00:00:00.000Z",
         endAt: "2026-10-08T00:00:00.000Z",
         totalDays: 7,
         currentDayNumber: 3,
         standings: [
            {
               ...mockChallenge.standings[0]!,
               participantId: "part-1",
               displayName: "Scholar One",
               username: null,
               totalLoggedSeconds: 36_000,
               totalLoggedClock: "10:00:00",
               todayLoggedSeconds: 3_600,
               todayLoggedClock: "01:00:00",
               dailyLogs: {
                  "2026-10-01": 14_400, // Day 1: 04:00:00
                  "2026-10-02": 0, // Day 2: 00:00:00
                  "2026-10-03": 3_600, // Day 3 (Today): 01:00:00
               },
               rank: 1,
            },
            {
               ...mockChallenge.standings[0]!,
               participantId: "part-2",
               displayName: "Scholar Two",
               username: null,
               totalLoggedSeconds: 20_000,
               totalLoggedClock: "05:33:20",
               todayLoggedSeconds: 14_400,
               todayLoggedClock: "04:00:00",
               dailyLogs: {
                  "2026-10-01": 7_200, // Day 1: 02:00:00
                  "2026-10-02": 10_800, // Day 2: 03:00:00
                  "2026-10-03": 14_400, // Day 3 (Today): 04:00:00
               },
               rank: 2,
            },
         ],
      };

      it("renders day selector dropdown and day heading when in daily view", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: challengeWithDailyLogs,
               initialViewMode: "today",
            })
         );

         expect(html).toContain('data-testid="leaderboard-day-select"');
         expect(html).toContain('data-testid="leaderboard-day-heading"');
         expect(html).toContain("Showing Today&#x27;s Standings · Oct 3, 2026");
         expect(html).toContain("Today (Day 3 · Oct 3)");
         expect(html).toContain("Day 1 · Oct 1");
         expect(html).toContain("Day 2 · Oct 2");
      });

      it("ranks scholars by logged seconds for the selected historical day (Day 1)", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: challengeWithDailyLogs,
               initialViewMode: "day",
               initialDay: 1,
            })
         );

         expect(html).toContain("Showing Day 1 Standings · Oct 1, 2026");
         expect(html).toContain("Day 1 hours");
         expect(html).toContain("Day 1 Hours");

         // On Day 1 in standings table: Scholar One (4h) beats Scholar Two (2h)
         const tableBody = html.slice(html.indexOf("<tbody"));
         const indexScholarOne = tableBody.indexOf("Scholar One");
         const indexScholarTwo = tableBody.indexOf("Scholar Two");
         expect(indexScholarOne).toBeGreaterThan(-1);
         expect(indexScholarTwo).toBeGreaterThan(-1);
         expect(indexScholarOne).toBeLessThan(indexScholarTwo);

         expect(html).toContain("04:00:00");
         expect(html).toContain("02:00:00");
      });

      it("renders 00:00:00 for participants with zero logged time on selected day without breaking layout", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: challengeWithDailyLogs,
               initialViewMode: "day",
               initialDay: 2,
            })
         );

         expect(html).toContain("Showing Day 2 Standings · Oct 2, 2026");

         // On Day 2 in standings table: Scholar Two (3h) beats Scholar One (0h)
         const tableBody = html.slice(html.indexOf("<tbody"));
         const indexScholarTwo = tableBody.indexOf("Scholar Two");
         const indexScholarOne = tableBody.indexOf("Scholar One");
         expect(indexScholarTwo).toBeGreaterThan(-1);
         expect(indexScholarOne).toBeGreaterThan(-1);
         expect(indexScholarTwo).toBeLessThan(indexScholarOne);

         expect(html).toContain("03:00:00");
         expect(html).toContain("00:00:00");
      });

      it("resolves dateKey initialDay string (YYYY-MM-DD) for pre-hydration deep linking", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: challengeWithDailyLogs,
               initialViewMode: "day",
               initialDay: "2026-10-02",
            })
         );

         expect(html).toContain("Showing Day 2 Standings · Oct 2, 2026");
         expect(html).toContain("Day 2 hours");
      });

      it("renders cozy empty state when no study sessions are recorded across all participants on selected day", () => {
         const challengeNoLogsOnDay2: ChallengeScoreboardViewModel = {
            ...challengeWithDailyLogs,
            standings: challengeWithDailyLogs.standings.map((s) => ({
               ...s,
               dailyLogs: {
                  ...s.dailyLogs,
                  "2026-10-02": 0,
               },
            })),
         };

         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: challengeNoLogsOnDay2,
               initialViewMode: "day",
               initialDay: 2,
            })
         );

         expect(html).toContain('data-testid="day-no-logs-empty-state"');
         expect(html).toContain("No study sessions logged on Day 2");
         expect(html).toContain("No scholars recorded study hours on Oct 2.");
      });

      it("defaults to final day for completed challenges in daily view", () => {
         const completedChallenge: ChallengeScoreboardViewModel = {
            ...challengeWithDailyLogs,
            status: "COMPLETED",
            totalDays: 5,
            currentDayNumber: 8,
         };

         const html = renderToStaticMarkup(
            createElement(ChallengeLeaderboardTab, {
               challenge: completedChallenge,
               initialViewMode: "today",
            })
         );

         expect(html).toContain("Showing Day 5 Standings · Oct 5, 2026");
         expect(html).toContain("Day 5 · Oct 5 (Final Day)");
      });
   });
});
