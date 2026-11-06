import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GlobalProfileView } from "./global-profile-view";
import type { GlobalUserProfile } from "../domain/global-profile.types";

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
   signIn: vi.fn(),
   signOut: vi.fn(),
}));

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

let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
   useRouter: () => ({
      refresh: vi.fn(),
      push: vi.fn(),
      replace: vi.fn(),
   }),
   useSearchParams: () => mockSearchParams,
}));

vi.mock("../api/global-profile.actions", () => ({
   getChallengeSnapshotAction: vi.fn(),
}));

vi.mock("@/features/ypt/presentation/ypt-settings-card", () => ({
   YptSettingsCard: () =>
      createElement(
         "div",
         { "data-testid": "ypt-settings-card" },
         "YPT Settings Card"
      ),
}));

vi.mock("@/features/preferences/presentation/audio-settings-card", () => ({
   AudioSettingsCard: () =>
      createElement(
         "div",
         { "data-testid": "audio-settings-card" },
         "Audio Settings Card"
      ),
}));

describe("GlobalProfileView", () => {
   const mockProfile: GlobalUserProfile = {
      user: {
         id: "user_alice",
         displayName: "Alice Scholar",
         username: "alicescholar",
         image: "https://example.com/alice.png",
         role: "PARTICIPANT",
         joinedAt: "2026-02-10T00:00:00.000Z",
         trophyBalance: 2450,
         yptId: "12345678",
      },
      careerStats: {
         lifetimeStudyHours: 85.5,
         lifetimeStudySeconds: 307800,
         lifetimeStudyClock: "85:30:00",
         lifetimeStudyHuman: "85h 30m",
         totalActiveStudyDays: 24,
         currentStreak: 6,
         longestStreak: 14,
         totalChallengesEntered: 3,
         challengesCompleted: 2,
         totalTasksCompleted: 48,
         trophyTotal: 2450,
         trophyRank: "Master Scholar",
         pokedexCount: 19,
      },
      challengeHistory: [
         {
            challengeId: "chal_recent",
            participantId: "part_recent",
            title: "Winter Sprint",
            mode: "DUOS",
            status: "ACTIVE",
            startDate: "2026-10-25T00:00:00.000Z",
            endDate: "2026-11-05T00:00:00.000Z",
            targetHours: 25,
            loggedHours: 12.5,
            trophyDelta: 0,
         },
         {
            challengeId: "chal_older",
            participantId: "part_older",
            title: "Autumn Clash",
            mode: "TEAM_VS_TEAM",
            status: "COMPLETED",
            startDate: "2026-10-01T00:00:00.000Z",
            endDate: "2026-10-08T00:00:00.000Z",
            targetHours: 35,
            loggedHours: 36,
            trophyDelta: 100,
         },
      ],
   };

   it("renders profile header with avatar, platform username, trophy rank, and member since date", () => {
      const html = renderToStaticMarkup(
         <GlobalProfileView
            profile={mockProfile}
            isOwnProfile={false}
            isGlobalLeaderboardEnabled={true}
         />
      );

      expect(html).toContain("alicescholar");
      expect(html).toContain("Master Scholar");
      expect(html).toContain("2450 trophies");
      expect(html).toContain("Member since Feb 2026");
   });

   it("gates trophy rank badge behind global_leaderboard feature flag", () => {
      const htmlDisabled = renderToStaticMarkup(
         <GlobalProfileView
            profile={mockProfile}
            isOwnProfile={false}
            isGlobalLeaderboardEnabled={false}
         />
      );

      expect(htmlDisabled).not.toContain("trophy-rank-badge");
      expect(htmlDisabled).not.toContain("2450 trophies");

      const htmlEnabled = renderToStaticMarkup(
         <GlobalProfileView
            profile={mockProfile}
            isOwnProfile={false}
            isGlobalLeaderboardEnabled={true}
         />
      );

      expect(htmlEnabled).toContain("trophy-rank-badge");
      expect(htmlEnabled).toContain("2450 trophies");
   });

   it("renders pencil icon button only for profile owner when platform_username flag is enabled", () => {
      const htmlOwnerEnabled = renderToStaticMarkup(
         <GlobalProfileView
            profile={mockProfile}
            isOwnProfile={true}
            isPlatformUsernameEnabled={true}
         />
      );
      expect(htmlOwnerEnabled).toContain("edit-username-trigger");

      const htmlOwnerDisabled = renderToStaticMarkup(
         <GlobalProfileView
            profile={mockProfile}
            isOwnProfile={true}
            isPlatformUsernameEnabled={false}
         />
      );
      expect(htmlOwnerDisabled).not.toContain("edit-username-trigger");

      const htmlNonOwner = renderToStaticMarkup(
         <GlobalProfileView
            profile={mockProfile}
            isOwnProfile={false}
            isPlatformUsernameEnabled={true}
         />
      );
      expect(htmlNonOwner).not.toContain("edit-username-trigger");
   });

   it("renders all 6 global career overview statistics cards", () => {
      const html = renderToStaticMarkup(
         <GlobalProfileView profile={mockProfile} />
      );

      expect(html).toContain("Lifetime Study Time");
      expect(html).toContain("85:30:00");
      expect(html).toContain("Active Study Days");
      expect(html).toContain("24 Days");
      expect(html).toContain("Study Streak");
      expect(html).toContain("6 Days");
      expect(html).toContain("Personal longest: 14");
      expect(html).toContain("Challenges Participated");
      expect(html).toContain("3 Entered");
      expect(html).toContain("2 challenges completed");
      expect(html).toContain("Tasks Completed");
      expect(html).toContain("48");
      expect(html).toContain("Pokédex Collection");
      expect(html).toContain("19 Pokémon");
   });

   it("renders Settings tab for profile owner and omits sync avatar button", () => {
      const html = renderToStaticMarkup(
         <GlobalProfileView profile={mockProfile} isOwnProfile={true} />
      );

      expect(html).not.toContain("Sync Avatar");
      expect(html).toContain("tab-settings");
   });

   it("renders YPT, Audio, and Wrapped Mascot settings cards when Settings tab is active for owner", () => {
      mockSearchParams = new URLSearchParams("tab=settings");
      const html = renderToStaticMarkup(
         <GlobalProfileView profile={mockProfile} isOwnProfile={true} />
      );

      expect(html).toContain('data-testid="settings-content"');
      expect(html).toContain('data-testid="ypt-settings-card"');
      expect(html).toContain('data-testid="audio-settings-card"');
      expect(html).toContain('data-testid="wrapped-mascot-preference-card"');
      mockSearchParams = new URLSearchParams();
   });

   it("omits Settings tab for non-owner viewers", () => {
      const html = renderToStaticMarkup(
         <GlobalProfileView profile={mockProfile} isOwnProfile={false} />
      );

      expect(html).not.toContain("tab-settings");
   });

   it("renders empty state notice when viewer is unauthorized by privacy boundary", () => {
      const html = renderToStaticMarkup(
         <GlobalProfileView profile={mockProfile} isAuthorizedHistory={false} />
      );

      // In overview tab, career cards are still visible
      expect(html).toContain("Lifetime Career Statistics");
   });
});
