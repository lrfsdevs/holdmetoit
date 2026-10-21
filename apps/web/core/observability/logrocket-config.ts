declare global {
   interface Window {
      __HMI_LOGROCKET_ENABLED__?: boolean;
   }
}

/**
 * Applies the server-evaluated `logrocket_v1` flag to this browser tab.
 * The setter is a no-op during SSR, so module state never leaks across requests.
 */
export function setLogRocketEnabled(enabled: boolean): void {
   if (typeof window === "undefined") {
      return;
   }

   window.__HMI_LOGROCKET_ENABLED__ = enabled;
}

/**
 * Single source of truth for whether LogRocket is active.
 *
 * Requires a production build AND the runtime feature flag applied by
 * `LogRocketProvider`. Defaults to off until the flag is known.
 */
export function isLogRocketEnabled(): boolean {
   if (typeof window === "undefined") {
      return false;
   }

   if (process.env.NODE_ENV !== "production") {
      return false;
   }

   return window.__HMI_LOGROCKET_ENABLED__ === true;
}
