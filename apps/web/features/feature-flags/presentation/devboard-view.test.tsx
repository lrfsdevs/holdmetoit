import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DevBoardView } from "./devboard-view";
import type { FeatureFlagEntity } from "../domain/feature-flags.types";

vi.mock("../api/feature-flags.actions", () => ({
   createFeatureFlagAction: vi.fn(),
   updateFeatureFlagAction: vi.fn(),
   setRolloutModeAction: vi.fn(),
   assignTesterAction: vi.fn(),
   removeTesterAction: vi.fn(),
   deleteFeatureFlagAction: vi.fn(),
   getFlagAuditTrailAction: vi.fn(),
   searchDiscordUsersAction: vi.fn(),
}));

vi.mock("@/features/ypt/presentation/ypt-verification-panel", () => ({
   YptVerificationPanel: () => null,
}));

vi.mock("@/features/cron-logs/presentation/cron-logs-panel", () => ({
   CronLogsPanel: () => null,
}));

describe("DevBoardView Presentation", () => {
   it("renders empty state when there are no feature flags", () => {
      const html = renderToStaticMarkup(
         createElement(DevBoardView, { initialFlags: [] })
      );

      expect(html).toContain("DevBoard");
      expect(html).toContain("No feature flags configured");
      expect(html).toContain("Create Feature Flag");
   });

   it("renders flag tabular grid, columns, and metrics when initialFlags are provided", () => {
      const flags: FeatureFlagEntity[] = [
         {
            id: "flag_1",
            key: "voice_logging",
            name: "Voice Logging Feature",
            description: "Enables voice duration input",
            rolloutMode: "GLOBAL",
            createdBy: "user_1",
            isDeleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            targets: [],
         },
         {
            id: "flag_2",
            key: "beta_dashboard",
            name: "Beta Dashboard V2",
            description: "Targeted rollout to alpha testers",
            rolloutMode: "TARGETED",
            createdBy: "user_1",
            isDeleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            targets: [
               {
                  flagId: "flag_2",
                  userId: "u_alpha",
                  createdBy: "admin",
                  createdAt: new Date().toISOString(),
                  user: {
                     id: "u_alpha",
                     displayName: "Alpha Tester",
                     username: "alpha",
                  },
               },
            ],
         },
      ];

      const html = renderToStaticMarkup(
         createElement(DevBoardView, { initialFlags: flags })
      );

      expect(html).toContain("DevBoard");
      // Column headers
      expect(html).toContain("Key &amp; Description");
      expect(html).toContain("Rollout");
      expect(html).toContain("Targeting");
      expect(html).toContain("Last Modified");

      // Flag rows
      expect(html).toContain("voice_logging");
      expect(html).toContain("Enables voice duration input");
      expect(html).toContain("Global");
      expect(html).toContain("beta_dashboard");
      expect(html).toContain("Targeted");
      expect(html).toContain("1 testers");

      // Metrics & filter tabs
      expect(html).toContain("Targeted Beta");
      expect(html).toContain("Active Global");
      expect(html).toContain("Killed/Dormant");
      expect(html).toContain("2");
      expect(html).toContain('aria-label="Actions for voice_logging"');
      expect(html).not.toContain("font-mono");
      expect(html).not.toContain("#a78bfa");
   });

   it("renders the Feature Flags | YPT Verification | Cron Logs switcher", () => {
      const html = renderToStaticMarkup(
         createElement(DevBoardView, { initialFlags: [] })
      );

      expect(html).toContain("Feature Flags");
      expect(html).toContain("YPT Verification");
      expect(html).toContain("Cron Logs");
      expect(html).toContain('role="tablist"');
      expect(html).toContain('aria-selected="true"');
   });
});
