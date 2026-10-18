/** Maximum seconds allowed for a single calendar day's study log (Law L8 / FEAT-LOG-02). */
export const MAX_DAILY_LOG_SECONDS = 86_400;

/** Minimum declared weekly target: 1 hour (FEAT-DECL-01). */
export const MIN_WEEKLY_TARGET_SECONDS = 3_600;

/** Maximum declared weekly target: 105 hours (FEAT-DECL-01). */
export const MAX_WEEKLY_TARGET_SECONDS = 378_000;

export class DurationParseError extends Error {
   constructor(message: string) {
      super(message);
      this.name = "DurationParseError";
   }
}

export class DurationRangeError extends Error {
   constructor(message: string) {
      super(message);
      this.name = "DurationRangeError";
   }
}

/**
 * Parses a clock duration string into total integer seconds.
 *
 * Accepted formats (per Law L8 / FEAT-LOG-01):
 * - `HH:MM:SS` (primary)
 * - `HH:MM` (seconds default to 0)
 *
 * Hours may exceed 23 for weekly targets (e.g. `35:00:00`).
 * Minutes and seconds must be in the range 0–59.
 */
export function parseDurationToSeconds(input: string): number {
   const trimmed = input.trim();
   if (trimmed.length === 0) {
      throw new DurationParseError("Duration string cannot be empty.");
   }

   const parts = trimmed.split(":");
   if (parts.length < 2 || parts.length > 3) {
      throw new DurationParseError(
         `Invalid duration format "${input}". Expected HH:MM:SS or HH:MM.`
      );
   }

   const [hoursPart, minutesPart, secondsPart = "0"] = parts;

   if (
      !/^\d+$/.test(hoursPart) ||
      !/^\d+$/.test(minutesPart) ||
      !/^\d+$/.test(secondsPart)
   ) {
      throw new DurationParseError(
         `Invalid duration format "${input}". Components must be non-negative integers.`
      );
   }

   const hours = Number(hoursPart);
   const minutes = Number(minutesPart);
   const seconds = Number(secondsPart);

   if (minutes > 59 || seconds > 59) {
      throw new DurationParseError(
         `Invalid duration "${input}". Minutes and seconds must be between 0 and 59.`
      );
   }

   const totalSeconds = hours * 3_600 + minutes * 60 + seconds;

   if (!Number.isSafeInteger(totalSeconds)) {
      throw new DurationParseError(
         `Duration "${input}" exceeds safe integer range.`
      );
   }

   return totalSeconds;
}

/**
 * Formats integer seconds as zero-padded `HH:MM:SS` (Law L8).
 */
export function formatSecondsToClock(totalSeconds: number): string {
   if (!Number.isInteger(totalSeconds)) {
      throw new DurationRangeError("Seconds must be an integer.");
   }

   if (totalSeconds < 0) {
      throw new DurationRangeError("Seconds cannot be negative.");
   }

   const hours = Math.floor(totalSeconds / 3_600);
   const minutes = Math.floor((totalSeconds % 3_600) / 60);
   const seconds = totalSeconds % 60;

   return [
      String(hours).padStart(2, "0"),
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0"),
   ].join(":");
}

/**
 * Formats integer seconds as human-readable `Xh Ym Zs`, omitting zero trailing units.
 * Used for lead margins and catch-up encouragement copy (DESIGN.md / FEAT-LEAD-01).
 */
export function formatSecondsToHuman(totalSeconds: number): string {
   if (!Number.isInteger(totalSeconds)) {
      throw new DurationRangeError("Seconds must be an integer.");
   }

   if (totalSeconds < 0) {
      throw new DurationRangeError("Seconds cannot be negative.");
   }

   if (totalSeconds === 0) {
      return "0s";
   }

   const hours = Math.floor(totalSeconds / 3_600);
   const minutes = Math.floor((totalSeconds % 3_600) / 60);
   const seconds = totalSeconds % 60;

   const parts: string[] = [];

   if (hours > 0) {
      parts.push(`${hours}h`);
   }
   if (minutes > 0) {
      parts.push(`${minutes}m`);
   }
   if (seconds > 0 || parts.length === 0) {
      parts.push(`${seconds}s`);
   }

   return parts.join(" ");
}

/**
 * Decomposes total integer seconds into hours, minutes, and seconds parts.
 * Non-integer or non-positive values default to zeros.
 */
export function decomposeSecondsToParts(totalSeconds: number): {
   hours: number;
   minutes: number;
   seconds: number;
} {
   if (!Number.isInteger(totalSeconds) || totalSeconds <= 0) {
      return { hours: 0, minutes: 0, seconds: 0 };
   }

   const hours = Math.floor(totalSeconds / 3_600);
   const minutes = Math.floor((totalSeconds % 3_600) / 60);
   const seconds = totalSeconds % 60;

   return { hours, minutes, seconds };
}
