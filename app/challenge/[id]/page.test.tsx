import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ChallengePage from "./page";
import { getChallengeScoreboard } from "@/features/leaderboard/data/leaderboard-data";
import { auth } from "@/core/auth";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";

vi.mock("next/navigation", () => ({
   notFound: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
   }),
}));

vi.mock("@/features/leaderboard/data/leaderboard-data", () => ({
   getChallengeScoreboard: vi.fn(),
}));

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
}));

vi.mock("next/headers", () => ({
   cookies: vi.fn(),
}));

vi.mock("@/features/challenges/presentation/challenge-view", () => ({
   ChallengeView: ({
      initialTab,
      isAdmin,
      initialRosterSearch,
      initialRosterTeamFilter,
      initialRosterPage,
      isWrappedEnabled,
   }: {
      initialTab: string;
      isAdmin: boolean;
      initialRosterSearch?: string;
      initialRosterTeamFilter?: string;
      initialRosterPage?: number;
      isWrappedEnabled?: boolean;
   }) =>
      createElement(
         "div",
         {
            "data-testid": "challenge-view",
            "data-initial-tab": initialTab,
            "data-is-admin": String(isAdmin),
            "data-roster-search": initialRosterSearch,
            "data-roster-team": initialRosterTeamFilter,
            "data-roster-page": String(initialRosterPage),
            "data-is-wrapped-enabled": String(isWrappedEnabled),
         },
         `ChallengeView: tab=${initialTab}, admin=${isAdmin}`
      ),
}));

vi.mock("next/link", () => ({
   default: ({ href, children, ...rest }: any) =>
      createElement("a", { href, ...rest }, children),
}));

vi.mock("@/features/feature-flags/api/server", () => ({
   isFeatureEnabled: vi.fn(),
}));

const mockScoreboard = {
   id: "chal-1",
   title: "October Sprint",
   heroImageUrl: null,
   eventBannerUrl: null,
   punishmentPfpUrl: null,
   format: "SOLOS",
   status: "ACTIVE",
   startAt: "2026-10-01T00:00:00.000Z",
   endAt: "2026-10-08T00:00:00.000Z",
   daysRemaining: 4,
   totalDays: 7,
   currentDayNumber: 3,
   timeRemainingHuman: "4d",
   teams: [],
   matchHeader: {
      hasMatchup: false,
      teamA: null,
      teamB: null,
      leaderTeamId: null,
      leaderSide: "tie",
      leadMarginSeconds: 0,
      leadMarginClock: "00:00:00",
      leadMarginHuman: "Tied",
      ratioPercentageA: 50,
      ratioPercentageB: 50,
   },
   standings: [],
   currentUser: {
      isLoggedIn: false,
      isEnrolled: false,
      participantId: null,
   },
};

describe("ChallengePage (Server Component)", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);
      vi.mocked(cookies).mockResolvedValue({
         get: vi.fn().mockReturnValue(undefined),
      } as any);
      vi.mocked(auth).mockResolvedValue(null as any);
      vi.mocked(getChallengeScoreboard).mockResolvedValue(
         mockScoreboard as any
      );
   });

   it("passes default 'overview' initialTab when searchParams.tab is omitted", async () => {
      const pageJsx = await ChallengePage({
         params: { id: "chal-1" },
      });
      const html = renderToStaticMarkup(pageJsx);

      expect(html).toContain('data-initial-tab="overview"');
   });

   it("passes valid public initialTab (e.g. 'leaderboard') for non-admin", async () => {
      const pageJsx = await ChallengePage({
         params: { id: "chal-1" },
         searchParams: { tab: "leaderboard" },
      });
      const html = renderToStaticMarkup(pageJsx);

      expect(html).toContain('data-initial-tab="leaderboard"');
   });

   it("resolves legacy 'about' tab to 'overview'", async () => {
      const pageJsx = await ChallengePage({
         params: { id: "chal-1" },
         searchParams: { tab: "about" },
      });
      const html = renderToStaticMarkup(pageJsx);

      expect(html).toContain('data-initial-tab="overview"');
   });

   it("clamps admin tab 'manage' to 'overview' when user is not an admin", async () => {
      const pageJsx = await ChallengePage({
         params: { id: "chal-1" },
         searchParams: { tab: "manage" },
      });
      const html = renderToStaticMarkup(pageJsx);

      expect(html).toContain('data-initial-tab="overview"');
      expect(html).toContain('data-is-admin="false"');
   });

   it("allows admin tab 'manage' when user is an admin", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "admin-1", role: "ADMIN" },
      } as any);

      const pageJsx = await ChallengePage({
         params: { id: "chal-1" },
         searchParams: { tab: "manage" },
      });
      const html = renderToStaticMarkup(pageJsx);

      expect(html).toContain('data-initial-tab="manage"');
      expect(html).toContain('data-is-admin="true"');
   });

   it("clamps invalid searchParams.tab to 'overview'", async () => {
      const pageJsx = await ChallengePage({
         params: { id: "chal-1" },
         searchParams: { tab: "nonexistent-tab" },
      });
      const html = renderToStaticMarkup(pageJsx);

      expect(html).toContain('data-initial-tab="overview"');
   });

   it("passes search, team, and page from searchParams to ChallengeView", async () => {
      const pageJsx = await ChallengePage({
         params: { id: "chal-1" },
         searchParams: {
            tab: "manage",
            search: "morgan",
            team: "team-2",
            page: "3",
         },
      });
      const html = renderToStaticMarkup(pageJsx);

      expect(html).toContain('data-roster-search="morgan"');
      expect(html).toContain('data-roster-team="team-2"');
      expect(html).toContain('data-roster-page="3"');
   });

   it("triggers notFound when challenge is not found", async () => {
      vi.mocked(getChallengeScoreboard).mockResolvedValue(null);

      await expect(
         ChallengePage({
            params: { id: "chal-missing" },
         })
      ).rejects.toThrow("NEXT_NOT_FOUND");

      expect(notFound).toHaveBeenCalled();
   });

   it("renders ErrorState when fetching scoreboard fails", async () => {
      vi.mocked(getChallengeScoreboard).mockRejectedValue(
         new Error("DB error")
      );

      const pageJsx = await ChallengePage({
         params: { id: "chal-error" },
      });
      const html = renderToStaticMarkup(pageJsx);

      expect(html).toContain("Could not load scoreboard");
   });

   it("keeps ?tab=summary when the wrapped flag is on and results are locked", async () => {
      vi.mocked(getChallengeScoreboard).mockResolvedValue({
         ...mockScoreboard,
         resultsLockedAt: "2026-10-08T00:00:00.000Z",
      } as any);
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);

      const pageJsx = await ChallengePage({
         params: { id: "chal-1" },
         searchParams: { tab: "summary" },
      });
      const html = renderToStaticMarkup(pageJsx);

      expect(html).toContain('data-initial-tab="summary"');
      expect(html).toContain('data-is-wrapped-enabled="true"');
   });

   it("clamps ?tab=summary to overview when the wrapped flag is off", async () => {
      vi.mocked(getChallengeScoreboard).mockResolvedValue({
         ...mockScoreboard,
         resultsLockedAt: "2026-10-08T00:00:00.000Z",
      } as any);
      vi.mocked(isFeatureEnabled).mockResolvedValue(false);

      const pageJsx = await ChallengePage({
         params: { id: "chal-1" },
         searchParams: { tab: "summary" },
      });
      const html = renderToStaticMarkup(pageJsx);

      expect(html).toContain('data-initial-tab="overview"');
      expect(html).toContain('data-is-wrapped-enabled="false"');
   });
});
