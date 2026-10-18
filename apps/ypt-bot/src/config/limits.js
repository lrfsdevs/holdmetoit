export const MAX_DAILY_STUDY_SECONDS = 14 * 60 * 60; // 50400

export function clampDailyStudySeconds(seconds) {
   const n = Math.floor(Number(seconds) || 0);
   if (n <= 0) return 0;
   return Math.min(n, MAX_DAILY_STUDY_SECONDS);
}

export const MAX_CONTINUOUS_SESSION_SECONDS = 4 * 60 * 60; // 14400
export const MAX_CONTINUOUS_SESSION_MS = MAX_CONTINUOUS_SESSION_SECONDS * 1000;

export function clampContinuousSessionMs(elapsedMs) {
   const n = Math.floor(Number(elapsedMs) || 0);
   return n <= 0 ? 0 : Math.min(n, MAX_CONTINUOUS_SESSION_MS);
}

export function cappedLiveStudyMs(recordedStudyMs, sessionElapsedMs) {
   const base = Math.max(0, Math.floor(Number(recordedStudyMs) || 0));
   return base + clampContinuousSessionMs(sessionElapsedMs);
}
