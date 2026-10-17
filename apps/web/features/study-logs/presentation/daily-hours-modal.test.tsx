import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DailyHoursModal } from "./daily-hours-modal";

vi.mock("next/navigation", () => ({
   useRouter: () => ({
      refresh: vi.fn(),
   }),
}));

vi.mock("@/features/study-logs/api/log-study-time.actions", () => ({
   logStudyTimeAction: vi.fn(),
}));

describe("DailyHoursModal", () => {
   it("renders with empty inputs and 'Submit' when no hours have been logged today", () => {
      const html = renderToStaticMarkup(
         createElement(DailyHoursModal, {
            challengeId: "chal-1",
            isOpen: true,
            onClose: vi.fn(),
            todayDate: "2026-10-04",
            todayDayNumber: 2,
            todayLoggedSeconds: 0,
            yesterdayDate: "2026-10-03",
            yesterdayDayNumber: 1,
            yesterdayLoggedSeconds: 0,
            isYesterdayMissed: false,
         })
      );

      expect(html).toContain("How much did you study today?");
      expect(html).toContain("Submit");
      expect(html).not.toContain("Update Hours");
      expect(html).not.toContain("Previously committed:");
      expect(html).not.toContain("Yesterday (2026-10-03)");
   });

   it("pre-populates inputs and displays 'Update Hours' when user has previously committed hours without 'Previously committed' badge", () => {
      // 9,035 seconds = 2h 30m 35s
      const html = renderToStaticMarkup(
         createElement(DailyHoursModal, {
            challengeId: "chal-1",
            isOpen: true,
            onClose: vi.fn(),
            todayDate: "2026-10-04",
            todayDayNumber: 2,
            todayLoggedSeconds: 9035,
            yesterdayDate: "2026-10-03",
            yesterdayDayNumber: 1,
            yesterdayLoggedSeconds: 0,
         })
      );

      expect(html).toContain("How much did you study today?");
      expect(html).toContain('value="2"');
      expect(html).toContain('value="30"');
      expect(html).toContain('value="35"');
      expect(html).toContain("Update Hours");
      expect(html).not.toContain("Previously committed");
      expect(html).not.toContain("02:30:35");
   });

   it("shows 'Yesterday' toggle when isYesterdayMissed is true and pre-populates yesterday's hours when opened with initialDayNumber", () => {
      // 3,600 seconds = 1h
      const html = renderToStaticMarkup(
         createElement(DailyHoursModal, {
            challengeId: "chal-1",
            isOpen: true,
            onClose: vi.fn(),
            todayDate: "2026-10-04",
            todayDayNumber: 2,
            todayLoggedSeconds: 0,
            yesterdayDate: "2026-10-03",
            yesterdayDayNumber: 1,
            yesterdayLoggedSeconds: 3600,
            isYesterdayMissed: true,
            initialDayNumber: 1,
         })
      );

      expect(html).toContain("How much did you study yesterday?");
      expect(html).toContain("Yesterday (2026-10-03)");
      expect(html).toContain("Today (2026-10-04)");
      expect(html).toContain('value="1"');
      expect(html).toContain('value="0"');
      expect(html).toContain("Update Hours");
      expect(html).not.toContain("Previously committed");
   });

   it("hides 'Yesterday' toggle and defaults to today if isYesterdayMissed is false even if initialDate is yesterday", () => {
      const html = renderToStaticMarkup(
         createElement(DailyHoursModal, {
            challengeId: "chal-1",
            isOpen: true,
            onClose: vi.fn(),
            todayDate: "2026-10-04",
            todayDayNumber: 2,
            todayLoggedSeconds: 0,
            yesterdayDate: "2026-10-03",
            yesterdayDayNumber: 1,
            yesterdayLoggedSeconds: 3600,
            isYesterdayMissed: false,
            initialDayNumber: 1,
         })
      );

      expect(html).toContain("How much did you study today?");
      expect(html).not.toContain("Yesterday (2026-10-03)");
      expect(html).not.toContain("Today (2026-10-04)");
      expect(html).not.toContain("Previously committed");
   });

   it("renders null when isOpen is false", () => {
      const html = renderToStaticMarkup(
         createElement(DailyHoursModal, {
            challengeId: "chal-1",
            isOpen: false,
            onClose: vi.fn(),
            todayDate: "2026-10-04",
            todayDayNumber: 1,
         })
      );

      expect(html).toBe("");
   });

   it("renders full challenge week selector with future days disabled for admins", () => {
      const html = renderToStaticMarkup(
         createElement(DailyHoursModal, {
            challengeId: "chal-1",
            isOpen: true,
            onClose: vi.fn(),
            todayDate: "2026-10-06",
            todayDayNumber: 2,
            challengeStartDate: "2026-10-05",
            totalChallengeDays: 7,
            isAdmin: true,
         })
      );

      expect(html).toContain("Challenge Week Days");
      // Day 1 (past) and Day 2 (today)
      expect(html).toContain("D1");
      expect(html).toContain("Today");
      // Date picker input with min set to start date and max to today
      expect(html).toContain('type="date"');
      expect(html).toContain('max="2026-10-06"');
      expect(html).toContain('min="2026-10-05"');
      // Future days are disabled
      expect(html).toContain('disabled=""');
      expect(html).toContain("Future date (cannot log yet)");
   });

   it("pre-populates yesterday hours when opened with initialDayNumber for yesterday", () => {
      const html = renderToStaticMarkup(
         createElement(DailyHoursModal, {
            challengeId: "chal-1",
            isOpen: true,
            onClose: vi.fn(),
            todayDate: "2026-10-07",
            todayDayNumber: 3,
            yesterdayDate: "2026-10-06",
            yesterdayDayNumber: 2,
            isYesterdayMissed: true,
            initialDayNumber: 2,
            challengeStartDate: "2026-10-05",
            existingLogs: {
               "2026-10-06": 7200, // 2 hours on Day 2 (yesterday)
            },
         })
      );

      expect(html).toContain("How much did you study yesterday?");
      expect(html).toContain('value="2"');
      expect(html).toContain("Update Hours");
   });

   it("shows only editable days (yesterday and today) in clean 2-card layout for normal participants", () => {
      const html = renderToStaticMarkup(
         createElement(DailyHoursModal, {
            challengeId: "chal-1",
            isOpen: true,
            onClose: vi.fn(),
            todayDate: "2026-10-07",
            todayDayNumber: 3,
            yesterdayDate: "2026-10-06",
            yesterdayDayNumber: 2,
            challengeStartDate: "2026-10-05",
            totalChallengeDays: 7,
            isAdmin: false,
         })
      );

      // Shows 2-card selector header
      expect(html).toContain("Select Day to Log");
      expect(html).toContain("Yesterday");
      expect(html).toContain("Today");
      expect(html).toContain("D2");
      expect(html).toContain("D3");
      // Earlier days (Day 1) and future days are NOT rendered in participant layout
      expect(html).not.toContain("D1");
      expect(html).not.toContain("D4");
      expect(html).not.toContain("D5");
      expect(html).not.toContain("Future date (cannot log yet)");
      // Date picker is constrained to yesterday and today
      expect(html).toContain('min="2026-10-06"');
      expect(html).toContain('max="2026-10-07"');
   });

   it("renders leave visual cues when today is marked as leave", () => {
      const html = renderToStaticMarkup(
         createElement(DailyHoursModal, {
            challengeId: "chal-1",
            isOpen: true,
            onClose: vi.fn(),
            todayDate: "2026-10-07",
            todayDayNumber: 3,
            todayLoggedSeconds: 0,
            todayIsLeave: true,
            yesterdayDate: "2026-10-06",
            yesterdayDayNumber: 2,
            yesterdayLoggedSeconds: 0,
            challengeStartDate: "2026-10-05",
         })
      );

      // Displays visual leave banner
      expect(html).toContain("Marked as Leave Day");
      expect(html).toContain(
         "Day 3 (2026-10-07) is recorded as an approved leave day."
      );
      // Pre-populates 00:00:00
      expect(html).toContain('value="0"');
      // Button offers removing leave
      expect(html).toContain("🌴 Remove Leave");
      // Day card shows Leave badge
      expect(html).toContain("🌴 Leave");
   });

   it("renders 'Mark as Leave' button and no leave banner when day is not on leave", () => {
      const html = renderToStaticMarkup(
         createElement(DailyHoursModal, {
            challengeId: "chal-1",
            isOpen: true,
            onClose: vi.fn(),
            todayDate: "2026-10-07",
            todayDayNumber: 3,
            todayLoggedSeconds: 0,
            todayIsLeave: false,
            challengeStartDate: "2026-10-05",
         })
      );

      expect(html).not.toContain("Marked as Leave Day");
      expect(html).toContain("🌴 Mark as Leave");
      expect(html).not.toContain("🌴 Remove Leave");
   });
});
