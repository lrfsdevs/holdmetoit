// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FeedbackForm } from "./feedback-form";

afterEach(cleanup);

vi.mock("next/navigation", () => ({
   usePathname: () => "/test-page",
}));

vi.mock("@/core/observability/logrocket", () => ({
   getLogRocketSessionURL: vi
      .fn()
      .mockResolvedValue("https://app.logrocket.com/session-123"),
}));

describe("FeedbackForm", () => {
   it("renders bug report form by default with submit button and without page path indicator", () => {
      const html = renderToStaticMarkup(createElement(FeedbackForm));

      expect(html).toContain("Bug Report");
      expect(html).toContain("Suggestion");
      expect(html).toContain("Submit Feedback");
      expect(html).not.toContain("📍 Page");
      expect(html).toContain("e.g., Submit button doesn&#x27;t work on mobile");
   });

   it("renders cancel button when onCancel handler is provided", () => {
      const html = renderToStaticMarkup(
         createElement(FeedbackForm, { onCancel: vi.fn() })
      );

      expect(html).toContain("Cancel");
   });

   it("shows attachments for bug reports and hides them for suggestions", () => {
      render(createElement(FeedbackForm));

      expect(screen.getByText("Add image or video")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: /suggestion/i }));

      expect(screen.queryByText("Add image or video")).toBeNull();
   });
});
