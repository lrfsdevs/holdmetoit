import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ChallengeScoreboardViewModel } from "@/features/leaderboard/data/leaderboard-data";
import { ChallengeView } from "./challenge-view";

vi.mock("@/features/wrapped/api/wrapped.actions", () => ({
   markWrappedSeenAction: vi.fn().mockResolvedValue({ ok: true }),
   markWrappedSeenIfExpiredAction: vi.fn().mockResolvedValue({ ok: true }),
}));

const replaceStateMock = vi.fn();
let activeTabState: string = "overview";
const setActiveTabMock = vi.fn((updater: unknown) => {
   activeTabState =
      typeof updater === "function"
         ? (updater as (prev: string) => string)(activeTabState)
         : (updater as string);
});
let effectCallback: (() => void) | undefined = undefined;

// Mock react to allow both renderToStaticMarkup and direct hook invocation inspection
vi.mock("react", async (importOriginal) => {
   const actual = await importOriginal<typeof import("react")>();
   return {
      ...actual,
      useState: (initial: unknown) => {
         const initialVal =
            typeof initial === "function"
               ? (initial as () => unknown)()
               : initial;
         activeTabState = (initialVal as string) ?? "overview";
         return [activeTabState, setActiveTabMock];
      },
      useEffect: (fn: () => void) => {
         effectCallback = fn;
      },
   };
});

vi.mock("./challenge-hero-banner", () => ({
   ChallengeHeroBanner: ({
      challenge,
   }: {
      challenge: ChallengeScoreboardViewModel;
   }) =>
      createElement(
         "div",
         { "data-testid": "hero-banner" },
         `Hero: ${challenge.title}`
      ),
}));

vi.mock("./challenge-overview-tab", () => ({
   ChallengeOverviewTab: () =>
      createElement(
         "div",
         { "data-testid": "overview-tab-content" },
         "Overview Content"
      ),
}));

vi.mock(
   "@/features/leaderboard/presentation/challenge-leaderboard-tab",
   () => ({
      ChallengeLeaderboardTab: () =>
         createElement(
            "div",
            { "data-testid": "leaderboard-tab-content" },
            "Leaderboard Content"
         ),
   })
);

vi.mock("./challenge-manage-tab", () => ({
   ChallengeManageTab: ({
      initialRosterSearch,
      initialRosterTeamFilter,
      initialRosterPage,
   }: any) =>
      createElement(
         "div",
         {
            "data-testid": "manage-tab-content",
            "data-search": initialRosterSearch,
            "data-team": initialRosterTeamFilter,
            "data-page": String(initialRosterPage),
         },
         "Manage Content"
      ),
}));

vi.mock("@/features/audit/presentation/event-audit-tab", () => ({
   EventAuditTab: () =>
      createElement(
         "div",
         { "data-testid": "audit-tab-content" },
         "Audit Content"
      ),
}));

const mockChallenge: ChallengeScoreboardViewModel = {
   id: "chal-1",
   title: "October Study Sprint",
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
   punishmentWall: {
      punishmentPfpUrl: "https://example.com/pfp.png",
      flaggedMembers: [],
      isEventCompleted: false,
   },
   currentUser: {
      isLoggedIn: true,
      isEnrolled: true,
      participantId: "part-1",
      isWrappedSeen: false,
      isFeedbackFilled: false,
   },
};

