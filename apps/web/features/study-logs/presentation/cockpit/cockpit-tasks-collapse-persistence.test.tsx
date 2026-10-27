// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, act } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CockpitTasksSection } from "./cockpit-tasks-section";
import type { UserCategorizedTasks } from "@/features/tasks/domain/task.types";
import {
   COLLAPSED_CATEGORIES_COOKIE,
   isCategoryCollapsed,
   readCollapsedCategoryIds,
} from "./cockpit-tasks-storage";

vi.mock("@/features/tasks/api/task.actions", () => ({
   createTaskAction: vi.fn(),
   deleteTaskAction: vi.fn(),
   toggleTaskAction: vi.fn(),
   updateTaskAction: vi.fn(),
   updateCategoryAction: vi.fn(),
   deleteCategoryAction: vi.fn(),
}));

vi.mock("@/features/tasks/data/local/task-idb", async (importOriginal) => {
   const actual =
      await importOriginal<
         typeof import("@/features/tasks/data/local/task-idb")
      >();
   return {
      ...actual,
      getAllLocalCategories: vi.fn().mockResolvedValue([]),
      getAllLocalTasks: vi.fn().mockResolvedValue([]),
      getAllQueuedMutations: vi.fn().mockResolvedValue([]),
      putLocalCategories: vi.fn().mockResolvedValue(undefined),
      putLocalTasks: vi.fn().mockResolvedValue(undefined),
      seedFromUserTasks: vi.fn().mockResolvedValue(undefined),
      putLocalCategory: vi.fn().mockResolvedValue(undefined),
      deleteLocalCategory: vi.fn().mockResolvedValue(undefined),
      enqueueMutation: vi.fn().mockResolvedValue(undefined),
      scheduleSync: vi.fn(),
      logTaskSync: vi.fn(),
      migrateGuestDataToUser: vi.fn().mockResolvedValue(undefined),
      TASKS_SYNCED_EVENT: "holdmetoit:tasks-synced",
   };
});

