import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("utils: cn", () => {
   it("merges tailwind class names via cn()", () => {
      expect(cn("px-2", "px-4", "text-cafe-parchment")).toBe(
         "px-4 text-cafe-parchment"
      );
   });
});
