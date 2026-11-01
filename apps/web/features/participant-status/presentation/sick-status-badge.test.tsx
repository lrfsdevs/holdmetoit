// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import React from "react";
import { SickStatusBadge } from "./sick-status-badge";

afterEach(cleanup);

describe("features/participant-status/presentation/sick-status-badge", () => {
   it("renders nothing if isSick is false or omitted", () => {
      const { container } = render(<SickStatusBadge isSick={false} />);
      expect(container.firstChild).toBeNull();
   });

   it("renders nothing if auto-expired (7 days+)", () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 3600 * 1000);
      const { container } = render(
         <SickStatusBadge isSick={true} activatedAt={eightDaysAgo} />
      );
      expect(container.firstChild).toBeNull();
   });

   it("renders resting badge when active", () => {
      const activatedAt = new Date(Date.now() - 2 * 3600 * 1000); // 2h ago
      render(
         <SickStatusBadge
            isSick={true}
            activatedAt={activatedAt}
            note="High fever"
            showTooltip={false}
         />
      );

      const badge = screen.getByTestId("sick-status-badge");
      expect(badge).toBeDefined();
      expect(badge.textContent).toContain("Resting");
      expect(badge.getAttribute("title")).toContain("High fever");
   });

   it("applies variant classes correctly", () => {
      const activatedAt = new Date();
      render(
         <SickStatusBadge
            isSick={true}
            activatedAt={activatedAt}
            variant="prominent"
            showTooltip={false}
         />
      );

      const badge = screen.getByTestId("sick-status-badge");
      expect(badge.className).toContain("text-sm");
   });
});
