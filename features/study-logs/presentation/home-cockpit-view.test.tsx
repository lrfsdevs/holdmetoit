import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { HomeCockpitView } from "./home-cockpit-view";
import type { CockpitViewModel } from "@/features/study-logs/data/cockpit-data";

vi.mock("next/link", () => ({
   default: ({
      href,
      children,
      className,
      ...props
   }: {
      href: string;
      children: React.ReactNode;
      className?: string;
      [key: string]: any;
   }) => createElement("a", { href, className, ...props }, children),
}));

vi.mock("@/features/challenges/presentation/enrollment-modal", () => ({
   EnrollmentModal: () => null,
   JoinChallengeModal: () => null,
}));

vi.mock("./daily-hours-modal", () => ({
   DailyHoursModal: () => null,
}));

vi.mock("@/features/tasks/api/task.actions", () => ({
   createTaskAction: vi.fn(),
   deleteTaskAction: vi.fn(),
   toggleTaskAction: vi.fn(),
}));

describe("HomeCockpitView", () => {
   it("renders correctly with fractional paceSecondsPerDay without throwing DurationRangeError", () => {
      const mockCockpit: CockpitViewModel = {
         challengeId: "chal-1",
         challengeTitle: "October Group Battle",
         challengeStatus: "ACTIVE",
         challengeFormat: "TEAM_VS_TEAM",
         teamName: "Honey Bees",
         teamColor: "#d9822b",
         teamIcon: "🐝",
         participant: {
            id: "part-1",
            userId: "user-1",
            displayName: "Afnan",
            username: "afnan6969",
            image: null,
         },
         targetSeconds: 126000,
         targetClock: "35:00:00",
         totalLoggedSeconds: 18000,
         totalLoggedClock: "05:00:00",
         canEditDeclarations: false,
         canLogStudyTime: true,
         isReadOnly: false,
         userTasks: {
            categories: [
               {
                  id: "cat-1",
                  userId: "user-1",
                  name: "Deep Work",
                  taskType: "DAILY",
                  createdAt: new Date(),
                  updatedAt: new Date(),
               },
            ],
            dailyCategories: [
               {
                  id: "cat-1",
                  name: "Deep Work",
                  taskType: "DAILY",
                  isCollapsed: false,
                  tasks: [
                     {
                        id: "t-1",
                        userId: "user-1",
                        categoryId: "cat-1",
                        title: "Study Physics",
                        taskType: "DAILY",
                        isComplete: false,
                        dueDate: "2026-10-04",
                        createdAt: new Date("2026-10-04T12:00:00Z"),
                        updatedAt: new Date("2026-10-04T12:00:00Z"),
                        completedAt: null,
                     },
                  ],
               },
            ],
            weeklyCategories: [
               {
                  id: "cat-2",
                  name: "Sprint Goals",
                  taskType: "WEEKLY",
                  isCollapsed: false,
                  tasks: [],
               },
            ],
            totalDailyTasks: 1,
            completedDailyTasks: 0,
            totalWeeklyTasks: 0,
            completedWeeklyTasks: 0,
         },
         logs: [],
         catchUp: {
            tone: "catch-up",
            deficitSeconds: 108000,
            // Fractional quotient: 108000 / 7 = 15428.571428571428
            paceSecondsPerDay: 108000 / 7,
            progressLabel: "05:00:00 / 35:00:00",
            message: "Gentle catch-up.",
         },
         todayDate: "2026-10-04",
         todayLoggedSeconds: 18000,
         todayLoggedClock: "05:00:00",
         yesterdayDate: "2026-10-03",
         yesterdayLoggedSeconds: 0,
         isYesterdayMissed: false,
         teamRank: null,
         remainingDailyAllowanceSeconds: 68400,
         todayDayNumber: 1,
      };

      expect(() => {
         const html = renderToStaticMarkup(
            createElement(HomeCockpitView, {
               cockpit: mockCockpit,
               user: { id: "user-1", name: "Afnan", displayName: "Afnan" },
               displayName: "Afnan",
            })
         );
         expect(html).toContain("Deficit:");
         expect(html).toContain("04:17:09"); // 15429 seconds (Math.round(108000/7)) formatted cleanly to HH:MM:SS
         expect(html).toContain("Deep Work");
         expect(html).toContain("Study Physics");
      }).not.toThrow();
   });

   it("hides Weekly Commitment Progress when challengeStatus is COMPLETED", () => {
      const mockCockpit: CockpitViewModel = {
         challengeId: "chal-1",
         challengeTitle: "October Group Battle",
         challengeStatus: "COMPLETED",
         challengeFormat: "TEAM_VS_TEAM",
         teamName: "Honey Bees",
         teamColor: "#d9822b",
         teamIcon: "🐝",
         participant: {
            id: "part-1",
            userId: "user-1",
            displayName: "Afnan",
            username: "afnan6969",
            image: null,
         },
         targetSeconds: 126000,
         targetClock: "35:00:00",
         totalLoggedSeconds: 25200,
         totalLoggedClock: "07:00:00",
         canEditDeclarations: false,
         canLogStudyTime: false,
         isReadOnly: true,
         userTasks: {
            categories: [],
            dailyCategories: [],
            weeklyCategories: [],
            totalDailyTasks: 0,
            completedDailyTasks: 0,
            totalWeeklyTasks: 0,
            completedWeeklyTasks: 0,
         },
         logs: [],
         catchUp: {
            tone: "deadline",
            deficitSeconds: 100800,
            paceSecondsPerDay: null,
            progressLabel: "07:00:00 / 35:00:00",
            message: "Challenge completed.",
         },
         todayDate: "2026-10-04",
         todayLoggedSeconds: 0,
         todayLoggedClock: "00:00:00",
         yesterdayDate: "2026-10-03",
         yesterdayLoggedSeconds: 0,
         isYesterdayMissed: false,
         teamRank: 1,
         remainingDailyAllowanceSeconds: 86400,
         todayDayNumber: 1,
      };

      const html = renderToStaticMarkup(
         createElement(HomeCockpitView, {
            cockpit: mockCockpit,
            user: { id: "user-1", name: "Afnan", displayName: "Afnan" },
            displayName: "Afnan",
         })
      );

      expect(html).toContain(
         "Congrats, your team secured 1st in this challenge"
      );
      expect(html).not.toContain("Weekly Commitment Progress");
   });

   it("hides Weekly Commitment Progress when challengeStatus is UPCOMING", () => {
      const mockCockpit: CockpitViewModel = {
         challengeId: "chal-1",
         challengeTitle: "October Group Battle",
         challengeStatus: "UPCOMING",
         challengeFormat: "TEAM_VS_TEAM",
         teamName: "Honey Bees",
         teamColor: "#d9822b",
         teamIcon: "🐝",
         participant: {
            id: "part-1",
            userId: "user-1",
            displayName: "Afnan",
            username: "afnan6969",
            image: null,
         },
         targetSeconds: 126000,
         targetClock: "35:00:00",
         totalLoggedSeconds: 0,
         totalLoggedClock: "00:00:00",
         canEditDeclarations: true,
         canLogStudyTime: false,
         isReadOnly: false,
         userTasks: {
            categories: [],
            dailyCategories: [],
            weeklyCategories: [],
            totalDailyTasks: 0,
            completedDailyTasks: 0,
            totalWeeklyTasks: 0,
            completedWeeklyTasks: 0,
         },
         logs: [],
         catchUp: {
            tone: "on-pace",
            deficitSeconds: 126000,
            paceSecondsPerDay: null,
            progressLabel: "00:00:00 / 35:00:00",
            message: "Upcoming challenge.",
         },
         todayDate: "2026-10-04",
         todayLoggedSeconds: 0,
         todayLoggedClock: "00:00:00",
         yesterdayDate: "2026-10-03",
         yesterdayLoggedSeconds: 0,
         isYesterdayMissed: false,
         teamRank: null,
         remainingDailyAllowanceSeconds: 86400,
         todayDayNumber: 1,
      };

      const html = renderToStaticMarkup(
         createElement(HomeCockpitView, {
            cockpit: mockCockpit,
            user: { id: "user-1", name: "Afnan", displayName: "Afnan" },
            displayName: "Afnan",
         })
      );

      expect(html).toContain("You are enrolled in group battle this week");
      expect(html).not.toContain("Weekly Commitment Progress");
   });

   it("renders guest view gracefully when user is not logged in", () => {
      const html = renderToStaticMarkup(
         createElement(HomeCockpitView, {
            user: null,
            cockpit: null,
            displayName: "Guest",
         })
      );
      expect(html).toContain("Daily Todos");
      expect(html).toContain("Weekly Todos");
   });

   it("does not render any cockpit banner when logged in but there is no event in the app", () => {
      const html = renderToStaticMarkup(
         createElement(HomeCockpitView, {
            user: { id: "user-1", name: "Afnan", displayName: "Afnan" },
            cockpit: null,
            upcomingChallenge: null,
            displayName: "Afnan",
         })
      );
      expect(html).not.toContain("Enroll in group battle");
      expect(html).not.toContain("Enroll in solo battle");
      expect(html).not.toContain("Enroll in duo battle");
      expect(html).not.toContain("Wow, you studied");
      expect(html).not.toContain("You haven't logged today's hours");
      expect(html).toContain("Daily Todos");
      expect(html).toContain("Weekly Todos");
   });

   it("renders username next to Welcome as a link to user's profile when logged in with cockpit", () => {
      const mockCockpit: any = {
         challengeId: "chal-beta",
         participant: {
            id: "part-gamma",
            userId: "user-beta",
            displayName: "NrGSIayeR",
         },
         logs: [],
         userTasks: {
            categories: [],
            dailyCategories: [],
            weeklyCategories: [],
         },
      };

      const html = renderToStaticMarkup(
         createElement(HomeCockpitView, {
            user: { id: "user-beta", displayName: "NrGSIayeR" },
            cockpit: mockCockpit,
         })
      );

      expect(html).toContain("Welcome");
      expect(html).toContain(
         'href="/challenge/chal-beta/participant/part-gamma"'
      );
      expect(html).toContain("NrGSIayeR");
      expect(html).toContain('title="View profile for NrGSIayeR"');
   });

   it("renders username next to Welcome as plain text without link when unauthenticated", () => {
      const html = renderToStaticMarkup(
         createElement(HomeCockpitView, {
            user: null,
            cockpit: null,
            displayName: "Guest",
         })
      );

      expect(html).toContain("Welcome Guest");
      expect(html).not.toContain('title="View profile for Guest"');
      expect(html).not.toContain('href="/challenge/');
      expect(html).not.toContain('href="/profile"');
   });
});
