import { describe, expect, it } from "vitest";
import {
   canScopeTaskToChallenge,
   countScopedTasks,
   getTaskScope,
   isChallengeScopedTask,
   isPersonalScopedTask,
   resolveTaskScopeChallengeId,
   type TaskScopeSource,
} from "./task-scope";

describe("task-scope domain", () => {
   describe("getTaskScope, isChallengeScopedTask, isPersonalScopedTask", () => {
      it("identifies challenge-scoped task when challengeId is present", () => {
         const task = { challengeId: "chal-123" };
         expect(getTaskScope(task)).toBe("CHALLENGE");
         expect(isChallengeScopedTask(task)).toBe(true);
         expect(isPersonalScopedTask(task)).toBe(false);
      });

      it("identifies personal task when challengeId is null or undefined or whitespace", () => {
         expect(getTaskScope({ challengeId: null })).toBe("PERSONAL");
         expect(isPersonalScopedTask({ challengeId: null })).toBe(true);
         expect(isChallengeScopedTask({ challengeId: null })).toBe(false);

         expect(getTaskScope({ challengeId: undefined })).toBe("PERSONAL");
         expect(isPersonalScopedTask({ challengeId: undefined })).toBe(true);

         expect(getTaskScope({ challengeId: "   " })).toBe("PERSONAL");
         expect(isPersonalScopedTask({ challengeId: "   " })).toBe(true);
      });
   });

   describe("resolveTaskScopeChallengeId", () => {
      it("returns activeChallengeId when scope is CHALLENGE", () => {
         expect(resolveTaskScopeChallengeId("CHALLENGE", "chal-active-1")).toBe(
            "chal-active-1"
         );
         expect(resolveTaskScopeChallengeId("CHALLENGE", null)).toBeNull();
      });

      it("returns null when scope is PERSONAL regardless of activeChallengeId", () => {
         expect(
            resolveTaskScopeChallengeId("PERSONAL", "chal-active-1")
         ).toBeNull();
         expect(resolveTaskScopeChallengeId("PERSONAL", null)).toBeNull();
      });
   });

   describe("canScopeTaskToChallenge", () => {
      it("allows challenge scoping for weekly tasks with active challenge", () => {
         expect(
            canScopeTaskToChallenge({
               taskType: "WEEKLY",
               linkableChallengeId: "chal-1",
               challengeStatus: "ACTIVE",
            })
         ).toBe(true);

         expect(
            canScopeTaskToChallenge({
               taskType: "weekly",
               linkableChallengeId: "chal-1",
               challengeStatus: "UPCOMING",
            })
         ).toBe(true);
      });

      it("blocks challenge scoping for daily tasks", () => {
         expect(
            canScopeTaskToChallenge({
               taskType: "DAILY",
               linkableChallengeId: "chal-1",
               challengeStatus: "ACTIVE",
            })
         ).toBe(false);
         expect(
            canScopeTaskToChallenge({
               taskType: "daily",
               linkableChallengeId: "chal-1",
            })
         ).toBe(false);
      });

      it("blocks challenge scoping if linkableChallengeId is missing or empty", () => {
         expect(
            canScopeTaskToChallenge({
               taskType: "WEEKLY",
               linkableChallengeId: null,
            })
         ).toBe(false);
         expect(
            canScopeTaskToChallenge({
               taskType: "WEEKLY",
               linkableChallengeId: "",
            })
         ).toBe(false);
      });

      it("blocks challenge scoping if challenge is completed", () => {
         expect(
            canScopeTaskToChallenge({
               taskType: "WEEKLY",
               linkableChallengeId: "chal-1",
               challengeStatus: "COMPLETED",
            })
         ).toBe(false);
      });
   });

   describe("countScopedTasks", () => {
      it("computes accurate counts for mixed challenge goals and personal tasks", () => {
         const tasks: TaskScopeSource[] = [
            { challengeId: "chal-1", isComplete: true },
            { challengeId: "chal-1", isComplete: false },
            { challengeId: null, isComplete: true },
            { challengeId: undefined, isComplete: false },
            { challengeId: undefined, status: "COMPLETED" },
         ];

         const counts = countScopedTasks(tasks);
         expect(counts.totalChallengeGoals).toBe(2);
         expect(counts.completedChallengeGoals).toBe(1);
         expect(counts.totalPersonalGoals).toBe(3);
         expect(counts.completedPersonalGoals).toBe(2);
         expect(counts.totalTasks).toBe(5);
         expect(counts.completedTasks).toBe(3);
      });

      it("handles empty task lists cleanly", () => {
         const counts = countScopedTasks([]);
         expect(counts.totalChallengeGoals).toBe(0);
         expect(counts.completedChallengeGoals).toBe(0);
         expect(counts.totalPersonalGoals).toBe(0);
         expect(counts.completedPersonalGoals).toBe(0);
         expect(counts.totalTasks).toBe(0);
         expect(counts.completedTasks).toBe(0);
      });
   });
});
