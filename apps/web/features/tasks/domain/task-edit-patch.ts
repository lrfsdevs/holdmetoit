import type { TaskStatus } from "./task.types";

export interface TaskEditSnapshot {
   title: string;
   status: TaskStatus;
   isComplete: boolean;
   dueDate: string | null;
   challengeId?: string | null;
}

export interface TaskEditPatch {
   title?: string;
   status?: TaskStatus;
   isComplete?: boolean;
   dueDate?: string | null;
   challengeId?: string | null;
}

function dateKey(value: string | null | undefined): string | null {
   return value ? value.slice(0, 10) : null;
}

/**
 * Builds the minimal mutation payload for a task edit.
 * Fields the user did not change are omitted so a stale edit cannot clobber
 * another device's toggle, due date, or challenge scope.
 */
export function buildTaskEditPatch(
   current: TaskEditSnapshot,
   next: TaskEditSnapshot,
   taskType: "DAILY" | "WEEKLY"
): TaskEditPatch {
   const patch: TaskEditPatch = {};

   const nextTitle = next.title.trim();
   if (nextTitle !== current.title.trim()) {
      patch.title = nextTitle;
   }

   if (
      next.status !== current.status ||
      next.isComplete !== current.isComplete
   ) {
      patch.status = next.status;
      patch.isComplete = next.isComplete;
   }

   if (taskType === "DAILY") {
      if (dateKey(next.dueDate) !== dateKey(current.dueDate)) {
         patch.dueDate = dateKey(next.dueDate);
      }
   }

   if (taskType === "WEEKLY") {
      const nextChallenge = next.challengeId ?? null;
      const currentChallenge = current.challengeId ?? null;
      if (nextChallenge !== currentChallenge) {
         patch.challengeId = nextChallenge;
      }
   }

   return patch;
}
