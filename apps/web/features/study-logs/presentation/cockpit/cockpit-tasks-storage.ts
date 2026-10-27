/**
 * Local storage utility for persisting task category collapse state across
 * page refreshes, client-side route navigation, and background IndexedDB sync events.
 */

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

/**
 * Reads the set of collapsed category identifiers from localStorage.
 * Safely handles SSR, missing keys, corrupted JSON, and private browsing exceptions.
 */
export function readCollapsedCategoryIds(userId?: string | null): Set<string> {
   if (typeof window === "undefined") {
      return new Set();
   }

   try {
      if (!window.localStorage) {
         return new Set();
      }

      const key = getCollapsedCategoriesStorageKey(userId);
      const raw = window.localStorage.getItem(key);
      if (!raw) {
         return new Set();
      }

      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
         return new Set(
            parsed.filter(
               (item): item is string =>
                  typeof item === "string" && item.trim().length > 0
            )
         );
      }

      if (
         parsed &&
         typeof parsed === "object" &&
         Array.isArray((parsed as { keys?: unknown }).keys)
      ) {
         return new Set(
            (parsed as { keys: unknown[] }).keys.filter(
               (item): item is string =>
                  typeof item === "string" && item.trim().length > 0
            )
         );
      }

      return new Set();
   } catch {
      return new Set();
   }
}

/**
 * Persists the set of collapsed category identifiers to localStorage.
 * Safely handles SSR and quota/security errors.
 */
export function writeCollapsedCategoryIds(
   userId: string | null | undefined,
   collapsedIds: Set<string> | string[]
): void {
   if (typeof window === "undefined") {
      return;
   }

   try {
      if (!window.localStorage) {
         return;
      }

      const key = getCollapsedCategoriesStorageKey(userId);
      const array = Array.from(collapsedIds).filter(
         (id) => typeof id === "string" && id.trim().length > 0
      );
      window.localStorage.setItem(key, JSON.stringify(array));
   } catch {
      // Gracefully ignore storage quota or sandbox permission errors
   }
}

/**
 * Checks whether a given category is collapsed based on its id or name.
 */
export function isCategoryCollapsed(
   cat: { id?: string | null; name: string },
   collapsedIds: Set<string>
): boolean {
   if (cat.id && collapsedIds.has(cat.id)) {
      return true;
   }
   if (cat.name && collapsedIds.has(cat.name)) {
      return true;
   }
   return false;
}

/**
 * Computes the new Set of collapsed category keys when a category is toggled.
 */
export function toggleCategoryCollapseKey(
   cat: { id?: string | null; name: string },
   currentCollapsed: Set<string>
): Set<string> {
   const next = new Set(currentCollapsed);
   const isCurrentlyCollapsed = isCategoryCollapsed(cat, currentCollapsed);

   if (isCurrentlyCollapsed) {
      if (cat.id) {
         next.delete(cat.id);
      }
      if (cat.name) {
         next.delete(cat.name);
      }
   } else {
      const keyToAdd = cat.id || cat.name;
      if (keyToAdd) {
         next.add(keyToAdd);
      }
   }

   return next;
}
