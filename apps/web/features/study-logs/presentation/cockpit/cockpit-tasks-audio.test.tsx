// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CockpitTasksSection } from "./cockpit-tasks-section";
import type { UserCategorizedTasks } from "@/features/tasks/domain/task.types";
import * as audioModule from "@/features/preferences/presentation/audio-service";

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

describe("CockpitTasksSection - Completion Audio Trigger", () => {
   const todayDate = "2026-11-01";

   const initialUserTasks: UserCategorizedTasks = {
      categories: [
         {
            id: "cat-daily-1",
            userId: "user-1",
            name: "Study",
            taskType: "DAILY",
            createdAt: new Date(),
            updatedAt: new Date(),
         },
         {
            id: "cat-weekly-1",
            userId: "user-1",
            name: "Milestones",
            taskType: "WEEKLY",
            createdAt: new Date(),
            updatedAt: new Date(),
         },
      ],
      dailyCategories: [
         {
            id: "cat-daily-1",
            name: "Study",
            taskType: "DAILY",
            isCollapsed: false,
            sortOrder: 0,
            tasks: [
               {
                  id: "task-daily-todo",
                  userId: "user-1",
                  categoryId: "cat-daily-1",
                  title: "Solve LeetCode Problem",
                  taskType: "DAILY",
                  isComplete: false,
                  status: "TODO",
                  dueDate: todayDate,
                  sortOrder: 0,
                  challengeId: null,
                  createdAt: new Date(`${todayDate}T09:00:00Z`),
                  updatedAt: new Date(`${todayDate}T09:00:00Z`),
                  completedAt: null,
               },
               {
                  id: "task-daily-done",
                  userId: "user-1",
                  categoryId: "cat-daily-1",
                  title: "Review Flashcards",
                  taskType: "DAILY",
                  isComplete: true,
                  status: "COMPLETED",
                  dueDate: todayDate,
                  sortOrder: 1,
                  challengeId: null,
                  createdAt: new Date(`${todayDate}T09:00:00Z`),
                  updatedAt: new Date(`${todayDate}T09:00:00Z`),
                  completedAt: new Date(`${todayDate}T09:30:00Z`),
               },
            ],
         },
      ],
      weeklyCategories: [
         {
            id: "cat-weekly-1",
            name: "Milestones",
            taskType: "WEEKLY",
            isCollapsed: false,
            sortOrder: 0,
            tasks: [
               {
                  id: "task-weekly-todo",
                  userId: "user-1",
                  categoryId: "cat-weekly-1",
                  title: "Finish Physics Chapter 4",
                  taskType: "WEEKLY",
                  isComplete: false,
                  status: "TODO",
                  dueDate: null,
                  sortOrder: 0,
                  challengeId: null,
                  createdAt: new Date(`${todayDate}T09:00:00Z`),
                  updatedAt: new Date(`${todayDate}T09:00:00Z`),
                  completedAt: null,
               },
            ],
         },
      ],
      totalDailyTasks: 2,
      completedDailyTasks: 1,
      totalWeeklyTasks: 1,
      completedWeeklyTasks: 0,
   };

   it("invokes playCompletionAudio when completing a Daily task", async () => {
      const audioSpy = vi
         .spyOn(audioModule, "playCompletionAudio")
         .mockResolvedValue(true);

      await act(async () => {
         render(
            <CockpitTasksSection
               isLoggedIn={true}
               userId="user-test-1"
               userTasks={initialUserTasks}
               todayDate={todayDate}
            />
         );
      });

      const todoTaskText = screen.getByText("Solve LeetCode Problem");
      const checkboxDiv = todoTaskText.closest('[role="checkbox"]');
      expect(checkboxDiv).not.toBeNull();

      await act(async () => {
         fireEvent.click(checkboxDiv!);
      });

      expect(audioSpy).toHaveBeenCalledTimes(1);
   });

   it("invokes playCompletionAudio when completing a Weekly task", async () => {
      const audioSpy = vi
         .spyOn(audioModule, "playCompletionAudio")
         .mockResolvedValue(true);

      await act(async () => {
         render(
            <CockpitTasksSection
               isLoggedIn={true}
               userId="user-test-1"
               userTasks={initialUserTasks}
               todayDate={todayDate}
            />
         );
      });

      const weeklyTaskText = screen.getByText("Finish Physics Chapter 4");
      const checkboxDiv = weeklyTaskText.closest('[role="checkbox"]');
      expect(checkboxDiv).not.toBeNull();

      await act(async () => {
         fireEvent.click(checkboxDiv!);
      });

      expect(audioSpy).toHaveBeenCalledTimes(1);
   });

   it("does NOT invoke playCompletionAudio when unchecking an already completed task", async () => {
      const audioSpy = vi
         .spyOn(audioModule, "playCompletionAudio")
         .mockResolvedValue(true);

      await act(async () => {
         render(
            <CockpitTasksSection
               isLoggedIn={true}
               userId="user-test-1"
               userTasks={initialUserTasks}
               todayDate={todayDate}
            />
         );
      });

      const doneTaskText = screen.getByText("Review Flashcards");
      const checkboxDiv = doneTaskText.closest('[role="checkbox"]');
      expect(checkboxDiv).not.toBeNull();

      await act(async () => {
         fireEvent.click(checkboxDiv!);
      });

      expect(audioSpy).not.toHaveBeenCalled();
   });
});
