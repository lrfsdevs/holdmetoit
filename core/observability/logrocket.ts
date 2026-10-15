"use client";

import LogRocket from "logrocket";
import setupLogRocketReact from "logrocket-react";

import { isLogRocketEnabled } from "./logrocket-config";

const FALLBACK_LOGROCKET_APP_ID = "q9morb/holdmeintoit";
const FALLBACK_RELEASE = "0.1.0";

export const LOGROCKET_APP_ID =
   process.env.NEXT_PUBLIC_LOGROCKET_APP_ID || FALLBACK_LOGROCKET_APP_ID;

const LOGROCKET_RELEASE =
   process.env.NEXT_PUBLIC_APP_RELEASE || FALLBACK_RELEASE;

let initialized = false;

export type LogRocketUserTraits = {
   name?: string | null;
   role?: string | null;
   discordId?: string | null;
};

export type LogRocketEventProps = Record<
   string,
   | string
   | number
   | boolean
   | string[]
   | number[]
   | boolean[]
   | null
   | undefined
>;

/** Initializes the browser-only LogRocket client once when analytics is enabled. */
export function initLogRocket(): void {
   if (typeof window === "undefined" || initialized) {
      return;
   }

   if (!isLogRocketEnabled()) {
      return;
   }

   LogRocket.init(LOGROCKET_APP_ID, {
      release: LOGROCKET_RELEASE,
   });
   setupLogRocketReact();
   initialized = true;
}

/** Associates the current authenticated user and optional traits with LogRocket. */
export function identifyLogRocketUser(
   userId: string,
   traits?: LogRocketUserTraits
): void {
   if (
      typeof window === "undefined" ||
      !isLogRocketEnabled() ||
      !initialized ||
      !userId
   ) {
      return;
   }

   const payload: Record<string, string> = {};
   if (traits?.name) payload.name = traits.name;
   if (traits?.role) payload.role = traits.role;
   if (traits?.discordId) payload.discordId = traits.discordId;

   LogRocket.identify(userId, payload);
}

/** Sends a non-fatal analytics event when the browser client is initialized. */
export function trackLogRocketEvent(
   eventName: string,
   properties?: LogRocketEventProps
): void {
   if (typeof window === "undefined" || !isLogRocketEnabled() || !initialized) {
      return;
   }

   try {
      if (properties) {
         LogRocket.track(eventName, properties);
         return;
      }

      LogRocket.track(eventName);
   } catch {
      // Silently ignore analytics tracking exceptions
   }
}

/** Captures an exception without allowing analytics failures to affect the app. */
export function captureLogRocketException(
   error: unknown,
   context?: {
      tags?: Record<string, string>;
      extra?: Record<string, string | number | boolean>;
   }
): void {
   if (typeof window === "undefined" || !isLogRocketEnabled() || !initialized) {
      return;
   }

   try {
      const err = error instanceof Error ? error : new Error(String(error));
      LogRocket.captureException(err, context);
   } catch {
      // Silently ignore exception capture failures
   }
}

/** Captures a diagnostic message without allowing analytics failures to escape. */
export function captureLogRocketMessage(
   message: string,
   extra?: Record<string, string | number | boolean>
): void {
   if (typeof window === "undefined" || !isLogRocketEnabled() || !initialized) {
      return;
   }

   try {
      LogRocket.captureMessage(message, extra ? { extra } : undefined);
   } catch {
      // Silently ignore message capture failures
   }
}

/** Resolves the current LogRocket session URL when one is available. */
export function getLogRocketSessionURL(): Promise<string | null> {
   if (typeof window === "undefined" || !initialized) {
      return Promise.resolve(null);
   }

   return new Promise((resolve) => {
      try {
         LogRocket.getSessionURL((url) => {
            resolve(url || null);
         });
      } catch {
         resolve(null);
      }
   });
}
