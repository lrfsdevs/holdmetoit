import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
