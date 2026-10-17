import { describe, it, expect } from "vitest";
import {
   validateLeaveAllowance,
   assertLeaveAllowance,
   MAX_LEAVES_ERROR,
   MaximumLeavesExceededError,
} from "./leave-allowance";

describe("Leave Allowance Domain (Law L7 — Pure Domain Isolation)", () => {
   it("allows taking a leave when used leaves is below planned leaves", () => {
      const result = validateLeaveAllowance({
         plannedLeaveDays: 3,
         usedLeaveDays: 1,
         isExistingLogLeave: false,
         isLeave: true,
      });

      expect(result.allowed).toBe(true);
      expect(result.nextUsedLeaveDays).toBe(2);
      expect(result.error).toBeUndefined();
   });

   it("rejects taking a leave when used leaves has reached planned leaves", () => {
      const result = validateLeaveAllowance({
         plannedLeaveDays: 2,
         usedLeaveDays: 2,
         isExistingLogLeave: false,
         isLeave: true,
      });

      expect(result.allowed).toBe(false);
      expect(result.nextUsedLeaveDays).toBe(2);
      expect(result.error).toBe(MAX_LEAVES_ERROR);
      expect(result.error).toBe("Maximum leaves taken for the challenge");
   });

   it("rejects taking a leave when planned leaves is 0", () => {
      const result = validateLeaveAllowance({
         plannedLeaveDays: 0,
         usedLeaveDays: 0,
         isExistingLogLeave: false,
         isLeave: true,
      });

      expect(result.allowed).toBe(false);
      expect(result.error).toBe("Maximum leaves taken for the challenge");
   });

   it("allows idempotent re-saving of an existing leave day even when at quota", () => {
      const result = validateLeaveAllowance({
         plannedLeaveDays: 2,
         usedLeaveDays: 2,
         isExistingLogLeave: true,
         isLeave: true,
      });

      expect(result.allowed).toBe(true);
      expect(result.nextUsedLeaveDays).toBe(2);
   });

   it("decrements used leaves when switching from a leave day to a study day", () => {
      const result = validateLeaveAllowance({
         plannedLeaveDays: 3,
         usedLeaveDays: 2,
         isExistingLogLeave: true,
         isLeave: false,
      });

      expect(result.allowed).toBe(true);
      expect(result.nextUsedLeaveDays).toBe(1);
   });

   it("does not decrement below 0 when switching from a leave day if used was 0", () => {
      const result = validateLeaveAllowance({
         plannedLeaveDays: 1,
         usedLeaveDays: 0,
         isExistingLogLeave: true,
         isLeave: false,
      });

      expect(result.allowed).toBe(true);
      expect(result.nextUsedLeaveDays).toBe(0);
   });

   it("keeps used leaves unchanged when logging normal hours on a normal day", () => {
      const result = validateLeaveAllowance({
         plannedLeaveDays: 2,
         usedLeaveDays: 1,
         isExistingLogLeave: false,
         isLeave: false,
      });

      expect(result.allowed).toBe(true);
      expect(result.nextUsedLeaveDays).toBe(1);
   });

   it("assertLeaveAllowance throws MaximumLeavesExceededError on quota overflow", () => {
      expect(() =>
         assertLeaveAllowance({
            plannedLeaveDays: 1,
            usedLeaveDays: 1,
            isExistingLogLeave: false,
            isLeave: true,
         })
      ).toThrow(MaximumLeavesExceededError);

      expect(() =>
         assertLeaveAllowance({
            plannedLeaveDays: 1,
            usedLeaveDays: 1,
            isExistingLogLeave: false,
            isLeave: true,
         })
      ).toThrow("Maximum leaves taken for the challenge");
   });

   it("assertLeaveAllowance returns nextUsedLeaveDays on success", () => {
      const nextUsed = assertLeaveAllowance({
         plannedLeaveDays: 2,
         usedLeaveDays: 0,
         isExistingLogLeave: false,
         isLeave: true,
      });
      expect(nextUsed).toBe(1);
   });
});
