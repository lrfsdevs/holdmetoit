// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { DevBoardView } from "./devboard-view";

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
   YptVerificationPanel: () => <div data-testid="ypt-verification-panel" />,
}));

vi.mock("@/features/cron-logs/presentation/cron-logs-panel", () => ({
   CronLogsPanel: () => <div data-testid="cron-logs-panel" />,
}));

beforeEach(() => {
   window.history.replaceState(null, "", "/devboard");
});

afterEach(() => {
   cleanup();
   window.history.replaceState(null, "", "/devboard");
});

describe("DevBoardView tab persistence", () => {
   it("opens the initial tab from the server", () => {
      render(<DevBoardView initialFlags={[]} initialTab="cron-logs" />);

      expect(
         screen
            .getByRole("tab", { name: /Cron Logs/ })
            .getAttribute("aria-selected")
      ).toBe("true");
      expect(screen.getByTestId("cron-logs-panel")).toBeTruthy();
   });

   it("clamps an invalid initial tab", () => {
      render(<DevBoardView initialFlags={[]} initialTab="nonsense" />);

      expect(
         screen
            .getByRole("tab", { name: /Feature Flags/ })
            .getAttribute("aria-selected")
      ).toBe("true");
   });

   it("writes the selected tab to the URL", () => {
      render(<DevBoardView initialFlags={[]} />);

      fireEvent.mouseDown(screen.getByRole("tab", { name: /Cron Logs/ }), {
         button: 0,
      });

      expect(window.location.pathname).toBe("/devboard");
      expect(window.location.search).toBe("?tab=cron-logs");
      expect(screen.getByTestId("cron-logs-panel")).toBeTruthy();
   });

   it("removes the param when returning to Feature Flags but keeps others", () => {
      window.history.replaceState(null, "", "/devboard?tab=cron-logs&foo=bar");
      render(<DevBoardView initialFlags={[]} initialTab="cron-logs" />);

      fireEvent.mouseDown(screen.getByRole("tab", { name: /Feature Flags/ }), {
         button: 0,
      });

      expect(window.location.search).toBe("?foo=bar");
   });

   it("syncs when a new initial tab arrives from the server", () => {
      const { rerender } = render(
         <DevBoardView initialFlags={[]} initialTab="flags" />
      );

      rerender(<DevBoardView initialFlags={[]} initialTab="ypt" />);

      expect(
         screen
            .getByRole("tab", { name: /YPT Verification/ })
            .getAttribute("aria-selected")
      ).toBe("true");
   });
});
