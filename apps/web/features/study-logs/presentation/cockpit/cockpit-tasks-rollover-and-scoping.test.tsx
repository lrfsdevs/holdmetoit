// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CockpitTasksSection } from "./cockpit-tasks-section";
import type { UserCategorizedTasks } from "@/features/tasks/domain/task.types";
import {
   ROLLOVER_SNOOZE_COOKIE,
   isRolloverSnoozedForDate,
   setRolloverSnoozedForDate,
} from "./cockpit-tasks-storage";

vi.mock("@/features/tasks/api/task.actions", () => ({
   createTaskAction: vi.fn(),
   deleteTaskAction: vi.fn(),
   toggleTaskAction: vi.fn(),
   updateTaskAction: vi.fn(),
   updateCategoryAction: vi.fn(),
   deleteCategoryAction: vi.fn(),
   rolloverTasksAction: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => {
   if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
   }
   if (typeof document !== "undefined") {
      document.cookie = `${ROLLOVER_SNOOZE_COOKIE}=; path=/; max-age=0`;
   }
});

describe("CockpitTasksSection - Rollover and Goal Scoping (GH #185 / KAN-61)", () => {
   const todayDate = "2026-10-26";
   const yesterdayDate = "2026-10-25";
   const pastDay2 = "2026-10-24";

   describe("Incomplete Task Rollover Helper", () => {
      it("renders the Today rollover banner when past days contain incomplete tasks", () => {
         const mockTasks: UserCategorizedTasks = {
            categories: [
               {
                  id: "cat_1",
                  userId: "user_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  createdAt: new Date(),
                  updatedAt: new Date(),
               },
            ],
            dailyCategories: [
               {
                  id: "cat_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  isCollapsed: false,
                  tasks: [
                     {
                        id: "task_yesterday",
                        userId: "user_1",
                        categoryId: "cat_1",
                        title: "Incomplete Chem problem set",
                        taskType: "DAILY",
                        isComplete: false,
                        dueDate: yesterdayDate,
                        createdAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        updatedAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        completedAt: null,
                     },
                  ],
               },
            ],
            weeklyCategories: [],
            totalDailyTasks: 1,
            completedDailyTasks: 0,
            totalWeeklyTasks: 0,
            completedWeeklyTasks: 0,
         };

         const html = renderToStaticMarkup(
            createElement(CockpitTasksSection, {
               isLoggedIn: true,
               userTasks: mockTasks,
               todayDate,
               initialSelectedDateKey: todayDate,
            })
         );

         expect(html).toContain('data-testid="rollover-today-banner"');
         expect(html).toContain('data-testid="rollover-all-button"');
         expect(html).toContain('data-testid="rollover-snooze-today-button"');
         expect(html).toContain("1 incomplete task from yesterday");
         expect(html).toContain("Roll over to Today");
         expect(html).toContain("Don&#x27;t remind today");
      });

      it("displays 'earlier days' wording when incomplete tasks span multiple past days", () => {
         const mockTasks: UserCategorizedTasks = {
            categories: [
               {
                  id: "cat_1",
                  userId: "user_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  createdAt: new Date(),
                  updatedAt: new Date(),
               },
            ],
            dailyCategories: [
               {
                  id: "cat_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  isCollapsed: false,
                  tasks: [
                     {
                        id: "task_1",
                        userId: "user_1",
                        categoryId: "cat_1",
                        title: "Day 1 unfinished reading",
                        taskType: "DAILY",
                        isComplete: false,
                        dueDate: pastDay2,
                        createdAt: new Date(`${pastDay2}T10:00:00Z`),
                        updatedAt: new Date(`${pastDay2}T10:00:00Z`),
                        completedAt: null,
                     },
                     {
                        id: "task_2",
                        userId: "user_1",
                        categoryId: "cat_1",
                        title: "Yesterday unfinished lab notes",
                        taskType: "DAILY",
                        isComplete: false,
                        dueDate: yesterdayDate,
                        createdAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        updatedAt: new Date(`${yesterdayDate}T10:00:00Z`),
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

         const html = renderToStaticMarkup(
            createElement(CockpitTasksSection, {
               isLoggedIn: true,
               userTasks: mockTasks,
               todayDate,
               initialSelectedDateKey: todayDate,
            })
         );

         expect(html).toContain('data-testid="rollover-today-banner"');
         expect(html).toContain("2 incomplete tasks from earlier days");
      });

      it("does not render the Today rollover banner when all past tasks are completed", () => {
         const mockTasks: UserCategorizedTasks = {
            categories: [
               {
                  id: "cat_1",
                  userId: "user_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  createdAt: new Date(),
                  updatedAt: new Date(),
               },
            ],
            dailyCategories: [
               {
                  id: "cat_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  isCollapsed: false,
                  tasks: [
                     {
                        id: "task_yesterday_done",
                        userId: "user_1",
                        categoryId: "cat_1",
                        title: "Finished reading yesterday",
                        taskType: "DAILY",
                        isComplete: true,
                        status: "COMPLETED",
                        dueDate: yesterdayDate,
                        createdAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        updatedAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        completedAt: new Date(`${yesterdayDate}T18:00:00Z`),
                     },
                  ],
               },
            ],
            weeklyCategories: [],
            totalDailyTasks: 1,
            completedDailyTasks: 1,
            totalWeeklyTasks: 0,
            completedWeeklyTasks: 0,
         };

         const html = renderToStaticMarkup(
            createElement(CockpitTasksSection, {
               isLoggedIn: true,
               userTasks: mockTasks,
               todayDate,
               initialSelectedDateKey: todayDate,
            })
         );

         expect(html).not.toContain('data-testid="rollover-today-banner"');
      });

      it("renders the past-day rollover banner when viewing a past day with incomplete tasks", () => {
         const mockTasks: UserCategorizedTasks = {
            categories: [
               {
                  id: "cat_1",
                  userId: "user_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  createdAt: new Date(),
                  updatedAt: new Date(),
               },
            ],
            dailyCategories: [
               {
                  id: "cat_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  isCollapsed: false,
                  tasks: [
                     {
                        id: "task_past",
                        userId: "user_1",
                        categoryId: "cat_1",
                        title: "Unfinished math drill",
                        taskType: "DAILY",
                        isComplete: false,
                        dueDate: yesterdayDate,
                        createdAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        updatedAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        completedAt: null,
                     },
                  ],
               },
            ],
            weeklyCategories: [],
            totalDailyTasks: 1,
            completedDailyTasks: 0,
            totalWeeklyTasks: 0,
            completedWeeklyTasks: 0,
         };

         const html = renderToStaticMarkup(
            createElement(CockpitTasksSection, {
               isLoggedIn: true,
               userTasks: mockTasks,
               todayDate,
               initialSelectedDateKey: yesterdayDate,
            })
         );

         expect(html).toContain('data-testid="rollover-past-day-banner"');
         expect(html).toContain('data-testid="rollover-day-button"');
         expect(html).toContain("1 incomplete task on this day");
      });

      it("renders individual 1-click rollover button on past-day incomplete task cards", () => {
         const mockTasks: UserCategorizedTasks = {
            categories: [
               {
                  id: "cat_1",
                  userId: "user_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  createdAt: new Date(),
                  updatedAt: new Date(),
               },
            ],
            dailyCategories: [
               {
                  id: "cat_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  isCollapsed: false,
                  tasks: [
                     {
                        id: "task_past_todo",
                        userId: "user_1",
                        categoryId: "cat_1",
                        title: "Past Day Todo Item",
                        taskType: "DAILY",
                        isComplete: false,
                        status: "TODO",
                        dueDate: yesterdayDate,
                        createdAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        updatedAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        completedAt: null,
                     },
                     {
                        id: "task_past_done",
                        userId: "user_1",
                        categoryId: "cat_1",
                        title: "Past Day Completed Item",
                        taskType: "DAILY",
                        isComplete: true,
                        status: "COMPLETED",
                        dueDate: yesterdayDate,
                        createdAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        updatedAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        completedAt: new Date(`${yesterdayDate}T12:00:00Z`),
                     },
                  ],
               },
            ],
            weeklyCategories: [],
            totalDailyTasks: 2,
            completedDailyTasks: 1,
            totalWeeklyTasks: 0,
            completedWeeklyTasks: 0,
         };

         const html = renderToStaticMarkup(
            createElement(CockpitTasksSection, {
               isLoggedIn: true,
               userTasks: mockTasks,
               todayDate,
               initialSelectedDateKey: yesterdayDate,
            })
         );

         expect(html).toContain('title="Roll over to Today"');
         expect(html).toContain(
            'aria-label="Roll over Past Day Todo Item to Today"'
         );
         expect(html).not.toContain(
            'aria-label="Roll over Past Day Completed Item to Today"'
         );
      });

      it("renders the Today rollover banner during an active challenge when incomplete tasks exist (#196, KAN-65)", () => {
         const mockTasks: UserCategorizedTasks = {
            categories: [
               {
                  id: "cat_1",
                  userId: "user_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  createdAt: new Date(),
                  updatedAt: new Date(),
               },
            ],
            dailyCategories: [
               {
                  id: "cat_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  isCollapsed: false,
                  tasks: [
                     {
                        id: "task_yesterday",
                        userId: "user_1",
                        categoryId: "cat_1",
                        title: "Incomplete Chem problem set",
                        taskType: "DAILY",
                        isComplete: false,
                        dueDate: yesterdayDate,
                        createdAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        updatedAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        completedAt: null,
                     },
                  ],
               },
            ],
            weeklyCategories: [],
            totalDailyTasks: 1,
            completedDailyTasks: 0,
            totalWeeklyTasks: 0,
            completedWeeklyTasks: 0,
         };

         const html = renderToStaticMarkup(
            createElement(CockpitTasksSection, {
               isLoggedIn: true,
               userTasks: mockTasks,
               challengeStartDate: yesterdayDate,
               totalChallengeDays: 7,
               challengeStatus: "ACTIVE",
               todayDate,
               initialSelectedDateKey: todayDate,
            })
         );

         expect(html).toContain('data-testid="rollover-today-banner"');
         expect(html).toContain('data-testid="rollover-snooze-today-button"');
         expect(html).toContain("Don&#x27;t remind today");
      });

      it("renders the Today rollover banner during an upcoming challenge (#196, KAN-65)", () => {
         const mockTasks: UserCategorizedTasks = {
            categories: [
               {
                  id: "cat_1",
                  userId: "user_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  createdAt: new Date(),
                  updatedAt: new Date(),
               },
            ],
            dailyCategories: [
               {
                  id: "cat_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  isCollapsed: false,
                  tasks: [
                     {
                        id: "task_yesterday",
                        userId: "user_1",
                        categoryId: "cat_1",
                        title: "Incomplete task before challenge",
                        taskType: "DAILY",
                        isComplete: false,
                        dueDate: yesterdayDate,
                        createdAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        updatedAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        completedAt: null,
                     },
                  ],
               },
            ],
            weeklyCategories: [],
            totalDailyTasks: 1,
            completedDailyTasks: 0,
            totalWeeklyTasks: 0,
            completedWeeklyTasks: 0,
         };

         const html = renderToStaticMarkup(
            createElement(CockpitTasksSection, {
               isLoggedIn: true,
               userTasks: mockTasks,
               challengeStartDate: "2026-11-01",
               totalChallengeDays: 7,
               challengeStatus: "UPCOMING",
               todayDate,
               initialSelectedDateKey: todayDate,
            })
         );

         expect(html).toContain('data-testid="rollover-today-banner"');
         expect(html).toContain('data-testid="rollover-snooze-today-button"');
      });

      it("suppresses the Today rollover banner when snoozed for today in localStorage (#196, KAN-65)", () => {
         const mockTasks: UserCategorizedTasks = {
            categories: [
               {
                  id: "cat_1",
                  userId: "user_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  createdAt: new Date(),
                  updatedAt: new Date(),
               },
            ],
            dailyCategories: [
               {
                  id: "cat_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  isCollapsed: false,
                  tasks: [
                     {
                        id: "task_yesterday",
                        userId: "user_1",
                        categoryId: "cat_1",
                        title: "Incomplete Chem problem set",
                        taskType: "DAILY",
                        isComplete: false,
                        dueDate: yesterdayDate,
                        createdAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        updatedAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        completedAt: null,
                     },
                  ],
               },
            ],
            weeklyCategories: [],
            totalDailyTasks: 1,
            completedDailyTasks: 0,
            totalWeeklyTasks: 0,
            completedWeeklyTasks: 0,
         };

         setRolloverSnoozedForDate("user_1", todayDate);

         render(
            <CockpitTasksSection
               isLoggedIn={true}
               userTasks={mockTasks}
               userId="user_1"
               todayDate={todayDate}
               initialSelectedDateKey={todayDate}
            />
         );

         expect(screen.queryByTestId("rollover-today-banner")).toBeNull();
      });

      it("does not render the Today banner when initialIsRolloverSnoozed is true (SSR hydration parity, zero flash) (#196, KAN-65)", () => {
         const mockTasks: UserCategorizedTasks = {
            categories: [
               {
                  id: "cat_1",
                  userId: "user_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  createdAt: new Date(),
                  updatedAt: new Date(),
               },
            ],
            dailyCategories: [
               {
                  id: "cat_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  isCollapsed: false,
                  tasks: [
                     {
                        id: "task_yesterday",
                        userId: "user_1",
                        categoryId: "cat_1",
                        title: "Incomplete Chem problem set",
                        taskType: "DAILY",
                        isComplete: false,
                        dueDate: yesterdayDate,
                        createdAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        updatedAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        completedAt: null,
                     },
                  ],
               },
            ],
            weeklyCategories: [],
            totalDailyTasks: 1,
            completedDailyTasks: 0,
            totalWeeklyTasks: 0,
            completedWeeklyTasks: 0,
         };

         render(
            <CockpitTasksSection
               isLoggedIn={true}
               userTasks={mockTasks}
               userId="user_1"
               todayDate={todayDate}
               initialSelectedDateKey={todayDate}
               initialIsRolloverSnoozed={true}
            />
         );

         expect(screen.queryByTestId("rollover-today-banner")).toBeNull();
      });

      it("hides the Today banner and persists snooze to localStorage when snooze button is clicked (#196, KAN-65)", () => {
         const mockTasks: UserCategorizedTasks = {
            categories: [
               {
                  id: "cat_1",
                  userId: "user_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  createdAt: new Date(),
                  updatedAt: new Date(),
               },
            ],
            dailyCategories: [
               {
                  id: "cat_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  isCollapsed: false,
                  tasks: [
                     {
                        id: "task_yesterday",
                        userId: "user_1",
                        categoryId: "cat_1",
                        title: "Incomplete Chem problem set",
                        taskType: "DAILY",
                        isComplete: false,
                        dueDate: yesterdayDate,
                        createdAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        updatedAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        completedAt: null,
                     },
                  ],
               },
            ],
            weeklyCategories: [],
            totalDailyTasks: 1,
            completedDailyTasks: 0,
            totalWeeklyTasks: 0,
            completedWeeklyTasks: 0,
         };

         render(
            <CockpitTasksSection
               isLoggedIn={true}
               userTasks={mockTasks}
               userId="user_1"
               todayDate={todayDate}
               initialSelectedDateKey={todayDate}
            />
         );

         expect(screen.getByTestId("rollover-today-banner")).toBeTruthy();
         const snoozeBtn = screen.getByTestId("rollover-snooze-today-button");
         fireEvent.click(snoozeBtn);

         expect(screen.queryByTestId("rollover-today-banner")).toBeNull();
         expect(isRolloverSnoozedForDate("user_1", todayDate)).toBe(true);
      });

      it("allows changing the status of earlier tasks in daily to-do when viewing a past day", () => {
         const mockTasks: UserCategorizedTasks = {
            categories: [
               {
                  id: "cat_1",
                  userId: "user_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  createdAt: new Date(),
                  updatedAt: new Date(),
               },
            ],
            dailyCategories: [
               {
                  id: "cat_1",
                  name: "Daily Work",
                  taskType: "DAILY",
                  isCollapsed: false,
                  tasks: [
                     {
                        id: "task_past_day",
                        userId: "user_1",
                        categoryId: "cat_1",
                        title: "Incomplete Chem problem set",
                        taskType: "DAILY",
                        isComplete: false,
                        status: "TODO",
                        dueDate: yesterdayDate,
                        createdAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        updatedAt: new Date(`${yesterdayDate}T10:00:00Z`),
                        completedAt: null,
                     },
                  ],
               },
            ],
            weeklyCategories: [],
            totalDailyTasks: 1,
            completedDailyTasks: 0,
            totalWeeklyTasks: 0,
            completedWeeklyTasks: 0,
         };

         render(
            <CockpitTasksSection
               isLoggedIn={true}
               userTasks={mockTasks}
               userId="user_1"
               todayDate={todayDate}
               initialSelectedDateKey={yesterdayDate}
               challengeStartDate="2026-10-20"
               totalChallengeDays={7}
               challengeStatus="ACTIVE"
            />
         );

         // Task checkbox is rendered with cursor-pointer and not disabled
         const taskCheckbox = screen.getByRole("checkbox", {
            name: /Incomplete Chem problem set/i,
         });
         expect(taskCheckbox.className).toContain("cursor-pointer");
         expect(taskCheckbox.className).not.toContain("cursor-not-allowed");

         // Clicking the task checkbox toggles it to completed
         fireEvent.click(taskCheckbox);
         expect(taskCheckbox.getAttribute("aria-checked")).toBe("true");
      });
   });

   describe("Challenge Goal Scoping (Law L6 Three-Condition Accountability)", () => {
      const challengeId = "challenge_oct_sprint";

      it("renders Challenge Goal and Personal badges on weekly task cards when an active challenge is linked", () => {
         const mockTasks: UserCategorizedTasks = {
            categories: [
               {
                  id: "cat_weekly_1",
                  userId: "user_1",
                  name: "Sprint Deliverables",
                  taskType: "WEEKLY",
                  createdAt: new Date(),
                  updatedAt: new Date(),
               },
            ],
            dailyCategories: [],
            weeklyCategories: [
               {
                  id: "cat_weekly_1",
                  name: "Sprint Deliverables",
                  taskType: "WEEKLY",
                  isCollapsed: false,
                  tasks: [
                     {
                        id: "task_challenge_goal",
                        userId: "user_1",
                        categoryId: "cat_weekly_1",
                        challengeId,
                        title: "Submit Term Project Draft",
                        taskType: "WEEKLY",
                        isComplete: true,
                        status: "COMPLETED",
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        completedAt: new Date(),
                     },
                     {
                        id: "task_personal_goal",
                        userId: "user_1",
                        categoryId: "cat_weekly_1",
                        challengeId: null,
                        title: "Read Clean Architecture Ch 4",
                        taskType: "WEEKLY",
                        isComplete: false,
                        status: "TODO",
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        completedAt: null,
                     },
                  ],
               },
            ],
            totalDailyTasks: 0,
            completedDailyTasks: 0,
            totalWeeklyTasks: 2,
            completedWeeklyTasks: 1,
         };

         const html = renderToStaticMarkup(
            createElement(CockpitTasksSection, {
               isLoggedIn: true,
               userTasks: mockTasks,
               challengeId,
               todayDate,
            })
         );

         // Header Challenge Goals badge
         expect(html).toContain('data-testid="weekly-challenge-goals-badge"');
         expect(html).toContain("1/1 Goals");

         // Task card badges
         expect(html).toContain('data-testid="task-scope-challenge-badge"');
         expect(html).toContain("Goal");
         expect(html).toContain('data-testid="task-scope-personal-badge"');
         expect(html).toContain("Personal");
      });

      it("does not render challenge goal badges when no challenge context is active (pure personal planning)", () => {
         const mockTasks: UserCategorizedTasks = {
            categories: [
               {
                  id: "cat_weekly_1",
                  userId: "user_1",
                  name: "Sprint Deliverables",
                  taskType: "WEEKLY",
                  createdAt: new Date(),
                  updatedAt: new Date(),
               },
            ],
            dailyCategories: [],
            weeklyCategories: [
               {
                  id: "cat_weekly_1",
                  name: "Sprint Deliverables",
                  taskType: "WEEKLY",
                  isCollapsed: false,
                  tasks: [
                     {
                        id: "task_personal_1",
                        userId: "user_1",
                        categoryId: "cat_weekly_1",
                        challengeId: null,
                        title: "Independent Reading",
                        taskType: "WEEKLY",
                        isComplete: false,
                        status: "TODO",
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        completedAt: null,
                     },
                  ],
               },
            ],
            totalDailyTasks: 0,
            completedDailyTasks: 0,
            totalWeeklyTasks: 1,
            completedWeeklyTasks: 0,
         };

         const html = renderToStaticMarkup(
            createElement(CockpitTasksSection, {
               isLoggedIn: true,
               userTasks: mockTasks,
               challengeId: undefined,
               todayDate,
            })
         );

         expect(html).not.toContain(
            'data-testid="weekly-challenge-goals-badge"'
         );
         expect(html).not.toContain('data-testid="task-scope-challenge-badge"');
         expect(html).not.toContain('data-testid="task-scope-personal-badge"');
      });
   });
});
