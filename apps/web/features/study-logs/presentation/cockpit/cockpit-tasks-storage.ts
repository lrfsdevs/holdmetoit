/**
 * Local storage utility for persisting task category collapse state across
 * page refreshes, client-side route navigation, and background IndexedDB sync events.
 */

export type TaskCategoryType = "daily" | "weekly";

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
 * Checks whether a given category is collapsed for the specified board type ("daily" | "weekly").
 * Supports board-isolated identifiers to prevent category name collisions across boards.
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

   if (!collapsedIds) {
      return false;
   }

   // 1. Check exact board-scoped ID
   if (cat.id && collapsedIds.has(`${boardType}:${cat.id}`)) {
      return true;
   }

   // 2. Check exact board-scoped name
   if (cat.name && collapsedIds.has(`${boardType}:name:${cat.name}`)) {
      return true;
   }

   // 3. Backward compatibility fallback for legacy unscoped ID
   if (cat.id && collapsedIds.has(cat.id)) {
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
      if (cat.id) next.delete(cat.id);
      if (cat.name) next.delete(cat.name);
      if (cat.name) next.delete(`${boardType}:${cat.name}`);
   } else {
      if (idKey) {
         next.add(idKey);
      } else if (nameKey) {
         next.add(nameKey);
      }
   }

   return next;
}
