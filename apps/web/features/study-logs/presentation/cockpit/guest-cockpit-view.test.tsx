// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import React, { createElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import {
   GuestCockpitView,
   type GuestCockpitViewProps,
} from "./guest-cockpit-view";
import { LOAD_SAMPLE_TASK_EVENT } from "./cockpit-tasks-section";

vi.mock("next/link", () => ({
   default: ({
      href,
      children,
      className,
      ...props
   }: {
      href: string;
      children: React.ReactNode;
      className?: string;
      [key: string]: any;
   }) => createElement("a", { href, className, ...props }, children),
}));

vi.mock("next/image", () => ({
   default: ({
      src,
      alt,
      fill,
      priority,
      unoptimized,
      ...props
   }: {
      src: string;
      alt: string;
      [key: string]: any;
   }) => createElement("img", { src, alt, ...props }),
}));

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
   signIn: vi.fn(),
   signOut: vi.fn(),
}));

vi.mock("@/features/auth/api/auth.actions", () => ({
   loginWithDiscordAction: vi.fn(),
   logoutAction: vi.fn(),
}));

vi.mock("@/core/observability/logrocket", () => ({
   trackLogRocketEvent: vi.fn(),
}));

vi.mock("@/features/wrapped/presentation/dashboard-wrapped", () => ({
   DashboardWrapped: ({ challenge }: { challenge: any }) =>
      createElement("div", {
         "data-testid": "dashboard-wrapped",
         "data-challenge-id": challenge?.id,
      }),
}));

vi.mock("./cockpit-tasks-section", async (importOriginal) => {
   const actual =
      await importOriginal<typeof import("./cockpit-tasks-section")>();
   return {
      ...actual,
      CockpitTasksSection: () =>
         createElement(
            "div",
            { "data-testid": "mocked-cockpit-tasks-section" },
            "Daily & Weekly Tasks Mock"
         ),
   };
});

describe("GuestCockpitView", () => {
   it("renders the guest greeting and hero banner with Discord CTA and navigation links", () => {
      const html = renderToStaticMarkup(
         createElement(GuestCockpitView, { displayName: "StudyWarrior" })
      );

      // Greeting
      expect(html).toContain("Welcome StudyWarrior");
      expect(html).toContain("Spectator Mode Active");

      // Hero banner
      expect(html).toContain("Level Up Your Focus with Gamified Study Battles");
      expect(html).toContain("Competitive Study Accountability");
      expect(html).toContain("Sign in with Discord");
      expect(html).toContain('href="/challenges"');
      expect(html).toContain("Browse Challenges");
      expect(html).toContain('href="/leaderboard"');
      expect(html).toContain("Trophy Leaderboard");
   });

   it("renders the 2-column bento preview row with simulated progress and telemetry matrix", () => {
      const html = renderToStaticMarkup(createElement(GuestCockpitView, {}));

      // Left telemetry card
      expect(html).toContain("Weekly Commitment Progress");
      expect(html).toContain("Preview Mode");
      expect(html).toContain("24:30:00");
      expect(html).toContain("/ 35:00:00");
      expect(html).toContain("Pace on Target");
      expect(html).toContain("70%");
      expect(html).toContain("05:00:00");
      expect(html).toContain("🔥 5 Days");
      expect(html).toContain("🌴 1/2 Left");
      expect(html).toContain("YPT Ready");
      expect(html).toContain(
         "Sign in to log daily study hours, sync Yeolpumta (YPT), and protect your streak."
      );
   });

   it("renders the live challenge details in the accountability pulse card when provided", () => {
      const mockChallenge: GuestCockpitViewProps["upcomingChallenge"] = {
         id: "chal-99",
         title: "November Bees vs Butterflies Duel",
         format: "TEAM_VS_TEAM",
         teams: [
            {
               id: "team-1",
               name: "Honey Bees",
               color: "#f59e0b",
               iconEmoji: "🐝",
            },
            {
               id: "team-2",
               name: "Monarch Butterflies",
               color: "#3b82f6",
               iconEmoji: "🦋",
            },
         ],
      };

      const html = renderToStaticMarkup(
         createElement(GuestCockpitView, { upcomingChallenge: mockChallenge })
      );

      expect(html).toContain("November Bees vs Butterflies Duel");
      expect(html).toContain("Team vs Team");
      expect(html).toContain("Honey Bees");
      expect(html).toContain("Monarch Butterflies");
      expect(html).toContain("The Three-Condition Accountability Law");
      expect(html).toContain("Punishment PFP");
   });

   it("renders the fallback arena card when no challenge is active", () => {
      const html = renderToStaticMarkup(
         createElement(GuestCockpitView, { upcomingChallenge: null })
      );

      expect(html).toContain("Join Competitive Weekly Battles");
      expect(html).toContain("The Three-Condition Accountability Law");
      expect(html).toContain("Explore Active Challenges &amp; Matchups");
   });

   it("renders the 3 gamification & ecosystem strip cards", () => {
      const html = renderToStaticMarkup(createElement(GuestCockpitView, {}));

      // Economy
      expect(html).toContain("Economy &amp; Wagers");
      expect(html).toContain('href="/wallet"');
      expect(html).toContain("View Wallet &amp; Rules");

      // Pokemon
      expect(html).toContain("Pokémon Gacha &amp; Pokédex");
      expect(html).toContain('href="/pokemon"');
      expect(html).toContain("Explore Pokédex");

      // Trophy & Wrapped
      expect(html).toContain("Trophy Ranks &amp; Wrapped");
      expect(html).toContain('href="/leaderboard"');
      expect(html).toContain("Check Trophy Ranks");
   });

   it("renders the guest sandbox banner and starter chips", () => {
      const html = renderToStaticMarkup(createElement(GuestCockpitView, {}));

      expect(html).toContain("Local Guest Sandbox");
      expect(html).toContain("Browser-local storage · Offline-first");
      expect(html).toContain("Discord Tasker Bot");
      expect(html).toContain("Complete 2h Deep Work block");
      expect(html).toContain("Link YPT account");
      expect(html).toContain("Join an active Study Challenge");
      expect(html).toContain("mocked-cockpit-tasks-section");
   });

   it("dispatches LOAD_SAMPLE_TASK_EVENT when sample task chip is clicked in client DOM", () => {
      const eventListener = vi.fn();
      window.addEventListener(LOAD_SAMPLE_TASK_EVENT, eventListener);

      render(createElement(GuestCockpitView, {}));

      const sampleChip = screen.getByText("Complete 2h Deep Work block");
      fireEvent.click(sampleChip);

      expect(eventListener).toHaveBeenCalledOnce();
      const customEvent = eventListener.mock.calls[0]?.[0] as CustomEvent;
      expect(customEvent.detail).toEqual({
         title: "Complete 2h Deep Work block",
      });

      window.removeEventListener(LOAD_SAMPLE_TASK_EVENT, eventListener);
   });

   it("renders DashboardWrapped if wrappedChallenge is provided", () => {
      const html = renderToStaticMarkup(
         createElement(GuestCockpitView, {
            wrappedChallenge: { id: "wrapped-1" } as any,
         })
      );

      expect(html).toContain('data-testid="dashboard-wrapped"');
      expect(html).toContain('data-challenge-id="wrapped-1"');
   });
});
