import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChallengeLeaderboardTab } from "./challenge-leaderboard-tab";
import type { ChallengeScoreboardViewModel } from "../domain/leaderboard.types";

vi.mock("next/navigation", () => ({
   useRouter: () => ({
      push: vi.fn(),
      refresh: vi.fn(),
   }),
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
      expect(html).toContain("@afnan");
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

      // Serpents has participant Afnan (#1 in team, #1 overall)
      expect(html).toContain("#1");
      expect(html).toContain("Afnan");
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

      // In Today's LB view, "Today Champion" with 4h today is ranked above "Overall Leader" with 1h today
      const indexTodayChampion = html.indexOf("Today Champion");
      const indexOverallLeader = html.indexOf("Overall Leader");
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
      expect(html).toContain("Afnan");
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
         `/challenge/${todayChallenge.id}/participant/part-test-123?view=today`
      );

      const defaultHtml = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: todayChallenge,
            initialViewMode: "individual",
         })
      );

      // Default (overall rank) links should NOT have ?view=
      expect(defaultHtml).toContain(
         `/challenge/${todayChallenge.id}/participant/part-test-123"`
      );
      expect(defaultHtml).not.toContain(
         `/challenge/${todayChallenge.id}/participant/part-test-123?`
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
         `/challenge/${duoChallenge.id}/participant/part-duo-1"`
      );
      expect(teamHtml).not.toContain(
         `/challenge/${duoChallenge.id}/participant/part-duo-1?view=team`
      );

      const individualHtml = renderToStaticMarkup(
         createElement(ChallengeLeaderboardTab, {
            challenge: duoChallenge,
            initialViewMode: "individual",
         })
      );

      expect(individualHtml).toContain(
         `/challenge/${duoChallenge.id}/participant/part-duo-1?view=individual`
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
});