describe("ChallengeView", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      activeTabState = "overview";
      effectCallback = undefined;

      // Configure window and location mock preserving search params
      const mockLocation = {
         href: "https://holdmetoit.com/challenge/chal-1?as=participant&filter=all",
         pathname: "/challenge/chal-1",
         search: "?as=participant&filter=all",
         hash: "",
      };

      globalThis.window = {
         location: mockLocation as unknown as Location,
         history: {
            replaceState: replaceStateMock,
         } as unknown as History,
      } as unknown as Window & typeof globalThis;
   });

   describe("Server / Initial Tab Hydration & Role Gating", () => {
      it("renders Overview content by default when no initialTab is provided", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeView, {
               challenge: mockChallenge,
               isAdmin: false,
            })
         );
         expect(html).toContain("Overview Content");
         expect(html).not.toContain("Leaderboard Content");
         expect(html).not.toContain("About this Challenge");
         expect(html).not.toContain("Manage Content");
      });

      it("renders Leaderboard content when initialTab='leaderboard'", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeView, {
               challenge: mockChallenge,
               initialTab: "leaderboard",
               isAdmin: false,
            })
         );
         expect(html).toContain("Leaderboard Content");
         expect(html).not.toContain("Overview Content");
      });

      it("gracefully redirects initialTab='about' to Overview content", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeView, {
               challenge: mockChallenge,
               initialTab: "about",
               isAdmin: false,
            })
         );
         expect(html).toContain("Overview Content");
         expect(html).not.toContain("Leaderboard Content");
      });

      it("clamps initialTab='manage' to overview for non-admin spectators", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeView, {
               challenge: mockChallenge,
               initialTab: "manage",
               isAdmin: false,
            })
         );
         expect(html).toContain("Overview Content");
         expect(html).not.toContain("Manage Content");
         expect(html).not.toContain(">Manage<");
         expect(html).not.toContain(">Audit Log<");
      });

      it("clamps initialTab='audit' to overview for non-admin spectators", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeView, {
               challenge: mockChallenge,
               initialTab: "audit",
               isAdmin: false,
            })
         );
         expect(html).toContain("Overview Content");
         expect(html).not.toContain("Audit Content");
         expect(html).not.toContain(">Audit Log<");
      });

      it("renders Manage tab content and buttons when initialTab='manage' and isAdmin=true", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeView, {
               challenge: mockChallenge,
               initialTab: "manage",
               isAdmin: true,
            })
         );
         expect(html).toContain("Manage Content");
         expect(html).toContain("Manage");
         expect(html).toContain("Audit Log");
      });

      it("renders Audit tab content when initialTab='audit' and isAdmin=true", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeView, {
               challenge: mockChallenge,
               initialTab: "audit",
               isAdmin: true,
            })
         );
         expect(html).toContain("Audit Content");
      });

      it("falls back to Overview when given an invalid initialTab string", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeView, {
               challenge: mockChallenge,
               initialTab: "invalid-tab-xyz",
               isAdmin: false,
            })
         );
         expect(html).toContain("Overview Content");
      });

      it("passes initialRosterSearch, initialRosterTeamFilter, and initialRosterPage to ChallengeManageTab", () => {
         const html = renderToStaticMarkup(
            createElement(ChallengeView, {
               challenge: mockChallenge,
               initialTab: "manage",
               isAdmin: true,
               initialRosterSearch: "sufi",
               initialRosterTeamFilter: "team-a",
               initialRosterPage: 2,
            })
         );
         expect(html).toContain('data-search="sufi"');
         expect(html).toContain('data-team="team-a"');
         expect(html).toContain('data-page="2"');
      });
   });

   describe("Interactive URL Synchronization via replaceState", () => {
      it("calls window.history.replaceState with updated ?tab=leaderboard preserving existing query params", () => {
         // Execute the component function to retrieve its rendered element tree
         const element = ChallengeView({
            challenge: mockChallenge,
            initialTab: "overview",
            isAdmin: true,
         });

         // Navigate tree to find tab buttons
         // element -> div.space-y-8 -> children[1] is tab container -> div -> children has buttons
         const tabContainer = (element.props.children as ReactNode[])[1] as {
            props: {
               children: {
                  props: {
                     children: Array<{
                        props: { children: ReactNode; onClick: () => void };
                     }>;
                  };
               };
            };
         };
         const buttons = tabContainer.props.children.props.children;

         const leaderboardBtn = buttons.find(
            (b) => b.props.children === "Leaderboard"
         );
         expect(leaderboardBtn).toBeDefined();

         leaderboardBtn!.props.onClick();

         expect(setActiveTabMock).toHaveBeenCalledWith("leaderboard");
         expect(replaceStateMock).toHaveBeenCalledTimes(1);
         expect(replaceStateMock).toHaveBeenCalledWith(
            null,
            "",
            "/challenge/chal-1?as=participant&filter=all&tab=leaderboard"
         );
      });

      it("deletes the tab query parameter when switching to 'overview' to keep canonical URL clean", () => {
         // Setup window location with an active tab param
         globalThis.window.location.search =
            "?as=participant&filter=all&tab=leaderboard";

         const element = ChallengeView({
            challenge: mockChallenge,
            initialTab: "leaderboard",
            isAdmin: true,
         });

         const tabContainer = (element.props.children as ReactNode[])[1] as {
            props: {
               children: {
                  props: {
                     children: Array<{
                        props: { children: ReactNode; onClick: () => void };
                     }>;
                  };
               };
            };
         };
         const buttons = tabContainer.props.children.props.children;

         const overviewBtn = buttons.find(
            (b) => b.props.children === "Overview"
         );
         expect(overviewBtn).toBeDefined();

         overviewBtn!.props.onClick();

         expect(setActiveTabMock).toHaveBeenCalledWith("overview");
         expect(replaceStateMock).toHaveBeenCalledWith(
            null,
            "",
            "/challenge/chal-1?as=participant&filter=all"
         );
      });

      it("clears search, team, and page parameters when navigating away from manage tab", () => {
         globalThis.window.location.href =
            "https://holdmetoit.com/challenge/chal-1?tab=manage&search=morgan&team=team-1&page=2";
         globalThis.window.location.search =
            "?tab=manage&search=morgan&team=team-1&page=2";

         const element = ChallengeView({
            challenge: mockChallenge,
            initialTab: "manage",
            isAdmin: true,
         });

         const tabContainer = (element.props.children as ReactNode[])[1] as {
            props: {
               children: {
                  props: {
                     children: Array<{
                        props: { children: ReactNode; onClick: () => void };
                     }>;
                  };
               };
            };
         };
         const buttons = tabContainer.props.children.props.children;
         const overviewBtn = buttons.find(
            (b) => b.props.children === "Overview"
         );
         expect(overviewBtn).toBeDefined();

         overviewBtn!.props.onClick();

         expect(setActiveTabMock).toHaveBeenCalledWith("overview");
         expect(replaceStateMock).toHaveBeenCalledWith(
            null,
            "",
            "/challenge/chal-1"
         );
      });

      it("clamps tab to 'overview' if non-admin tries to switch to 'manage'", () => {
         const element = ChallengeView({
            challenge: mockChallenge,
            initialTab: "overview",
            isAdmin: false,
         });

         const tabContainer = (element.props.children as ReactNode[])[1] as {
            props: {
               children: {
                  props: {
                     children: Array<{
                        props: { children: ReactNode; onClick: () => void };
                     }>;
                  };
               };
            };
         };
         const buttons = tabContainer.props.children.props.children;

         // Admin tabs shouldn't even exist in the DOM
         const manageBtn = buttons.find(
            (b) => b && b.props?.children === "Manage"
         );
         expect(manageBtn).toBeUndefined();
      });

      it("synchronizes activeTab when initialTab prop updates via useEffect", () => {
         ChallengeView({
            challenge: mockChallenge,
            initialTab: "leaderboard",
            isAdmin: true,
         });

         expect(effectCallback).toBeDefined();
         effectCallback!();
         expect(setActiveTabMock).toHaveBeenCalledWith("leaderboard");
      });
   });
});
