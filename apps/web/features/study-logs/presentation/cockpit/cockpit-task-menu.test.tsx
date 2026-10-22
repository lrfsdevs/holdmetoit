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

   it("does NOT lock delete category option for weekly challenge categories even with tasks on past dates (GH-130)", () => {
      const weeklyCategoryWithPastTask: CategoryGroup = {
         ...mockCategory,
         name: "Weekly Goals",
         tasks: [
            {
               id: "t_weekly_past",
               text: "Weekly Goal From Past Day",
               completed: false,
               dueDate: "2026-10-01",
               createdAt: "2026-10-01T00:00:00Z",
            },
         ],
      };

      const html = renderToStaticMarkup(
         createElement(CategoryMenuItems, {
            cat: weeklyCategoryWithPastTask,
            catType: "weekly",
            dailyCategories: [],
            weeklyCategories: [weeklyCategoryWithPastTask],
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

      expect(html).toContain("Delete Category");
      expect(html).not.toContain("Delete Category (Locked)");
   });

   it("does not falsely lock weekly category when a daily category shares the same name (GH-130)", () => {
      const dailyCatWithPastTask: CategoryGroup = {
         id: "cat_daily_shared",
         name: "General",
         isCollapsed: false,
         tasks: [
            {
               id: "t_daily_past",
               text: "Past Daily Task",
               completed: true,
               dueDate: "2026-10-01",
               createdAt: "2026-10-01T00:00:00Z",
            },
         ],
      };
      const weeklyCat: CategoryGroup = {
         id: "cat_weekly_shared",
         name: "General",
         isCollapsed: false,
         tasks: [
            {
               id: "t_weekly",
               text: "Active Weekly Goal",
               completed: false,
               createdAt: "2026-10-02T00:00:00Z",
            },
         ],
      };

      const html = renderToStaticMarkup(
         createElement(CategoryMenuItems, {
            cat: weeklyCat,
            catType: "weekly",
            dailyCategories: [dailyCatWithPastTask],
            weeklyCategories: [weeklyCat],
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

      expect(html).toContain("Delete Category");
      expect(html).not.toContain("Delete Category (Locked)");
   });

   it("locks weekly category deletion when the same category ID contains daily tasks on past challenge days", () => {
      const sharedCatId = "cat_shared_sprint";
      const dailyCatWithPastTask: CategoryGroup = {
         id: sharedCatId,
         name: "Sprint Goals",
         isCollapsed: false,
         tasks: [
            {
               id: "t_daily_past",
               text: "Day 1 Task",
               completed: true,
               dueDate: "2026-10-01",
               createdAt: "2026-10-01T00:00:00Z",
            },
         ],
      };
      const weeklyCat: CategoryGroup = {
         id: sharedCatId,
         name: "Sprint Goals",
         isCollapsed: false,
         tasks: [
            {
               id: "t_weekly",
               text: "Active Weekly Goal",
               completed: false,
               createdAt: "2026-10-02T00:00:00Z",
            },
         ],
      };

      const html = renderToStaticMarkup(
         createElement(CategoryMenuItems, {
            cat: weeklyCat,
            catType: "weekly",
            dailyCategories: [dailyCatWithPastTask],
            weeklyCategories: [weeklyCat],
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

   it("invokes callbacks via onSelect and onClick in TaskMenuItems", () => {
      const capturedProps: any[] = [];
      const RecordingItem = ({
         children,
         onSelect,
         onClick,
         ...props
      }: any) => {
         capturedProps.push({ children, onSelect, onClick });
         return createElement("button", { onClick, ...props }, children);
      };

      const onSetStatus = vi.fn();
      const onMoveToDay = vi.fn();
      const onEditTask = vi.fn();
      const onDeleteTask = vi.fn();

      renderToStaticMarkup(
         createElement(TaskMenuItems, {
            task: mockTask,
            catIdx: 0,
            taskType: "daily",
            effectiveTodayDate: "2026-10-02",
            dayOptions: mockDayOptions,
            selectedDateKey: "2026-10-02",
            onSetStatus,
            onMoveToDay,
            onEditTask,
            onDeleteTask,
            Item: RecordingItem,
            Separator: MockSeparator,
            Label: MockLabel,
         })
      );

      // Verify each interactive item provides both onSelect and onClick
      const completeItem = capturedProps.find((p) =>
         String(renderToStaticMarkup(p.children)).includes("Mark as Completed")
      );
      expect(completeItem).toBeDefined();
      expect(typeof completeItem.onSelect).toBe("function");
      expect(typeof completeItem.onClick).toBe("function");

      completeItem.onSelect();
      expect(onSetStatus).toHaveBeenCalledWith("COMPLETED");

      const editItem = capturedProps.find((p) =>
         String(renderToStaticMarkup(p.children)).includes("Edit Task")
      );
      expect(editItem).toBeDefined();
      expect(typeof editItem.onSelect).toBe("function");
      expect(typeof editItem.onClick).toBe("function");

      editItem.onSelect();
      expect(onEditTask).toHaveBeenCalled();

      const deleteItem = capturedProps.find((p) =>
         String(renderToStaticMarkup(p.children)).includes("Delete Task")
      );
      expect(deleteItem).toBeDefined();
      expect(typeof deleteItem.onSelect).toBe("function");
      expect(typeof deleteItem.onClick).toBe("function");

      deleteItem.onClick();
      expect(onDeleteTask).toHaveBeenCalled();
   });

   it("invokes callbacks via onSelect and onClick in CategoryMenuItems", () => {
      const capturedProps: any[] = [];
      const RecordingItem = ({
         children,
         onSelect,
         onClick,
         ...props
      }: any) => {
         capturedProps.push({ children, onSelect, onClick });
         return createElement("button", { onClick, ...props }, children);
      };

      const onMoveCategoryToDay = vi.fn();
      const onRenameCategory = vi.fn();
      const onDeleteCategory = vi.fn();

      renderToStaticMarkup(
         createElement(CategoryMenuItems, {
            cat: mockCategory,
            catType: "daily",
            dailyCategories: [mockCategory],
            weeklyCategories: [],
            selectedDateKey: "2026-10-02",
            effectiveTodayDate: "2026-10-02",
            dayOptions: mockDayOptions,
            onMoveCategoryToDay,
            onRenameCategory,
            onDeleteCategory,
            Item: RecordingItem,
            Separator: MockSeparator,
            Label: MockLabel,
         })
      );

      const renameItem = capturedProps.find((p) =>
         String(renderToStaticMarkup(p.children)).includes("Rename Category")
      );
      expect(renameItem).toBeDefined();
      expect(typeof renameItem.onSelect).toBe("function");
      expect(typeof renameItem.onClick).toBe("function");

      renameItem.onSelect();
      expect(onRenameCategory).toHaveBeenCalled();

      const deleteItem = capturedProps.find((p) =>
         String(renderToStaticMarkup(p.children)).includes("Delete Category")
      );
      expect(deleteItem).toBeDefined();
      expect(typeof deleteItem.onSelect).toBe("function");
      expect(typeof deleteItem.onClick).toBe("function");

      deleteItem.onClick();
      expect(onDeleteCategory).toHaveBeenCalled();
   });
});
