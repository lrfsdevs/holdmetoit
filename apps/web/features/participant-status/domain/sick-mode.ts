import type {
   SickAutoExpiryCheckInput,
   SickModeDuration,
   SickReminderCheckInput,
} from "./sick-mode.types";

/** Maximum permitted character length for optional Sick Mode note (spec: 80 chars max). */
export const SICK_MODE_MAX_NOTE_LENGTH = 80;

/** Duration in hours before first non-blocking check-in reminder appears (3 days = 72 hours). */
export const SICK_MODE_REMINDER_THRESHOLD_HOURS = 72;

/** Duration in hours when participant extends reminder check-in (+2 days = 48 hours). */
export const SICK_MODE_REMINDER_SNOOZE_HOURS = 48;

/** Automatic deactivation safeguard duration in hours (7 consecutive days = 168 hours). */
export const SICK_MODE_AUTO_EXPIRY_HOURS = 168;

/**
 * Sanitizes and validates the participant's optional Sick Mode note.
 * Trims whitespace, removes multi-line line breaks and control characters, and enforces length constraint.
 */
export function sanitizeSickModeNote(note?: string | null): string | null {
   if (!note) return null;
   const sanitized = note
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

   if (sanitized.length === 0) return null;
   return sanitized.slice(0, SICK_MODE_MAX_NOTE_LENGTH);
}

/**
 * Parses an unknown date-like input safely into a Date object.
 */
function toDate(value: Date | string | null | undefined): Date | null {
   if (!value) return null;
   if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
   const parsed = new Date(value);
   return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Calculates the elapsed time and days since Sick Mode was activated.
 */
export function calculateSickDuration(
   activatedAt: Date | string | null | undefined,
   now: Date = new Date()
): SickModeDuration {
   const date = toDate(activatedAt);
   if (!date) {
      return { elapsedHours: 0, elapsedDays: 0, formattedDuration: "0d" };
   }

   const diffMs = Math.max(0, now.getTime() - date.getTime());
   const elapsedHours = Math.floor(diffMs / (1000 * 60 * 60));
   const elapsedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

   let formattedDuration: string;
   if (elapsedDays === 0) {
      formattedDuration = "< 1 day ago";
   } else if (elapsedDays === 1) {
      formattedDuration = "1 day ago";
   } else {
      formattedDuration = `${elapsedDays} days ago`;
   }

   return {
      elapsedHours,
      elapsedDays,
      formattedDuration,
   };
}

/**
 * Determines whether Sick Mode has auto-expired due to the 7-day (168h) consecutive safeguard.
 * In accordance with product spec: prevents abandoned stale badges.
 */
export function isSickModeAutoExpired(
   input: SickAutoExpiryCheckInput,
   now: Date = new Date()
): boolean {
   if (!input.isSick || !input.activatedAt) return false;
   const date = toDate(input.activatedAt);
   if (!date) return false;

   const diffMs = Math.max(0, now.getTime() - date.getTime());
   const diffHours = diffMs / (1000 * 60 * 60);
   return diffHours >= SICK_MODE_AUTO_EXPIRY_HOURS;
}

/**
 * Evaluates whether the 3-day (72h) check-in reminder prompt is due.
 *
 * Rules:
 * 1. False if participant is not currently in Sick Mode or activatedAt is missing.
 * 2. False if Sick Mode has reached the 7-day auto-expiry threshold (safeguard takes precedence).
 * 3. False if reminder was snoozed and the snooze timestamp is still in the future.
 * 4. True once at least 72 hours have elapsed since activation (or since previous snooze expiration).
 */
export function isSickReminderDue(
   input: SickReminderCheckInput,
   now: Date = new Date()
): boolean {
   if (!input.isSick || !input.activatedAt) return false;
   if (isSickModeAutoExpired(input, now)) return false;

   const activatedDate = toDate(input.activatedAt);
   if (!activatedDate) return false;

   const snoozedUntilDate = toDate(input.reminderSnoozedUntil);
   if (snoozedUntilDate && now.getTime() < snoozedUntilDate.getTime()) {
      return false;
   }

   const diffMs = Math.max(0, now.getTime() - activatedDate.getTime());
   const diffHours = diffMs / (1000 * 60 * 60);

   return diffHours >= SICK_MODE_REMINDER_THRESHOLD_HOURS;
}

/**
 * Formats the standard empathetic tooltip text for Sick Mode badge.
 * Spec: "Active since [Date] ([X] days ago). This participant is resting; study logs and weekly task progress may be delayed."
 */
export function getSickModeTooltipText(input: {
   activatedAt: Date | string | null | undefined;
   note?: string | null;
   now?: Date;
}): string {
   const now = input.now ?? new Date();
   const date = toDate(input.activatedAt);

   let durationText = "";
   let dateText = "";
   if (date) {
      const { formattedDuration } = calculateSickDuration(date, now);
      durationText = ` (${formattedDuration})`;
      dateText = date.toLocaleDateString("en-US", {
         month: "short",
         day: "numeric",
      });
   }

   const basePrefix = dateText
      ? `Active since ${dateText}${durationText}. `
      : "";
   const coreNotice =
      "This participant is resting; study logs and weekly task progress may be delayed.";
   const sanitizedNote = sanitizeSickModeNote(input.note);

   if (sanitizedNote) {
      return `${basePrefix}${coreNotice}\nNote: "${sanitizedNote}"`;
   }
   return `${basePrefix}${coreNotice}`;
}
