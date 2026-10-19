import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LeaderboardPage from "./page";
import { getTrophyLeaderboard } from "@/features/trophies/data/trophy.repository";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";
import { findActiveChallengeEnrollment } from "@/features/challenges/data/participant.repository";
import { auth } from "@/core/auth";

vi.mock("@/features/feature-flags/api/server", () => ({
   isFeatureEnabled: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/core/auth", () => ({
   auth: vi.fn().mockResolvedValue({
      user: { id: "usr_1", name: "Afnan", role: "MEMBER" },
   }),
}));

vi.mock("@/features/challenges/data/participant.repository", () => ({
   findActiveChallengeEnrollment: vi.fn().mockResolvedValue({
      challengeId: "chal_1",
      challengeTitle: "Bees vs Butterflies",
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
      <div
         data-testid="trophy-leaderboard-view"
         data-has-active={String(props.hasActiveChallenge)}
      >
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

   it("marks the viewer as already in an active challenge", async () => {
      const page = await LeaderboardPage();
      const html = renderToStaticMarkup(page as any);

      expect(findActiveChallengeEnrollment).toHaveBeenCalledWith("usr_1");
      expect(html).toContain('data-has-active="true"');
   });

   it("does not query membership for signed-out spectators", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: null } as any);

      const page = await LeaderboardPage();
      const html = renderToStaticMarkup(page as any);

      expect(findActiveChallengeEnrollment).not.toHaveBeenCalled();
      expect(html).toContain('data-has-active="false"');
   });

   it("renders the locked state when the leaderboard flag is off", async () => {
      vi.mocked(isFeatureEnabled).mockResolvedValueOnce(false);

      const page = await LeaderboardPage();
      const html = renderToStaticMarkup(page as any);

      expect(html).toContain("Global leaderboard is currently unavailable");
      expect(getTrophyLeaderboard).not.toHaveBeenCalled();
   });
});

describe("Leaderboard Boundaries (Law L9)", () => {
   it("renders LeaderboardLoading skeleton", async () => {
      const { default: LeaderboardLoading } = await import("./loading");
      const html = renderToStaticMarkup(<LeaderboardLoading />);

      expect(html).toContain("animate-pulse");
      expect(html).toContain("bg-surface-page");
   });

   it("renders LeaderboardError recovery UI", async () => {
      const { default: LeaderboardError } = await import("./error");
      const html = renderToStaticMarkup(
         <LeaderboardError
            error={new Error("Database connection timed out")}
            reset={vi.fn()}
         />
      );

      expect(html).toContain("Leaderboard Unavailable");
      expect(html).toContain("Database connection timed out");
      expect(html).toContain("Try again");
      expect(html).toContain("Return to Challenges");
   });
});
