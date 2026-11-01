import { z } from "zod";
import type { QueuedMutation } from "./task-sync.types";

export const queuedMutationSchema = z.object({
   id: z.string().uuid("Mutation id must be a valid UUID"),
   entityType: z.enum(["TASK", "CATEGORY"]),
   action: z.enum([
      "CREATE",
      "UPDATE",
      "DELETE",
      "TOGGLE",
      "MOVE",
      "REORDER",
      "ROLLOVER",
   ]),
   payload: z.record(z.string(), z.unknown()),
   createdAt: z.number().int().positive(),
   retryCount: z.number().int().min(0).default(0),
   baseRevision: z.number().int().nonnegative().optional(),
});

export const batchSyncSchema = z.object({
   lastSyncTimestamp: z.string().optional(),
   mutations: z.array(queuedMutationSchema),
});

export type BatchSyncInput = z.infer<typeof batchSyncSchema>;

// ---------------------------------------------------------------------------
// Per-action payload validation
// ---------------------------------------------------------------------------

const syncIdSchema = z.string().trim().min(1);
const syncTitleSchema = z.string().trim().min(1).max(255);
const syncDateKeySchema = z
   .string()
   .trim()
   .regex(/^\d{4}-\d{2}-\d{2}$/);
const syncTaskStatusSchema = z.enum([
   "TODO",
   "IN_PROGRESS",
   "COMPLETED",
   "CROSSED_OUT",
]);
const syncTaskTypeSchema = z.enum(["DAILY", "WEEKLY"]);

export const taskCreatePayloadSchema = z.object({
   id: syncIdSchema,
   categoryId: syncIdSchema.optional(),
   challengeId: syncIdSchema.nullable().optional(),
   title: syncTitleSchema,
   taskType: syncTaskTypeSchema.optional(),
   sortOrder: z.number().int().optional(),
   isComplete: z.boolean().optional(),
   status: syncTaskStatusSchema.optional(),
   dueDate: syncDateKeySchema.nullable().optional(),
});

export const taskUpdatePayloadSchema = z.object({
   taskId: syncIdSchema,
   categoryId: syncIdSchema.optional(),
   title: syncTitleSchema.optional(),
   taskType: syncTaskTypeSchema.optional(),
   sortOrder: z.number().int().optional(),
   dueDate: syncDateKeySchema.nullable().optional(),
   challengeId: syncIdSchema.nullable().optional(),
   status: syncTaskStatusSchema.optional(),
   isComplete: z.boolean().optional(),
});

export const taskTogglePayloadSchema = z
   .object({
      taskId: syncIdSchema,
      isComplete: z.boolean().optional(),
      status: syncTaskStatusSchema.optional(),
   })
   .refine(
      (data) => data.isComplete !== undefined || data.status !== undefined,
      {
         message: "Either isComplete or status must be provided.",
      }
   );

export const taskDeletePayloadSchema = z.object({
   taskId: syncIdSchema,
});

export const taskReorderPayloadSchema = z.object({
   taskIds: z.array(syncIdSchema).min(1),
});

export const taskRolloverPayloadSchema = z.object({
   taskIds: z.array(syncIdSchema).min(1),
   targetDateKey: syncDateKeySchema,
});

export const categoryCreatePayloadSchema = z.object({
   id: syncIdSchema,
   name: syncTitleSchema,
   taskType: syncTaskTypeSchema.optional(),
   sortOrder: z.number().int().optional(),
});

export const categoryUpdatePayloadSchema = z.object({
   categoryId: syncIdSchema,
   name: syncTitleSchema.optional(),
   taskType: syncTaskTypeSchema.optional(),
   sortOrder: z.number().int().optional(),
});

export const categoryDeletePayloadSchema = z.object({
   categoryId: syncIdSchema,
});

export const categoryReorderPayloadSchema = z.object({
   categoryIds: z.array(syncIdSchema).min(1),
});

/**
 * Sorts mutations in strict FIFO (First-In, First-Out) chronological order.
 */
export function sortMutationsChronologically(
   mutations: QueuedMutation[]
): QueuedMutation[] {
   return [...mutations].sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Compacts mutation queue to eliminate redundant mutations.
 * E.g., if a task was locally created and subsequently deleted before being synced,
 * both mutations are safely pruned.
 */
export function compactMutationQueue(
   mutations: QueuedMutation[]
): QueuedMutation[] {
   const sorted = sortMutationsChronologically(mutations);
   const result: QueuedMutation[] = [];
   const deletedEntityIds = new Set<string>();

   // Scan backwards to identify deleted entities
   for (let i = sorted.length - 1; i >= 0; i--) {
      const m = sorted[i];
      const targetId =
         (m.payload as { id?: string; taskId?: string; categoryId?: string })
            ?.id ||
         (m.payload as { taskId?: string })?.taskId ||
         (m.payload as { categoryId?: string })?.categoryId;

      if (m.action === "DELETE" && targetId) {
         deletedEntityIds.add(targetId);
         result.unshift(m);
      } else if (targetId && deletedEntityIds.has(targetId)) {
         // If entity was created locally and deleted before sync, skip earlier updates/creates
         if (m.action === "CREATE") {
            // Remove the delete mutation as well because the server never knew about this entity!
            const deleteIdx = result.findIndex(
               (rm) =>
                  ((
                     rm.payload as {
                        id?: string;
                        taskId?: string;
                        categoryId?: string;
                     }
                  )?.id ||
                     (rm.payload as { taskId?: string })?.taskId ||
                     (rm.payload as { categoryId?: string })?.categoryId) ===
                     targetId && rm.action === "DELETE"
            );
            if (deleteIdx !== -1) {
               result.splice(deleteIdx, 1);
            }
         }
         // Otherwise skip the intermediate update/toggle
      } else {
         result.unshift(m);
      }
   }

   return result;
}
