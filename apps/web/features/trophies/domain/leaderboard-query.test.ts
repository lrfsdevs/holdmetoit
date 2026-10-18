import { describe, expect, it } from "vitest";
import {
   filterLeaderboardEntries,
   LEADERBOARD_PAGE_SIZE,
   paginateLeaderboard,
   sortLeaderboardEntries,
} from "./leaderboard-query";

const entries = [
   {
      userId: "u1",
      displayName: "Charlie",
      username: "charlie",
      trophyBalance: 100,
      winRate: 50,
      wins: 1,
   },
   {
      userId: "u2",
      displayName: "alice",
      username: "alice_x",
      trophyBalance: 300,
      winRate: 80,
      wins: 8,
   },
   {
      userId: "u3",
      displayName: "Bob",
      username: "bobby",
      trophyBalance: 200,
      winRate: 20,
      wins: 2,
   },
];

describe("filterLeaderboardEntries", () => {
   it("returns all entries for an empty or whitespace query", () => {
      expect(filterLeaderboardEntries(entries, "")).toHaveLength(3);
      expect(filterLeaderboardEntries(entries, "   ")).toHaveLength(3);
   });

   it("matches display name case-insensitively", () => {
      expect(
         filterLeaderboardEntries(entries, "ALICE").map((e) => e.userId)
      ).toEqual(["u2"]);
   });

   it("matches username", () => {
      expect(
         filterLeaderboardEntries(entries, "bobby").map((e) => e.userId)
      ).toEqual(["u3"]);
   });

   it("returns no matches when nothing matches", () => {
      expect(filterLeaderboardEntries(entries, "zzz")).toEqual([]);
   });
});

describe("sortLeaderboardEntries", () => {
   it("sorts by name ascending and descending", () => {
      expect(
         sortLeaderboardEntries(entries, "name", "asc").map(
            (e) => e.displayName
         )
      ).toEqual(["alice", "Bob", "Charlie"]);
      expect(
         sortLeaderboardEntries(entries, "name", "desc").map(
            (e) => e.displayName
         )
      ).toEqual(["Charlie", "Bob", "alice"]);
   });

   it("sorts by trophies descending by default usage", () => {
      expect(
         sortLeaderboardEntries(entries, "trophies", "desc").map(
            (e) => e.trophyBalance
         )
      ).toEqual([300, 200, 100]);
   });

   it("sorts by win rate and wins", () => {
      expect(
         sortLeaderboardEntries(entries, "winRate", "desc").map(
            (e) => e.winRate
         )
      ).toEqual([80, 50, 20]);
      expect(
         sortLeaderboardEntries(entries, "wins", "desc").map((e) => e.wins)
      ).toEqual([8, 2, 1]);
   });

   it("does not mutate the input array", () => {
      const original = [...entries];
      sortLeaderboardEntries(entries, "trophies", "asc");
      expect(entries).toEqual(original);
   });
});

describe("paginateLeaderboard", () => {
   const many = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

   it("slices the requested page and reports totals", () => {
      const page1 = paginateLeaderboard(many, 1);
      expect(page1.items).toHaveLength(LEADERBOARD_PAGE_SIZE);
      expect(page1.page).toBe(1);
      expect(page1.totalPages).toBe(3);
      expect(page1.totalItems).toBe(25);

      const page3 = paginateLeaderboard(many, 3);
      expect(page3.items).toHaveLength(5);
      expect(page3.items[0].id).toBe(21);
   });

   it("clamps out-of-range pages", () => {
      expect(paginateLeaderboard(many, 99).page).toBe(3);
      expect(paginateLeaderboard(many, 0).page).toBe(1);
      expect(paginateLeaderboard(many, -5).page).toBe(1);
   });

   it("reports one page for an empty list", () => {
      const empty = paginateLeaderboard([] as { id: number }[], 4);
      expect(empty.items).toEqual([]);
      expect(empty.totalPages).toBe(1);
      expect(empty.page).toBe(1);
   });
});
