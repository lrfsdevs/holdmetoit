import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { UserNav } from "./auth-nav";

vi.mock("@/features/auth/api/auth.actions", () => ({
   loginWithDiscordAction: vi.fn(),
   logoutAction: vi.fn(),
}));

vi.mock("@/features/auth/api/preview-mode.actions", () => ({
   toggleParticipantPreviewAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
   useRouter: () => ({
      refresh: vi.fn(),
   }),
}));

describe("UserNav", () => {
   it("renders Discord sign in button when user is null", () => {
      const html = renderToStaticMarkup(createElement(UserNav, { user: null }));
      expect(html).toContain("Sign In with Discord");
      expect(html).not.toContain("Admin Console");
      expect(html).not.toContain("DEV");
      expect(html).not.toContain("enter-preview-button");
   });

   it("renders participant capsule without admin console, preview button, or dev badge", () => {
      const html = renderToStaticMarkup(
         createElement(UserNav, {
            user: {
               id: "u_1",
               displayName: "AliceStudent",
               role: "PARTICIPANT",
            },
         })
      );
      expect(html).toContain("AliceStudent");
      expect(html).not.toContain("Admin Console");
      expect(html).not.toContain("dev-role-badge");
      expect(html).not.toContain("enter-preview-button");
      expect(html).not.toContain("exit-preview-button");
   });

   it("renders enter-preview button for ADMIN role without dev badge", () => {
      const html = renderToStaticMarkup(
         createElement(UserNav, {
            user: {
               id: "u_2",
               displayName: "HostAdmin",
               role: "ADMIN",
            },
         })
      );
      expect(html).toContain("HostAdmin");
      expect(html).not.toContain("Admin Console");
      expect(html).not.toContain("/admin");
      expect(html).toContain('data-testid="enter-preview-button"');
      expect(html).toContain("Preview as Participant");
      expect(html).not.toContain("dev-role-badge");
   });

   it("renders enter-preview button and DEV badge for DEV role", () => {
      const html = renderToStaticMarkup(
         createElement(UserNav, {
            user: {
               id: "u_3",
               displayName: "DevArchitect",
               role: "DEV",
            },
         })
      );
      expect(html).toContain("DevArchitect");
      expect(html).not.toContain("Admin Console");
      expect(html).not.toContain("/admin");
      expect(html).toContain('data-testid="enter-preview-button"');
      expect(html).toContain('data-testid="dev-role-badge"');
      expect(html).toContain("DEV");
   });

   it("hides DEV badge when isPreviewActive is true, and renders Exit Preview button", () => {
      const html = renderToStaticMarkup(
         createElement(UserNav, {
            user: {
               id: "u_3",
               displayName: "DevArchitect",
               role: "DEV",
            },
            isActualAdmin: true,
            isPreviewActive: true,
         })
      );
      expect(html).toContain("DevArchitect");
      expect(html).not.toContain("Admin Console");
      expect(html).not.toContain("/admin");
      expect(html).not.toContain('data-testid="dev-role-badge"');
      expect(html).toContain('data-testid="exit-preview-button"');
      expect(html).toContain("Exit Preview");
   });

   it("renders user capsule as a link to /profile by default", () => {
      const html = renderToStaticMarkup(
         createElement(UserNav, {
            user: {
               id: "u_1",
               displayName: "AliceStudent",
               role: "PARTICIPANT",
            },
         })
      );
      expect(html).toContain('data-testid="user-profile-link"');
      expect(html).toContain('href="/profile"');
      expect(html).toContain('title="View profile for AliceStudent"');
   });

   it("renders user capsule as a link with custom profileUrl when provided", () => {
      const html = renderToStaticMarkup(
         createElement(UserNav, {
            user: {
               id: "u_1",
               displayName: "AliceStudent",
               role: "PARTICIPANT",
            },
            profileUrl: "/challenge/c-1/participant/p-1",
         })
      );
      expect(html).toContain('data-testid="user-profile-link"');
      expect(html).toContain('href="/challenge/c-1/participant/p-1"');
   });
});

describe("AppHeader", () => {
   it("renders brand logo and Challenges directory link", async () => {
      const { AppHeader } = await import("./auth-nav");
      const html = renderToStaticMarkup(
         createElement(AppHeader, { user: null })
      );
      expect(html).toContain("HoldMeToIt");
      expect(html).toContain("Challenges");
      expect(html).toContain('href="/challenges"');
   });
});
