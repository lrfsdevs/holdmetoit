/**
 * Single source of truth for whether LogRocket is active.
 *
 * Enabled only in production builds, so local development stays quiet.
 * Safe to import from both server and client modules: it never pulls in the
 * `logrocket` browser package and returns false when there is no window.
 */
export function isLogRocketEnabled(): boolean {
   if (typeof window === "undefined") {
      return false;
   }

   return process.env.NODE_ENV === "production";
}
