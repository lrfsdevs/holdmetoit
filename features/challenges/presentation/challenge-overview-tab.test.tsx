import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChallengeOverviewTab } from "./challenge-overview-tab";
import type { ChallengeScoreboardViewModel } from "@/features/leaderboard/domain/leaderboard.types";

vi.mock("next/navigation", () => ({
   useRouter: () => ({
      push: vi.fn(),
      refresh: vi.fn(),
   }),
}));

vi.mock("next/image", () => ({
   default: ({
      src,
      alt,
      className,
   }: {
      src: string;
      alt: string;
      className?: string;
   }) => createElement("img", { src, alt, className }),
}));

describe("ChallengeOverviewTab", () => {
   const mockChallenge: ChallengeScoreboardViewModel = {
      id: "test-challenge-overview",
      title: "Midterm Sprint",
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
            id: "team-a",
            name: "Honey Bees",
            color: "#eab308",
            iconEmoji: "🐝",
            mascotUrl: null,
            sortOrder: 0,
            companionCount: 1,
            totalLoggedSeconds: 14400,
            totalLoggedClock: "04:00:00",
            targetSeconds: 72000,
            targetClock: "20:00:00",
            targetHours: 20,
            completionPercentage: 20,
            isLeader: true,
         },
      ],
      matchHeader: {
         hasMatchup: false,
         teamA: null,
         teamB: null,
         leadMarginSeconds: 0,
         leadMarginClock: "00:00:00",
         leadMarginHuman: "0h",
         leaderTeamId: null,
         leaderSide: "tie",
         ratioPercentageA: 50,
         ratioPercentageB: 50,
      },
      standings: [
         {
            rank: 1,
            participantId: "part-1",
            userId: "user-1",
            displayName: "Alice Scholar",
            username: "alicescholar",
            image: null,
            teamId: "team-a",
            teamName: "Honey Bees",
            teamColor: "#eab308",
            teamIcon: "🐝",
            totalLoggedSeconds: 14400,
            totalLoggedClock: "04:00:00",
            todayLoggedSeconds: 7200,
            todayLoggedClock: "02:00:00",
            targetSeconds: 72000,
            targetClock: "20:00:00",
            completionPercentage: 20,
            weeklyTasksCompletedCount: 1,
            weeklyTasksTotalCount: 3,
            paceStatus: "on-track",
            paceLabel: "On Track",
            deficitSeconds: 0,
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

   it("renders challenge title and enrolled participant name", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeOverviewTab, {
            challenge: mockChallenge,
            isAdmin: false,
         })
      );

      expect(html).toContain("Welcome to the Midterm Sprint!");
      expect(html).toContain("Alice Scholar");
      expect(html).toContain("Honey Bees");
      expect(html).toContain("Active");
      expect(html).not.toContain("Edit hr");
   });

   it("does not render Edit hr buttons when isAdmin is omitted", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeOverviewTab, {
            challenge: mockChallenge,
         })
      );

      expect(html).not.toContain("Edit hr");
   });

   it("renders Edit hr button next to participant when isAdmin is true", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeOverviewTab, {
            challenge: mockChallenge,
            isAdmin: true,
         })
      );

      expect(html).toContain("Edit hr");
      expect(html).toContain("Admin: Edit hours for Alice Scholar");
   });

   it("renders compact pagination controls when participants exceed 8", () => {
      const manyStandings = Array.from({ length: 12 }, (_, i) => ({
         ...mockChallenge.standings[0]!,
         participantId: `part-${i + 1}`,
         userId: `user-${i + 1}`,
         displayName: `Scholar ${i + 1}`,
         username: `scholar_${i + 1}`,
         rank: i + 1,
      }));

      const html = renderToStaticMarkup(
         createElement(ChallengeOverviewTab, {
            challenge: {
               ...mockChallenge,
               standings: manyStandings,
            },
         })
      );

      expect(html).toContain("1–8");
      expect(html).toContain("12");
      expect(html).toContain("1/2");
      expect(html).toContain("Next");
   });

   it("renders search input and team filter dropdown in participants section", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeOverviewTab, {
            challenge: mockChallenge,
         })
      );

      expect(html).toContain("Search participants...");
      expect(html).toContain("All Teams");
      expect(html).toContain("Honey Bees");
   });

   it("renders Timetable (UTC) kickoff and conclusion dates", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeOverviewTab, {
            challenge: mockChallenge,
         })
      );

      expect(html).toContain("Timetable (UTC)");
      expect(html).toContain("Kickoff Date");
      expect(html).toContain("Conclusion Date");
      expect(html).toContain("Thu, 01 Oct 2026 00:00:00 UTC");
      expect(html).toContain("Thu, 08 Oct 2026 00:00:00 UTC");
   });

   it("renders fallback state when no punishment PFP is configured", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeOverviewTab, {
            challenge: {
               ...mockChallenge,
               punishmentPfpUrl: null,
            },
         })
      );

      expect(html).toContain("Forfeit Avatar &amp; Accountability");
      expect(html).toContain("No Custom Forfeit Avatar Set");
      expect(html).toContain("Accountability rules still apply");
      expect(html).not.toContain("Download Forfeit PFP");
      expect(html).not.toContain("Dual-Failure Invariant (Law L6)");
      expect(html).not.toContain("Forfeit Discord PFP");
      expect(html).not.toContain("Accountability Rule:");
   });

   it("renders forfeit avatar image and download button when punishment PFP is configured", () => {
      const pfpUrl = "https://images.example.com/forfeits/anime-clown.png";
      const html = renderToStaticMarkup(
         createElement(ChallengeOverviewTab, {
            challenge: {
               ...mockChallenge,
               punishmentPfpUrl: pfpUrl,
            },
         })
      );

      expect(html).toContain("Forfeit Avatar &amp; Accountability");
      expect(html).toContain("Assigned Forfeit Picture");
      expect(html).toContain(pfpUrl);
      expect(html).toContain("Download Forfeit PFP");
      expect(html).not.toContain("Dual-Failure Invariant (Law L6)");
      expect(html).not.toContain("Forfeit Discord PFP");
      expect(html).not.toContain("Accountability Rule:");
   });
});
