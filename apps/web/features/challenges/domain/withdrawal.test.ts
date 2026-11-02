import { describe, expect, it } from "vitest";

import {
   filterLogsBeforeWithdrawal,
   isStudyLogBeforeWithdrawal,
   resolveWithdrawalEligibility,
} from "./withdrawal";

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

describe("isStudyLogBeforeWithdrawal and filterLogsBeforeWithdrawal", () => {
   const withdrawalAt = new Date("2026-10-25T14:30:00.000Z");

   it("includes logs when withdrawalAt is not provided", () => {
      expect(
         isStudyLogBeforeWithdrawal({ durationSeconds: 3600 } as never, null)
      ).toBe(true);
      expect(
         isStudyLogBeforeWithdrawal(
            { durationSeconds: 3600 } as never,
            undefined
         )
      ).toBe(true);
   });

   it("accurately compares createdAt millisecond timestamps against withdrawalAt", () => {
      const priorLog = {
         durationSeconds: 3600,
         createdAt: new Date("2026-10-25T14:29:59.000Z"),
      };
      const exactLog = {
         durationSeconds: 1800,
         createdAt: new Date("2026-10-25T14:30:00.000Z"),
      };
      const afterLog = {
         durationSeconds: 7200,
         createdAt: new Date("2026-10-25T14:30:01.000Z"),
      };

      expect(isStudyLogBeforeWithdrawal(priorLog, withdrawalAt)).toBe(true);
      expect(isStudyLogBeforeWithdrawal(exactLog, withdrawalAt)).toBe(true);
      expect(isStudyLogBeforeWithdrawal(afterLog, withdrawalAt)).toBe(false);
   });

   it("falls back to logDate UTC comparison when createdAt is omitted", () => {
      const priorDate = {
         durationSeconds: 3600,
         logDate: new Date("2026-10-24T00:00:00.000Z"),
      };
      const sameDate = {
         durationSeconds: 1800,
         logDate: new Date("2026-10-25T00:00:00.000Z"),
      };
      const afterDate = {
         durationSeconds: 7200,
         logDate: new Date("2026-10-26T00:00:00.000Z"),
      };

      expect(isStudyLogBeforeWithdrawal(priorDate, withdrawalAt)).toBe(true);
      expect(isStudyLogBeforeWithdrawal(sameDate, withdrawalAt)).toBe(true);
      expect(isStudyLogBeforeWithdrawal(afterDate, withdrawalAt)).toBe(false);
   });

   it("filters a list of study logs retaining only frozen historical hours", () => {
      const logs = [
         {
            durationSeconds: 3600,
            createdAt: new Date("2026-10-24T10:00:00.000Z"),
         },
         {
            durationSeconds: 7200,
            createdAt: new Date("2026-10-25T12:00:00.000Z"),
         },
         {
            durationSeconds: 5400,
            createdAt: new Date("2026-10-26T09:00:00.000Z"),
         },
      ];

      const frozen = filterLogsBeforeWithdrawal(logs, withdrawalAt);
      expect(frozen).toHaveLength(2);
      expect(frozen.reduce((sum, l) => sum + l.durationSeconds, 0)).toBe(10800);
   });
});
