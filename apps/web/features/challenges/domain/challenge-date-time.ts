/**
 * Pure domain utilities for formatting and parsing challenge date-times in strict UTC.
 * Invariant: Law L7 (Pure Domain Isolation), Law L8 (Second-Level Precision).
 * Zero reliance on local browser or server timezones.
 */

function pad(n: number): string {
   return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Formats any Date or ISO date string into the canonical UTC format `YYYY-MM-DDTHH:mm`
 * required by HTML5 `<input type="datetime-local">`.
 */
export function formatDateToUtcInputString(dateInput: Date | string): string {
   try {
      const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
      if (isNaN(d.getTime())) return "";

      const year = d.getUTCFullYear();
      const month = pad(d.getUTCMonth() + 1);
      const day = pad(d.getUTCDate());
      const hours = pad(d.getUTCHours());
      const minutes = pad(d.getUTCMinutes());

      return `${year}-${month}-${day}T${hours}:${minutes}`;
   } catch {
      return "";
   }
}

/**
 * Parses a `YYYY-MM-DDTHH:mm` (or with seconds) string explicitly as UTC wall-clock time
 * and returns a canonical ISO 8601 UTC string (`YYYY-MM-DDTHH:mm:ss.000Z`).
 *
 * Guarantees ZERO timezone drift regardless of what local timezone the browser
 * or server is running in.
 */
export function parseUtcInputStringToIso(inputStr: string): string {
   const trimmed = inputStr?.trim() || "";
   if (!trimmed) {
      throw new Error("Date input cannot be empty.");
   }

   // If already an ISO string with explicit timezone (Z or offset)
   if (trimmed.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
      const parsed = new Date(trimmed);
      if (isNaN(parsed.getTime()))
         throw new Error(`Invalid date string: "${inputStr}"`);
      return parsed.toISOString();
   }

   // Format: YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss
   const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(
      trimmed
   );
   if (!match) {
      const parsed = new Date(trimmed);
      if (isNaN(parsed.getTime()))
         throw new Error(`Invalid datetime-local format: "${inputStr}"`);
      return parsed.toISOString();
   }

   const year = parseInt(match[1], 10);
   const month = parseInt(match[2], 10) - 1;
   const day = parseInt(match[3], 10);
   const hours = parseInt(match[4], 10);
   const minutes = parseInt(match[5], 10);
   const seconds = match[6] ? parseInt(match[6], 10) : 0;

   const utcMs = Date.UTC(year, month, day, hours, minutes, seconds, 0);
   return new Date(utcMs).toISOString();
}

/**
 * Validates that the end date is strictly chronologically after the start date in UTC.
 */
export function isUtcDateRangeValid(startStr: string, endStr: string): boolean {
   try {
      const startIso = parseUtcInputStringToIso(startStr);
      const endIso = parseUtcInputStringToIso(endStr);
      return new Date(endIso).getTime() > new Date(startIso).getTime();
   } catch {
      return false;
   }
}
