import type {
   CategoryItem,
   TaskItem,
   TaskStatus,
   TaskType,
} from "./task.types";

export type SyncState = "synced" | "pending";

export type SyncAction =
   "CREATE" | "UPDATE" | "DELETE" | "TOGGLE" | "MOVE" | "REORDER" | "ROLLOVER";

export type SyncEntityType = "TASK" | "CATEGORY";

export interface LocalTaskRecord {
   id: string;
   userId: string | null;
   categoryId: string;
   challengeId?: string | null;
   title: string;
   taskType: TaskType;
   sortOrder?: number;
   isComplete: boolean;
   status?: TaskStatus;
   dueDate?: string | null;
   createdAt: string;
   updatedAt: string;
   completedAt: string | null;
   isDeleted?: boolean;
   deletionTime?: string | null;
   syncState: SyncState;
}

export interface LocalCategoryRecord {
   id: string;
   userId: string | null;
   name: string;
   taskType: TaskType;
   sortOrder?: number;
   createdAt: string;
   updatedAt: string;
   isDeleted?: boolean;
   deletionTime?: string | null;
   syncState: SyncState;
}

export interface QueuedMutation<TPayload = Record<string, unknown>> {
   id: string;
   entityType: SyncEntityType;
   action: SyncAction;
   payload: TPayload;
   createdAt: number;
   retryCount: number;
}

/** Batch synchronization request payload sent from offline client. */
export interface BatchSyncRequest {
   lastSyncTimestamp?: string;
   mutations: QueuedMutation[];
}

export type MutationOutcome = "applied" | "conflict" | "error";

export type MutationReason =
   | "zero_rows"
   | "foreign_row"
   | "category_missing"
   | "category_name_taken"
   | "challenge_locked"
   | "invalid_payload";

export interface MutationResult {
   id: string;
   status: MutationOutcome;
   reason?: MutationReason;
   /** Present on conflicts so the client can apply the server row immediately. */
   currentTask?: TaskItem | null;
   currentCategory?: CategoryItem | null;
}

/** Response payload returned from batch synchronization endpoint. */
export interface BatchSyncResponse {
   success: boolean;
   /** Applied + conflict ids. Kept for clients that predate mutationResults. */
   processedMutationIds: string[];
   mutationResults?: MutationResult[];
   authenticatedUserId?: string;
   serverChanges?: {
      categories: CategoryItem[];
      tasks: TaskItem[];
   };
   error?: string;
}
