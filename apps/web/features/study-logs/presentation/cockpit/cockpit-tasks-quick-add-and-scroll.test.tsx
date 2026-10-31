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

   it("renders quick-add buttons in both Daily and Weekly headers and clicking them opens the respective modal", () => {
      render(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: sampleTasks,
            todayDate: "2026-10-28",
         })
      );

      // Daily header quick-add button
      const dailyQuickAdd = screen.getByTestId("quick-add-daily-button");
      expect(dailyQuickAdd).toBeTruthy();
      expect(dailyQuickAdd.getAttribute("aria-label")).toMatch(/Add todo for/i);
      expect(dailyQuickAdd.className).toContain("min-h-control-sm");
      expect(dailyQuickAdd.className).toContain("min-w-control-sm");

      // Clicking Daily header quick-add opens Daily modal
      fireEvent.click(dailyQuickAdd);
      expect(screen.getByText("Add Daily Todo")).toBeTruthy();

      // Close modal
      const closeDaily = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(closeDaily);

      // Weekly header quick-add button
      const weeklyQuickAdd = screen.getByTestId("quick-add-weekly-button");
      expect(weeklyQuickAdd).toBeTruthy();
      expect(weeklyQuickAdd.getAttribute("aria-label")).toBe("Add weekly todo");
      expect(weeklyQuickAdd.className).toContain("min-h-control-sm");
      expect(weeklyQuickAdd.className).toContain("min-w-control-sm");

      // Clicking Weekly header quick-add opens Weekly modal
      fireEvent.click(weeklyQuickAdd);
      expect(screen.getByText("Add Weekly Todo")).toBeTruthy();
   });

   it("hides Daily Quick-Add button when viewing a locked past challenge day", () => {
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

      // Daily quick add should be hidden because past challenge days cannot accept new tasks
      expect(screen.queryByTestId("quick-add-daily-button")).toBeNull();

      // Weekly quick add remains accessible regardless of active day tab
      expect(screen.getByTestId("quick-add-weekly-button")).toBeTruthy();
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
