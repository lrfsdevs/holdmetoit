/**
 * Local storage & cookie utility for persisting task category collapse state across
 * page refreshes, SSR hydration, client-side route navigation, and background IndexedDB sync events.
 */

export type TaskCategoryType = "daily" | "weekly";

export const COLLAPSED_CATEGORIES_COOKIE = "holdmetoit_collapsed_categories";

const STORAGE_KEY_PREFIX = "holdmetoit:collapsed_categories:";

/**
 * Returns the localStorage key for collapsed categories, scoped to a specific user or guest.
 */
export function getCollapsedCategoriesStorageKey(
   userId?: string | null
): string {
   const normalizedUser =
      userId && userId.trim().length > 0 ? userId.trim() : "guest";
   return `${STORAGE_KEY_PREFIX}${normalizedUser}`;
}

function readCookiePayload(): Record<string, string[]> {
   if (typeof document === "undefined" || !document.cookie) {
      return {};
   }
   try {
      const match = document.cookie.match(
         new RegExp(`(?:^|; )${COLLAPSED_CATEGORIES_COOKIE}=([^;]*)`)
      );
      if (match && match[1]) {
         const parsed: unknown = JSON.parse(decodeURIComponent(match[1]));
         if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, string[]>;
         }
         if (Array.isArray(parsed)) {
            return { all: parsed as string[] };
         }
      }
   } catch {
      // Ignore
   }
   return {};
}

/**
 * Reads the set of collapsed category identifiers from localStorage (or fallback cookie).
 * Safely handles SSR, missing keys, corrupted JSON, and private browsing exceptions.
 * Automatically filters out any legacy unscoped entries so old tests don't corrupt state.
 */
export function readCollapsedCategoryIds(userId?: string | null): Set<string> {
   if (typeof window === "undefined") {
      return new Set();
   }

   const isValidKey = (k: unknown): k is string =>
      typeof k === "string" &&
      (k.startsWith("daily:") || k.startsWith("weekly:"));

   const scope = userId && userId.trim().length > 0 ? userId.trim() : "guest";

   try {
      if (window.localStorage) {
         const key = getCollapsedCategoriesStorageKey(userId);
         const raw = window.localStorage.getItem(key);
         if (raw) {
            const parsed: unknown = JSON.parse(raw);
            if (Array.isArray(parsed)) {
               const valid = parsed.filter(isValidKey);
               if (valid.length > 0) {
                  return new Set(valid);
               }
            } else if (
               parsed &&
               typeof parsed === "object" &&
               Array.isArray((parsed as { keys?: unknown }).keys)
            ) {
               const valid = (parsed as { keys: unknown[] }).keys.filter(
                  isValidKey
               );
               if (valid.length > 0) {
                  return new Set(valid);
               }
            }
         }
      }
   } catch {
      // Ignore
   }

   // Fallback to cookie if localStorage had no valid keys
   try {
      const payload = readCookiePayload();
      const list = payload[scope] || payload["all"];
      if (Array.isArray(list)) {
         return new Set(list.filter(isValidKey));
      }
   } catch {
      // Ignore
   }

   return new Set();
}

/**
 * Persists the set of collapsed category identifiers to localStorage AND cookie.
 * Writing to a cookie enables Next.js SSR to pre-render the exact collapsed states,
 * eliminating the visual flash/pop on page reload with zero hydration mismatch.
 */
export function writeCollapsedCategoryIds(
   userId: string | null | undefined,
   collapsedIds: Set<string> | string[]
): void {
   if (typeof window === "undefined") {
      return;
   }

   const array = Array.from(collapsedIds).filter(
      (id): id is string =>
         typeof id === "string" &&
         (id.startsWith("daily:") || id.startsWith("weekly:"))
   );

   const scope = userId && userId.trim().length > 0 ? userId.trim() : "guest";

   try {
      if (window.localStorage) {
         const key = getCollapsedCategoriesStorageKey(userId);
         window.localStorage.setItem(key, JSON.stringify(array));
      }
   } catch {
      // Gracefully ignore storage quota or sandbox permission errors
   }

   try {
      if (typeof document !== "undefined") {
         const currentPayload = readCookiePayload();
         currentPayload[scope] = array;
         const cookieValue = encodeURIComponent(JSON.stringify(currentPayload));
         document.cookie = `${COLLAPSED_CATEGORIES_COOKIE}=${cookieValue}; path=/; max-age=31536000; SameSite=Lax`;
      }
   } catch {
      // Gracefully ignore cookie write failures
   }
}

/**
 * Checks whether a given category is collapsed for the specified board type ("daily" | "weekly").
 * Strictly checks board-isolated identifiers to guarantee daily and weekly categories never collide.
 */
export function isCategoryCollapsed(
   boardTypeOrCat: TaskCategoryType | { id?: string | null; name: string },
   catOrCollapsedIds: { id?: string | null; name: string } | Set<string>,
   maybeCollapsedIds?: Set<string>
): boolean {
   let boardType: TaskCategoryType = "daily";
   let cat: { id?: string | null; name: string };
   let collapsedIds: Set<string> | undefined;

   if (typeof boardTypeOrCat === "string") {
      boardType = boardTypeOrCat;
      cat = catOrCollapsedIds as { id?: string | null; name: string };
      collapsedIds = maybeCollapsedIds;
   } else {
      cat = boardTypeOrCat;
      collapsedIds = catOrCollapsedIds as Set<string>;
   }

   if (!collapsedIds || collapsedIds.size === 0) {
      return false;
   }

   // 1. Check exact board-scoped ID (e.g. "daily:cat_123" or "weekly:cat_456")
   if (cat.id && collapsedIds.has(`${boardType}:${cat.id}`)) {
      return true;
   }

   // 2. Check exact board-scoped name (e.g. "daily:name:General" or "weekly:name:General")
   if (cat.name && collapsedIds.has(`${boardType}:name:${cat.name}`)) {
      return true;
   }

   return false;
}

