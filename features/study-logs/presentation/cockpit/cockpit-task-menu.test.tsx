import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskMenuItems, CategoryMenuItems } from "./cockpit-task-menu";
import type { TaskItem, CategoryGroup } from "./cockpit-tasks-section";
import type { ChallengeDayOption } from "@/features/study-logs/domain/challenge-day";

const MockItem = ({ children, ...props }: any) =>
   createElement("button", props, children);
const MockSeparator = (props: any) => createElement("hr", props);
const MockLabel = ({ children, ...props }: any) =>
   createElement("div", props, children);

describe("CockpitTaskMenu (KAN-18 / Issue #100)", () => {
   const mockDayOptions: ChallengeDayOption[] = [
      {
         dayNumber: 1,
         dateKey: "2026-10-01",
         label: "Day 1 (Thu, Oct 1)",
         shortLabel: "D1",
         weekday: "Thu",
         isPast: true,
         isToday: false,
         isYesterday: false,
         isFuture: false,
      },
      {
         dayNumber: 2,
         dateKey: "2026-10-02",
         label: "Day 2 (Fri, Oct 2)",
         shortLabel: "D2",
         weekday: "Fri",
         isPast: false,
         isToday: true,
         isYesterday: false,
         isFuture: false,
      },
      {
         dayNumber: 3,
         dateKey: "2026-10-03",
         label: "Day 3 (Sat, Oct 3)",
         shortLabel: "D3",
         weekday: "Sat",
         isPast: false,
         isToday: false,
         isYesterday: false,
         isFuture: true,
      },
   ];

   const mockTask: TaskItem = {
      id: "t_test_1",
      text: "Finish Chapter 4 Notes",
      completed: false,
      status: "TODO",
      dueDate: "2026-10-02",
      createdAt: "2026-10-02T10:00:00Z",
   };

   const mockCategory: CategoryGroup = {
      id: "cat_test_1",
      name: "Core Subjects",
      isCollapsed: false,
      tasks: [mockTask],
   };

   it("renders TaskMenuItems with incomplete task options and move-to-day", () => {
      const html = renderToStaticMarkup(
         createElement(TaskMenuItems, {
            task: mockTask,
            catIdx: 0,
            taskType: "daily",
            effectiveTodayDate: "2026-10-02",
            dayOptions: mockDayOptions,
            selectedDateKey: "2026-10-02",
            onSetStatus: vi.fn(),
            onMoveToDay: vi.fn(),
            onEditTask: vi.fn(),
            onDeleteTask: vi.fn(),
            Item: MockItem,
            Separator: MockSeparator,
            Label: MockLabel,
         })
      );

      expect(html).toContain("Mark as Completed");
      expect(html).toContain("Status");
      expect(html).toContain("In Progress");
      expect(html).toContain("Completed");
      expect(html).toContain("Crossed Out");
      expect(html).toContain("Move to Day");
      expect(html).toContain("Move to D3");
      expect(html).toContain("Edit Task");
      expect(html).toContain("Delete Task");
      expect(html).not.toContain("Delete Task (Locked)");
   });

   it("renders TaskMenuItems with completed task options", () => {
      const completedTask: TaskItem = {
         ...mockTask,
         completed: true,
         status: "COMPLETED",
      };

      const html = renderToStaticMarkup(
         createElement(TaskMenuItems, {
            task: completedTask,
            catIdx: 0,
            taskType: "daily",
            effectiveTodayDate: "2026-10-02",
            dayOptions: mockDayOptions,
            selectedDateKey: "2026-10-02",
            onSetStatus: vi.fn(),
            onMoveToDay: vi.fn(),
            onEditTask: vi.fn(),
            onDeleteTask: vi.fn(),
            Item: MockItem,
            Separator: MockSeparator,
            Label: MockLabel,
         })
      );

      expect(html).toContain("Reset to To-Do");
      expect(html).toContain("Edit Task");
      expect(html).toContain("Delete Task");
   });

   it("locks deletion when task is on a past challenge day", () => {
      const pastTask: TaskItem = {
         ...mockTask,
         dueDate: "2026-10-01",
         createdAt: "2026-10-01T08:00:00Z",
      };

      const html = renderToStaticMarkup(
         createElement(TaskMenuItems, {
            task: pastTask,
            catIdx: 0,
            taskType: "daily",
            effectiveTodayDate: "2026-10-02",
            dayOptions: mockDayOptions,
            selectedDateKey: "2026-10-01",
            onSetStatus: vi.fn(),
            onMoveToDay: vi.fn(),
            onEditTask: vi.fn(),
            onDeleteTask: vi.fn(),
            Item: MockItem,
            Separator: MockSeparator,
            Label: MockLabel,
         })
      );

      expect(html).toContain("Delete Task (Locked)");
   });

   it("renders CategoryMenuItems with Move Category, Rename, and Delete", () => {
      const html = renderToStaticMarkup(
         createElement(CategoryMenuItems, {
            cat: mockCategory,
            catType: "daily",
            dailyCategories: [mockCategory],
            weeklyCategories: [],
            selectedDateKey: "2026-10-02",
            effectiveTodayDate: "2026-10-02",
            dayOptions: mockDayOptions,
            onMoveCategoryToDay: vi.fn(),
            onRenameCategory: vi.fn(),
            onDeleteCategory: vi.fn(),
            Item: MockItem,
            Separator: MockSeparator,
            Label: MockLabel,
         })
      );

      expect(html).toContain("Move Category to Day");
      expect(html).toContain("Move to D3");
      expect(html).toContain("Rename Category");
      expect(html).toContain("Delete Category");
      expect(html).not.toContain("Delete Category (Locked)");
   });

   it("locks delete category option when category contains past tasks", () => {
      const categoryWithPastTask: CategoryGroup = {
         ...mockCategory,
         tasks: [
            {
               id: "t_past",
               text: "Past Task",
               completed: true,
               dueDate: "2026-10-01",
               createdAt: "2026-10-01T00:00:00Z",
            },
         ],
      };

      const html = renderToStaticMarkup(
         createElement(CategoryMenuItems, {
            cat: categoryWithPastTask,
            catType: "daily",
            dailyCategories: [categoryWithPastTask],
            weeklyCategories: [],
            selectedDateKey: "2026-10-02",
            effectiveTodayDate: "2026-10-02",
            dayOptions: mockDayOptions,
            onMoveCategoryToDay: vi.fn(),
            onRenameCategory: vi.fn(),
            onDeleteCategory: vi.fn(),
            Item: MockItem,
            Separator: MockSeparator,
            Label: MockLabel,
         })
      );

      expect(html).toContain("Delete Category (Locked)");
   });
});
