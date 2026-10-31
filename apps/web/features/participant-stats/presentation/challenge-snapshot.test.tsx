import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChallengeSnapshot } from "./challenge-snapshot";
import type { ParticipantStatsViewModel } from "../domain/participant-stats.types";

vi.mock("next/link", () => ({
   default: ({
      href,
      children,
      ...rest
   }: {
      href: string;
      children: ReactNode;
   }) => createElement("a", { href, ...rest }, children),
}));

vi.mock("next/image", () => ({
   default: ({
      src,
      alt,
      className,
   }: {
      src: string;
      alt: string;
      className: string;
   }) => createElement("img", { src, alt, className }),
}));

describe("ChallengeSnapshot", () => {
   const mockStats: ParticipantStatsViewModel = {
      profile: {
         participantId: "part_1",
         userId: "user_1",
         displayName: "Alice Scholar",
         username: "alicescholar",
         image: "https://example.com/alice.png",
         teamId: "team_1",
         teamName: "Honey Bees",
         teamColor: "#eab308",
         teamIcon: "🐝",
         rank: 1,
         totalParticipants: 12,
         paceStatus: "serene",
         paceLabel: "Serene",
         challengeId: "chal_1",
         challengeTitle: "Autumn Study Clash",
         challengeFormat: "TEAM_VS_TEAM",
         challengeStatus: "ACTIVE",
         startDate: "2026-10-01T00:00:00.000Z",
         endDate: "2026-10-07T00:00:00.000Z",
         participantStatus: "ACTIVE",
      },
      summary: {
         totalLoggedSeconds: 72000,
         totalLoggedClock: "20:00:00",
         totalLoggedHuman: "20h",
         todayLoggedSeconds: 14400,
         todayLoggedClock: "04:00:00",
         todayLoggedHuman: "4h",
         todayIsLeave: false,
         leavesCount: 1,
         targetSeconds: 72000,
         targetClock: "20:00:00",
         targetHuman: "20h",
         completionPercentage: 100,
         rank: 1,
         totalParticipants: 12,
         remainingSeconds: 0,
         remainingClock: "00:00:00",
         remainingHuman: "0s",
         isTargetMet: true,
         excessSeconds: 0,
         excessClock: "00:00:00",
         excessHuman: "0s",
         paceStatus: "serene",
         paceLabel: "Serene",
      },
      dailyHistory: [
         {
            dayNumber: 1,
            dateKey: "2026-10-01",
            dateFormatted: "Oct 1, 2026",
            weekday: "Thu",
            label: "Day 1 (Thu)",
            durationSeconds: 14400,
            durationClock: "04:00:00",
            durationHuman: "4h",
            cumulativeSeconds: 14400,
            cumulativeClock: "04:00:00",
            cumulativeHuman: "4h",
            isToday: false,
            isYesterday: false,
            isFuture: false,
            isPast: true,
            isOverride: false,
            isLeave: false,
         },
      ],
      teamStats: {
         teamId: "team_1",
         teamName: "Honey Bees",
         teamColor: "#eab308",
         teamIcon: "🐝",
         teamRank: 1,
         participantTeamRank: 2,
         teamTotalLoggedSeconds: 100000,
         teamTotalLoggedClock: "27:46:40",
         participantContributionPercentage: 29,
         companionCount: 3,
      },
      accountability: {
         deficitSeconds: 0,
         deficitClock: "00:00:00",
         deficitHuman: "0s",
         requiredDailyPaceSeconds: 0,
         requiredDailyPaceClock: "00:00:00",
         requiredDailyPaceHuman: "0s",
         daysRemaining: 4,
         isPunished: false,
         isPardoned: false,
         pardonReason: null,
         statusBadge: "On-Track",
      },
      viewer: {
         isAdmin: false,
         isOwner: false,
      },
   };

   it("renders challenge header bar with title, format badge, status badge, and date range", () => {
      const html = renderToStaticMarkup(
         <ChallengeSnapshot stats={mockStats} />
      );

      expect(html).toContain("Autumn Study Clash");
      expect(html).toContain("Team Battle");
      expect(html).toContain("Active");
      expect(html).toContain("Oct 1, 2026 – Oct 7, 2026");
   });

   it("renders cockpit link by default when showCockpitLink is true", () => {
      const html = renderToStaticMarkup(
         <ChallengeSnapshot stats={mockStats} />
      );

      expect(html).toContain("View Full Challenge Cockpit");
      expect(html).toContain('href="/challenge/chal_1/participant/part_1"');
   });

   it("omits cockpit link when showCockpitLink is false", () => {
      const html = renderToStaticMarkup(
         <ChallengeSnapshot stats={mockStats} showCockpitLink={false} />
      );

      expect(html).not.toContain("View Full Challenge Cockpit");
   });

   it("hides challenge header bar when showChallengeHeader is false", () => {
      const html = renderToStaticMarkup(
         <ChallengeSnapshot stats={mockStats} showChallengeHeader={false} />
      );

      expect(html).not.toContain("challenge-snapshot-header");
      expect(html).not.toContain("Team Battle");
   });

   it("renders summary cards, team stats, accountability, and daily history", () => {
      const html = renderToStaticMarkup(
         <ChallengeSnapshot stats={mockStats} />
      );

      expect(html).toContain("Total Study Time");
      expect(html).toContain("20:00:00");
      expect(html).toContain("Team Standing &amp; Contribution");
      expect(html).toContain("Accountability &amp; Catch-Up Status");
      expect(html).toContain("Daily Study History");
   });

   it("formats DUOS and SOLOS mode badges properly", () => {
      const duosStats: ParticipantStatsViewModel = {
         ...mockStats,
         profile: {
            ...mockStats.profile,
            challengeFormat: "DUOS",
         },
      };
      const duosHtml = renderToStaticMarkup(
         <ChallengeSnapshot stats={duosStats} />
      );
      expect(duosHtml).toContain("Duos");

      const solosStats: ParticipantStatsViewModel = {
         ...mockStats,
         profile: {
            ...mockStats.profile,
            challengeFormat: "SOLOS",
         },
         teamStats: null,
      };
      const solosHtml = renderToStaticMarkup(
         <ChallengeSnapshot stats={solosStats} />
      );
      expect(solosHtml).toContain("Solos");
   });

   it("displays Withdrawn and Completed badges correctly", () => {
      const withdrawnStats: ParticipantStatsViewModel = {
         ...mockStats,
         profile: {
            ...mockStats.profile,
            participantStatus: "WITHDRAWN",
         },
      };
      const withdrawnHtml = renderToStaticMarkup(
         <ChallengeSnapshot stats={withdrawnStats} />
      );
      expect(withdrawnHtml).toContain("Withdrawn");

      const completedStats: ParticipantStatsViewModel = {
         ...mockStats,
         profile: {
            ...mockStats.profile,
            participantStatus: "COMPLETED",
            challengeStatus: "COMPLETED",
         },
      };
      const completedHtml = renderToStaticMarkup(
         <ChallengeSnapshot stats={completedStats} />
      );
      expect(completedHtml).toContain("Completed");
   });

   it("derives date range from dailyHistory when startDate and endDate are omitted", () => {
      const statsWithoutDates: ParticipantStatsViewModel = {
         ...mockStats,
         profile: {
            ...mockStats.profile,
            startDate: undefined,
            endDate: undefined,
         },
         dailyHistory: [
            {
               ...mockStats.dailyHistory[0],
               dateFormatted: "Nov 10, 2026",
            },
            {
               ...mockStats.dailyHistory[0],
               dayNumber: 2,
               dateFormatted: "Nov 17, 2026",
            },
         ],
      };
      const html = renderToStaticMarkup(
         <ChallengeSnapshot stats={statsWithoutDates} />
      );
      expect(html).toContain("Nov 10, 2026 – Nov 17, 2026");
   });

   it("renders fallback mode gracefully without chart, team stats, or accountability", () => {
      const fallbackStats: ParticipantStatsViewModel = {
         ...mockStats,
         isFallback: true,
         teamStats: null,
      };
      const html = renderToStaticMarkup(
         <ChallengeSnapshot stats={fallbackStats} />
      );

      expect(html).not.toContain("Team Standing &amp; Contribution");
      expect(html).not.toContain("Accountability &amp; Catch-Up Status");
      expect(html).toContain("Daily Study History");
   });
});