/**
 * Computes the new Set of collapsed category keys when a category is toggled.
 * Strictly scopes keys by board type ("daily" or "weekly") so actions on one board never affect the other.
 */
export function toggleCategoryCollapseKey(
   boardTypeOrCat: TaskCategoryType | { id?: string | null; name: string },
   catOrCurrentCollapsed: { id?: string | null; name: string } | Set<string>,
   maybeCurrentCollapsed?: Set<string>
): Set<string> {
   let boardType: TaskCategoryType = "daily";
   let cat: { id?: string | null; name: string };
   let currentCollapsed: Set<string>;

   if (typeof boardTypeOrCat === "string") {
      boardType = boardTypeOrCat;
      cat = catOrCurrentCollapsed as { id?: string | null; name: string };
      currentCollapsed = maybeCurrentCollapsed as Set<string>;
   } else {
      cat = boardTypeOrCat;
      currentCollapsed = catOrCurrentCollapsed as Set<string>;
   }

   const next = new Set(currentCollapsed || []);
   const isCurrentlyCollapsed = isCategoryCollapsed(
      boardType,
      cat,
      currentCollapsed
   );

   const idKey = cat.id ? `${boardType}:${cat.id}` : null;
   const nameKey = cat.name ? `${boardType}:name:${cat.name}` : null;

   if (isCurrentlyCollapsed) {
      if (idKey) next.delete(idKey);
      if (nameKey) next.delete(nameKey);
      // Clean up any legacy unscoped keys if present to prevent pollution
      if (cat.id) next.delete(cat.id);
      if (cat.name) next.delete(cat.name);
   } else {
      if (idKey) {
         next.add(idKey);
      } else if (nameKey) {
         next.add(nameKey);
      }
      // Ensure any legacy unscoped keys are removed
      if (cat.id) next.delete(cat.id);
      if (cat.name) next.delete(cat.name);
   }

   return next;
}

/**
 * Prefix for daily rollover snooze keys in localStorage.
 * Format: holdmetoit_rollover_snooze_${userId}_${todayDateKey}
 */
export const ROLLOVER_SNOOZE_STORAGE_PREFIX = "holdmetoit_rollover_snooze_";

/**
 * Returns the localStorage key for snoozing the daily rollover banner.
 * Keyed by userId + dateKey: holdmetoit_rollover_snooze_${userId}_${todayDateKey}
 */
export function getRolloverSnoozeStorageKey(
   userId: string | null | undefined,
   dateKey: string
): string {
   const normalizedUser =
      userId && userId.trim().length > 0 ? userId.trim() : "guest";
   return `${ROLLOVER_SNOOZE_STORAGE_PREFIX}${normalizedUser}_${dateKey}`;
}

/**
 * Checks whether the Today rollover reminder banner has been snoozed for the given date.
 */
export function isRolloverSnoozedForDate(
   userId: string | null | undefined,
   dateKey: string
): boolean {
   if (typeof window === "undefined") {
      return false;
   }
   try {
      if (window.localStorage) {
         const key = getRolloverSnoozeStorageKey(userId, dateKey);
         return window.localStorage.getItem(key) === "true";
      }
   } catch {
      // Gracefully ignore private browsing / quota errors
   }
   return false;
}

/**
 * Snoozes the Today rollover reminder for the given dateKey in localStorage.
 * Automatically cleans up any obsolete snooze entries for older dates.
 */
export function setRolloverSnoozedForDate(
   userId: string | null | undefined,
   dateKey: string
): void {
   if (typeof window === "undefined") {
      return;
   }
   try {
      if (window.localStorage) {
         const key = getRolloverSnoozeStorageKey(userId, dateKey);
         window.localStorage.setItem(key, "true");
         cleanupExpiredRolloverSnooze(userId, dateKey);
      }
   } catch {
      // Gracefully ignore
   }
}

/**
 * Cleans up expired rollover snooze entries from localStorage where the stored dateKey is earlier than currentDateKey.
 */
export function cleanupExpiredRolloverSnooze(
   userId: string | null | undefined,
   currentDateKey: string
): void {
   if (typeof window === "undefined") {
      return;
   }
   try {
      if (window.localStorage) {
         const normalizedUser =
            userId && userId.trim().length > 0 ? userId.trim() : "guest";
         const prefix = `${ROLLOVER_SNOOZE_STORAGE_PREFIX}${normalizedUser}_`;
         const toRemove: string[] = [];
         for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && key.startsWith(prefix)) {
               const snoozeDate = key.slice(prefix.length);
               if (snoozeDate < currentDateKey) {
                  toRemove.push(key);
               }
            }
         }
         toRemove.forEach((k) => window.localStorage.removeItem(k));
      }
   } catch {
      // Gracefully ignore
   }
}
