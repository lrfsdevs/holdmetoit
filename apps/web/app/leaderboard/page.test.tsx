import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LeaderboardPage from "./page";
import { getTrophyLeaderboard } from "@/features/trophies/data/trophy.repository";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";

vi.mock("@/features/feature-flags/api/server", () => ({
   isFeatureEnabled: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/core/auth", () => ({
   auth: vi.fn().mockResolvedValue({
      user: { id: "usr_1", name: "Afnan", role: "MEMBER" },
   }),
}));

vi.mock("next/headers", () => ({
   cookies: vi.fn().mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
   }),
}));

vi.mock("@/features/trophies/data/trophy.repository", () => ({
   getTrophyLeaderboard: vi.fn().mockResolvedValue({
      entries: [
         {
            rank: 1,
            userId: "usr_1",
            displayName: "Afnan",
            username: "afnan",
            image: null,
            trophyBalance: 1250,
            rankRole: "Diamond",
            wins: 10,
            losses: 2,
            winRate: 83.3,
            tierConfig: {
               role: "Diamond",
               minTrophies: 1000,
               maxTrophies: 1499,
               badgeColor: "#38bdf8",
               borderColor: "border-sky-500/40",
               bgColor: "bg-sky-500/10",
               textColor: "text-sky-300",
               accentColor: "#0284c7",
               iconName: "Diamond",
            },
         },
      ],
      pagination: {
         page: 1,
         limit: 50,
         totalCount: 1,
         totalPages: 1,
      },
   }),
}));

vi.mock("@/features/trophies/presentation/trophy-leaderboard-view", () => ({
   TrophyLeaderboardView: (props: any) => (
      <div data-testid="trophy-leaderboard-view">
         Leaderboard entries: {props.initialEntries.length}
      </div>
   ),
}));

describe("LeaderboardPage", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("fetches the full leaderboard set and renders the view", async () => {
      const page = await LeaderboardPage();
      expect(getTrophyLeaderboard).toHaveBeenCalledWith({ all: true });
      expect(page).toBeDefined();
   });

   it("renders the locked state when the leaderboard flag is off", async () => {
      vi.mocked(isFeatureEnabled).mockResolvedValueOnce(false);

      const page = await LeaderboardPage();
      const html = renderToStaticMarkup(page as any);

      expect(html).toContain("Global leaderboard is currently unavailable");
      expect(getTrophyLeaderboard).not.toHaveBeenCalled();
   });
});
