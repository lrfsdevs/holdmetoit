import { describe, expect, it } from "vitest";

import { resolveWithdrawalEligibility } from "./withdrawal";

describe("resolveWithdrawalEligibility", () => {
   it("allows withdrawal while the challenge is upcoming", () => {
      expect(
         resolveWithdrawalEligibility({
            isWithdrawn: false,
            resultsLockedAt: null,
            status: "UPCOMING",
         })
      ).toEqual({ allowed: true });
   });

   it("allows withdrawal while the challenge is active", () => {
      expect(
         resolveWithdrawalEligibility({
            isWithdrawn: false,
            resultsLockedAt: null,
            status: "ACTIVE",
         })
      ).toEqual({ allowed: true });
   });

   it("blocks withdrawal once results are locked", () => {
      expect(
         resolveWithdrawalEligibility({
            isWithdrawn: false,
            resultsLockedAt: new Date("2026-10-20T00:00:00.000Z"),
            status: "ACTIVE",
         })
      ).toMatchObject({ allowed: false, code: "RESULTS_LOCKED" });
   });

   it("blocks withdrawal on a completed challenge", () => {
      expect(
         resolveWithdrawalEligibility({
            isWithdrawn: false,
            resultsLockedAt: null,
            status: "COMPLETED",
         })
      ).toMatchObject({ allowed: false, code: "CHALLENGE_COMPLETED" });
   });

   it("blocks a repeated withdrawal", () => {
      expect(
         resolveWithdrawalEligibility({
            isWithdrawn: true,
            resultsLockedAt: null,
            status: "ACTIVE",
         })
      ).toMatchObject({ allowed: false, code: "ALREADY_WITHDRAWN" });
   });
});
