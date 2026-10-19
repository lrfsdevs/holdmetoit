// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Dialog, DialogContent, DialogTitle } from "./dialog";

afterEach(cleanup);

describe("DialogContent", () => {
   it("applies overlayClassName to the overlay", () => {
      render(
         <Dialog open onOpenChange={vi.fn()}>
            <DialogContent overlayClassName="z-[80]">
               <DialogTitle>Test dialog</DialogTitle>
               <p>Body</p>
            </DialogContent>
         </Dialog>
      );

      const overlay = document.body.querySelector(".bg-modal-overlay");

      expect(overlay?.className).toContain("z-[80]");
   });
});
