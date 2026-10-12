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

export function identifyLogRocketUser(
   userId: string,
   traits?: LogRocketUserTraits
): void {
   if (typeof window === "undefined" || !userId) {
      return;
   }

   const payload: Record<string, string> = {};
   if (traits?.name) payload.name = traits.name;
   if (traits?.role) payload.role = traits.role;
   if (traits?.discordId) payload.discordId = traits.discordId;

   LogRocket.identify(userId, payload);
}

export function trackLogRocketEvent(
   eventName: string,
   properties?: LogRocketEventProps
): void {
   if (typeof window === "undefined") {
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

export function captureLogRocketException(
   error: unknown,
   context?: {
      tags?: Record<string, string>;
      extra?: Record<string, string | number | boolean>;
   }
): void {
   if (typeof window === "undefined") {
      return;
   }

   try {
      const err = error instanceof Error ? error : new Error(String(error));
      LogRocket.captureException(err, context);
   } catch {
      // Silently ignore exception capture failures
   }
}

export function captureLogRocketMessage(
   message: string,
   extra?: Record<string, string | number | boolean>
): void {
   if (typeof window === "undefined") {
      return;
   }

   try {
      LogRocket.captureMessage(message, extra ? { extra } : undefined);
   } catch {
      // Silently ignore message capture failures
   }
}

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
