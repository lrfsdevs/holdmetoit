/**
 * Normalizes any timestamp to a strict UTC midnight Date object (00:00:00.000Z)
 * @param {Date|string|number} [nowUtc=new Date()]
 * @returns {Date}
 */
export function computeUtcLogDate(nowUtc = new Date()) {
   const d = new Date(nowUtc);
   return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
   );
}

export const CHALLENGE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Computes the challenge-anchored day bucket for a UTC instant.
 * Day N spans [startAt + N*24h, startAt + (N+1)*24h); the returned Date is the
 * UTC midnight of that bucket's calendar date (matching the @db.Date column).
 * @param {Date|string|number} [nowUtc=new Date()]
 * @param {Date|string|number} challengeStartAt
 * @returns {Date}
 */
export function computeChallengeDayLogDate(
   nowUtc = new Date(),
   challengeStartAt
) {
   const now = new Date(nowUtc).getTime();
   const start = new Date(challengeStartAt).getTime();
   const dayIndex = Math.max(0, Math.floor((now - start) / CHALLENGE_DAY_MS));
   const bucketStart = new Date(start + dayIndex * CHALLENGE_DAY_MS);
   return new Date(
      Date.UTC(
         bucketStart.getUTCFullYear(),
         bucketStart.getUTCMonth(),
         bucketStart.getUTCDate()
      )
   );
}

/**
 * Derives a human-readable status string from member telemetry
 * @param {object} member
 * @returns {string}
 */
export function deriveStudyStatus(member) {
   if (member.isStudying) {
      return "STUDYING";
   }
   return "OFFLINE";
}
