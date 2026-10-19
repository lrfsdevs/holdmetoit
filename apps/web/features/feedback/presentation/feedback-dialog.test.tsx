// @vitest-environment jsdom
import { createElement, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { FeedbackDialog } from "./feedback-dialog";

vi.mock("next/navigation", () => ({
   usePathname: () => "/active-challenge",
}));

afterEach(cleanup);

function renderToHtml(el: ReactElement): string {
   const { container } = render(el);
   return document.body.innerHTML.replace(container.outerHTML, "");
}

function getOverlay(): Element {
   const overlay = document.body.querySelector(".bg-modal-overlay");
   if (!overlay) throw new Error("Dialog overlay was not rendered.");
   return overlay;
}

async function renderOpen(onClose: () => void): Promise<void> {
   render(createElement(FeedbackDialog, { isOpen: true, onClose }));
   await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
   });
}

async function pressBackdrop(): Promise<void> {
   const overlay = getOverlay();
   fireEvent.pointerDown(overlay, { button: 0 });
   fireEvent.click(overlay);
   await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
   });
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

   it("closes on a backdrop press when the form is pristine", async () => {
      const onClose = vi.fn();
      await renderOpen(onClose);

      await pressBackdrop();

      expect(onClose).toHaveBeenCalled();
   });

   it("does not close on a backdrop press once the draft is dirty", async () => {
      const onClose = vi.fn();
      await renderOpen(onClose);

      fireEvent.change(document.querySelector("#feedback-title")!, {
         target: { value: "Broken submit button" },
      });
      await pressBackdrop();

      expect(onClose).not.toHaveBeenCalled();
   });

   it("closes on Escape when the form is pristine", async () => {
      const onClose = vi.fn();
      await renderOpen(onClose);

      fireEvent.keyDown(document.body, { key: "Escape" });

      expect(onClose).toHaveBeenCalled();
   });

   it("ignores Escape while the draft is dirty", async () => {
      const onClose = vi.fn();
      await renderOpen(onClose);

      fireEvent.change(document.querySelector("#feedback-title")!, {
         target: { value: "Broken submit button" },
      });
      fireEvent.keyDown(document.body, { key: "Escape" });

      expect(onClose).not.toHaveBeenCalled();
   });

   it("ignores Escape during IME composition", async () => {
      const onClose = vi.fn();
      await renderOpen(onClose);

      fireEvent.keyDown(document.body, {
         key: "Escape",
         isComposing: true,
         keyCode: 229,
      });

      expect(onClose).not.toHaveBeenCalled();
   });

   it("raises the overlay and content above app overlays", async () => {
      const onClose = vi.fn();
      await renderOpen(onClose);

      expect(getOverlay().className).toContain("z-[80]");
      expect(
         document.body.querySelector('[role="dialog"]')?.className
      ).toContain("z-[80]");
   });
});
