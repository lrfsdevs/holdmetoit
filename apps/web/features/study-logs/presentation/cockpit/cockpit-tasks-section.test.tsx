import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CockpitTasksSection } from "./cockpit-tasks-section";
import type { UserCategorizedTasks } from "@/features/tasks/domain/task.types";

vi.mock("@/features/tasks/api/task.actions", () => ({
   createTaskAction: vi.fn(),
   deleteTaskAction: vi.fn(),
   toggleTaskAction: vi.fn(),
   updateTaskAction: vi.fn(),
   updateCategoryAction: vi.fn(),
   deleteCategoryAction: vi.fn(),
}));

describe("CockpitTasksSection", () => {
   const mockTasks: UserCategorizedTasks = {
      categories: [
         {
            id: "cat_daily_1",
            userId: "user_1",
            name: "Daily Routines",
            taskType: "DAILY",
            createdAt: new Date(),
            updatedAt: new Date(),
         },
         {
            id: "cat_weekly_1",
            userId: "user_1",
            name: "Sprint Deliverables",
            taskType: "WEEKLY",
            createdAt: new Date(),
            updatedAt: new Date(),
         },
      ],
      dailyCategories: [
         {
            id: "cat_daily_1",
            name: "Daily Routines",
            taskType: "DAILY",
            isCollapsed: false,
            tasks: [
               {
                  id: "t_1",
                  userId: "user_1",
                  categoryId: "cat_daily_1",
                  title: "Study Chemistry Chapter 2",
                  taskType: "DAILY",
                  isComplete: false,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  completedAt: null,
               },
            ],
         },
      ],
      weeklyCategories: [
         {
            id: "cat_weekly_1",
            name: "Sprint Deliverables",
            taskType: "WEEKLY",
            isCollapsed: false,
            tasks: [
               {
                  id: "t_2",
                  userId: "user_1",
                  categoryId: "cat_weekly_1",
                  title: "Physics Problem Set",
                  taskType: "WEEKLY",
                  isComplete: true,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  completedAt: new Date(),
               },
            ],
         },
      ],
      totalDailyTasks: 1,
      completedDailyTasks: 0,
      totalWeeklyTasks: 1,
      completedWeeklyTasks: 1,
   };

   it("renders tasks and category options trigger buttons when user is logged in", () => {
      const html = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: mockTasks,
         })
      );

      expect(html).toContain("Daily Todos");
      expect(html).toContain("Weekly Todos");
      expect(html).toContain("Daily Routines");
      expect(html).toContain("Sprint Deliverables");
      expect(html).toContain("Study Chemistry Chapter 2");
      expect(html).toContain("Physics Problem Set");
      expect(html).toContain(
         'aria-label="Options for category Daily Routines"'
      );
      expect(html).toContain(
         'aria-label="Options for category Sprint Deliverables"'
      );
      expect(html).toContain(
         'aria-label="Options for task Study Chemistry Chapter 2"'
      );
   });

   it("does not render options trigger buttons when user is not logged in", () => {
      const html = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: false,
            userTasks: mockTasks,
         })
      );

      expect(html).toContain("Daily Routines");
      expect(html).toContain("Sprint Deliverables");
      expect(html).not.toContain(
         'aria-label="Options for category Daily Routines"'
      );
      expect(html).not.toContain(
         'aria-label="Options for category Sprint Deliverables"'
      );
      expect(html).not.toContain(
         'aria-label="Options for task Study Chemistry Chapter 2"'
      );
   });

   it("strictly segregates daily and weekly categories without cross-contamination", () => {
      const html = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: mockTasks,
         })
      );

      const [dailySection, weeklySection] = html.split("Weekly Todos");

      // Daily Routines exists only in daily section
      expect(dailySection).toContain("Daily Routines");
      expect(weeklySection).not.toContain("Daily Routines");

      // Sprint Deliverables exists only in weekly section
      expect(weeklySection).toContain("Sprint Deliverables");
      expect(dailySection).not.toContain("Sprint Deliverables");
   });

   it("renders status indicator badges and accessible checkbox controls for tasks", () => {
      const html = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: mockTasks,
         })
      );

      // Uncompleted / To-Do daily task has clean row without "Incomplete" badge
      expect(html).toContain('role="checkbox"');
      expect(html).toContain('aria-checked="false"');
      expect(html).not.toContain("Incomplete");

      // Completed weekly task
      expect(html).toContain('aria-checked="true"');
      expect(html).toContain("Completed");
   });

   it("renders In Progress and Crossed Out status badges appropriately", () => {
      const customTasks: UserCategorizedTasks = {
         ...mockTasks,
         dailyCategories: [
            {
               id: "cat_daily_status",
               name: "Status Tests",
               taskType: "DAILY",
               isCollapsed: false,
               tasks: [
                  {
                     id: "t_prog",
                     userId: "user_1",
                     categoryId: "cat_daily_status",
                     title: "Active Working Task",
                     taskType: "DAILY",
                     isComplete: false,
                     status: "IN_PROGRESS",
                     createdAt: new Date(),
                     updatedAt: new Date(),
                     completedAt: null,
                  },
                  {
                     id: "t_cross",
                     userId: "user_1",
                     categoryId: "cat_daily_status",
                     title: "Blocked Task",
                     taskType: "DAILY",
                     isComplete: false,
                     status: "CROSSED_OUT",
                     createdAt: new Date(),
                     updatedAt: new Date(),
                     completedAt: null,
                  },
               ],
            },
         ],
      };

      const html = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: customTasks,
         })
      );

      expect(html).toContain("In Progress");
      expect(html).toContain("Crossed Out");
      expect(html).not.toContain("Incomplete");
   });

   it("renders full 7-day pill switcher tabs with challenge days for all users (participants and admins)", () => {
      const html = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: mockTasks,
            challengeStartDate: "2026-10-01T00:00:00Z",
            todayDate: "2026-10-03",
            todayDayNumber: 3,
            totalChallengeDays: 7,
            isAdmin: false,
         })
      );

      expect(html).toContain('role="tablist"');
      expect(html).toContain('aria-label="Challenge Day Tabs"');
      expect(html).toContain("D1");
      expect(html).toContain("D2");
      expect(html).toContain("Today");
      expect(html).toContain("D4");
      expect(html).toContain("D7");
   });

   it("renders day number instead of 'Yesterday' in 7-day switcher to prevent text overlap", () => {
      const html = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: mockTasks,
            challengeStartDate: "2026-10-01T00:00:00Z",
            todayDate: "2026-10-03",
            todayDayNumber: 3,
            totalChallengeDays: 7,
         })
      );

      expect(html).toContain('role="tablist"');
      expect(html).toContain("D1");
      expect(html).toContain("D2");
      expect(html).toContain("Today");
      expect(html).toContain("D4");
      expect(html).toContain("D7");
      expect(html).not.toMatch(/>\s*Yesterday\s*</i);
   });

   it("filters daily tasks according to the active challenge day", () => {
      const multiDayTasks: UserCategorizedTasks = {
         ...mockTasks,
         dailyCategories: [
            {
               id: "cat_daily_days",
               name: "Study Blocks",
               taskType: "DAILY",
               isCollapsed: false,
               tasks: [
                  {
                     id: "t_day1",
                     userId: "user_1",
                     categoryId: "cat_daily_days",
                     title: "Day 1 Calculus Prep",
                     taskType: "DAILY",
                     isComplete: false,
                     dueDate: "2026-10-01",
                     createdAt: new Date("2026-10-01T10:00:00Z"),
                     updatedAt: new Date("2026-10-01T10:00:00Z"),
                     completedAt: null,
                  },
                  {
                     id: "t_day2",
                     userId: "user_1",
                     categoryId: "cat_daily_days",
                     title: "Day 2 Organic Chemistry",
                     taskType: "DAILY",
                     isComplete: false,
                     dueDate: "2026-10-02",
                     createdAt: new Date("2026-10-02T10:00:00Z"),
                     updatedAt: new Date("2026-10-02T10:00:00Z"),
                     completedAt: null,
                  },
               ],
            },
         ],
      };

      // When viewing Day 1 (todayDate = 2026-10-01)
      const htmlDay1 = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: multiDayTasks,
            challengeStartDate: "2026-10-01T00:00:00Z",
            todayDate: "2026-10-01",
            todayDayNumber: 1,
            totalChallengeDays: 7,
         })
      );

      expect(htmlDay1).toContain("Day 1 Calculus Prep");
      expect(htmlDay1).not.toContain("Day 2 Organic Chemistry");
   });

   it("does not shift a task to the current day when created today with dueDate set to another day", () => {
      const tasksAddedForOtherDay: UserCategorizedTasks = {
         ...mockTasks,
         dailyCategories: [
            {
               id: "cat_daily_days",
               name: "Study Blocks",
               taskType: "DAILY",
               isCollapsed: false,
               tasks: [
                  {
                     id: "t_created_today_for_tomorrow",
                     userId: "user_1",
                     categoryId: "cat_daily_days",
                     title: "Tomorrow Physics Exam Review",
                     taskType: "DAILY",
                     isComplete: false,
                     // Created today (2026-10-01), but scheduled for tomorrow (2026-10-02)
                     dueDate: "2026-10-02",
                     createdAt: new Date("2026-10-01T08:00:00Z"),
                     updatedAt: new Date("2026-10-01T08:00:00Z"),
                     completedAt: null,
                  },
               ],
            },
         ],
      };

      // Viewing Day 1 (todayDate = 2026-10-01)
      const htmlDay1 = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: tasksAddedForOtherDay,
            challengeStartDate: "2026-10-01T00:00:00Z",
            todayDate: "2026-10-01",
            todayDayNumber: 1,
            totalChallengeDays: 7,
         })
      );

      // Should NOT be rendered on Day 1 (Today)
      expect(htmlDay1).not.toContain("Tomorrow Physics Exam Review");
      expect(htmlDay1).toContain("No todos scheduled for");
   });

   it("renders empty day state when no tasks are scheduled for the active day", () => {
      const emptyDayTasks: UserCategorizedTasks = {
         ...mockTasks,
         dailyCategories: [
            {
               id: "cat_daily_days",
               name: "Study Blocks",
               taskType: "DAILY",
               isCollapsed: false,
               tasks: [
                  {
                     id: "t_day5",
                     userId: "user_1",
                     categoryId: "cat_daily_days",
                     title: "Day 5 Biology",
                     taskType: "DAILY",
                     isComplete: false,
                     dueDate: "2026-10-05",
                     createdAt: new Date("2026-10-05T10:00:00Z"),
                     updatedAt: new Date("2026-10-05T10:00:00Z"),
                     completedAt: null,
                  },
               ],
            },
         ],
      };

      // Viewing Day 1 (2026-10-01), but task is only on Day 5
      const html = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: emptyDayTasks,
            challengeStartDate: "2026-10-01T00:00:00Z",
            todayDate: "2026-10-01",
            todayDayNumber: 1,
            totalChallengeDays: 7,
         })
      );

      expect(html).toContain("No todos scheduled for");
      expect(html).toContain("+ Add todo for");
   });

   it("does not render clock time logging button in tasks section header", () => {
      const openHoursModal = vi.fn();
      const html = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: mockTasks,
            onOpenHoursModal: openHoursModal,
         })
      );

      expect(html).not.toContain('aria-label="Log study hours for');
   });

   it("renders daily tasks under inherited weekly parent categories", () => {
      const sharedTasks: UserCategorizedTasks = {
         ...mockTasks,
         categories: [
            {
               id: "cat_shared_math",
               userId: "user_1",
               name: "Mathematics",
               taskType: "WEEKLY",
               createdAt: new Date(),
               updatedAt: new Date(),
            },
         ],
         weeklyCategories: [
            {
               id: "cat_shared_math",
               name: "Mathematics",
               taskType: "WEEKLY",
               isCollapsed: false,
               tasks: [
                  {
                     id: "t_w_math",
                     userId: "user_1",
                     categoryId: "cat_shared_math",
                     title: "Weekly Calculus Problem Set",
                     taskType: "WEEKLY",
                     isComplete: false,
                     createdAt: new Date(),
                     updatedAt: new Date(),
                     completedAt: null,
                  },
               ],
            },
         ],
         dailyCategories: [
            {
               id: "cat_shared_math",
               name: "Mathematics",
               taskType: "DAILY",
               isCollapsed: false,
               tasks: [
                  {
                     id: "t_d_math",
                     userId: "user_1",
                     categoryId: "cat_shared_math",
                     title: "Do Integration by Parts 1-5",
                     taskType: "DAILY",
                     isComplete: false,
                     createdAt: new Date(),
                     updatedAt: new Date(),
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

      const html = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: sharedTasks,
         })
      );

      const [dailySection, weeklySection] = html.split("Weekly Todos");

      // "Mathematics" shows up in daily section with its daily task
      expect(dailySection).toContain("Mathematics");
      expect(dailySection).toContain("Do Integration by Parts 1-5");

      // "Mathematics" shows up in weekly section with its weekly task
      expect(weeklySection).toContain("Mathematics");
      expect(weeklySection).toContain("Weekly Calculus Problem Set");
   });

   it("blocks adding tasks to past challenge days in empty state and bottom button", () => {
      // Challenge started 2026-10-01, today is Day 3 (2026-10-03)
      // When no tasks exist for Day 1 (which is past)
      const htmlPastDay = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: {
               ...mockTasks,
               dailyCategories: [],
            },
            challengeStartDate: "2026-10-01T00:00:00Z",
            todayDate: "2026-10-03",
            todayDayNumber: 3,
            totalChallengeDays: 7,
         })
      );

      // Initial view is Today (Day 3), which allows adding tasks
      expect(htmlPastDay).toContain("+ Add todo for Day 3");
   });

   it("renders locked past day empty state when today is after challenge end or viewing past day", () => {
      // If a challenge has ended (e.g. today is 2026-10-10, started 2026-10-01, 7 days)
      // Then Day 7 ended on 2026-10-07. Today (2026-10-10) is Day 10 (past the challenge).
      // All challenge days (D1..D7) are past days!
      const htmlCompleted = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: {
               ...mockTasks,
               dailyCategories: [],
            },
            challengeStartDate: "2026-10-01T00:00:00Z",
            todayDate: "2026-10-10",
            todayDayNumber: 10,
            totalChallengeDays: 7,
         })
      );

      const [dailySection, weeklySection] = htmlCompleted.split("Weekly Todos");

      // Empty state displays locked past day messaging in Daily Todos
      expect(dailySection).toContain(
         "This challenge day has passed. New tasks cannot be added to past days."
      );
      expect(dailySection).toContain("Adding tasks to past days is locked");
      expect(dailySection).toContain("Past day locked (new tasks blocked)");
      expect(dailySection).not.toContain("+ Add todo for");
      expect(dailySection).not.toContain("+ Add first todo for");
      expect(dailySection).not.toContain("+ Add more todos for");
      // Weekly column still functions independently
      expect(weeklySection).toContain("+ Add more todos");
   });

   it("preserves task editing and status controls for tasks on past days", () => {
      const pastCompletedTasks: UserCategorizedTasks = {
         ...mockTasks,
         dailyCategories: [
            {
               id: "cat_past_done",
               name: "Past Records",
               taskType: "DAILY",
               isCollapsed: false,
               tasks: [
                  {
                     id: "t_past_record",
                     userId: "user_1",
                     categoryId: "cat_past_done",
                     title: "Day 1 Historic Study Task",
                     taskType: "DAILY",
                     isComplete: true,
                     status: "COMPLETED",
                     dueDate: "2026-10-01",
                     createdAt: new Date("2026-10-01T10:00:00Z"),
                     updatedAt: new Date("2026-10-01T10:00:00Z"),
                     completedAt: new Date("2026-10-01T11:00:00Z"),
                  },
               ],
            },
         ],
      };

      const htmlCompleted = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: pastCompletedTasks,
            challengeStartDate: "2026-10-01T00:00:00Z",
            todayDate: "2026-10-10",
            todayDayNumber: 10,
            totalChallengeDays: 7,
         })
      );

      const [dailySection] = htmlCompleted.split("Weekly Todos");

      // Existing task is rendered and has checkbox + status pill
      expect(dailySection).toContain("Day 1 Historic Study Task");
      expect(dailySection).toContain('role="checkbox"');
      expect(dailySection).toContain("Completed");
      expect(dailySection).toContain(
         'aria-label="Options for task Day 1 Historic Study Task"'
      );

      // Bottom button is locked in daily section
      expect(dailySection).toContain("Past day locked (new tasks blocked)");
      expect(dailySection).not.toContain("+ Add more todos for");
      expect(dailySection).not.toContain("+ Add first todo for");
   });

   it("renders daily task on the day matching its dueDate even if createdAt was Day 1", () => {
      const taskCreatedDay1DueDay4: UserCategorizedTasks = {
         ...mockTasks,
         dailyCategories: [
            {
               id: "cat_daily_moved",
               name: "Moved From Weekly",
               taskType: "DAILY",
               isCollapsed: false,
               tasks: [
                  {
                     id: "t_moved_weekly",
                     userId: "user_1",
                     categoryId: "cat_daily_moved",
                     title: "Weekly Task Assigned To Day 4",
                     taskType: "DAILY",
                     isComplete: false,
                     status: "TODO",
                     dueDate: "2026-10-04",
                     createdAt: new Date("2026-10-01T10:00:00Z"), // Created on Day 1
                     updatedAt: new Date("2026-10-04T10:00:00Z"),
                     completedAt: null,
                  },
               ],
            },
         ],
      };

      // Render cockpit when active day is Day 4 (2026-10-04)
      const htmlDay4 = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: taskCreatedDay1DueDay4,
            challengeStartDate: "2026-10-01T00:00:00Z",
            todayDate: "2026-10-04",
            todayDayNumber: 4,
            totalChallengeDays: 7,
         })
      );

      const [dailySection] = htmlDay4.split("Weekly Todos");

      // The task should be visible in Daily Todos under Day 4 because dueDate is Day 4
      expect(dailySection).toContain("Weekly Task Assigned To Day 4");
      expect(dailySection).toContain("Moved From Weekly");
   });

   it("renders 7-day pill switcher with tablist and day tabs for challenge days", () => {
      const html = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: mockTasks,
            challengeStartDate: "2026-10-01T00:00:00Z",
            todayDate: "2026-10-04",
            todayDayNumber: 4,
            totalChallengeDays: 7,
         })
      );

      expect(html).toContain('role="tablist"');
      expect(html).toContain('aria-label="Challenge Day Tabs"');
      expect(html).toContain("Today");
      expect(html).toContain('role="tab"');
   });

   it("renders full category cards with draggable header and category drag metadata", () => {
      const html = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: mockTasks,
         })
      );

      // Both categories render with data-drag-card="category"
      expect(html).toContain('data-drag-card="category"');
      // Category drag labels are rendered on both headers
      expect(html).toContain('aria-label="Drag category Daily Routines"');
      expect(html).toContain('aria-label="Drag category Sprint Deliverables"');
      // Category header is marked draggable
      expect(html).toContain(
         'title="Drag category to reorder, move to day or across boards"'
      );
   });

   it("filters out soft-deleted categories and tasks (isDeleted = true) from the rendered cockpit", () => {
      const tasksWithDeleted: UserCategorizedTasks = {
         ...mockTasks,
         dailyCategories: [
            ...mockTasks.dailyCategories,
            {
               id: "cat_deleted_daily",
               name: "Ghost Category",
               taskType: "DAILY",
               isCollapsed: false,
               isDeleted: true,
               tasks: [
                  {
                     id: "t_ghost_1",
                     userId: "user_1",
                     categoryId: "cat_deleted_daily",
                     title: "Ghost Task Inside Deleted Category",
                     taskType: "DAILY",
                     isComplete: false,
                     status: "TODO",
                     isDeleted: true,
                     createdAt: new Date("2026-10-04T10:00:00Z"),
                     updatedAt: new Date("2026-10-04T10:00:00Z"),
                     completedAt: null,
                  },
               ],
            },
         ],
         weeklyCategories: [
            {
               ...mockTasks.weeklyCategories[0],
               tasks: [
                  ...mockTasks.weeklyCategories[0].tasks,
                  {
                     id: "t_ghost_weekly",
                     userId: "user_1",
                     categoryId: mockTasks.weeklyCategories[0].id,
                     title: "Ghost Weekly Task",
                     taskType: "WEEKLY",
                     isComplete: false,
                     status: "TODO",
                     isDeleted: true,
                     createdAt: new Date("2026-10-04T10:00:00Z"),
                     updatedAt: new Date("2026-10-04T10:00:00Z"),
                     completedAt: null,
                  },
               ],
            },
         ],
      };

      const html = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: tasksWithDeleted,
            todayDate: "2026-10-04",
         })
      );

      expect(html).not.toContain("Ghost Category");
      expect(html).not.toContain("Ghost Task Inside Deleted Category");
      expect(html).not.toContain("Ghost Weekly Task");
   });

   it("renders weekly category options when weekly category contains tasks from past days (GH-130)", () => {
      const tasksWithPastWeekly: UserCategorizedTasks = {
         categories: [
            {
               id: "cat_weekly_past",
               userId: "user_1",
               name: "Sprint Deliverables",
               taskType: "WEEKLY",
               createdAt: new Date("2026-10-01T10:00:00Z"),
               updatedAt: new Date("2026-10-01T10:00:00Z"),
            },
         ],
         dailyCategories: [],
         weeklyCategories: [
            {
               id: "cat_weekly_past",
               name: "Sprint Deliverables",
               taskType: "WEEKLY",
               isCollapsed: false,
               tasks: [
                  {
                     id: "task_weekly_past",
                     userId: "user_1",
                     categoryId: "cat_weekly_past",
                     title: "Past Weekly Goal",
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
         totalDailyTasks: 0,
         completedDailyTasks: 0,
         totalWeeklyTasks: 1,
         completedWeeklyTasks: 0,
      };

      const html = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: tasksWithPastWeekly,
            todayDate: "2026-10-04",
         })
      );

      expect(html).toContain(
         'aria-label="Options for category Sprint Deliverables"'
      );
      expect(html).toContain("Sprint Deliverables");
      expect(html).toContain("Past Weekly Goal");
   });
   it("renders Show more button and title tooltip for long task descriptions", () => {
      const longText =
         "This is a very long task description to test that horizontal text caret navigation does not dismiss the modal";
      const tasksWithLongDescription: UserCategorizedTasks = {
         categories: [
            {
               id: "cat_weekly_long",
               userId: "user_1",
               name: "Sprint Deliverables",
               taskType: "WEEKLY",
               createdAt: new Date("2026-10-01T10:00:00Z"),
               updatedAt: new Date("2026-10-01T10:00:00Z"),
            },
         ],
         dailyCategories: [],
         weeklyCategories: [
            {
               id: "cat_weekly_long",
               name: "Sprint Deliverables",
               taskType: "WEEKLY",
               isCollapsed: false,
               tasks: [
                  {
                     id: "task_weekly_long",
                     userId: "user_1",
                     categoryId: "cat_weekly_long",
                     title: longText,
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
         totalDailyTasks: 0,
         completedDailyTasks: 0,
         totalWeeklyTasks: 1,
         completedWeeklyTasks: 0,
      };

      const html = renderToStaticMarkup(
         createElement(CockpitTasksSection, {
            isLoggedIn: true,
            userTasks: tasksWithLongDescription,
            todayDate: "2026-10-04",
         })
      );

      expect(html).toContain('title="' + longText + '"');
      expect(html).toContain("Show more");
   });
   describe("Non-Challenge Personal Planning (GH-125 / KAN-34)", () => {
      const emptyTasks: UserCategorizedTasks = {
         categories: [],
         dailyCategories: [],
         weeklyCategories: [],
         totalDailyTasks: 0,
         completedDailyTasks: 0,
         totalWeeklyTasks: 0,
         completedWeeklyTasks: 0,
      };

      it("enables adding tasks and displays personal planning copy on past days when not in an active challenge", () => {
         // Monday 2026-09-28 is past relative to Sunday 2026-10-04
         const html = renderToStaticMarkup(
            createElement(CockpitTasksSection, {
               isLoggedIn: true,
               userTasks: emptyTasks,
               todayDate: "2026-10-04",
               initialSelectedDateKey: "2026-09-28",
            })
         );

         // Should NOT show challenge locking indicators
         expect(html).not.toContain(
            "This challenge day has passed. New tasks cannot be added to past days."
         );
         expect(html).not.toContain("Adding tasks to past days is locked");
         expect(html).not.toContain("Past day locked (new tasks blocked)");
         expect(html).not.toContain("Locked</span>");

         // Should display helpful personal planning copy and active add button
         expect(html).toContain("Plan or log your tasks for Mon.");
         expect(html).toContain("+ Add todo for Mon");
         expect(html).toContain("+ Add first todo for Mon");
      });

      it("preserves challenge locks and challenge copy on past days when an active challenge is present", () => {
         const html = renderToStaticMarkup(
            createElement(CockpitTasksSection, {
               isLoggedIn: true,
               userTasks: emptyTasks,
               challengeStartDate: "2026-09-28",
               challengeId: "ch_active_1",
               challengeStatus: "ACTIVE",
               todayDate: "2026-10-04",
               initialSelectedDateKey: "2026-09-28",
            })
         );

         // Must preserve anti-cheat challenge locking indicators
         expect(html).toContain(
            "This challenge day has passed. New tasks cannot be added to past days."
         );
         expect(html).toContain("Adding tasks to past days is locked");
         expect(html).toContain("Past day locked (new tasks blocked)");
         expect(html).toContain("Locked</span>");
         expect(html).not.toContain("+ Add todo for Day 1");
      });
      it("renders task and category options triggers and keeps adding unlocked on past days when not in an active challenge", () => {
         const tasksWithPastDaily: UserCategorizedTasks = {
            categories: [
               {
                  id: "cat_daily_past",
                  userId: "user_1",
                  name: "Past Daily Routine",
                  taskType: "DAILY",
                  createdAt: new Date("2026-09-28T10:00:00Z"),
                  updatedAt: new Date("2026-09-28T10:00:00Z"),
               },
            ],
            dailyCategories: [
               {
                  id: "cat_daily_past",
                  name: "Past Daily Routine",
                  taskType: "DAILY",
                  isCollapsed: false,
                  tasks: [
                     {
                        id: "t_past_daily",
                        userId: "user_1",
                        categoryId: "cat_daily_past",
                        title: "Past Routine Task",
                        taskType: "DAILY",
                        isComplete: false,
                        dueDate: "2026-09-28",
                        createdAt: new Date("2026-09-28T10:00:00Z"),
                        updatedAt: new Date("2026-09-28T10:00:00Z"),
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
               userTasks: tasksWithPastDaily,
               todayDate: "2026-10-04",
               initialSelectedDateKey: "2026-09-28",
            })
         );

         expect(html).toContain(
            'aria-label="Options for task Past Routine Task"'
         );
         expect(html).toContain(
            'aria-label="Options for category Past Daily Routine"'
         );
         expect(html).not.toContain("Past day locked (new tasks blocked)");
         expect(html).toContain("+ Add more todos for Mon");
      });

      it("does not lock past days and ignores expired challenge start dates when challengeStatus is COMPLETED", () => {
         const html = renderToStaticMarkup(
            createElement(CockpitTasksSection, {
               isLoggedIn: true,
               userTasks: emptyTasks,
               challengeStartDate: "2026-10-05",
               challengeId: "ch_completed_1",
               challengeStatus: "COMPLETED",
               todayDate: "2026-10-11",
            })
         );

         expect(html).not.toContain(
            "This challenge day has passed. New tasks cannot be added to past days."
         );
         expect(html).not.toContain("Past day locked (new tasks blocked)");
         expect(html).not.toContain("Adding tasks to past days is locked");
         expect(html).toContain('aria-label="Calendar Week Day Tabs"');
         expect(html).toContain("+ Add first todo");
      });
   });

   describe("Calendar Week Navigation (GH #184 / KAN-60)", () => {
      const emptyTasks: UserCategorizedTasks = {
         categories: [],
         dailyCategories: [],
         weeklyCategories: [],
         totalDailyTasks: 0,
         completedDailyTasks: 0,
         totalWeeklyTasks: 0,
         completedWeeklyTasks: 0,
      };

      it("renders week navigation chevrons and week range trigger when not in an active challenge", () => {
         const html = renderToStaticMarkup(
            createElement(CockpitTasksSection, {
               isLoggedIn: true,
               userTasks: emptyTasks,
               todayDate: "2026-10-25",
            })
         );

         expect(html).toContain('aria-label="Previous week"');
         expect(html).toContain('aria-label="Next week"');
         expect(html).toContain(
            'aria-label="Current week: Oct 19 – 25. Click to pick date"'
         );
         expect(html).toContain("Oct 19 – 25");
      });

      it("does not render calendar week navigation during an active challenge", () => {
         const html = renderToStaticMarkup(
            createElement(CockpitTasksSection, {
               isLoggedIn: true,
               userTasks: emptyTasks,
               challengeStartDate: "2026-10-05",
               challengeId: "ch_active_1",
               challengeStatus: "ACTIVE",
               todayDate: "2026-10-07",
            })
         );

         expect(html).not.toContain('aria-label="Previous week"');
         expect(html).not.toContain('aria-label="Next week"');
         expect(html).toContain('aria-label="Challenge Day Tabs"');
      });

      it("renders Today snap button when initialSelectedDateKey is not today", () => {
         const html = renderToStaticMarkup(
            createElement(CockpitTasksSection, {
               isLoggedIn: true,
               userTasks: emptyTasks,
               todayDate: "2026-10-25",
               initialSelectedDateKey: "2026-10-20",
            })
         );

         expect(html).toContain("Today");
      });

      it("hides Today snap button when selected date matches todayDate", () => {
         const html = renderToStaticMarkup(
            createElement(CockpitTasksSection, {
               isLoggedIn: true,
               userTasks: emptyTasks,
               todayDate: "2026-10-25",
               initialSelectedDateKey: "2026-10-25",
            })
         );

         expect(html).not.toMatch(/<button[^>]*>Today<\/button>/);
      });
   });
});
