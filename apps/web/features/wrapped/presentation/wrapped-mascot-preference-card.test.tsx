// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { WrappedMascotPreferenceCard } from "./wrapped-mascot-preference-card";
import { setWrappedMascotPreference } from "./wrapped-storage";

vi.mock("sonner", () => ({
   toast: {
      success: vi.fn(),
      error: vi.fn(),
   },
}));

describe("WrappedMascotPreferenceCard", () => {
   beforeEach(() => {
      window.localStorage.clear();
      setWrappedMascotPreference("GOOGLY_EYES");
      vi.clearAllMocks();
   });

   afterEach(() => {
      cleanup();
   });

   it("renders header, description, and active mascot badge", () => {
      const { getByTestId, getByText } = render(
         <WrappedMascotPreferenceCard />
      );

      expect(getByTestId("wrapped-mascot-preference-card")).toBeDefined();
      expect(getByText("Wrapped Mascot Companion")).toBeDefined();
      expect(getByTestId("active-mascot-badge").textContent).toContain(
         "OG Googly Eyes"
      );
   });

   it("renders all 4 mascot selector options with live previews", () => {
      const { getByTestId, getByText } = render(
         <WrappedMascotPreferenceCard />
      );

      expect(getByTestId("mascot-option-googly_eyes")).toBeDefined();
      expect(getByText("Doodle Cat")).toBeDefined();
      expect(getByText("Doodle Dog")).toBeDefined();
      expect(getByText("Doodle Bunny")).toBeDefined();

      expect(getByTestId("mascot-preview-googly_eyes")).toBeDefined();
      expect(getByTestId("mascot-preview-cat")).toBeDefined();
      expect(getByTestId("mascot-preview-dog")).toBeDefined();
      expect(getByTestId("mascot-preview-bunny")).toBeDefined();
   });

   it("clicking an unselected option updates active mascot and fires callback", () => {
      const onVariantChange = vi.fn();
      const { getByTestId } = render(
         <WrappedMascotPreferenceCard onVariantChange={onVariantChange} />
      );

      const catButton = getByTestId("mascot-option-cat");
      fireEvent.click(catButton);

      expect(onVariantChange).toHaveBeenCalledWith("CAT");
      expect(getByTestId("active-mascot-badge").textContent).toContain(
         "Doodle Cat"
      );
      expect(catButton.getAttribute("aria-checked")).toBe("true");
   });
});
