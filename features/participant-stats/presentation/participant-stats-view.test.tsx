import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ParticipantStatsView } from "./participant-stats-view";
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

vi.mock("next/navigation", () => ({
   useRouter: () => ({
      refresh: vi.fn(),
      push: vi.fn(),
   }),
}));

describe("ParticipantStatsView", () => {
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
         {
            dayNumber: 2,
            dateKey: "2026-10-02",
            dateFormatted: "Oct 2, 2026",
            weekday: "Fri",
            label: "Day 2 (Fri)",
            durationSeconds: 0,
            durationClock: "00:00:00",
            durationHuman: "0s",
            cumulativeSeconds: 14400,
            cumulativeClock: "04:00:00",
            cumulativeHuman: "4h",
            isToday: false,
            isYesterday: true,
            isFuture: false,
            isPast: true,
            isOverride: false,
            isLeave: true,
         },
         {
            dayNumber: 3,
            dateKey: "2026-10-03",
            dateFormatted: "Oct 3, 2026",
            weekday: "Sat",
            label: "Today (Day 3)",
            durationSeconds: 14400,
            durationClock: "04:00:00",
            durationHuman: "4h",
            cumulativeSeconds: 28800,
            cumulativeClock: "08:00:00",
            cumulativeHuman: "8h",
            isToday: true,
            isYesterday: false,
            isFuture: false,
            isPast: false,
            isOverride: true,
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

   it("renders profile header details and breadcrumbs", () => {
      const html = renderToStaticMarkup(
         <ParticipantStatsView stats={mockStats} />
      );

      expect(html).toContain("Alice Scholar");
      expect(html).toContain("@alicescholar");
      expect(html).toContain("Honey Bees");
      expect(html).toContain("Autumn Study Clash");
      expect(html).toContain("#1");
      expect(html).toContain("Serene");
      expect(html).toContain("/challenges");
      expect(html).toContain("/challenge/chal_1?tab=leaderboard");
   });

   it("renders summary statistics cards with clocks and target progress", () => {
      const html = renderToStaticMarkup(
         <ParticipantStatsView stats={mockStats} />
      );

      expect(html).toContain("Total Study Time");
      expect(html).toContain("20:00:00");
      expect(html).toContain("Today&#x27;s Hours");
      expect(html).toContain("04:00:00");
      expect(html).toContain("Declared Target");
      expect(html).toContain("100%");
      expect(html).toContain("Target Met!");
   });

   it("renders daily history table with zero days, leave badges, and override indicators", () => {
      const html = renderToStaticMarkup(
         <ParticipantStatsView stats={mockStats} />
      );

      expect(html).toContain("Day 1");
      expect(html).toContain("Oct 1, 2026");
      expect(html).toContain("Day 2");
      expect(html).toContain("00:00:00"); // zero day preserved
      expect(html).toContain("On Leave"); // Day 2 leave badge
      expect(html).toContain("Marked as Leave"); // Day 2 leave note
      expect(html).toContain("Host Override"); // Day 3 override badge
   });

   it("renders em-dash for cumulative duration on upcoming days in daily history", () => {
      const statsWithUpcoming: ParticipantStatsViewModel = {
         ...mockStats,
         dailyHistory: [
            ...mockStats.dailyHistory,
            {
               dayNumber: 4,
               dateKey: "2026-10-04",
               dateFormatted: "Oct 4, 2026",
               weekday: "Sun",
               label: "Day 4 (Sun)",
               durationSeconds: 0,
               durationClock: "00:00:00",
               durationHuman: "0s",
               cumulativeSeconds: 0,
               cumulativeClock: "—",
               cumulativeHuman: "—",
               isToday: false,
               isYesterday: false,
               isFuture: true,
               isPast: false,
               isOverride: false,
               isLeave: false,
            },
         ],
      };

      const html = renderToStaticMarkup(
         <ParticipantStatsView stats={statsWithUpcoming} />
      );

      expect(html).toContain("Upcoming");
      expect(html).toContain("—");
   });

   it("renders team stats when present", () => {
      const html = renderToStaticMarkup(
         <ParticipantStatsView stats={mockStats} />
      );

      expect(html).toContain("Team Standing &amp; Contribution");
      expect(html).toContain("Rank #2");
      expect(html).toContain("of 3 house members");
      expect(html).toContain("House #1");
      expect(html).toContain("27:46:40");
      expect(html).toContain("29%");
      expect(html).toContain("Honey Bees");
   });

   it("omits team stats when teamStats is null (e.g. SOLOS)", () => {
      const soloStats = {
         ...mockStats,
         teamStats: null,
      };
      const html = renderToStaticMarkup(
         <ParticipantStatsView stats={soloStats} />
      );

      expect(html).not.toContain("Team Standing &amp; Contribution");
   });

   it("strictly enforces read-only behavior for ordinary viewers: zero input fields or edit buttons", () => {
      const html = renderToStaticMarkup(
         <ParticipantStatsView stats={mockStats} />
      );

      expect(html).not.toContain("<input");
      expect(html).not.toContain("<form");
      expect(html).not.toContain("<textarea");
      expect(html).not.toContain("Edit hr");
      expect(html).not.toContain("Admin Controls");
   });

   it("renders admin controls link when viewer is admin", () => {
      const adminStats = {
         ...mockStats,
         viewer: {
            isAdmin: true,
            isOwner: false,
         },
      };
      const html = renderToStaticMarkup(
         <ParticipantStatsView stats={adminStats} />
      );

      expect(html).toContain("Admin Controls");
      expect(html).toContain("/challenge/chal_1?tab=manage");
   });
});