describe("CockpitTasksSection - Category Collapse Persistence (GH #194 / KAN-63)", () => {
   const testTasks: UserCategorizedTasks = {
      categories: [
         {
            id: "cat_daily_1",
            userId: "user_test",
            name: "Morning Focus",
            taskType: "DAILY",
            createdAt: new Date("2026-10-01T10:00:00Z"),
            updatedAt: new Date("2026-10-01T10:00:00Z"),
         },
         {
            id: "cat_daily_2",
            userId: "user_test",
            name: "Evening Routine",
            taskType: "DAILY",
            createdAt: new Date("2026-10-01T10:00:00Z"),
            updatedAt: new Date("2026-10-01T10:00:00Z"),
         },
         {
            id: "cat_weekly_1",
            userId: "user_test",
            name: "Weekly Milestones",
            taskType: "WEEKLY",
            createdAt: new Date("2026-10-01T10:00:00Z"),
            updatedAt: new Date("2026-10-01T10:00:00Z"),
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
                  id: "task_d1",
                  userId: "user_test",
                  categoryId: "cat_daily_1",
                  title: "Review Math Notes",
                  isComplete: false,
                  dueDate: "2026-10-04",
                  taskType: "DAILY",
                  isDeleted: false,
                  createdAt: new Date("2026-10-01T10:00:00Z"),
                  updatedAt: new Date("2026-10-01T10:00:00Z"),
                  completedAt: null,
               },
            ],
         },
         {
            id: "cat_daily_2",
            name: "Evening Routine",
            taskType: "DAILY",
            isCollapsed: false,
            tasks: [
               {
                  id: "task_d2",
                  userId: "user_test",
                  categoryId: "cat_daily_2",
                  title: "Read Physics Chapter",
                  isComplete: false,
                  dueDate: "2026-10-04",
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
            name: "Weekly Milestones",
            taskType: "WEEKLY",
            isCollapsed: false,
            tasks: [
               {
                  id: "task_w1",
                  userId: "user_test",
                  categoryId: "cat_weekly_1",
                  title: "Complete 100 LeetCode problems",
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
      totalDailyTasks: 2,
      completedDailyTasks: 0,
      totalWeeklyTasks: 1,
      completedWeeklyTasks: 0,
   };

   beforeEach(() => {
      window.localStorage.clear();
      document.cookie = `${COLLAPSED_CATEGORIES_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      vi.clearAllMocks();
   });

   afterEach(() => {
      cleanup();
      document.cookie = `${COLLAPSED_CATEGORIES_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
   });

   it("collapsing a daily category updates localStorage and hides its tasks", () => {
      render(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userId: "user_test",
            userTasks: testTasks,
            todayDate: "2026-10-04",
         })
      );

      // Tasks should be visible initially
      expect(screen.getByText("Review Math Notes")).toBeTruthy();
      expect(screen.getByText("Read Physics Chapter")).toBeTruthy();

      // Click on "Morning Focus" category header to collapse it
      const morningHeader = screen.getByText("Morning Focus");
      fireEvent.click(morningHeader);

      // Verify task in Morning Focus is hidden
      expect(screen.queryByText("Review Math Notes")).toBeNull();
      // Evening Routine remains open
      expect(screen.getByText("Read Physics Chapter")).toBeTruthy();

      // Verify localStorage was updated with user scoping
      const collapsedIds = readCollapsedCategoryIds("user_test");
      expect(
         isCategoryCollapsed(
            "daily",
            { id: "cat_daily_1", name: "Morning Focus" },
            collapsedIds
         )
      ).toBe(true);
      expect(
         isCategoryCollapsed(
            "daily",
            { id: "cat_daily_2", name: "Evening Routine" },
            collapsedIds
         )
      ).toBe(false);
   });

   it("clicking a collapsed daily category header uncollapses it and removes it from localStorage", () => {
      render(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userId: "user_test",
            userTasks: testTasks,
            todayDate: "2026-10-04",
         })
      );

      const morningHeader = screen.getByText("Morning Focus");

      // First click collapses it
      fireEvent.click(morningHeader);
      expect(screen.queryByText("Review Math Notes")).toBeNull();
      expect(
         isCategoryCollapsed(
            "daily",
            { id: "cat_daily_1", name: "Morning Focus" },
            readCollapsedCategoryIds("user_test")
         )
      ).toBe(true);

      // Second click uncollapses it
      fireEvent.click(morningHeader);
      expect(screen.getByText("Review Math Notes")).toBeTruthy();
      expect(
         isCategoryCollapsed(
            "daily",
            { id: "cat_daily_1", name: "Morning Focus" },
            readCollapsedCategoryIds("user_test")
         )
      ).toBe(false);
   });

   it("collapsing a weekly category persists to localStorage and hides weekly tasks", () => {
      render(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userId: "user_test",
            userTasks: testTasks,
            todayDate: "2026-10-04",
         })
      );

      expect(screen.getByText("Complete 100 LeetCode problems")).toBeTruthy();

      const weeklyHeader = screen.getByText("Weekly Milestones");
      fireEvent.click(weeklyHeader);

      expect(screen.queryByText("Complete 100 LeetCode problems")).toBeNull();

      const collapsedIds = readCollapsedCategoryIds("user_test");
      expect(
         isCategoryCollapsed(
            "weekly",
            { id: "cat_weekly_1", name: "Weekly Milestones" },
            collapsedIds
         )
      ).toBe(true);
   });

   it("preserves collapsed category state across page refresh / remounting", () => {
      // Simulate existing collapsed state in localStorage prior to component mounting
      window.localStorage.setItem(
         "holdmetoit:collapsed_categories:user_test",
         JSON.stringify(["daily:cat_daily_1", "weekly:cat_weekly_1"])
      );

      const { unmount } = render(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userId: "user_test",
            userTasks: testTasks,
            todayDate: "2026-10-04",
         })
      );

      // Morning Focus and Weekly Milestones are collapsed
      expect(screen.queryByText("Review Math Notes")).toBeNull();
      expect(screen.queryByText("Complete 100 LeetCode problems")).toBeNull();

      // Evening Routine was not collapsed, so its tasks are visible
      expect(screen.getByText("Read Physics Chapter")).toBeTruthy();

      // Simulate page refresh / unmount & remount
      unmount();

      render(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userId: "user_test",
            userTasks: testTasks,
            todayDate: "2026-10-04",
         })
      );

      expect(screen.queryByText("Review Math Notes")).toBeNull();
      expect(screen.queryByText("Complete 100 LeetCode problems")).toBeNull();
      expect(screen.getByText("Read Physics Chapter")).toBeTruthy();
   });

   it("preserves category collapsed state when background IndexedDB sync event fires", async () => {
      const { getAllLocalCategories, getAllLocalTasks } =
         await import("@/features/tasks/data/local/task-idb");

      vi.mocked(getAllLocalCategories).mockResolvedValue([
         {
            id: "cat_daily_1",
            userId: "user_test",
            name: "Morning Focus",
            taskType: "DAILY",
            sortOrder: 0,
            createdAt: "2026-10-01T10:00:00Z",
            updatedAt: "2026-10-01T10:00:00Z",
            syncState: "synced",
         },
      ]);

      vi.mocked(getAllLocalTasks).mockResolvedValue([
         {
            id: "task_d1",
            userId: "user_test",
            categoryId: "cat_daily_1",
            title: "Review Math Notes",
            taskType: "DAILY",
            sortOrder: 0,
            isComplete: false,
            dueDate: "2026-10-04",
            createdAt: "2026-10-01T10:00:00Z",
            updatedAt: "2026-10-01T10:00:00Z",
            completedAt: null,
            syncState: "synced",
         },
      ]);

      render(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userId: "user_test",
            userTasks: testTasks,
            todayDate: "2026-10-04",
         })
      );

      // Collapse Morning Focus
      fireEvent.click(screen.getByText("Morning Focus"));
      expect(screen.queryByText("Review Math Notes")).toBeNull();

      // Trigger background sync event
      await act(async () => {
         window.dispatchEvent(new CustomEvent("holdmetoit:tasks-synced"));
      });

      // Verify Morning Focus remains collapsed after sync
      expect(screen.queryByText("Review Math Notes")).toBeNull();
   });

   it("scopes storage to guest when user is not logged in", () => {
      render(
         createElement(CockpitTasksSection, {
            isLoggedIn: false,
            userTasks: testTasks,
            todayDate: "2026-10-04",
         })
      );

      fireEvent.click(screen.getByText("Morning Focus"));
      expect(screen.queryByText("Review Math Notes")).toBeNull();

      // Should be stored in guest scope
      const guestCollapsed = readCollapsedCategoryIds(null);
      expect(
         isCategoryCollapsed(
            "daily",
            { id: "cat_daily_1", name: "Morning Focus" },
            guestCollapsed
         )
      ).toBe(true);

      // User scope should remain untouched
      expect(readCollapsedCategoryIds("user_test").size).toBe(0);
   });

   it("collapsing a category in weekly goals does NOT collapse the daily category with the same name", () => {
      const crossBoardTasks: UserCategorizedTasks = {
         ...testTasks,
         dailyCategories: [
            {
               id: "cat_daily_shared",
               name: "General",
               taskType: "DAILY",
               isCollapsed: false,
               tasks: [
                  {
                     id: "task_daily_shared",
                     userId: "user_test",
                     categoryId: "cat_daily_shared",
                     title: "Daily General Task",
                     isComplete: false,
                     dueDate: "2026-10-04",
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
               id: "cat_weekly_shared",
               name: "General",
               taskType: "WEEKLY",
               isCollapsed: false,
               tasks: [
                  {
                     id: "task_weekly_shared",
                     userId: "user_test",
                     categoryId: "cat_weekly_shared",
                     title: "Weekly General Milestone",
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

      render(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userId: "user_test",
            userTasks: crossBoardTasks,
            todayDate: "2026-10-04",
         })
      );

      // Both tasks should be visible initially
      expect(screen.getByText("Daily General Task")).toBeTruthy();
      expect(screen.getByText("Weekly General Milestone")).toBeTruthy();

      // Find all headers named "General" (one in Daily, one in Weekly)
      const generalHeaders = screen.getAllByText("General");
      expect(generalHeaders.length).toBe(2);

      // Collapse the Weekly category header (second one in the DOM)
      fireEvent.click(generalHeaders[1]);

      // Weekly General Milestone is hidden
      expect(screen.queryByText("Weekly General Milestone")).toBeNull();

      // Daily General Task MUST STILL BE VISIBLE!
      expect(screen.getByText("Daily General Task")).toBeTruthy();

      // Verify the storage state is strictly scoped
      const collapsedIds = readCollapsedCategoryIds("user_test");
      expect(
         isCategoryCollapsed(
            "weekly",
            { id: "cat_weekly_shared", name: "General" },
            collapsedIds
         )
      ).toBe(true);
      expect(
         isCategoryCollapsed(
            "daily",
            { id: "cat_daily_shared", name: "General" },
            collapsedIds
         )
      ).toBe(false);
   });

   it("does not flash/overwrite fresh server tasks with stale IndexedDB cache on initial mount", async () => {
      const { getAllLocalCategories, getAllLocalTasks, getAllQueuedMutations } =
         await import("@/features/tasks/data/local/task-idb");

      // Stale data in IndexedDB from a previous session
      vi.mocked(getAllLocalCategories).mockResolvedValue([
         {
            id: "cat_old",
            userId: "user_test",
            name: "Old Stale Category",
            taskType: "DAILY",
            sortOrder: 0,
            createdAt: "2026-09-01T10:00:00Z",
            updatedAt: "2026-09-01T10:00:00Z",
            syncState: "synced",
         },
      ]);
      vi.mocked(getAllLocalTasks).mockResolvedValue([
         {
            id: "task_old",
            userId: "user_test",
            categoryId: "cat_old",
            title: "Old Stale Task From Last Month",
            taskType: "DAILY",
            sortOrder: 0,
            isComplete: false,
            dueDate: "2026-10-04",
            createdAt: "2026-09-01T10:00:00Z",
            updatedAt: "2026-09-01T10:00:00Z",
            completedAt: null,
            syncState: "synced",
         },
      ]);
      vi.mocked(getAllQueuedMutations).mockResolvedValue([]);

      render(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userId: "user_test",
            userTasks: testTasks,
            todayDate: "2026-10-04",
         })
      );

      // Fresh server tasks should be displayed
      expect(screen.getByText("Review Math Notes")).toBeTruthy();
      expect(screen.getByText("Read Physics Chapter")).toBeTruthy();

      // Stale old task must NEVER appear on mount
      expect(screen.queryByText("Old Stale Task From Last Month")).toBeNull();
   });
   it("pre-renders in collapsed state without flash when initialCollapsedCategoryIds is passed from server cookie", () => {
      render(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userId: "user_test",
            userTasks: testTasks,
            todayDate: "2026-10-04",
            initialCollapsedCategoryIds: ["daily:cat_daily_1"],
         })
      );

      // Morning Focus is pre-rendered collapsed immediately
      expect(screen.queryByText("Review Math Notes")).toBeNull();
      // Evening Routine remains open
      expect(screen.getByText("Read Physics Chapter")).toBeTruthy();
   });

   it("reliably preserves daily collapse across multiple toggles of weekly category with identical name", () => {
      const sharedTasks: UserCategorizedTasks = {
         ...testTasks,
         dailyCategories: [
            {
               id: "cat_daily_work",
               name: "Work",
               taskType: "DAILY",
               isCollapsed: false,
               tasks: [
                  {
                     id: "task_d_work",
                     userId: "user_test",
                     categoryId: "cat_daily_work",
                     title: "Daily Work Task",
                     isComplete: false,
                     dueDate: "2026-10-04",
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
               id: "cat_weekly_work",
               name: "Work",
               taskType: "WEEKLY",
               isCollapsed: false,
               tasks: [
                  {
                     id: "task_w_work",
                     userId: "user_test",
                     categoryId: "cat_weekly_work",
                     title: "Weekly Work Milestone",
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
      };

      render(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userId: "user_test",
            userTasks: sharedTasks,
            todayDate: "2026-10-04",
         })
      );

      const workHeaders = screen.getAllByText("Work");
      expect(workHeaders.length).toBe(2);
      const dailyHeader = workHeaders[0];
      const weeklyHeader = workHeaders[1];

      // 1. Collapse the Daily category
      fireEvent.click(dailyHeader);
      expect(screen.queryByText("Daily Work Task")).toBeNull();
      expect(screen.getByText("Weekly Work Milestone")).toBeTruthy();

      // 2. Collapse Weekly
      fireEvent.click(weeklyHeader);
      expect(screen.queryByText("Weekly Work Milestone")).toBeNull();
      // Daily MUST STILL BE COLLAPSED!
      expect(screen.queryByText("Daily Work Task")).toBeNull();

      // 3. Uncollapse Weekly
      fireEvent.click(weeklyHeader);
      expect(screen.getByText("Weekly Work Milestone")).toBeTruthy();
      // Daily MUST STILL BE COLLAPSED! It should NOT randomly expand!
      expect(screen.queryByText("Daily Work Task")).toBeNull();

      // 4. Collapse Weekly again
      fireEvent.click(weeklyHeader);
      expect(screen.queryByText("Weekly Work Milestone")).toBeNull();
      expect(screen.queryByText("Daily Work Task")).toBeNull();

      // 5. Uncollapse Daily explicitly
      fireEvent.click(dailyHeader);
      expect(screen.getByText("Daily Work Task")).toBeTruthy();
      // Weekly remains collapsed
      expect(screen.queryByText("Weekly Work Milestone")).toBeNull();
   });
});
