import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ChallengesListView } from "./challenges-list-view";
import type { ChallengeCatalogItem } from "@/features/challenges/data/challenge.repository";

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

const mockChallenges: ChallengeCatalogItem[] = [
   {
      id: "chal-active-1",
      title: "October Team Battle",
      format: "TEAM_VS_TEAM",
      challengeColor: null,
      status: "ACTIVE",
      startAt: new Date("2026-10-04T01:00:00.000Z"),
      endAt: new Date("2026-10-10T01:00:00.000Z"),
      eventBannerUrl: "https://example.com/banner.png",
      punishmentPfpUrl: null,
      resultsLockedAt: null,
      hostId: "admin-1",
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      updatedAt: new Date("2026-10-01T00:00:00.000Z"),
      host: {
         id: "admin-1",
         displayName: "Host Admin",
         username: "admin",
         image: null,
      },
      teams: [],
      _count: {
         participants: 12,
      },
   },
   {
      id: "chal-upcoming-2",
      title: "November Solo Grind",
      format: "SOLOS",
      challengeColor: null,
      status: "UPCOMING",
      startAt: new Date("2026-11-01T01:00:00.000Z"),
      endAt: new Date("2026-11-07T01:00:00.000Z"),
      eventBannerUrl: null,
      punishmentPfpUrl: null,
      resultsLockedAt: null,
      hostId: "admin-1",
      createdAt: new Date("2026-10-02T00:00:00.000Z"),
      updatedAt: new Date("2026-10-02T00:00:00.000Z"),
      host: {
         id: "admin-1",
         displayName: "Host Admin",
         username: "admin",
         image: null,
      },
      teams: [],
      _count: {
         participants: 5,
      },
   },
];

describe("ChallengesListView", () => {
   it("renders admin action controls when canManageChallenges is true", () => {
      const html = renderToStaticMarkup(
         <ChallengesListView
            challenges={mockChallenges}
            canManageChallenges={true}
         />
      );

      expect(html).toContain("Create Challenge");
      expect(html).toContain("Change Accent Color");
      expect(html).toContain('href="/admin/challenges/new"');
      expect(html).toContain('data-testid="admin-challenge-actions"');
   });

   it("omits admin action controls when canManageChallenges is false", () => {
      const html = renderToStaticMarkup(
         <ChallengesListView
            challenges={mockChallenges}
            canManageChallenges={false}
         />
      );

      expect(html).not.toContain("Create Challenge");
      expect(html).not.toContain("Change Accent Color");
      expect(html).not.toContain('href="/admin/challenges/new"');
      expect(html).not.toContain('data-testid="admin-challenge-actions"');
   });

   it("renders challenge cards with correct metadata badges and links", () => {
      const html = renderToStaticMarkup(
         <ChallengesListView
            challenges={mockChallenges}
            canManageChallenges={false}
         />
      );

      // Titles
      expect(html).toContain("October Team Battle");
      expect(html).toContain("November Solo Grind");

      // Status badges
      expect(html).toContain("Ongoing");
      expect(html).toContain("Upcoming");

      // Participant counts
      expect(html).toContain("12");
      expect(html).toContain("5");

      // View links
      expect(html).toContain('href="/challenge/chal-active-1"');
      expect(html).toContain('href="/challenge/chal-upcoming-2"');
      expect(html).toContain("View Challenge");
   });

   it("renders admin empty state when challenges is empty and canManageChallenges is true", () => {
      const html = renderToStaticMarkup(
         <ChallengesListView challenges={[]} canManageChallenges={true} />
      );

      expect(html).toContain("No challenges created yet.");
      expect(html).toContain("Create First Challenge");
      expect(html).toContain('href="/admin/challenges/new"');
   });

   it("renders participant friendly empty state when challenges is empty and canManageChallenges is false", () => {
      const html = renderToStaticMarkup(
         <ChallengesListView challenges={[]} canManageChallenges={false} />
      );

      expect(html).toContain(
         "No challenges active yet. Check back soon for upcoming events!"
      );
      expect(html).toContain("Back to Home");
      expect(html).toContain('href="/"');
      expect(html).not.toContain("Create First Challenge");
   });

   it("renders pagination controls when challenge count exceeds 9", () => {
      const manyChallenges = Array.from({ length: 12 }, (_, i) => ({
         id: `chal-${i + 1}`,
         title: `Challenge ${i + 1}`,
         format: "TEAM_VS_TEAM" as const,
         challengeColor: null,
         status: "ACTIVE" as const,
         startAt: new Date("2026-10-04T01:00:00.000Z"),
         endAt: new Date("2026-10-10T01:00:00.000Z"),
         eventBannerUrl: null,
         punishmentPfpUrl: null,
         resultsLockedAt: null,
         hostId: "admin-1",
         createdAt: new Date("2026-10-01T00:00:00.000Z"),
         updatedAt: new Date("2026-10-01T00:00:00.000Z"),
         host: {
            id: "admin-1",
            displayName: "Host Admin",
            username: "admin",
            image: null,
         },
         _count: { participants: 2 },
         teams: [],
      }));

      const html = renderToStaticMarkup(
         <ChallengesListView
            challenges={manyChallenges}
            canManageChallenges={false}
         />
      );

      expect(html).toContain("Showing");
      expect(html).toContain("1–9");
      expect(html).toContain("12");
      expect(html).toContain("challenges");
      expect(html).toContain("Next");
   });

   it("renders search input, status tabs, and format filter dropdown", () => {
      const html = renderToStaticMarkup(
         <ChallengesListView
            challenges={mockChallenges}
            canManageChallenges={false}
         />
      );

      // Search input
      expect(html).toContain(
         "Search challenges by title, format, host, team..."
      );
      // Status tabs
      expect(html).toContain("All (2)");
      expect(html).toContain("Active (1)");
      expect(html).toContain("Upcoming (1)");
      expect(html).toContain("Completed (0)");
      // Format dropdown
      expect(html).toContain("All Formats");
      expect(html).toContain("Team vs Team");
      expect(html).toContain("Solo Battles");
   });
});
