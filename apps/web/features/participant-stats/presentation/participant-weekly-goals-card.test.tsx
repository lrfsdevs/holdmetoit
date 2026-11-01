import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ParticipantWeeklyGoalsCard } from "./participant-weekly-goals-card";
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
});
