import type { TaskType } from "./task.types";

export type TaskScope = "CHALLENGE" | "PERSONAL";

export interface TaskScopeSource {
   challengeId?: string | null;
   isComplete?: boolean;
   completed?: boolean;
   status?: string;
   taskType?: TaskType;
}

export interface ScopedTaskCounts {
   totalChallengeGoals: number;
   completedChallengeGoals: number;
   totalPersonalGoals: number;
   completedPersonalGoals: number;
   totalTasks: number;
   completedTasks: number;
}

/**
 * Derives the scope ("CHALLENGE" or "PERSONAL") for a task.
 */
export function getTaskScope(
   task: Pick<TaskScopeSource, "challengeId">
): TaskScope {
   return task.challengeId && task.challengeId.trim().length > 0
      ? "CHALLENGE"
      : "PERSONAL";
}

/**
 * Returns true if the task is explicitly linked to a challenge.
 */
export function isChallengeScopedTask(
   task: Pick<TaskScopeSource, "challengeId">
): boolean {
   return getTaskScope(task) === "CHALLENGE";
}

/**
 * Returns true if the task is a personal task (not linked to any challenge).
 */
export function isPersonalScopedTask(
   task: Pick<TaskScopeSource, "challengeId">
): boolean {
   return getTaskScope(task) === "PERSONAL";
}

/**
 * Resolves the challengeId value based on the chosen scope.
 */
export function resolveTaskScopeChallengeId(
   scope: TaskScope,
   activeChallengeId?: string | null
): string | null {
   if (scope === "CHALLENGE") {
      return activeChallengeId && activeChallengeId.trim().length > 0
         ? activeChallengeId.trim()
         : null;
   }
   return null;
}

/**
 * Checks whether a task is eligible to be scoped to a challenge.
 * Only weekly tasks can be challenge goals (Law L6 Three-Condition Invariant),
 * and only when a challenge is active or upcoming.
 */
export function canScopeTaskToChallenge(params: {
   taskType: TaskType | "daily" | "weekly";
   linkableChallengeId?: string | null;
   challengeStatus?: "UPCOMING" | "ACTIVE" | "COMPLETED" | string;
}): boolean {
   const normalizedType = params.taskType.toUpperCase();
   if (normalizedType !== "WEEKLY") return false;
   if (
      !params.linkableChallengeId ||
      params.linkableChallengeId.trim().length === 0
   ) {
      return false;
   }
   if (params.challengeStatus === "COMPLETED") return false;
   return true;
}

/**
 * Computes breakdown counts of challenge goals vs personal tasks.
 */
export function countScopedTasks(
   tasks: readonly TaskScopeSource[]
): ScopedTaskCounts {
   let totalChallengeGoals = 0;
   let completedChallengeGoals = 0;
   let totalPersonalGoals = 0;
   let completedPersonalGoals = 0;

   tasks.forEach((task) => {
      const isComplete = Boolean(
         task.isComplete || task.completed || task.status === "COMPLETED"
      );
      const isChallenge = isChallengeScopedTask(task);

      if (isChallenge) {
         totalChallengeGoals++;
         if (isComplete) completedChallengeGoals++;
      } else {
         totalPersonalGoals++;
         if (isComplete) completedPersonalGoals++;
      }
   });

   return {
      totalChallengeGoals,
      completedChallengeGoals,
      totalPersonalGoals,
      completedPersonalGoals,
      totalTasks: tasks.length,
      completedTasks: completedChallengeGoals + completedPersonalGoals,
   };
}
