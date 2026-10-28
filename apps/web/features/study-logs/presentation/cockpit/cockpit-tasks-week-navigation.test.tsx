// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { CockpitTasksSection } from "./cockpit-tasks-section";
import type { UserCategorizedTasks } from "@/features/tasks/domain/task.types";

vi.mock("@/features/tasks/api/task.actions", () => ({
   createTaskAction: vi.fn(),
   deleteTaskAction: vi.fn(),
   toggleTaskAction: vi.fn(),
   updateTaskAction: vi.fn(),
   updateCategoryAction: vi.fn(),
   deleteCategoryAction: vi.fn(),
}));

afterEach(cleanup);

describe("CockpitTasksSection Interactive Week Navigation (GH #184 / KAN-60)", () => {
   const emptyTasks: UserCategorizedTasks = {
      categories: [],
      dailyCategories: [],
      weeklyCategories: [],
      totalDailyTasks: 0,
      completedDailyTasks: 0,
      totalWeeklyTasks: 0,
      completedWeeklyTasks: 0,
   };

   it("pages weeks backwards and forwards when chevron buttons are clicked", () => {
      render(
         <CockpitTasksSection
            isLoggedIn={true}
            userTasks={emptyTasks}
            todayDate="2026-10-25"
         />
      );

      // Initially on current week (Oct 19 – 25)
      expect(screen.getByText("Oct 19 – 25")).toBeTruthy();

      const prevWeekBtn = screen.getByRole("button", { name: "Previous week" });
      const nextWeekBtn = screen.getByRole("button", { name: "Next week" });

      // Click Previous week: moves to Oct 12 – 18
      fireEvent.click(prevWeekBtn);
      expect(screen.getByText("Oct 12 – 18")).toBeTruthy();

      // Today snap button should be displayed since we paged away from today
      const todayBtn = screen.getByRole("button", { name: "Today" });
      expect(todayBtn).toBeTruthy();

      // Click Next week: moves back to Oct 19 – 25
      fireEvent.click(nextWeekBtn);
      expect(screen.getByText("Oct 19 – 25")).toBeTruthy();

      // Click Next week again: moves to Oct 26 – Nov 1
      fireEvent.click(nextWeekBtn);
      expect(screen.getByText("Oct 26 – Nov 1")).toBeTruthy();
   });

   it("snaps back to current week and selects today when Today button is clicked", () => {
      render(
         <CockpitTasksSection
            isLoggedIn={true}
            userTasks={emptyTasks}
            todayDate="2026-10-25"
         />
      );

      // Page forward 2 weeks
      const nextWeekBtn = screen.getByRole("button", { name: "Next week" });
      fireEvent.click(nextWeekBtn);
      fireEvent.click(nextWeekBtn);

      expect(screen.getByText("Nov 2 – 8")).toBeTruthy();

      // Click Today snap button
      const todayBtn = screen.getByRole("button", { name: "Today" });
      fireEvent.click(todayBtn);

      // Snapped back to current week
      expect(screen.getByText("Oct 19 – 25")).toBeTruthy();

      // Today button should disappear once we are back on today
      expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
   });

   it("allows jumping to any arbitrary date and week via popover date picker", () => {
      render(
         <CockpitTasksSection
            isLoggedIn={true}
            userTasks={emptyTasks}
            todayDate="2026-10-25"
         />
      );

      // Open date picker popover
      const trigger = screen.getByRole("button", {
         name: /Current week: Oct 19 – 25/i,
      });
      fireEvent.click(trigger);

      // Month header visible
      expect(screen.getByText("October 2026")).toBeTruthy();

      // Click date Nov 12 by first navigating to November
      const nextMonthBtn = screen.getByRole("button", { name: "Next month" });
      fireEvent.click(nextMonthBtn);
      expect(screen.getByText("November 2026")).toBeTruthy();

      const dayCell = screen.getByRole("button", { name: "Select 2026-11-12" });
      fireEvent.click(dayCell);

      // Week range should now be Nov 9 – 15
      expect(screen.getByText("Nov 9 – 15")).toBeTruthy();

      // Today snap button should be displayed
      const todayBtn = screen.getByRole("button", { name: "Today" });
      expect(todayBtn).toBeTruthy();

      // Clicking Today returns to Oct 19 – 25
      fireEvent.click(todayBtn);
      expect(screen.getByText("Oct 19 – 25")).toBeTruthy();
   });

   it("locks daily todos for a previous challenge week when navigated back from the new week", () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));

      try {
         render(
            <CockpitTasksSection
               isLoggedIn={true}
               userTasks={emptyTasks}
               challengeStartDate="2026-10-12"
               totalChallengeDays={7}
               challengeStatus="COMPLETED"
               todayDate="2026-10-25"
            />
         );

         // On current week (Oct 19 – 25), today (Oct 25) is unlocked
         expect(screen.queryByText("Locked")).toBeNull();

         // Page back to the previous week (Oct 12 – 18, which was the challenge week)
         const prevWeekBtn = screen.getByRole("button", {
            name: "Previous week",
         });
         fireEvent.click(prevWeekBtn);
         expect(screen.getByText("Oct 12 – 18")).toBeTruthy();

         // The daily todos for that past challenge week must now be locked!
         expect(screen.getByText("Locked")).toBeTruthy();
         expect(
            screen.getByText(
               "This challenge day has passed. New tasks cannot be added to past days."
            )
         ).toBeTruthy();
      } finally {
         vi.useRealTimers();
      }
   });

   it("renders CockpitWeekNavigator and allows week paging during active challenges (#196, KAN-65)", () => {
      render(
         <CockpitTasksSection
            isLoggedIn={true}
            userTasks={emptyTasks}
            challengeStartDate="2026-10-19"
            totalChallengeDays={7}
            challengeStatus="ACTIVE"
            todayDate="2026-10-21"
         />
      );

      // Navigator visible during active challenge
      expect(screen.getByText("Oct 19 – 25")).toBeTruthy();
      expect(
         screen.getByRole("button", { name: "Previous week" })
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Next week" })).toBeTruthy();

      // On Day 3 (Wednesday Oct 21), Today button not initially shown
      expect(screen.queryByRole("button", { name: "Today" })).toBeNull();

      // Navigate to previous week
      const prevWeekBtn = screen.getByRole("button", { name: "Previous week" });
      fireEvent.click(prevWeekBtn);

      // Now showing Oct 12 – 18
      expect(screen.getByText("Oct 12 – 18")).toBeTruthy();

      // Today button appears in CockpitWeekNavigator
      const todayBtn = screen.getByRole("button", { name: "Today" });
      expect(todayBtn).toBeTruthy();

      // Click Today button: snaps back to active challenge week
      fireEvent.click(todayBtn);
      expect(screen.getByText("Oct 19 – 25")).toBeTruthy();
   });
});
