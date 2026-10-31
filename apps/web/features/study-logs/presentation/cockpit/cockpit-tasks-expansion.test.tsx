// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CockpitTasksSection } from "./cockpit-tasks-section";
import type { UserCategorizedTasks } from "@/features/tasks/domain/task.types";

afterEach(cleanup);

describe("CockpitTasksSection - Task Expansion & Collapse", () => {
   const longText =
      "This is a long task description that exceeds 45 characters and wraps to multiple lines in the cockpit board view.";

   const testTasks: UserCategorizedTasks = {
      categories: [
         {
            id: "cat_daily_1",
            userId: "user_1",
            name: "Daily Work",
            taskType: "DAILY",
            createdAt: new Date("2026-10-01T10:00:00Z"),
            updatedAt: new Date("2026-10-01T10:00:00Z"),
         },
         {
            id: "cat_weekly_1",
            userId: "user_1",
            name: "Weekly Goals",
            taskType: "WEEKLY",
            createdAt: new Date("2026-10-01T10:00:00Z"),
            updatedAt: new Date("2026-10-01T10:00:00Z"),
         },
      ],
      dailyCategories: [
         {
            id: "cat_daily_1",
            name: "Daily Work",
            taskType: "DAILY",
            isCollapsed: false,
            tasks: [
               {
                  id: "task_daily_long",
                  userId: "user_1",
                  categoryId: "cat_daily_1",
                  title: longText,
                  isComplete: false,
                  taskType: "DAILY",
                  isDeleted: false,
                  createdAt: new Date("2026-10-01T10:00:00Z"),
                  updatedAt: new Date("2026-10-01T10:00:00Z"),
                  completedAt: null,
               },
            ],
         },
      ],
      weeklyCategories: [
         {
            id: "cat_weekly_1",
            name: "Weekly Goals",
            taskType: "WEEKLY",
            isCollapsed: false,
            tasks: [
               {
                  id: "task_weekly_long",
                  userId: "user_1",
                  categoryId: "cat_weekly_1",
                  title: longText,
                  isComplete: false,
                  taskType: "WEEKLY",
                  isDeleted: false,
                  createdAt: new Date("2026-10-01T10:00:00Z"),
                  updatedAt: new Date("2026-10-01T10:00:00Z"),
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

   it("collapses with line-clamp-2 initially, expands with line-clamp-none on Show more, and shrinks back to line-clamp-2 on Show less", () => {
      render(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: testTasks,
            todayDate: "2026-10-04",
         })
      );

      // Verify buttons exist
      const showMoreButtons = screen.getAllByRole("button", {
         name: /show more/i,
      });
      expect(showMoreButtons.length).toBeGreaterThanOrEqual(1);

      const dailyBtn = showMoreButtons[0];
      const dailySpan = screen.getAllByText(longText)[0];

      // 1. Initial State: line-clamp-2, without block display conflict
      expect(dailySpan.className).toContain("line-clamp-2");
      expect(dailySpan.className).not.toContain("line-clamp-none");
      expect(dailySpan.className).not.toContain("block");

      // 2. Click Show more -> Expands with line-clamp-none
      fireEvent.click(dailyBtn);

      expect(dailySpan.className).toContain("line-clamp-none");
      expect(dailySpan.className).not.toContain("line-clamp-2");
      expect(dailyBtn.textContent).toContain("Show less");

      // 3. Click Show less -> Shrinks back to line-clamp-2
      fireEvent.click(dailyBtn);

      expect(dailySpan.className).toContain("line-clamp-2");
      expect(dailySpan.className).not.toContain("line-clamp-none");
      expect(dailySpan.className).not.toContain("block");
      expect(dailyBtn.textContent).toContain("Show more");
   });

   it("clicking Show more does not toggle the task completion state", () => {
      render(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: testTasks,
            todayDate: "2026-10-04",
         })
      );

      const showMoreButtons = screen.getAllByRole("button", {
         name: /show more/i,
      });
      const dailyBtn = showMoreButtons[0];
      const dailySpan = screen.getAllByText(longText)[0];

      // Initially not completed
      expect(dailySpan.className).not.toContain("line-through");

      // Click Show more
      fireEvent.click(dailyBtn);

      // Still not completed (expansion did not trigger checkbox toggle)
      expect(dailySpan.className).not.toContain("line-through");
   });
});
