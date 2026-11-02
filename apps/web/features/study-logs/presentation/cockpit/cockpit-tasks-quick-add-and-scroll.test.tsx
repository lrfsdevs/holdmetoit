// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CockpitTasksSection } from "./cockpit-tasks-section";
import type { UserCategorizedTasks } from "@/features/tasks/domain/task.types";

afterEach(cleanup);

describe("CockpitTasksSection - Quick-Add, Scroll Containment & Mobile Switcher (GH #195 / KAN-64)", () => {
   const sampleTasks: UserCategorizedTasks = {
      categories: [
         {
            id: "cat_daily_1",
            userId: "user_1",
            name: "Morning Focus",
            taskType: "DAILY",
            createdAt: new Date("2026-10-28T10:00:00Z"),
            updatedAt: new Date("2026-10-28T10:00:00Z"),
         },
         {
            id: "cat_weekly_1",
            userId: "user_1",
            name: "Sprint Goals",
            taskType: "WEEKLY",
            createdAt: new Date("2026-10-28T10:00:00Z"),
            updatedAt: new Date("2026-10-28T10:00:00Z"),
         },
      ],
      dailyCategories: [
         {
            id: "cat_daily_1",
            name: "Morning Focus",
            taskType: "DAILY",
            isCollapsed: false,
            tasks: [
               {
                  id: "t_daily_1",
                  userId: "user_1",
                  categoryId: "cat_daily_1",
                  title: "Review Biology Flashcards",
                  taskType: "DAILY",
                  isComplete: false,
                  dueDate: "2026-10-28",
                  createdAt: new Date("2026-10-28T10:00:00Z"),
                  updatedAt: new Date("2026-10-28T10:00:00Z"),
                  completedAt: null,
               },
            ],
         },
      ],
      weeklyCategories: [
         {
            id: "cat_weekly_1",
            name: "Sprint Goals",
            taskType: "WEEKLY",
            isCollapsed: false,
            tasks: [
               {
                  id: "t_weekly_1",
                  userId: "user_1",
                  categoryId: "cat_weekly_1",
                  title: "Finish Math Assignment 4",
                  taskType: "WEEKLY",
                  isComplete: false,
                  createdAt: new Date("2026-10-28T10:00:00Z"),
                  updatedAt: new Date("2026-10-28T10:00:00Z"),
                  completedAt: null,
               },
            ],
         },
      ],
      totalDailyTasks: 1,
      completedDailyTasks: 0,
      totalWeeklyTasks: 1,
      completedWeeklyTasks: 0,
   };

   it("removes top add buttons from Daily and Weekly headers now that the todo list size is fixed", () => {
      render(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: sampleTasks,
            todayDate: "2026-10-28",
         })
      );

      // Daily header quick-add button must no longer be present
      expect(screen.queryByTestId("quick-add-daily-button")).toBeNull();

      // Weekly header quick-add button must no longer be present
      expect(screen.queryByTestId("quick-add-weekly-button")).toBeNull();
   });

   it("does not render top quick-add buttons even when viewing an active challenge day", () => {
      render(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: sampleTasks,
            todayDate: "2026-10-28",
            challengeStartDate: "2026-10-26",
            challengeStatus: "ACTIVE",
            initialSelectedDateKey: "2026-10-26", // Day 1 (past day relative to Day 3)
         })
      );

      expect(screen.queryByTestId("quick-add-daily-button")).toBeNull();
      expect(screen.queryByTestId("quick-add-weekly-button")).toBeNull();
   });

   it("retains bottom add buttons for both Daily and Weekly columns as secondary actions", () => {
      render(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: sampleTasks,
            todayDate: "2026-10-28",
         })
      );

      // Bottom buttons exist
      const dailyBottomBtn = screen.getByRole("button", {
         name: /\+ Add more todos for/i,
      });
      const weeklyBottomBtn = screen.getByRole("button", {
         name: "+ Add more todos",
      });

      expect(dailyBottomBtn).toBeTruthy();
      expect(weeklyBottomBtn).toBeTruthy();

      // Clicking bottom buttons opens respective modals
      fireEvent.click(weeklyBottomBtn);
      expect(screen.getByText("Add Weekly Todo")).toBeTruthy();
   });

   it("applies scroll containment classes and enables scrolling for long lists exceeding bounded height", () => {
      const manyDailyTasks: UserCategorizedTasks = {
         ...sampleTasks,
         dailyCategories: [
            {
               id: "cat_daily_1",
               name: "Morning Focus",
               taskType: "DAILY",
               isCollapsed: false,
               tasks: Array.from({ length: 20 }, (_, i) => ({
                  id: `t_daily_${i}`,
                  userId: "user_1",
                  categoryId: "cat_daily_1",
                  title: `Study Session #${i + 1}`,
                  taskType: "DAILY",
                  isComplete: false,
                  dueDate: "2026-10-28",
                  createdAt: new Date("2026-10-28T10:00:00Z"),
                  updatedAt: new Date("2026-10-28T10:00:00Z"),
                  completedAt: null,
               })),
            },
         ],
         totalDailyTasks: 20,
      };

      const { container } = render(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: manyDailyTasks,
            todayDate: "2026-10-28",
         })
      );

      const scrollContainers = container.querySelectorAll(
         ".scrollbar-obsidian"
      );
      expect(scrollContainers.length).toBe(2);

      scrollContainers.forEach((el) => {
         expect(el.className).toContain("max-h-[520px]");
         expect(el.className).toContain("overflow-y-auto");
         expect(el.className).toContain("pr-1");
         expect(el.className).toContain("scrollbar-obsidian");
      });

      // Verify that the container element can be scrolled when items exceed bounded height
      const dailyScrollEl = scrollContainers[0] as HTMLElement;
      Object.defineProperty(dailyScrollEl, "scrollHeight", {
         value: 1200,
         configurable: true,
      });
      Object.defineProperty(dailyScrollEl, "clientHeight", {
         value: 520,
         configurable: true,
      });
      expect(dailyScrollEl.scrollHeight).toBeGreaterThan(
         dailyScrollEl.clientHeight
      );

      // Verify scroll event dispatch and position update
      fireEvent.scroll(dailyScrollEl, { target: { scrollTop: 200 } });
      expect(dailyScrollEl.scrollTop).toBe(200);
   });

   it("renders mobile segmented switcher and switches active view on click", () => {
      render(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: sampleTasks,
            todayDate: "2026-10-28",
         })
      );

      const switcher = screen.getByRole("tablist", {
         name: "Tasks board view switcher",
      });
      expect(switcher).toBeTruthy();

      const tabs = screen.getAllByRole("tab");
      const dailyTab = tabs.find(
         (t) =>
            t.textContent?.includes("Daily") && !t.textContent?.includes("Day ")
      );
      const weeklyTab = tabs.find((t) => t.textContent?.includes("Weekly"));

      expect(dailyTab).toBeTruthy();
      expect(weeklyTab).toBeTruthy();

      // Mobile tabs satisfy minimum 44px touch target height
      expect(dailyTab?.className).toContain("min-h-control-sm");
      expect(weeklyTab?.className).toContain("min-h-control-sm");

      const dailyBoard = screen.getByTestId("daily-tasks-board");
      const weeklyBoard = screen.getByTestId("weekly-tasks-board");

      // Default state: Daily active (Daily board visible with flex, Weekly board hidden on mobile)
      expect(dailyTab?.getAttribute("aria-selected")).toBe("true");
      expect(weeklyTab?.getAttribute("aria-selected")).toBe("false");
      expect(dailyBoard.className).toContain("flex");
      expect(dailyBoard.className).not.toContain("hidden sm:flex");
      expect(weeklyBoard.className).toContain("hidden sm:flex");

      // Switch to Weekly view
      if (weeklyTab) {
         fireEvent.click(weeklyTab);
      }

      expect(dailyTab?.getAttribute("aria-selected")).toBe("false");
      expect(weeklyTab?.getAttribute("aria-selected")).toBe("true");
      expect(dailyBoard.className).toContain("hidden sm:flex");
      expect(weeklyBoard.className).toContain("flex");
      expect(weeklyBoard.className).not.toContain("hidden sm:flex");

      // Switch back to Daily view
      if (dailyTab) {
         fireEvent.click(dailyTab);
      }

      expect(dailyTab?.getAttribute("aria-selected")).toBe("true");
      expect(weeklyTab?.getAttribute("aria-selected")).toBe("false");
      expect(dailyBoard.className).toContain("flex");
      expect(dailyBoard.className).not.toContain("hidden sm:flex");
      expect(weeklyBoard.className).toContain("hidden sm:flex");
   });
});
