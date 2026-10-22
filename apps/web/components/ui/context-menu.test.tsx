// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render, screen } from "@testing-library/react";
import {
   ContextMenu,
   ContextMenuTrigger,
   ContextMenuContent,
   ContextMenuItem,
   ContextMenuSeparator,
   ContextMenuLabel,
} from "./context-menu";
import {
   DropdownMenu,
   DropdownMenuTrigger,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuLabel,
} from "./dropdown-menu";
import { Input } from "./input";

afterEach(cleanup);

describe("ContextMenu & DropdownMenu Component Tokens", () => {
   it("renders ContextMenu elements with Obsidian Dark palette tokens", () => {
      const html = renderToStaticMarkup(
         createElement(
            ContextMenu,
            null,
            createElement(ContextMenuTrigger, null, "Right click here"),
            createElement(
               ContextMenuContent,
               null,
               createElement(ContextMenuLabel, null, "Actions"),
               createElement(ContextMenuItem, null, "Edit Task"),
               createElement(ContextMenuSeparator, null)
            )
         )
      );

      expect(html).toContain("Right click here");
   });

   it("renders DropdownMenu elements with Obsidian Dark palette tokens matching ContextMenu", () => {
      const html = renderToStaticMarkup(
         createElement(
            DropdownMenu,
            null,
            createElement(DropdownMenuTrigger, null, "Open Dropdown"),
            createElement(
               DropdownMenuContent,
               null,
               createElement(DropdownMenuLabel, null, "Options"),
               createElement(DropdownMenuItem, null, "Move to Day"),
               createElement(DropdownMenuSeparator, null)
            )
         )
      );

      expect(html).toContain("Open Dropdown");
   });
});

describe("ContextMenu Scroll Dismiss Resilience (GH-#147 / KAN-38 / FB-17)", () => {
   it("does NOT dispatch Escape when context menu is closed and a window or container scroll fires", () => {
      const escapeListener = vi.fn();
      document.addEventListener("keydown", escapeListener);

      render(
         <div>
            <ContextMenu>
               <ContextMenuTrigger>Trigger</ContextMenuTrigger>
               <ContextMenuContent>
                  <ContextMenuItem>Item</ContextMenuItem>
               </ContextMenuContent>
            </ContextMenu>
            <input
               data-testid="task-input"
               defaultValue="long task description..."
            />
         </div>
      );

      // Simulate a scroll event on window while menu is closed
      window.dispatchEvent(new Event("scroll"));

      expect(escapeListener).not.toHaveBeenCalled();
      document.removeEventListener("keydown", escapeListener);
   });

   it("does NOT dispatch Escape when an input or textarea scrolls horizontally/vertically", () => {
      const escapeListener = vi.fn();
      document.addEventListener("keydown", escapeListener);

      render(
         <div>
            <ContextMenu>
               <ContextMenuTrigger>Trigger</ContextMenuTrigger>
               <ContextMenuContent>
                  <ContextMenuItem>Item</ContextMenuItem>
               </ContextMenuContent>
            </ContextMenu>
            <input data-testid="test-input" defaultValue="long text" />
         </div>
      );

      const input = screen.getByTestId("test-input");

      // Dispatch scroll directly on the input element
      input.dispatchEvent(new Event("scroll", { bubbles: false }));

      expect(escapeListener).not.toHaveBeenCalled();
      document.removeEventListener("keydown", escapeListener);
   });

   it("Input component stops native scroll propagation", () => {
      const parentScrollSpy = vi.fn();
      const inputScrollSpy = vi.fn();

      render(
         <div onScroll={parentScrollSpy}>
            <Input data-testid="custom-input" onScroll={inputScrollSpy} />
         </div>
      );

      const input = screen.getByTestId("custom-input");
      input.dispatchEvent(new Event("scroll", { bubbles: true }));

      expect(inputScrollSpy).toHaveBeenCalled();
   });
});
