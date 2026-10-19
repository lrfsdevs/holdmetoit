/**
 * Pure query helpers for the trophy leaderboard (Law L7: no React/Prisma/Next imports).
 * These operate on any list of entries that expose the required fields, so the
 * domain layer never depends on the data-layer `TrophyLeaderboardEntry` type.
 */

export const LEADERBOARD_PAGE_SIZE = 10;

export type LeaderboardSortKey = "trophies" | "winRate" | "wins" | "name";
export type SortDirection = "asc" | "desc";

/** Case-insensitive search across display name and username. Empty query returns all. */
export function filterLeaderboardEntries<
   T extends { displayName: string; username: string },
>(entries: T[], query: string): T[] {
   const q = query.trim().toLowerCase();
   if (!q) return entries;

   return entries.filter(
      (entry) =>
         entry.displayName.toLowerCase().includes(q) ||
         entry.username.toLowerCase().includes(q)
   );
}

/** Non-mutating sort across the supported leaderboard keys. */
export function sortLeaderboardEntries<
   T extends {
      displayName: string;
      trophyBalance: number;
      winRate: number;
      wins: number;
      rank?: number;
   },
>(entries: T[], sortBy: LeaderboardSortKey, direction: SortDirection): T[] {
   const isDescending = direction === "desc";

   return [...entries].sort((a, b) => {
      if (sortBy === "name") {
         const comparison = a.displayName.localeCompare(b.displayName);
         return isDescending ? -comparison : comparison;
      }
      if (sortBy === "winRate") {
         const comparison = a.winRate - b.winRate;
         return isDescending ? -comparison : comparison;
      }
      if (sortBy === "wins") {
         const comparison = a.wins - b.wins;
         return isDescending ? -comparison : comparison;
      }

      // Trophy standings: "desc" means best first, i.e. lowest rank number.
      // Ranks are canonical (server-assigned from trophyBalance desc), so use
      // them when present — page 1 must always start at rank #1.
      if (typeof a.rank === "number" && typeof b.rank === "number") {
         const comparison = a.rank - b.rank;
         return isDescending ? comparison : -comparison;
      }

      const comparison = a.trophyBalance - b.trophyBalance;
      return isDescending ? -comparison : comparison;
   });
}

export interface PaginatedResult<T> {
   items: T[];
   page: number;
   totalPages: number;
   totalItems: number;
}

/** Clamps the requested page into range and slices the bounded result set. */
export function paginateLeaderboard<T>(
   items: T[],
   page: number,
   pageSize: number = LEADERBOARD_PAGE_SIZE
): PaginatedResult<T> {
   const totalItems = items.length;
   const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
   const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
   const start = (safePage - 1) * pageSize;

   return {
      items: items.slice(start, start + pageSize),
      page: safePage,
      totalPages,
      totalItems,
   };
}
