import { describe, expect, it } from "vitest";

import {
   DEFAULT_DEVBOARD_TAB,
   DEVBOARD_TABS,
   resolveDevBoardTab,
} from "./devboard-tabs";

describe("resolveDevBoardTab", () => {
   it("defaults to flags", () => {
      expect(DEFAULT_DEVBOARD_TAB).toBe("flags");
      expect(resolveDevBoardTab()).toBe("flags");
      expect(resolveDevBoardTab(null)).toBe("flags");
      expect(resolveDevBoardTab("")).toBe("flags");
   });

   it("accepts every valid tab", () => {
      for (const tab of DEVBOARD_TABS) {
         expect(resolveDevBoardTab(tab)).toBe(tab);
      }
   });

   it("uses the first value for repeated query params", () => {
      expect(resolveDevBoardTab(["cron-logs", "flags"])).toBe("cron-logs");
      expect(resolveDevBoardTab(["nonsense", "ypt"])).toBe("flags");
   });

   it("clamps unknown values", () => {
      expect(resolveDevBoardTab("manage")).toBe("flags");
      expect(resolveDevBoardTab("CRON-LOGS")).toBe("flags");
   });
});
