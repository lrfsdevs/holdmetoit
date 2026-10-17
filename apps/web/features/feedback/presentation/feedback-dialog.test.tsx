import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FeedbackDialog } from "./feedback-dialog";

vi.mock("next/navigation", () => ({
   usePathname: () => "/active-challenge",
}));

describe("FeedbackDialog", () => {
   it("renders nothing when isOpen is false", () => {
      const html = renderToStaticMarkup(
         createElement(FeedbackDialog, { isOpen: false, onClose: vi.fn() })
      );

      expect(html).toBe("");
   });

   it("renders modal header, close button, and form when isOpen is true", () => {
      const html = renderToStaticMarkup(
         createElement(FeedbackDialog, { isOpen: true, onClose: vi.fn() })
      );

      expect(html).toContain("Send Feedback");
      expect(html).toContain("Report a bug or suggest an enhancement");
      expect(html).toContain("Close dialog");
      expect(html).toContain("Submit Feedback");
   });
});
