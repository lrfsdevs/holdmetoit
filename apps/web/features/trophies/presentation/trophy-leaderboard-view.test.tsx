import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TrophyLeaderboardView } from "./trophy-leaderboard-view";
import type { TrophyLeaderboardEntry } from "../data/trophy.repository";

vi.mock("next/link", () => ({
   default: ({
      href,
      children,
      ...rest
   }: {
      href: string;
      children: ReactNode;
   }) => createElement("a", { href, ...rest }, children),
}));

vi.mock("next/image", () => ({
   default: ({
      src,
      alt,
      className,
   }: {
      src: string;
      alt: string;
      className: string;
   }) => createElement("img", { src, alt, className }),
}));

vi.mock("@/components/ui/button", () => ({
   Button: ({
      children,
      className,
   }: {
      children: ReactNode;
      className?: string;
   }) => createElement("div", { className }, children),
}));

function buildEntries(count: number): TrophyLeaderboardEntry[] {
   return Array.from({ length: count }, (_, i) => ({
      rank: i + 1,
      userId: `usr_${i + 1}`,
      displayName: `Player ${String(i + 1).padStart(2, "0")}`,
      username: `player${i + 1}`,
      image: null,
      trophyBalance: 1000 - i,
      rankRole: "Recruit",
      wins: count - i,
      losses: i,
      winRate: 50,
      tierConfig: {},
   })) as unknown as TrophyLeaderboardEntry[];
}

describe("TrophyLeaderboardView", () => {
   it("renders only the first 10 players and pagination controls", () => {
      const html = renderToStaticMarkup(
         <TrophyLeaderboardView initialEntries={buildEntries(12)} />
      );

      expect(html).toContain("Player 01");
      expect(html).toContain("Player 10");
      expect(html).not.toContain("Player 11");
      expect(html).not.toContain("Player 12");

      expect(html).toContain("Showing");
      expect(html).toContain("1\u201310");
      expect(html).toContain("12");
      expect(html).toContain("players");
      expect(html).toContain("Next");
   });

   it("hides pagination controls when there are 10 or fewer players", () => {
      const html = renderToStaticMarkup(
         <TrophyLeaderboardView initialEntries={buildEntries(5)} />
      );

      expect(html).not.toContain("Showing");
      expect(html).toContain("Player 05");
   });

   it("renders the search input and the alphabetical sort control", () => {
      const html = renderToStaticMarkup(
         <TrophyLeaderboardView initialEntries={buildEntries(3)} />
      );

      expect(html).toContain("Search participants by name or @username...");
      expect(html).toContain("A\u2013Z");
   });

   it("renders the empty state when there are no entries", () => {
      const html = renderToStaticMarkup(
         <TrophyLeaderboardView initialEntries={[]} />
      );

      expect(html).toContain(
         "No competitive players found matching your search."
      );
   });
});
