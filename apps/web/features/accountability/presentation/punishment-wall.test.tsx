import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PunishmentWall } from "./punishment-wall";
import type { ChallengeScoreboardViewModel } from "@/features/leaderboard/domain/leaderboard.types";

describe("PunishmentWall (FEAT-PUN-02 / FEAT-PUN-03)", () => {
   const baseChallenge: ChallengeScoreboardViewModel = {
      id: "chal_test",
      title: "Reading Week Sprint",
      description: "Test description",
      heroImageUrl: null,
      eventBannerUrl: null,
      punishmentPfpUrl: "https://example.com/forfeit.png",
      format: "SOLOS",
      status: "ACTIVE",
      startAt: "2026-09-01T08:00:00.000Z",
      endAt: "2026-09-08T08:00:00.000Z",
      daysRemaining: 4,
      totalDays: 7,
      currentDayNumber: 3,
      timeRemainingHuman: "4 days",
      teams: [],
      matchHeader: {
         hasMatchup: false,
         teamA: null,
         teamB: null,
         leadMarginSeconds: 0,
         leadMarginClock: "00:00:00",
         leadMarginHuman: "0s",
         leaderTeamId: null,
         leaderSide: "tie",
         ratioPercentageA: 0,
         ratioPercentageB: 0,
      },
      standings: [],
      currentUser: {
         isLoggedIn: true,
         isEnrolled: true,
         participantId: "part_1",
         isWrappedSeen: false,
         isFeedbackFilled: false,
      },
   };

   it("renders section header, description, and download button when forfeit avatar is configured", () => {
      const html = renderToStaticMarkup(
         createElement(PunishmentWall, { challenge: baseChallenge })
      );

      expect(html).toContain("Forfeits &amp; Accountability Wall");
      expect(html).toContain("Three-Condition Rule");
      expect(html).toContain("Download Forfeit PFP");
      expect(html).toContain("https://example.com/forfeit.png");
   });

   it("renders clean zero-state when all active participants are on pace with zero deficits", () => {
      const challenge: ChallengeScoreboardViewModel = {
         ...baseChallenge,
         standings: [
            {
               rank: 1,
               participantId: "p1",
               userId: "u1",
               displayName: "Alice Scholar",
               username: "alice",
               image: null,
               teamId: "t1",
               teamName: "Solo Scholar",
               teamColor: "#3b82f6",
               teamIcon: "⚡",
               totalLoggedSeconds: 36000,
               totalLoggedClock: "10:00:00",
               todayLoggedSeconds: 14400,
               todayLoggedClock: "04:00:00",
               targetSeconds: 36000,
               targetClock: "10:00:00",
               completionPercentage: 100,
               weeklyTasksCompletedCount: 3,
               weeklyTasksTotalCount: 3,
               paceStatus: "serene",
               paceLabel: "Serene",
               deficitSeconds: 0,
            },
         ],
      };

      const html = renderToStaticMarkup(
         createElement(PunishmentWall, { challenge })
      );
      expect(html).toContain("All participants currently on pace");
   });

   it("renders live deficit members when active participants are behind target", () => {
      const challenge: ChallengeScoreboardViewModel = {
         ...baseChallenge,
         standings: [
            {
               rank: 1,
               participantId: "p1",
               userId: "u1",
               displayName: "Bob Deficit",
               username: "bob",
               image: null,
               teamId: "t1",
               teamName: "Solo Scholar",
               teamColor: "#3b82f6",
               teamIcon: "⚡",
               totalLoggedSeconds: 14400,
               totalLoggedClock: "04:00:00",
               todayLoggedSeconds: 0,
               todayLoggedClock: "00:00:00",
               targetSeconds: 36000,
               targetClock: "10:00:00",
               completionPercentage: 40,
               weeklyTasksCompletedCount: 1,
               weeklyTasksTotalCount: 3,
               paceStatus: "catch-up",
               paceLabel: "Catch-Up",
               deficitSeconds: 21600, // 06:00:00
            },
         ],
      };

      const html = renderToStaticMarkup(
         createElement(PunishmentWall, { challenge })
      );
      expect(html).toContain("Bob Deficit");
      expect(html).toContain("-06:00:00");
      expect(html).toContain("Goals: 1/3");
      expect(html).toContain("Catch-Up");
   });

   it("renders punished and excused roster when event is COMPLETED", () => {
      const challenge: ChallengeScoreboardViewModel = {
         ...baseChallenge,
         status: "COMPLETED",
         standings: [
            {
               rank: 1,
               participantId: "p1",
               userId: "u1",
               displayName: "Charlie Punished",
               username: "charlie",
               image: null,
               teamId: "t1",
               teamName: "Solo Scholar",
               teamColor: "#3b82f6",
               teamIcon: "⚡",
               totalLoggedSeconds: 18000,
               totalLoggedClock: "05:00:00",
               todayLoggedSeconds: 0,
               todayLoggedClock: "00:00:00",
               targetSeconds: 36000,
               targetClock: "10:00:00",
               completionPercentage: 50,
               weeklyTasksCompletedCount: 2,
               weeklyTasksTotalCount: 3,
               paceStatus: "punished",
               paceLabel: "Punished",
               deficitSeconds: 18000,
               status: "PUNISHED",
            },
            {
               rank: 2,
               participantId: "p2",
               userId: "u2",
               displayName: "Diana Excused",
               username: "diana",
               image: null,
               teamId: "t1",
               teamName: "Solo Scholar",
               teamColor: "#3b82f6",
               teamIcon: "⚡",
               totalLoggedSeconds: 10000,
               totalLoggedClock: "02:46:40",
               todayLoggedSeconds: 0,
               todayLoggedClock: "00:00:00",
               targetSeconds: 36000,
               targetClock: "10:00:00",
               completionPercentage: 28,
               weeklyTasksCompletedCount: 1,
               weeklyTasksTotalCount: 3,
               paceStatus: "excused",
               paceLabel: "Excused",
               deficitSeconds: 26000,
               status: "EXCUSED",
            },
         ],
      };

      const html = renderToStaticMarkup(
         createElement(PunishmentWall, { challenge })
      );
      expect(html).toContain("Charlie Punished");
      expect(html).toContain("Punished");
      expect(html).toContain("Diana Excused");
      expect(html).toContain("Excused");
   });
});
