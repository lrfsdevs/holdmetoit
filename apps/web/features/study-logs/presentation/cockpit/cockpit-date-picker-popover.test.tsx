// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import {
   CockpitDatePickerPopover,
   CockpitWeekNavigator,
} from "./cockpit-date-picker-popover";

afterEach(cleanup);

describe("CockpitDatePickerPopover", () => {
   const defaultProps = {
      selectedDateKey: "2026-10-21",
      todayDateKey: "2026-10-25",
      weekRangeLabel: "Oct 19 – 25",
      onSelectDate: vi.fn(),
      activeWeekDateKeys: [
         "2026-10-19",
         "2026-10-20",
         "2026-10-21",
         "2026-10-22",
         "2026-10-23",
         "2026-10-24",
         "2026-10-25",
      ],
   };

   it("renders week range label and trigger button", () => {
      render(<CockpitDatePickerPopover {...defaultProps} />);

      const trigger = screen.getByRole("button", {
         name: /Current week: Oct 19 – 25/i,
      });
      expect(trigger).toBeTruthy();
      expect(screen.getByText("Oct 19 – 25")).toBeTruthy();
   });

   it("opens popover with month header and days when clicked", () => {
      render(<CockpitDatePickerPopover {...defaultProps} />);

      const trigger = screen.getByRole("button", {
         name: /Current week: Oct 19 – 25/i,
      });
      fireEvent.click(trigger);

      expect(screen.getByText("October 2026")).toBeTruthy();
      expect(screen.getByText("Mo")).toBeTruthy();
      expect(screen.getByText("Su")).toBeTruthy();
      expect(
         screen.getByRole("button", { name: "Select 2026-10-21" })
      ).toBeTruthy();
   });

   it("navigates months when clicking previous and next month buttons", () => {
      render(<CockpitDatePickerPopover {...defaultProps} />);

      const trigger = screen.getByRole("button", {
         name: /Current week: Oct 19 – 25/i,
      });
      fireEvent.click(trigger);

      expect(screen.getByText("October 2026")).toBeTruthy();

      const prevBtn = screen.getByRole("button", { name: "Previous month" });
      fireEvent.click(prevBtn);
      expect(screen.getByText("September 2026")).toBeTruthy();

      const nextBtn = screen.getByRole("button", { name: "Next month" });
      fireEvent.click(nextBtn);
      expect(screen.getByText("October 2026")).toBeTruthy();
   });

   it("calls onSelectDate when a date cell is clicked", () => {
      const onSelectDate = vi.fn();
      render(
         <CockpitDatePickerPopover
            {...defaultProps}
            onSelectDate={onSelectDate}
         />
      );

      const trigger = screen.getByRole("button", {
         name: /Current week: Oct 19 – 25/i,
      });
      fireEvent.click(trigger);

      const dayBtn = screen.getByRole("button", { name: "Select 2026-10-15" });
      fireEvent.click(dayBtn);

      expect(onSelectDate).toHaveBeenCalledWith("2026-10-15");
   });

   it("calls onSelectDate with todayDateKey when Jump to Today is clicked", () => {
      const onSelectDate = vi.fn();
      render(
         <CockpitDatePickerPopover
            {...defaultProps}
            onSelectDate={onSelectDate}
         />
      );

      const trigger = screen.getByRole("button", {
         name: /Current week: Oct 19 – 25/i,
      });
      fireEvent.click(trigger);

      const jumpBtn = screen.getByRole("button", { name: "Jump to Today" });
      fireEvent.click(jumpBtn);

      expect(onSelectDate).toHaveBeenCalledWith("2026-10-25");
   });
});

describe("CockpitWeekNavigator", () => {
   it("renders previous week, trigger, and next week buttons and responds to clicks", () => {
      const onPreviousWeek = vi.fn();
      const onNextWeek = vi.fn();
      const onSelectDate = vi.fn();

      render(
         <CockpitWeekNavigator
            selectedDateKey="2026-10-21"
            todayDateKey="2026-10-25"
            weekRangeLabel="Oct 19 – 25"
            onPreviousWeek={onPreviousWeek}
            onNextWeek={onNextWeek}
            onSelectDate={onSelectDate}
         />
      );

      const prevWeekBtn = screen.getByRole("button", {
         name: "Previous week",
      });
      const nextWeekBtn = screen.getByRole("button", { name: "Next week" });

      expect(prevWeekBtn).toBeTruthy();
      expect(nextWeekBtn).toBeTruthy();

      fireEvent.click(prevWeekBtn);
      expect(onPreviousWeek).toHaveBeenCalledTimes(1);

      fireEvent.click(nextWeekBtn);
      expect(onNextWeek).toHaveBeenCalledTimes(1);
   });

   it("disables buttons when disabled prop is true", () => {
      render(
         <CockpitWeekNavigator
            selectedDateKey="2026-10-21"
            todayDateKey="2026-10-25"
            weekRangeLabel="Oct 19 – 25"
            onPreviousWeek={vi.fn()}
            onNextWeek={vi.fn()}
            onSelectDate={vi.fn()}
            disabled={true}
         />
      );

      expect(
         (
            screen.getByRole("button", {
               name: "Previous week",
            }) as HTMLButtonElement
         ).disabled
      ).toBe(true);
      expect(
         (
            screen.getByRole("button", {
               name: "Next week",
            }) as HTMLButtonElement
         ).disabled
      ).toBe(true);
      expect(
         (
            screen.getByRole("button", {
               name: /Current week: Oct 19 – 25/i,
            }) as HTMLButtonElement
         ).disabled
      ).toBe(true);
   });

   it("renders Today snap button inside the navigator when showToday is true", () => {
      const onJumpToToday = vi.fn();
      render(
         <CockpitWeekNavigator
            selectedDateKey="2026-10-21"
            todayDateKey="2026-10-25"
            weekRangeLabel="Oct 19 – 25"
            onPreviousWeek={vi.fn()}
            onNextWeek={vi.fn()}
            onSelectDate={vi.fn()}
            showToday={true}
            onJumpToToday={onJumpToToday}
         />
      );

      const todayBtn = screen.getByRole("button", { name: "Today" });
      expect(todayBtn).toBeTruthy();
      fireEvent.click(todayBtn);
      expect(onJumpToToday).toHaveBeenCalledTimes(1);
   });
});
