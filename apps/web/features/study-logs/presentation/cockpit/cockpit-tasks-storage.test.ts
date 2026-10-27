// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   getCollapsedCategoriesStorageKey,
   isCategoryCollapsed,
   readCollapsedCategoryIds,
   toggleCategoryCollapseKey,
   writeCollapsedCategoryIds,
} from "./cockpit-tasks-storage";

describe("cockpit-tasks-storage", () => {
   beforeEach(() => {
      window.localStorage.clear();
      vi.restoreAllMocks();
   });

   describe("getCollapsedCategoriesStorageKey", () => {
      it("uses guest scope when userId is missing, empty, or whitespace", () => {
         expect(getCollapsedCategoriesStorageKey(null)).toBe(
            "holdmetoit:collapsed_categories:guest"
         );
         expect(getCollapsedCategoriesStorageKey(undefined)).toBe(
            "holdmetoit:collapsed_categories:guest"
         );
         expect(getCollapsedCategoriesStorageKey("")).toBe(
            "holdmetoit:collapsed_categories:guest"
         );
         expect(getCollapsedCategoriesStorageKey("   ")).toBe(
            "holdmetoit:collapsed_categories:guest"
         );
      });

      it("scopes storage key to the given userId", () => {
         expect(getCollapsedCategoriesStorageKey("user_42")).toBe(
            "holdmetoit:collapsed_categories:user_42"
         );
         expect(getCollapsedCategoriesStorageKey("  user_abc  ")).toBe(
            "holdmetoit:collapsed_categories:user_abc"
         );
      });
   });

   describe("readCollapsedCategoryIds", () => {
      it("returns an empty set when no entry exists in localStorage", () => {
         const result = readCollapsedCategoryIds("user_1");
         expect(result.size).toBe(0);
      });

      it("reads and parses an array of category IDs from localStorage", () => {
         window.localStorage.setItem(
            "holdmetoit:collapsed_categories:user_1",
            JSON.stringify(["cat-1", "cat-2"])
         );

         const result = readCollapsedCategoryIds("user_1");
         expect(result.size).toBe(2);
         expect(result.has("cat-1")).toBe(true);
         expect(result.has("cat-2")).toBe(true);
      });

      it("supports parsing an object payload with a keys property", () => {
         window.localStorage.setItem(
            "holdmetoit:collapsed_categories:user_1",
            JSON.stringify({ keys: ["cat-a", "cat-b"] })
         );

         const result = readCollapsedCategoryIds("user_1");
         expect(result.size).toBe(2);
         expect(result.has("cat-a")).toBe(true);
         expect(result.has("cat-b")).toBe(true);
      });

      it("filters out invalid, empty, or whitespace-only IDs", () => {
         window.localStorage.setItem(
            "holdmetoit:collapsed_categories:user_1",
            JSON.stringify(["valid-id", "", "   ", 123, null, undefined])
         );

         const result = readCollapsedCategoryIds("user_1");
         expect(result.size).toBe(1);
         expect(result.has("valid-id")).toBe(true);
      });

      it("returns an empty set safely when corrupted JSON is stored", () => {
         window.localStorage.setItem(
            "holdmetoit:collapsed_categories:user_1",
            "not-valid-json{{{"
         );

         const result = readCollapsedCategoryIds("user_1");
         expect(result.size).toBe(0);
      });

      it("returns an empty set safely when localStorage throws a security error", () => {
         vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("SecurityError: Access is denied");
         });

         const result = readCollapsedCategoryIds("user_1");
         expect(result.size).toBe(0);
      });
   });

   describe("writeCollapsedCategoryIds", () => {
      it("writes a Set of category IDs to the user-scoped localStorage key", () => {
         const ids = new Set(["cat-1", "cat-2"]);
         writeCollapsedCategoryIds("user_test", ids);

         const raw = window.localStorage.getItem(
            "holdmetoit:collapsed_categories:user_test"
         );
         expect(raw).toBe(JSON.stringify(["cat-1", "cat-2"]));
      });

      it("writes an Array of category IDs to guest scope when userId is omitted", () => {
         writeCollapsedCategoryIds(null, ["cat-guest-1"]);

         const raw = window.localStorage.getItem(
            "holdmetoit:collapsed_categories:guest"
         );
         expect(raw).toBe(JSON.stringify(["cat-guest-1"]));
      });

      it("safely handles storage quota exceptions without throwing", () => {
         vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("QuotaExceededError");
         });

         expect(() => {
            writeCollapsedCategoryIds("user_1", new Set(["cat-1"]));
         }).not.toThrow();
      });
   });

   describe("isCategoryCollapsed", () => {
      it("returns true when category ID is in the collapsed set", () => {
         const collapsed = new Set(["cat-uuid-1"]);
         expect(
            isCategoryCollapsed({ id: "cat-uuid-1", name: "Daily" }, collapsed)
         ).toBe(true);
      });

      it("returns true when category name is in the collapsed set as fallback", () => {
         const collapsed = new Set(["Weekly Goals"]);
         expect(
            isCategoryCollapsed(
               { id: "some-other-id", name: "Weekly Goals" },
               collapsed
            )
         ).toBe(true);
      });

      it("returns false when neither ID nor name is in the collapsed set", () => {
         const collapsed = new Set(["cat-uuid-1"]);
         expect(
            isCategoryCollapsed({ id: "cat-uuid-2", name: "Work" }, collapsed)
         ).toBe(false);
      });

      it("returns false for newly created categories with empty collapsed set", () => {
         const collapsed = new Set<string>();
         expect(
            isCategoryCollapsed(
               { id: "new-cat-uuid", name: "New Category" },
               collapsed
            )
         ).toBe(false);
      });
   });

   describe("toggleCategoryCollapseKey", () => {
      it("adds category ID when toggling an expanded category", () => {
         const initial = new Set<string>();
         const next = toggleCategoryCollapseKey(
            { id: "cat-1", name: "Work" },
            initial
         );

         expect(next.has("cat-1")).toBe(true);
         expect(initial.has("cat-1")).toBe(false); // pure, does not mutate original
      });

      it("adds category name when category ID is missing", () => {
         const initial = new Set<string>();
         const next = toggleCategoryCollapseKey(
            { id: undefined, name: "Chores" },
            initial
         );

         expect(next.has("Chores")).toBe(true);
      });

      it("removes both ID and name when toggling a collapsed category", () => {
         const initial = new Set(["cat-1", "Work"]);
         const next = toggleCategoryCollapseKey(
            { id: "cat-1", name: "Work" },
            initial
         );

         expect(next.has("cat-1")).toBe(false);
         expect(next.has("Work")).toBe(false);
      });
   });
});
