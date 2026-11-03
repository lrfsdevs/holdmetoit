import { describe, expect, it } from "vitest";
import { ChallengeStateError } from "@/features/challenges/domain/challenge-lifecycle";
import {
   assertWeeklyTaskEditable,
   isWeeklyTaskGraceExpired,
   WEEKLY_TASK_GRACE_MS,
} from "./task-lock";

const CREATED_AT = new Date("2026-11-02T10:00:00.000Z");

function task(
   overrides: Partial<Parameters<typeof isWeeklyTaskGraceExpired>[0]> = {}
) {
   return {
      taskType: "WEEKLY" as const,
      challengeId: "challenge-1",
      createdAt: CREATED_AT,
      ...overrides,
   };
}

function after(ms: number): Date {
   return new Date(CREATED_AT.getTime() + ms);
}

describe("isWeeklyTaskGraceExpired", () => {
   it("stays editable inside the 24-hour grace period", () => {
      expect(
         isWeeklyTaskGraceExpired(task(), after(WEEKLY_TASK_GRACE_MS - 1000))
      ).toBe(false);
   });

   it("stays editable at exactly 24 hours", () => {
      expect(
         isWeeklyTaskGraceExpired(task(), after(WEEKLY_TASK_GRACE_MS))
      ).toBe(false);
   });

   it("locks once the grace period has passed", () => {
      expect(
         isWeeklyTaskGraceExpired(task(), after(WEEKLY_TASK_GRACE_MS + 1000))
      ).toBe(true);
   });

   it("accepts an ISO string for createdAt", () => {
      expect(
         isWeeklyTaskGraceExpired(
            task({ createdAt: CREATED_AT.toISOString() }),
            after(WEEKLY_TASK_GRACE_MS + 1000)
         )
      ).toBe(true);
   });

   it("never locks daily tasks", () => {
      expect(
         isWeeklyTaskGraceExpired(
            task({ taskType: "DAILY" }),
            after(WEEKLY_TASK_GRACE_MS * 7)
         )
      ).toBe(false);
   });

   it("never locks weekly tasks without a challenge", () => {
      expect(
         isWeeklyTaskGraceExpired(
            task({ challengeId: null }),
            after(WEEKLY_TASK_GRACE_MS * 7)
         )
      ).toBe(false);
   });
});

describe("assertWeeklyTaskEditable", () => {
   it("does not throw inside the grace period", () => {
      expect(() =>
         assertWeeklyTaskEditable(task(), after(WEEKLY_TASK_GRACE_MS - 1000))
      ).not.toThrow();
   });

   it("throws a ChallengeStateError after the grace period", () => {
      expect(() =>
         assertWeeklyTaskEditable(task(), after(WEEKLY_TASK_GRACE_MS + 1000))
      ).toThrow(ChallengeStateError);
   });
});
