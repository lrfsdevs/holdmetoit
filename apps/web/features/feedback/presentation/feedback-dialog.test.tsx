// @vitest-environment jsdom
import { createElement, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { FeedbackDialog } from "./feedback-dialog";

vi.mock("next/navigation", () => ({
   usePathname: () => "/active-challenge",
}));

afterEach(cleanup);

function renderToHtml(el: ReactElement): string {
   const { container } = render(el);
   return document.body.innerHTML.replace(container.outerHTML, "");
}

describe("FeedbackDialog", () => {
   it("renders nothing when isOpen is false", () => {
      const html = renderToHtml(
         createElement(FeedbackDialog, { isOpen: false, onClose: vi.fn() })
      );

      expect(html).toBe("");
   });

   it("renders modal header, close button, and form when isOpen is true", () => {
      const html = renderToHtml(
         createElement(FeedbackDialog, { isOpen: true, onClose: vi.fn() })
      );

      expect(html).toContain("Send Feedback");
      expect(html).toContain("Report a bug or suggest an enhancement");
      expect(html).toContain("Close dialog");
      expect(html).toContain("Submit Feedback");
   });
});
