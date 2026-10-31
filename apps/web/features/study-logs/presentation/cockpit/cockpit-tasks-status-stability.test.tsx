// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { createElement, act } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CockpitTasksSection } from "./cockpit-tasks-section";
import type { UserCategorizedTasks } from "@/features/tasks/domain/task.types";
import { TASKS_SYNCED_EVENT } from "@/features/tasks/data/local/task-sync.service";
import * as taskIdb from "@/features/tasks/data/local/task-idb";
import * as taskSyncService from "@/features/tasks/data/local/task-sync.service";

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
      putLocalTask: vi.fn().mockResolvedValue(undefined),
      enqueueMutation: vi.fn().mockResolvedValue(undefined),
      logTaskSync: vi.fn(),
   };
});

vi.mock(
   "@/features/tasks/data/local/task-sync.service",
   async (importOriginal) => {
      const actual =
         await importOriginal<
            typeof import("@/features/tasks/data/local/task-sync.service")
         >();
      return {
         ...actual,
         scheduleSync: vi.fn(),
         initTaskSync: vi.fn(() => vi.fn()),
      };
   }
);

afterEach(cleanup);
beforeEach(() => {
   vi.clearAllMocks();
});

describe("CockpitTasksSection - Task Status Transition Stability & Anti-Flash", () => {
   const todayDate = "2026-10-29";

   const sampleTasks: UserCategorizedTasks = {
      categories: [
         {
            id: "cat_daily_status",
            userId: "user_status_test",
            name: "Status Focus",
            taskType: "DAILY",
            createdAt: new Date(),
            updatedAt: new Date(),
         },
      ],
      dailyCategories: [
         {
            id: "cat_daily_status",
            name: "Status Focus",
            taskType: "DAILY",
            isCollapsed: false,
            tasks: [
               {
                  id: "t_in_progress",
                  userId: "user_status_test",
                  categoryId: "cat_daily_status",
                  title: "Read Chapter 4 Biology",
                  taskType: "DAILY",
                  isComplete: false,
                  status: "IN_PROGRESS",
                  dueDate: todayDate,
                  createdAt: new Date(`${todayDate}T09:00:00Z`),
                  updatedAt: new Date(`${todayDate}T09:00:00Z`),
                  completedAt: null,
               },
               {
                  id: "t_todo",
                  userId: "user_status_test",
                  categoryId: "cat_daily_status",
                  title: "Solve Chemistry Quiz",
                  taskType: "DAILY",
                  isComplete: false,
                  status: "TODO",
                  dueDate: todayDate,
                  createdAt: new Date(`${todayDate}T09:00:00Z`),
                  updatedAt: new Date(`${todayDate}T09:00:00Z`),
                  completedAt: null,
               },
            ],
         },
      ],
      weeklyCategories: [],
      totalDailyTasks: 2,
      completedDailyTasks: 0,
      totalWeeklyTasks: 0,
      completedWeeklyTasks: 0,
   };

   it("immediately transitions an IN_PROGRESS task to COMPLETED when clicking the In Progress badge", async () => {
      render(
         <CockpitTasksSection
            isLoggedIn={true}
            userId="user_status_test"
            userTasks={sampleTasks}
            todayDate={todayDate}
            initialSelectedDateKey={todayDate}
         />
      );

      // Verify the In Progress badge is initially rendered
      const inProgressBadge = screen.getByRole("button", {
         name: /^In Progress$/i,
      });
      expect(inProgressBadge).toBeDefined();

      // Click the badge to transition to COMPLETED
      await act(async () => {
         fireEvent.click(inProgressBadge);
      });

      // Status pill should immediately reflect Completed
      const completedBadge = screen.getByRole("button", {
         name: /^Completed$/i,
      });
      expect(completedBadge).toBeDefined();

      // Verify scheduleSync was invoked with the 400ms debounce
      expect(taskSyncService.scheduleSync).toHaveBeenCalledWith(
         "user_status_test",
         400
      );

      // Verify enqueueMutation was dispatched with TOGGLE to COMPLETED
      expect(taskIdb.enqueueMutation).toHaveBeenCalledWith(
         expect.objectContaining({
            entityType: "TASK",
            action: "TOGGLE",
            payload: expect.objectContaining({
               taskId: "t_in_progress",
               isComplete: true,
               status: "COMPLETED",
            }),
         })
      );
   });

   it("does not revert optimistic status when a live sync event arrives while mutation is pending", async () => {
      // Mock that the mutation is still queued in IDB
      vi.mocked(taskIdb.getAllQueuedMutations).mockResolvedValue([
         {
            id: "mut_toggle_1",
            entityType: "TASK",
            action: "TOGGLE",
            payload: {
               taskId: "t_in_progress",
               isComplete: true,
               status: "COMPLETED",
            },
            createdAt: Date.now(),
            retryCount: 0,
         },
      ]);

      vi.mocked(taskIdb.getAllLocalCategories).mockResolvedValue([
         {
            id: "cat_daily_status",
            userId: "user_status_test",
            name: "Status Focus",
            taskType: "DAILY",
            sortOrder: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncState: "synced",
         },
      ]);

      // Mock that IndexedDB returns local tasks (simulating an older snapshot)
      vi.mocked(taskIdb.getAllLocalTasks).mockResolvedValue([
         {
            id: "t_in_progress",
            userId: "user_status_test",
            categoryId: "cat_daily_status",
            title: "Read Chapter 4 Biology",
            taskType: "DAILY",
            sortOrder: 0,
            isComplete: false,
            status: "IN_PROGRESS", // Old status in IDB
            dueDate: todayDate,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: null,
            syncState: "pending",
         },
      ]);

      render(
         <CockpitTasksSection
            isLoggedIn={true}
            userId="user_status_test"
            userTasks={sampleTasks}
            todayDate={todayDate}
            initialSelectedDateKey={todayDate}
         />
      );

      // Transition the task to COMPLETED
      const inProgressBadge = screen.getByRole("button", {
         name: /^In Progress$/i,
      });
      await act(async () => {
         fireEvent.click(inProgressBadge);
      });

      // Verify it is completed in the UI
      expect(
         screen.getByRole("button", {
            name: /^Completed$/i,
         })
      ).toBeDefined();

      // Simulate a background sync event firing (which previously caused a flash back to IN_PROGRESS)
      await act(async () => {
         window.dispatchEvent(
            new CustomEvent(TASKS_SYNCED_EVENT, {
               detail: { categories: [], tasks: [] },
            })
         );
      });

      // The UI must NOT flash or revert back to In Progress; it must retain Completed
      expect(
         screen.queryByRole("button", {
            name: /^In Progress$/i,
         })
      ).toBeNull();
      expect(
         screen.getByRole("button", {
            name: /^Completed$/i,
         })
      ).toBeDefined();
   });

   it("toggles TODO task to COMPLETED when clicking the task checkbox row", async () => {
      render(
         <CockpitTasksSection
            isLoggedIn={true}
            userId="user_status_test"
            userTasks={sampleTasks}
            todayDate={todayDate}
            initialSelectedDateKey={todayDate}
         />
      );

      const todoCheckbox = screen.getByRole("checkbox", {
         name: /Solve Chemistry Quiz/i,
      });
      expect(todoCheckbox.getAttribute("aria-checked")).toBe("false");

      await act(async () => {
         fireEvent.click(todoCheckbox);
      });

      expect(todoCheckbox.getAttribute("aria-checked")).toBe("true");
      expect(taskSyncService.scheduleSync).toHaveBeenCalledWith(
         "user_status_test",
         400
      );
   });
});
