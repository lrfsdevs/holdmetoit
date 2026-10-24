const DAY_MS = 24 * 60 * 60 * 1000;

const OBJECT_NAME_PATTERN =
   /^holdmetoit-(\d{4})-(\d{2})-(\d{2})(?:T(\d{2})-(\d{2})-(\d{2})Z)?\.dump$/;

/**
 * Returns the next 00:00:00.000 UTC strictly after `now`.
 * @param {Date|string|number} [now=new Date()]
 * @returns {Date}
 */
export function computeNextUtcMidnight(now = new Date()) {
   const current = new Date(now);
   return new Date(
      Date.UTC(
         current.getUTCFullYear(),
         current.getUTCMonth(),
         current.getUTCDate() + 1,
         0,
         0,
         0,
         0
      )
   );
}

/**
 * Builds the storage object name. Scheduled runs are day-scoped so restarts
 * cannot create duplicate dumps; manual runs keep second-level precision.
 * @param {Date|string|number} [now=new Date()]
 * @param {{ manual?: boolean }} [options]
 * @returns {string}
 */
export function buildObjectName(now = new Date(), options = {}) {
   const iso = new Date(now).toISOString();
   const day = iso.slice(0, 10);
   if (!options.manual) {
      return `holdmetoit-${day}.dump`;
   }
   return `holdmetoit-${iso.slice(0, 19).replace(/:/g, "-")}Z.dump`;
}

/**
 * Parses the UTC timestamp embedded in a backup object name.
 * @param {string} name
 * @returns {Date|null}
 */
export function parseObjectDate(name) {
   const match = OBJECT_NAME_PATTERN.exec(String(name || ""));
   if (!match) return null;

   const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
   const parts = [month, day, hour, minute, second].map(Number);

   if (
      parts[0] < 1 ||
      parts[0] > 12 ||
      parts[1] < 1 ||
      parts[1] > 31 ||
      parts[2] > 23 ||
      parts[3] > 59 ||
      parts[4] > 59
   ) {
      return null;
   }

   const timestamp = Date.UTC(
      Number(year),
      parts[0] - 1,
      parts[1],
      parts[2],
      parts[3],
      parts[4]
   );

   if (!Number.isFinite(timestamp)) return null;

   const date = new Date(timestamp);
   if (
      date.getUTCFullYear() !== Number(year) ||
      date.getUTCMonth() !== parts[0] - 1 ||
      date.getUTCDate() !== parts[1]
   ) {
      return null;
   }

   return date;
}

/**
 * True when no backup exists or the newest backup is at least 24h old.
 * @param {Date|string|number} now
 * @param {Date|string|number|null} lastBackupAt
 * @returns {boolean}
 */
export function isBackupDue(now, lastBackupAt) {
   if (!lastBackupAt) return true;
   const last = new Date(lastBackupAt).getTime();
   if (!Number.isFinite(last)) return true;
   return new Date(now).getTime() - last >= DAY_MS;
}

/**
 * Selects object paths older than the retention window.
 * Retention is clamped to a minimum of 1 day: `0` (or any invalid value)
 * behaves exactly like `1`, keeping the last 24 hours of backups.
 * @param {Array<{ name: string }>} objects
 * @param {Date|string|number} now
 * @param {number} retentionDays
 * @param {string} [prefix="backups"]
 * @returns {string[]}
 */
export function selectExpiredObjects(
   objects,
   now,
   retentionDays,
   prefix = "backups"
) {
   const days =
      !Number.isFinite(retentionDays) || retentionDays < 1 ? 1 : retentionDays;

   const cutoff = new Date(now).getTime() - days * DAY_MS;

   return (objects || [])
      .map((object) => ({ object, date: parseObjectDate(object.name) }))
      .filter(({ date }) => date !== null && date.getTime() < cutoff)
      .map(({ object }) => `${prefix}/${object.name}`);
}
