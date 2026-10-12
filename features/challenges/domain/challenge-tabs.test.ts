import { describe, expect, it } from "vitest";
import {
   ADMIN_CHALLENGE_TABS,
   CHALLENGE_TABS,
   DEFAULT_CHALLENGE_TAB,
   isChallengeTab,
   PUBLIC_CHALLENGE_TABS,
   resolveAllowedChallengeTab,
} from "./challenge-tabs";

describe("challenge-tabs domain", () => {
   describe("tab constants", () => {
      it("defines the expected challenge tab sets", () => {
         expect(CHALLENGE_TABS).toEqual([
            "overview",
            "leaderboard",
            "summary",
            "manage",
            "audit",
         ]);
         expect(PUBLIC_CHALLENGE_TABS).toEqual([
            "overview",
            "leaderboard",
            "summary",
         ]);
         expect(ADMIN_CHALLENGE_TABS).toEqual(["manage", "audit"]);
         expect(DEFAULT_CHALLENGE_TAB).toBe("overview");
      });
   });

   describe("isChallengeTab", () => {
      it("returns true for all valid challenge tabs", () => {
         for (const tab of CHALLENGE_TABS) {
            expect(isChallengeTab(tab)).toBe(true);
         }
      });

      it("returns false for invalid strings", () => {
         expect(isChallengeTab("settings")).toBe(false);
         expect(isChallengeTab("dashboard")).toBe(false);
         expect(isChallengeTab("about")).toBe(false);
         expect(isChallengeTab("")).toBe(false);
         expect(isChallengeTab("OVERVIEW")).toBe(false);
      });

      it("returns false for non-string values", () => {
         expect(isChallengeTab(null)).toBe(false);
         expect(isChallengeTab(undefined)).toBe(false);
         expect(isChallengeTab(123)).toBe(false);
         expect(isChallengeTab({})).toBe(false);
         expect(isChallengeTab(["overview"])).toBe(false);
      });
   });

   describe("resolveAllowedChallengeTab", () => {
      it("returns the requested public tab for regular non-admin participants", () => {
         expect(resolveAllowedChallengeTab("overview", false)).toBe("overview");
         expect(resolveAllowedChallengeTab("leaderboard", false)).toBe(
            "leaderboard"
         );
      });

      it("returns the requested public tab for admins", () => {
         expect(resolveAllowedChallengeTab("overview", true)).toBe("overview");
         expect(resolveAllowedChallengeTab("leaderboard", true)).toBe(
            "leaderboard"
         );
      });

      it("gracefully redirects legacy 'about' tab to 'overview'", () => {
         expect(resolveAllowedChallengeTab("about", false)).toBe("overview");
         expect(resolveAllowedChallengeTab("about", true)).toBe("overview");
      });

      it("allows admin tabs when isAdmin is true", () => {
         expect(resolveAllowedChallengeTab("manage", true)).toBe("manage");
         expect(resolveAllowedChallengeTab("audit", true)).toBe("audit");
      });

      it("clamps admin tabs to overview when isAdmin is false", () => {
         expect(resolveAllowedChallengeTab("manage", false)).toBe(
            DEFAULT_CHALLENGE_TAB
         );
         expect(resolveAllowedChallengeTab("audit", false)).toBe(
            DEFAULT_CHALLENGE_TAB
         );
      });

      it("falls back to default overview tab for invalid or missing values", () => {
         expect(resolveAllowedChallengeTab("invalid_tab", false)).toBe(
            "overview"
         );
         expect(resolveAllowedChallengeTab("invalid_tab", true)).toBe(
            "overview"
         );
         expect(resolveAllowedChallengeTab(null, false)).toBe("overview");
         expect(resolveAllowedChallengeTab(undefined, true)).toBe("overview");
         expect(resolveAllowedChallengeTab("", false)).toBe("overview");
      });

      it("allows the summary tab by default and once results are locked", () => {
         expect(resolveAllowedChallengeTab("summary", false)).toBe("summary");
         expect(
            resolveAllowedChallengeTab("summary", false, {
               isSummaryVisible: true,
            })
         ).toBe("summary");
      });

      it("clamps the summary tab to overview while results are unlocked", () => {
         expect(
            resolveAllowedChallengeTab("summary", false, {
               isSummaryVisible: false,
            })
         ).toBe(DEFAULT_CHALLENGE_TAB);
         expect(
            resolveAllowedChallengeTab("summary", true, {
               isSummaryVisible: false,
            })
         ).toBe(DEFAULT_CHALLENGE_TAB);
      });
   });
});
