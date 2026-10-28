// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   COLLAPSED_CATEGORIES_COOKIE,
   getCollapsedCategoriesStorageKey,
   isCategoryCollapsed,
   readCollapsedCategoryIds,
   toggleCategoryCollapseKey,
   writeCollapsedCategoryIds,
   getRolloverSnoozeStorageKey,
   isRolloverSnoozedForDate,
   setRolloverSnoozedForDate,
   cleanupExpiredRolloverSnooze,
} from "./cockpit-tasks-storage";

describe("cockpit-tasks-storage", () => {
   beforeEach(() => {
      window.localStorage.clear();
      document.cookie = `${COLLAPSED_CATEGORIES_COOKIE}=; path=/; max-age=0`;
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
            JSON.stringify(["daily:cat-1", "weekly:cat-2"])
         );

         const result = readCollapsedCategoryIds("user_1");
         expect(result.size).toBe(2);
         expect(result.has("daily:cat-1")).toBe(true);
         expect(result.has("weekly:cat-2")).toBe(true);
      });

      it("supports parsing an object payload with a keys property", () => {
         window.localStorage.setItem(
            "holdmetoit:collapsed_categories:user_1",
            JSON.stringify({ keys: ["daily:cat-a", "weekly:cat-b"] })
         );

         const result = readCollapsedCategoryIds("user_1");
         expect(result.size).toBe(2);
         expect(result.has("daily:cat-a")).toBe(true);
         expect(result.has("weekly:cat-b")).toBe(true);
      });

      it("filters out invalid, empty, or legacy unscoped IDs", () => {
         window.localStorage.setItem(
            "holdmetoit:collapsed_categories:user_1",
            JSON.stringify([
               "daily:valid-id",
               "unscoped-id",
               "",
               "   ",
               123,
               null,
               undefined,
            ])
         );

         const result = readCollapsedCategoryIds("user_1");
         expect(result.size).toBe(1);
         expect(result.has("daily:valid-id")).toBe(true);
         expect(result.has("unscoped-id")).toBe(false);
      });

      it("reads from cookie when localStorage is empty", () => {
         document.cookie = `${COLLAPSED_CATEGORIES_COOKIE}=${encodeURIComponent(
            JSON.stringify(["daily:from-cookie", "weekly:from-cookie"])
         )}; path=/`;

         const result = readCollapsedCategoryIds("user_1");
         expect(result.size).toBe(2);
         expect(result.has("daily:from-cookie")).toBe(true);
         expect(result.has("weekly:from-cookie")).toBe(true);
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
      it("writes board-scoped category IDs to localStorage AND cookie", () => {
         const ids = new Set(["daily:cat-1", "weekly:cat-2"]);
         writeCollapsedCategoryIds("user_test", ids);

         const raw = window.localStorage.getItem(
            "holdmetoit:collapsed_categories:user_test"
         );
         expect(raw).toBe(JSON.stringify(["daily:cat-1", "weekly:cat-2"]));

         expect(document.cookie).toContain(
            encodeURIComponent(JSON.stringify(["daily:cat-1", "weekly:cat-2"]))
         );
      });

      it("writes an Array of category IDs to guest scope when userId is omitted", () => {
         writeCollapsedCategoryIds(null, ["daily:cat-guest-1"]);

         const raw = window.localStorage.getItem(
            "holdmetoit:collapsed_categories:guest"
         );
         expect(raw).toBe(JSON.stringify(["daily:cat-guest-1"]));
      });

      it("safely handles storage quota exceptions without throwing", () => {
         vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("QuotaExceededError");
         });

         expect(() => {
            writeCollapsedCategoryIds("user_1", new Set(["daily:cat-1"]));
         }).not.toThrow();
      });
   });

   describe("isCategoryCollapsed", () => {
      it("isolates daily from weekly categories with same name and id", () => {
         const collapsed = new Set(["weekly:cat-common"]);

         // Collapsed in weekly
         expect(
            isCategoryCollapsed(
               "weekly",
               { id: "cat-common", name: "Math" },
               collapsed
            )
         ).toBe(true);

         // NOT collapsed in daily
         expect(
            isCategoryCollapsed(
               "daily",
               { id: "cat-common", name: "Math" },
               collapsed
            )
         ).toBe(false);
      });

      it("isolates daily from weekly categories using board-scoped name", () => {
         const collapsed = new Set(["weekly:name:General"]);

         expect(
            isCategoryCollapsed(
               "weekly",
               { id: "weekly-id-1", name: "General" },
               collapsed
            )
         ).toBe(true);

         expect(
            isCategoryCollapsed(
               "daily",
               { id: "daily-id-1", name: "General" },
               collapsed
            )
         ).toBe(false);
      });

      it("ignores legacy unscoped category IDs to prevent cross-board collision", () => {
         const collapsed = new Set(["cat-legacy-1"]);
         expect(
            isCategoryCollapsed(
               "daily",
               { id: "cat-legacy-1", name: "Old Category" },
               collapsed
            )
         ).toBe(false);
      });

      it("returns false for newly created categories with unrecorded keys", () => {
         const collapsed = new Set(["daily:cat-1", "weekly:cat-2"]);
         expect(
            isCategoryCollapsed(
               "daily",
               { id: "cat-new", name: "New Category" },
               collapsed
            )
         ).toBe(false);
      });
   });

   describe("toggleCategoryCollapseKey", () => {
      it("toggles weekly category without affecting daily category of the same name", () => {
         let collapsed = new Set<string>();

         // Collapse weekly "Math"
         collapsed = toggleCategoryCollapseKey(
            "weekly",
            { id: "cat-math", name: "Math" },
            collapsed
         );

         expect(collapsed.has("weekly:cat-math")).toBe(true);
         expect(
            isCategoryCollapsed(
               "weekly",
               { id: "cat-math", name: "Math" },
               collapsed
            )
         ).toBe(true);
         expect(
            isCategoryCollapsed(
               "daily",
               { id: "cat-math", name: "Math" },
               collapsed
            )
         ).toBe(false);

         // Uncollapse weekly "Math"
         collapsed = toggleCategoryCollapseKey(
            "weekly",
            { id: "cat-math", name: "Math" },
            collapsed
         );

         expect(collapsed.has("weekly:cat-math")).toBe(false);
         expect(
            isCategoryCollapsed(
               "weekly",
               { id: "cat-math", name: "Math" },
               collapsed
            )
         ).toBe(false);
      });

      it("toggles daily category without affecting weekly category of the same name", () => {
         let collapsed = new Set<string>();

         // Collapse daily "Physics"
         collapsed = toggleCategoryCollapseKey(
            "daily",
            { id: "cat-physics", name: "Physics" },
            collapsed
         );

         expect(collapsed.has("daily:cat-physics")).toBe(true);
         expect(
            isCategoryCollapsed(
               "daily",
               { id: "cat-physics", name: "Physics" },
               collapsed
            )
         ).toBe(true);
         expect(
            isCategoryCollapsed(
               "weekly",
               { id: "cat-physics", name: "Physics" },
               collapsed
            )
         ).toBe(false);
      });
   });

   describe("getRolloverSnoozeStorageKey", () => {
      it("formats key with guest scope when userId is missing or blank", () => {
         expect(getRolloverSnoozeStorageKey(null, "2026-10-28")).toBe(
            "holdmetoit_rollover_snooze_guest_2026-10-28"
         );
         expect(getRolloverSnoozeStorageKey(undefined, "2026-10-28")).toBe(
            "holdmetoit_rollover_snooze_guest_2026-10-28"
         );
         expect(getRolloverSnoozeStorageKey("", "2026-10-28")).toBe(
            "holdmetoit_rollover_snooze_guest_2026-10-28"
         );
         expect(getRolloverSnoozeStorageKey("   ", "2026-10-28")).toBe(
            "holdmetoit_rollover_snooze_guest_2026-10-28"
         );
      });

      it("formats key scoped to normalized userId and dateKey", () => {
         expect(getRolloverSnoozeStorageKey("user_123", "2026-10-28")).toBe(
            "holdmetoit_rollover_snooze_user_123_2026-10-28"
         );
         expect(getRolloverSnoozeStorageKey("  user_456  ", "2026-10-29")).toBe(
            "holdmetoit_rollover_snooze_user_456_2026-10-29"
         );
      });
   });

   describe("isRolloverSnoozedForDate & setRolloverSnoozedForDate", () => {
      it("returns false when no snooze is recorded", () => {
         expect(isRolloverSnoozedForDate("user_1", "2026-10-28")).toBe(false);
      });

      it("records snooze in localStorage and returns true for that date", () => {
         setRolloverSnoozedForDate("user_1", "2026-10-28");
         expect(isRolloverSnoozedForDate("user_1", "2026-10-28")).toBe(true);
         // Different user is not snoozed
         expect(isRolloverSnoozedForDate("user_2", "2026-10-28")).toBe(false);
         // Different date is not snoozed
         expect(isRolloverSnoozedForDate("user_1", "2026-10-29")).toBe(false);
      });
   });

   describe("cleanupExpiredRolloverSnooze", () => {
      it("cleans up snooze keys older than currentDateKey while preserving current and future dates", () => {
         window.localStorage.setItem(
            "holdmetoit_rollover_snooze_user_1_2026-10-26",
            "true"
         );
         window.localStorage.setItem(
            "holdmetoit_rollover_snooze_user_1_2026-10-27",
            "true"
         );
         window.localStorage.setItem(
            "holdmetoit_rollover_snooze_user_1_2026-10-28",
            "true"
         );
         window.localStorage.setItem(
            "holdmetoit_rollover_snooze_user_1_2026-10-29",
            "true"
         );

         cleanupExpiredRolloverSnooze("user_1", "2026-10-28");

         expect(
            window.localStorage.getItem(
               "holdmetoit_rollover_snooze_user_1_2026-10-26"
            )
         ).toBeNull();
         expect(
            window.localStorage.getItem(
               "holdmetoit_rollover_snooze_user_1_2026-10-27"
            )
         ).toBeNull();
         expect(
            window.localStorage.getItem(
               "holdmetoit_rollover_snooze_user_1_2026-10-28"
            )
         ).toBe("true");
         expect(
            window.localStorage.getItem(
               "holdmetoit_rollover_snooze_user_1_2026-10-29"
            )
         ).toBe("true");
      });
   });
});
