// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
   DEFAULT_WEEKLY_GOALS_PAGE_SIZE,
   ParticipantWeeklyGoalsCard,
} from "./participant-weekly-goals-card";
import type { ParticipantWeeklyGoalItem } from "../domain/participant-stats.types";

describe("ParticipantWeeklyGoalsCard", () => {
   const sampleGoals: ParticipantWeeklyGoalItem[] = [
      {
         id: "task_1",
         title: "Read Chapter 4 of Organic Chemistry",
         status: "COMPLETED",
         isComplete: true,
         completedAt: "2026-10-03T14:30:00.000Z",
      },
      {
         id: "task_2",
         title: "Complete 50 Practice Problems on LeetCode",
         status: "TODO",
         isComplete: false,
         completedAt: null,
      },
      {
         id: "task_3",
         title: "Review Flashcards for Biology Exam",
         status: "IN_PROGRESS",
         isComplete: false,
         completedAt: null,
      },
   ];

   const createGoals = (count: number): ParticipantWeeklyGoalItem[] =>
      Array.from({ length: count }, (_, i) => ({
         id: `goal_${i + 1}`,
         title: `Goal Item ${i + 1}`,
         status: i % 2 === 0 ? "COMPLETED" : "TODO",
         isComplete: i % 2 === 0,
         completedAt: i % 2 === 0 ? "2026-10-03T12:00:00.000Z" : null,
      }));

   it("exports DEFAULT_WEEKLY_GOALS_PAGE_SIZE as 5", () => {
      expect(DEFAULT_WEEKLY_GOALS_PAGE_SIZE).toBe(5);
   });

   it("renders card title and completion ratio pill for declared goals", () => {
      const html = renderToStaticMarkup(
         <ParticipantWeeklyGoalsCard
            weeklyGoals={sampleGoals}
            completedGoalsCount={1}
            totalGoalsCount={3}
         />
      );

      expect(html).toContain("Challenge Weekly Goals");
      expect(html).toContain("1/3 Goals Completed");
      expect(html).toContain("Read Chapter 4 of Organic Chemistry");
      expect(html).toContain("Complete 50 Practice Problems on LeetCode");
      expect(html).toContain("Review Flashcards for Biology Exam");
      expect(html).toContain("Done");
   });

   it("renders on-theme empty state when no challenge goals were declared", () => {
      const html = renderToStaticMarkup(
         <ParticipantWeeklyGoalsCard
            weeklyGoals={[]}
            completedGoalsCount={0}
            totalGoalsCount={0}
         />
      );

      expect(html).toContain("Challenge Weekly Goals");
      expect(html).toContain("0/0 Goals Completed");
      expect(html).toContain("No Challenge Goals Declared");
      expect(html).toContain(
         "This scholar has not declared any challenge-linked weekly goals for this event."
      );
      expect(html).not.toContain("weekly-goals-list");
   });

   it("renders success-styled completion badge when 100% of goals are completed", () => {
      const completedGoals: ParticipantWeeklyGoalItem[] = [
         {
            id: "task_1",
            title: "Goal A",
            status: "COMPLETED",
            isComplete: true,
            completedAt: "2026-10-02T10:00:00.000Z",
         },
         {
            id: "task_2",
            title: "Goal B",
            status: "COMPLETED",
            isComplete: true,
            completedAt: "2026-10-03T11:00:00.000Z",
         },
      ];

      const html = renderToStaticMarkup(
         <ParticipantWeeklyGoalsCard
            weeklyGoals={completedGoals}
            completedGoalsCount={2}
            totalGoalsCount={2}
         />
      );

      expect(html).toContain("2/2 Goals Completed");
      expect(html).toContain("bg-feedback-success-bg");
      expect(html).toContain("text-feedback-success-text");
   });

   it("renders neutral completion badge when goals are partially completed", () => {
      const html = renderToStaticMarkup(
         <ParticipantWeeklyGoalsCard
            weeklyGoals={sampleGoals}
            completedGoalsCount={1}
            totalGoalsCount={3}
         />
      );

      expect(html).toContain("1/3 Goals Completed");
      expect(html).toContain("bg-surface-elevated");
      expect(html).toContain("text-text-secondary");
   });

   it("renders strikethrough and emerald check icons for completed goals, neutral circle for pending", () => {
      const html = renderToStaticMarkup(
         <ParticipantWeeklyGoalsCard
            weeklyGoals={sampleGoals}
            completedGoalsCount={1}
            totalGoalsCount={3}
         />
      );

      expect(html).toContain("line-through");
      expect(html).toContain("text-feedback-success");
      expect(html).toContain("text-text-tertiary");
   });

   it("does not render pagination navigation when goals count is within pageSize", () => {
      const html = renderToStaticMarkup(
         <ParticipantWeeklyGoalsCard
            weeklyGoals={sampleGoals}
            completedGoalsCount={1}
            totalGoalsCount={3}
            pageSize={5}
         />
      );

      expect(html).not.toContain("Pagination Navigation");
      expect(html).not.toContain("Showing");
   });

   it("paginates goals and renders pagination controls when goals count exceeds pageSize", () => {
      const twelveGoals = createGoals(12);
      const html = renderToStaticMarkup(
         <ParticipantWeeklyGoalsCard
            weeklyGoals={twelveGoals}
            completedGoalsCount={6}
            totalGoalsCount={12}
            pageSize={5}
         />
      );

      // Page 1 displays first 5 items
      expect(html).toContain("Goal Item 1");
      expect(html).toContain("Goal Item 5");
      expect(html).not.toContain("Goal Item 6");

      // Pagination controls are rendered
      expect(html).toContain("Pagination Navigation");
      expect(html).toContain("Showing");
      expect(html).toContain("1–5");
      expect(html).toContain("12");
      expect(html).toContain("goals");
   });

   it("allows interactive navigation across pages and updates visible goals", () => {
      const twelveGoals = createGoals(12);
      render(
         <ParticipantWeeklyGoalsCard
            weeklyGoals={twelveGoals}
            completedGoalsCount={6}
            totalGoalsCount={12}
            pageSize={5}
         />
      );

      // Initially on page 1 (items 1–5 visible)
      expect(screen.getByText("Goal Item 1")).toBeDefined();
      expect(screen.getByText("Goal Item 5")).toBeDefined();
      expect(screen.queryByText("Goal Item 6")).toBeNull();

      // Click "Next" button
      const nextButton = screen.getByLabelText("Next page");
      fireEvent.click(nextButton);

      // Now on page 2 (items 6–10 visible)
      expect(screen.queryByText("Goal Item 1")).toBeNull();
      expect(screen.getByText("Goal Item 6")).toBeDefined();
      expect(screen.getByText("Goal Item 10")).toBeDefined();
      expect(screen.queryByText("Goal Item 11")).toBeNull();

      // Click "Next" again
      fireEvent.click(nextButton);

      // Now on page 3 (items 11–12 visible)
      expect(screen.queryByText("Goal Item 10")).toBeNull();
      expect(screen.getByText("Goal Item 11")).toBeDefined();
      expect(screen.getByText("Goal Item 12")).toBeDefined();

      // Click "Prev" button
      const prevButton = screen.getByLabelText("Previous page");
      fireEvent.click(prevButton);

      // Back on page 2
      expect(screen.getByText("Goal Item 6")).toBeDefined();

      cleanup();
   });

   it("resets to page 1 when the weekly goals list changes", () => {
      const setA = createGoals(12);
      const setB = [
         {
            id: "unique_new_1",
            title: "Unique New Goal",
            status: "TODO",
            isComplete: false,
            completedAt: null,
         },
      ];

      const { rerender } = render(
         <ParticipantWeeklyGoalsCard
            weeklyGoals={setA}
            completedGoalsCount={6}
            totalGoalsCount={12}
            pageSize={5}
         />
      );

      // Go to page 2
      const nextButton = screen.getByLabelText("Next page");
      fireEvent.click(nextButton);
      expect(screen.getByText("Goal Item 6")).toBeDefined();

      // Rerender with different goals
      rerender(
         <ParticipantWeeklyGoalsCard
            weeklyGoals={setB}
            completedGoalsCount={0}
            totalGoalsCount={1}
            pageSize={5}
         />
      );

      expect(screen.getByText("Unique New Goal")).toBeDefined();
      expect(screen.queryByText("Goal Item 6")).toBeNull();

      cleanup();
   });
});
