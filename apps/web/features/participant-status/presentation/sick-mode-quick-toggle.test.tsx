// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { SickModeQuickToggle } from "./sick-mode-quick-toggle";
import * as actions from "../api/sick-mode.actions";

vi.mock("../api/sick-mode.actions", () => ({
   toggleSickModeAction: vi.fn(),
}));

afterEach(cleanup);

describe("features/participant-status/presentation/sick-mode-quick-toggle", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("renders inactive state correctly", () => {
      render(<SickModeQuickToggle initialIsSick={false} />);
      const btn = screen.getByTestId("sick-mode-quick-toggle");
      expect(btn.textContent).toContain("Feeling Unwell?");
   });

   it("renders active resting state correctly", () => {
      render(
         <SickModeQuickToggle
            initialIsSick={true}
            initialActivatedAt={new Date()}
         />
      );
      const btn = screen.getByTestId("sick-mode-quick-toggle");
      expect(btn.textContent).toContain("Resting (Sick Mode)");
   });

   it("opens dialog on click and displays warning about zero grace passes", () => {
      render(<SickModeQuickToggle initialIsSick={false} />);
      const btn = screen.getByTestId("sick-mode-quick-toggle");
      fireEvent.click(btn);

      expect(screen.getByText("Activate Sick Mode")).toBeDefined();
      expect(screen.getByText(/zero grace passes/i)).toBeDefined();
   });
});
