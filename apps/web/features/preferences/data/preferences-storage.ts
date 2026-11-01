/**
 * @file preferences-storage.ts
 * Client-side localStorage persistence repository for UserPreferences.
 * Ensures safe SSR hydration, in-memory fallback, and multi-tab/event synchronization.
 */

import {
   DEFAULT_USER_PREFERENCES,
   sanitizeUserPreferences,
   type UserPreferences,
} from "../domain/user-preferences";

export const USER_PREFERENCES_STORAGE_KEY = "holdmetoit:user_preferences";
export const USER_PREFERENCES_UPDATED_EVENT = "holdmetoit:preferences-updated";

let memoryFallback: UserPreferences | null = null;

function isBrowser(): boolean {
   return (
      typeof window !== "undefined" &&
      typeof window.localStorage !== "undefined"
   );
}

/**
 * Loads user preferences from localStorage with fallback to defaults or memory cache.
 */
export function loadStoredPreferences(): UserPreferences {
   if (!isBrowser()) {
      return (
         memoryFallback ?? sanitizeUserPreferences(DEFAULT_USER_PREFERENCES)
      );
   }

   try {
      const raw = window.localStorage.getItem(USER_PREFERENCES_STORAGE_KEY);
      if (!raw) {
         return sanitizeUserPreferences(DEFAULT_USER_PREFERENCES);
      }
      const parsed = JSON.parse(raw);
      const sanitized = sanitizeUserPreferences(parsed);
      memoryFallback = sanitized;
      return sanitized;
   } catch {
      return (
         memoryFallback ?? sanitizeUserPreferences(DEFAULT_USER_PREFERENCES)
      );
   }
}

/**
 * Saves updated user preferences to localStorage and notifies subscribers.
 */
export function saveStoredPreferences(
   update:
      Partial<UserPreferences> | ((prev: UserPreferences) => UserPreferences)
): UserPreferences {
   const current = loadStoredPreferences();
   const nextRaw =
      typeof update === "function"
         ? update(current)
         : { ...current, ...update };
   const sanitized = sanitizeUserPreferences(nextRaw);
   memoryFallback = sanitized;

   if (isBrowser()) {
      try {
         window.localStorage.setItem(
            USER_PREFERENCES_STORAGE_KEY,
            JSON.stringify(sanitized)
         );
      } catch {
         // Silently keep memoryFallback if localStorage quota is exceeded or restricted
      }

      try {
         window.dispatchEvent(
            new CustomEvent(USER_PREFERENCES_UPDATED_EVENT, {
               detail: sanitized,
            })
         );
      } catch {
         // Silently handle event dispatch issues
      }
   }

   return sanitized;
}

/**
 * Resets preferences to factory defaults.
 */
export function resetStoredPreferences(): UserPreferences {
   return saveStoredPreferences(() => DEFAULT_USER_PREFERENCES);
}

/**
 * Subscribes to preference changes across same-page components and cross-tab storage events.
 */
export function subscribeToPreferences(
   callback: (preferences: UserPreferences) => void
): () => void {
   if (!isBrowser()) {
      return () => {};
   }

   const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<UserPreferences>;
      if (customEvent.detail) {
         callback(customEvent.detail);
      } else {
         callback(loadStoredPreferences());
      }
   };

   const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === USER_PREFERENCES_STORAGE_KEY) {
         callback(loadStoredPreferences());
      }
   };

   window.addEventListener(USER_PREFERENCES_UPDATED_EVENT, handleCustomEvent);
   window.addEventListener("storage", handleStorageEvent);

   return () => {
      window.removeEventListener(
         USER_PREFERENCES_UPDATED_EVENT,
         handleCustomEvent
      );
      window.removeEventListener("storage", handleStorageEvent);
   };
}
