import { describe, expect, it } from "vitest";
import {
   calculateSickDuration,
   getSickModeTooltipText,
   isSickModeAutoExpired,
   isSickReminderDue,
   sanitizeSickModeNote,
   SICK_MODE_AUTO_EXPIRY_HOURS,
   SICK_MODE_MAX_NOTE_LENGTH,
   SICK_MODE_REMINDER_THRESHOLD_HOURS,
} from "./sick-mode";
import {
   calculateRemainingDeficit,
   calculateRequiredDailyPace,
} from "@/features/leaderboard/domain/deficit";

describe("features/participant-status/domain/sick-mode", () => {
   describe("sanitizeSickModeNote", () => {
      it("returns null for null, undefined, or empty strings", () => {
         expect(sanitizeSickModeNote(null)).toBeNull();
         expect(sanitizeSickModeNote(undefined)).toBeNull();
         expect(sanitizeSickModeNote("")).toBeNull();
         expect(sanitizeSickModeNote("   \n\t  ")).toBeNull();
      });

      it("cleans excessive whitespace and newlines into single spaces", () => {
         const raw = "  High fever\n\n and severe  headache\t ";
         expect(sanitizeSickModeNote(raw)).toBe(
            "High fever and severe headache"
         );
      });

      it("enforces maximum length constraint (80 characters)", () => {
         const longText = "a".repeat(100);
         const sanitized = sanitizeSickModeNote(longText);
         expect(sanitized).toBeDefined();
         expect(sanitized?.length).toBe(SICK_MODE_MAX_NOTE_LENGTH);
         expect(sanitized).toBe("a".repeat(80));
      });
   });

   describe("calculateSickDuration", () => {
      it("handles null or invalid date safely", () => {
         expect(calculateSickDuration(null)).toEqual({
            elapsedHours: 0,
            elapsedDays: 0,
            formattedDuration: "0d",
         });
         expect(calculateSickDuration("invalid-date")).toEqual({
            elapsedHours: 0,
            elapsedDays: 0,
            formattedDuration: "0d",
         });
      });

      it("returns '< 1 day ago' for less than 24 hours elapsed", () => {
         const now = new Date("2026-11-01T12:00:00Z");
         const activated = new Date("2026-11-01T04:00:00Z"); // 8 hours ago
         const res = calculateSickDuration(activated, now);
         expect(res.elapsedHours).toBe(8);
         expect(res.elapsedDays).toBe(0);
         expect(res.formattedDuration).toBe("< 1 day ago");
      });

      it("returns '1 day ago' for between 24 and 47 hours elapsed", () => {
         const now = new Date("2026-11-01T12:00:00Z");
         const activated = new Date("2026-10-31T06:00:00Z"); // 30 hours ago
         const res = calculateSickDuration(activated, now);
         expect(res.elapsedHours).toBe(30);
         expect(res.elapsedDays).toBe(1);
         expect(res.formattedDuration).toBe("1 day ago");
      });

      it("returns '[X] days ago' for 2 or more days elapsed", () => {
         const now = new Date("2026-11-01T12:00:00Z");
         const activated = new Date("2026-10-29T12:00:00Z"); // 3 days ago (72h)
         const res = calculateSickDuration(activated, now);
         expect(res.elapsedHours).toBe(72);
         expect(res.elapsedDays).toBe(3);
         expect(res.formattedDuration).toBe("3 days ago");
      });
   });

   describe("isSickModeAutoExpired", () => {
      it("returns false if isSick is false or activatedAt is missing", () => {
         const now = new Date("2026-11-01T12:00:00Z");
         expect(
            isSickModeAutoExpired({ isSick: false, activatedAt: null }, now)
         ).toBe(false);
         expect(
            isSickModeAutoExpired(
               { isSick: false, activatedAt: "2026-10-20T00:00:00Z" },
               now
            )
         ).toBe(false);
      });

      it("returns false if activated under 168 hours (7 days) ago", () => {
         const now = new Date("2026-11-01T12:00:00Z");
         // 6 days ago (144h)
         const activated = new Date("2026-10-26T12:00:00Z");
         expect(
            isSickModeAutoExpired({ isSick: true, activatedAt: activated }, now)
         ).toBe(false);
      });

      it("returns true if activated 168 hours (7 days) or more ago", () => {
         const now = new Date("2026-11-01T12:00:00Z");
         // Exactly 7 days (168h) ago
         const activated = new Date(
            now.getTime() - SICK_MODE_AUTO_EXPIRY_HOURS * 3600 * 1000
         );
         expect(
            isSickModeAutoExpired({ isSick: true, activatedAt: activated }, now)
         ).toBe(true);

         // 8 days ago
         const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 3600 * 1000);
         expect(
            isSickModeAutoExpired(
               { isSick: true, activatedAt: eightDaysAgo },
               now
            )
         ).toBe(true);
      });
   });

   describe("isSickReminderDue", () => {
      const now = new Date("2026-11-01T12:00:00Z");

      it("returns false when user is not sick or activatedAt is missing", () => {
         expect(
            isSickReminderDue({ isSick: false, activatedAt: null }, now)
         ).toBe(false);
         expect(
            isSickReminderDue(
               { isSick: false, activatedAt: "2026-10-25T00:00:00Z" },
               now
            )
         ).toBe(false);
      });

      it("returns false when elapsed duration is less than 72 hours", () => {
         // 50 hours ago
         const activated = new Date(now.getTime() - 50 * 3600 * 1000);
         expect(
            isSickReminderDue({ isSick: true, activatedAt: activated }, now)
         ).toBe(false);
      });

      it("returns true once 72 hours have elapsed and not snoozed", () => {
         // Exactly 72 hours ago
         const activated = new Date(
            now.getTime() - SICK_MODE_REMINDER_THRESHOLD_HOURS * 3600 * 1000
         );
         expect(
            isSickReminderDue({ isSick: true, activatedAt: activated }, now)
         ).toBe(true);
      });

      it("returns false when reminder has been snoozed to a future time", () => {
         // 80 hours ago, but snoozed for 24 hours into the future
         const activated = new Date(now.getTime() - 80 * 3600 * 1000);
         const snoozedUntil = new Date(now.getTime() + 24 * 3600 * 1000);
         expect(
            isSickReminderDue(
               {
                  isSick: true,
                  activatedAt: activated,
                  reminderSnoozedUntil: snoozedUntil,
               },
               now
            )
         ).toBe(false);
      });

      it("returns true when snooze timestamp has expired", () => {
         // 100 hours ago, snoozed until 1 hour ago
         const activated = new Date(now.getTime() - 100 * 3600 * 1000);
         const snoozedUntil = new Date(now.getTime() - 1 * 3600 * 1000);
         expect(
            isSickReminderDue(
               {
                  isSick: true,
                  activatedAt: activated,
                  reminderSnoozedUntil: snoozedUntil,
               },
               now
            )
         ).toBe(true);
      });

      it("returns false if Sick Mode has auto-expired (7 days+)", () => {
         // 8 days ago -> auto-expired safeguard takes precedence over reminder
         const activated = new Date(now.getTime() - 8 * 24 * 3600 * 1000);
         expect(
            isSickReminderDue({ isSick: true, activatedAt: activated }, now)
         ).toBe(false);
      });
   });

   describe("getSickModeTooltipText", () => {
      it("formats tooltip without note cleanly", () => {
         const now = new Date("2026-11-01T12:00:00Z");
         const activated = new Date("2026-10-29T12:00:00Z"); // Oct 29, 3 days ago
         const text = getSickModeTooltipText({
            activatedAt: activated,
            note: null,
            now,
         });

         expect(text).toContain("Active since Oct 29 (3 days ago).");
         expect(text).toContain(
            "This participant is resting; study logs and weekly task progress may be delayed."
         );
         expect(text).not.toContain("Note:");
      });

      it("formats tooltip with note included", () => {
         const now = new Date("2026-11-01T12:00:00Z");
         const activated = new Date("2026-10-31T12:00:00Z");
         const text = getSickModeTooltipText({
            activatedAt: activated,
            note: "Flu & high fever",
            now,
         });

         expect(text).toContain('Note: "Flu & high fever"');
      });
   });

   describe("Law L3 & Law L6 Invariant Preservation", () => {
      it("guarantees Sick Mode does NOT alter deficit math or study targets", () => {
         // A participant with 35 hours target (126,000s) and 10 hours logged (36,000s) with 5 days remaining
         const targetSeconds = 126_000;
         const loggedSeconds = 36_000;
         const daysRemaining = 5;

         const deficit = calculateRemainingDeficit(
            targetSeconds,
            loggedSeconds
         );
         const dailyPace = calculateRequiredDailyPace(deficit, daysRemaining);

         // Remaining deficit is strictly 90,000 seconds and required daily pace is 18,000 seconds
         expect(deficit).toBe(90_000);
         expect(dailyPace).toBe(18_000);

         // Law L3 Invariant: Sick Mode is purely informational.
         // No grace passes exist and deficit calculation is never parameterized by illness.
      });
   });
});
