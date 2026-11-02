// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
   cleanup,
   fireEvent,
   render,
   screen,
   within,
} from "@testing-library/react";
import React from "react";
import { CockpitTasksSection } from "./cockpit-tasks-section";
import type { UserCategorizedTasks } from "@/features/tasks/domain/task.types";

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

      const dailyBoard = screen.getByTestId("daily-tasks-board");
      // Initially on current week (Oct 19 – 25)
      expect(within(dailyBoard).getByText("Oct 19 – 25")).toBeTruthy();

      const prevWeekBtn = within(dailyBoard).getByRole("button", {
         name: "Previous week",
      });
      const nextWeekBtn = within(dailyBoard).getByRole("button", {
         name: "Next week",
      });

      // Click Previous week: moves to Oct 12 – 18
      fireEvent.click(prevWeekBtn);
      expect(within(dailyBoard).getByText("Oct 12 – 18")).toBeTruthy();

      // Today snap button should be displayed since we paged away from today
      const todayBtn = within(dailyBoard).getByRole("button", {
         name: "Today",
      });
      expect(todayBtn).toBeTruthy();

      // Click Next week: moves back to Oct 19 – 25
      fireEvent.click(nextWeekBtn);
      expect(within(dailyBoard).getByText("Oct 19 – 25")).toBeTruthy();

      // Click Next week again: moves to Oct 26 – Nov 1
      fireEvent.click(nextWeekBtn);
      expect(within(dailyBoard).getByText("Oct 26 – Nov 1")).toBeTruthy();
   });

   it("snaps back to current week and selects today when Today button is clicked", () => {
      render(
         <CockpitTasksSection
            isLoggedIn={true}
            userTasks={emptyTasks}
            todayDate="2026-10-25"
         />
      );

      const dailyBoard = screen.getByTestId("daily-tasks-board");
      // Page forward 2 weeks
      const nextWeekBtn = within(dailyBoard).getByRole("button", {
         name: "Next week",
      });
      fireEvent.click(nextWeekBtn);
      fireEvent.click(nextWeekBtn);

      expect(within(dailyBoard).getByText("Nov 2 – 8")).toBeTruthy();

      // Click Today snap button
      const todayBtn = within(dailyBoard).getByRole("button", {
         name: "Today",
      });
      fireEvent.click(todayBtn);

      // Snapped back to current week
      expect(within(dailyBoard).getByText("Oct 19 – 25")).toBeTruthy();

      // Today button should disappear once we are back on today
      expect(
         within(dailyBoard).queryByRole("button", { name: "Today" })
      ).toBeNull();
   });

   it("allows jumping to any arbitrary date and week via popover date picker", () => {
      render(
         <CockpitTasksSection
            isLoggedIn={true}
            userTasks={emptyTasks}
            todayDate="2026-10-25"
         />
      );

      const dailyBoard = screen.getByTestId("daily-tasks-board");
      // Open date picker popover
      const trigger = within(dailyBoard).getByRole("button", {
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
      expect(within(dailyBoard).getByText("Nov 9 – 15")).toBeTruthy();

      // Today snap button should be displayed
      const todayBtn = within(dailyBoard).getByRole("button", {
         name: "Today",
      });
      expect(todayBtn).toBeTruthy();

      // Clicking Today returns to Oct 19 – 25
      fireEvent.click(todayBtn);
      expect(within(dailyBoard).getByText("Oct 19 – 25")).toBeTruthy();
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

         const dailyBoard = screen.getByTestId("daily-tasks-board");
         // On current week (Oct 19 – 25), today (Oct 25) is unlocked
         expect(within(dailyBoard).queryByText("Locked")).toBeNull();

         // Page back to the previous week (Oct 12 – 18, which was the challenge week)
         const prevWeekBtn = within(dailyBoard).getByRole("button", {
            name: "Previous week",
         });
         fireEvent.click(prevWeekBtn);
         expect(within(dailyBoard).getByText("Oct 12 – 18")).toBeTruthy();

         // The daily todos for that past challenge week must now be locked!
         expect(within(dailyBoard).getByText("Locked")).toBeTruthy();
         expect(
            within(dailyBoard).getByText(
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

      const dailyBoard = screen.getByTestId("daily-tasks-board");
      // Navigator visible during active challenge
      expect(within(dailyBoard).getByText("Oct 19 – 25")).toBeTruthy();
      expect(
         within(dailyBoard).getByRole("button", { name: "Previous week" })
      ).toBeTruthy();
      expect(
         within(dailyBoard).getByRole("button", { name: "Next week" })
      ).toBeTruthy();

      // On Day 3 (Wednesday Oct 21), Today button not initially shown
      expect(
         within(dailyBoard).queryByRole("button", { name: "Today" })
      ).toBeNull();

      // Navigate to previous week
      const prevWeekBtn = within(dailyBoard).getByRole("button", {
         name: "Previous week",
      });
      fireEvent.click(prevWeekBtn);

      // Now showing Oct 12 – 18
      expect(within(dailyBoard).getByText("Oct 12 – 18")).toBeTruthy();

      // Today button appears in CockpitWeekNavigator
      const todayBtn = within(dailyBoard).getByRole("button", {
         name: "Today",
      });
      expect(todayBtn).toBeTruthy();

      // Click Today button: snaps back to active challenge week
      fireEvent.click(todayBtn);
      expect(within(dailyBoard).getByText("Oct 19 – 25")).toBeTruthy();
   });

   it("shows current week dates in CockpitWeekNavigator during active challenges with non-7 total days (e.g. 6-day challenge) (#196, KAN-65)", () => {
      render(
         <CockpitTasksSection
            isLoggedIn={true}
            userTasks={emptyTasks}
            challengeStartDate="2026-10-27"
            totalChallengeDays={6}
            challengeStatus="ACTIVE"
            todayDate="2026-10-28"
         />
      );

      const dailyBoard = screen.getByTestId("daily-tasks-board");
      // Navigator must display the current calendar week dates (Oct 26 – Nov 1) rather than an empty label
      expect(within(dailyBoard).getByText("Oct 26 – Nov 1")).toBeTruthy();
      expect(
         within(dailyBoard).getByRole("button", {
            name: /Current week: Oct 26 – Nov 1\. Click to pick date/i,
         })
      ).toBeTruthy();

      // Page back to previous week
      const prevWeekBtn = within(dailyBoard).getByRole("button", {
         name: "Previous week",
      });
      fireEvent.click(prevWeekBtn);
      expect(within(dailyBoard).getByText("Oct 19 – 25")).toBeTruthy();

      // Click Today button to return to current week
      const todayBtn = within(dailyBoard).getByRole("button", {
         name: "Today",
      });
      fireEvent.click(todayBtn);
      expect(within(dailyBoard).getByText("Oct 26 – Nov 1")).toBeTruthy();
   });

   describe("Weekly Todos Week Navigation (adapted for weekly system)", () => {
      it("renders week navigator in Weekly Todos and pages backwards and forwards", () => {
         render(
            <CockpitTasksSection
               isLoggedIn={true}
               userTasks={emptyTasks}
               todayDate="2026-10-25"
            />
         );

         const weeklyBoard = screen.getByTestId("weekly-tasks-board");
         expect(within(weeklyBoard).getByText("Oct 19 – 25")).toBeTruthy();

         const prevWeekBtn = within(weeklyBoard).getByRole("button", {
            name: /Previous week for weekly todos/i,
         });
         const nextWeekBtn = within(weeklyBoard).getByRole("button", {
            name: /Next week for weekly todos/i,
         });

         // Click Previous week: moves to Oct 12 – 18
         fireEvent.click(prevWeekBtn);
         expect(within(weeklyBoard).getByText("Oct 12 – 18")).toBeTruthy();

         // 'This Week' button should appear (adapted from Daily's 'Today')
         const thisWeekBtn = within(weeklyBoard).getByRole("button", {
            name: /This week/i,
         });
         expect(thisWeekBtn).toBeTruthy();

         // Click 'This Week' button: snaps back to current week
         fireEvent.click(thisWeekBtn);
         expect(within(weeklyBoard).getByText("Oct 19 – 25")).toBeTruthy();
         expect(
            within(weeklyBoard).queryByRole("button", { name: /This week/i })
         ).toBeNull();
      });

      it("allows picking a week via popover in Weekly Todos with weekly adaptations", () => {
         render(
            <CockpitTasksSection
               isLoggedIn={true}
               userTasks={emptyTasks}
               todayDate="2026-10-25"
            />
         );

         const weeklyBoard = screen.getByTestId("weekly-tasks-board");
         const trigger = within(weeklyBoard).getByRole("button", {
            name: /Current week: Oct 19 – 25\. Click to pick week/i,
         });
         fireEvent.click(trigger);

         // Popover opens
         expect(screen.getByText("October 2026")).toBeTruthy();
         // Footer button says Jump to This Week
         const jumpBtn = screen.getByRole("button", {
            name: /Jump to This Week/i,
         });
         expect(jumpBtn).toBeTruthy();

         // Selecting any day in another week selects that week
         const dayCell = screen.getByRole("button", {
            name: "Select 2026-10-08",
         });
         fireEvent.click(dayCell);

         expect(within(weeklyBoard).getByText("Oct 5 – 11")).toBeTruthy();
      });
   });
});
