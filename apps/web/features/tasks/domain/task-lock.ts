import { ChallengeStateError } from "@/features/challenges/domain/challenge-lifecycle";

export const WEEKLY_TASK_GRACE_MS = 24 * 60 * 60 * 1000;

interface LockableTask {
   taskType: "DAILY" | "WEEKLY";
   challengeId?: string | null;
   createdAt: Date | string;
}

/**
 * Determines whether a challenge-linked weekly task has outlived its 24-hour
 * grace period. Daily and unlinked weekly tasks never lock.
 */
export function isWeeklyTaskGraceExpired(
   task: LockableTask,
   now: Date = new Date()
): boolean {
   if (task.taskType !== "WEEKLY" || !task.challengeId) return false;
   return (
      now.getTime() - new Date(task.createdAt).getTime() > WEEKLY_TASK_GRACE_MS
   );
}

/**
 * Rejects deleting, renaming, or re-scoping a weekly task once its grace
 * period has expired.
 */
export function assertWeeklyTaskEditable(
   task: LockableTask,
   now: Date = new Date()
): void {
   if (isWeeklyTaskGraceExpired(task, now)) {
      throw new ChallengeStateError(
         "Weekly goals lock 24 hours after they are added and can no longer be deleted or renamed."
      );
   }
}
