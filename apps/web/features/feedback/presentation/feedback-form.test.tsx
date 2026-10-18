import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FeedbackForm } from "./feedback-form";

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
});
