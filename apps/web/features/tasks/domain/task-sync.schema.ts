import { z } from "zod";
import type { QueuedMutation } from "./task-sync.types";

export const queuedMutationSchema = z.object({
   id: z.string().uuid("Mutation id must be a valid UUID"),
   entityType: z.enum(["TASK", "CATEGORY"]),
   action: z.enum(["CREATE", "UPDATE", "DELETE", "TOGGLE", "MOVE", "REORDER"]),
   payload: z.record(z.string(), z.unknown()),
   createdAt: z.number().int().positive(),
   retryCount: z.number().int().min(0).default(0),
});

export const batchSyncSchema = z.object({
   lastSyncTimestamp: z.string().optional(),
   mutations: z.array(queuedMutationSchema),
});

export type BatchSyncInput = z.infer<typeof batchSyncSchema>;

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
