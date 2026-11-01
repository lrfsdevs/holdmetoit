import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
   AuthError,
   requireSessionUser,
} from "@/features/auth/api/require-session";
import { batchSyncSchema } from "@/features/tasks/domain/task-sync.schema";
import { processBatchSync } from "@/features/tasks/data/task-sync.repository";
import { cacheTags, invalidateTags } from "@/core/cache";
import { createLogger, logEvents } from "@/core/observability/logger";

const logger = createLogger("tasks.sync");

/**
 * Authenticates the current user session and processes a queued offline task-sync batch.
 *
 * @param request - Next.js Request object containing the JSON BatchSyncRequest payload.
 * @returns JSON response with BatchSyncResponse containing processed mutation IDs, authenticated user ID, and server changes.
 */
export async function POST(request: Request) {
   try {
      const user = await requireSessionUser();

      const body = await request.json().catch(() => null);
      const parsed = batchSyncSchema.safeParse(body);

      if (!parsed.success) {
         return NextResponse.json(
            {
               success: false,
               error:
                  parsed.error.issues[0]?.message ||
                  "Invalid batch sync payload.",
            },
            { status: 400 }
         );
      }

      const result = await processBatchSync(user.id, parsed.data.mutations);
      const conflictCount =
         result.mutationResults?.filter((r) => r.status === "conflict")
            .length ?? 0;
      const errorCount =
         result.mutationResults?.filter((r) => r.status === "error").length ??
         0;

      if (result.success && result.processedMutationIds.length > 0) {
         invalidateTags([cacheTags.userTasks(user.id)]);
         revalidatePath("/");
      }

      if (result.success) {
         logger.info(logEvents.tasksSyncBatchApplied, {
            context: {
               userId: user.id,
               processedCount: result.processedMutationIds.length,
               conflictCount,
               errorCount,
            },
         });
      } else {
         logger.warn(logEvents.tasksSyncFailed, {
            context: {
               userId: user.id,
               processedCount: result.processedMutationIds.length,
               conflictCount,
               errorCount,
            },
         });
      }

      return NextResponse.json(result);
   } catch (error) {
      if (error instanceof AuthError) {
         logger.debug(logEvents.tasksSyncFailed, {
            context: { code: "UNAUTHORIZED" },
            error,
         });
         return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
         );
      }

      logger.error(logEvents.tasksSyncFailed, { error });
      return NextResponse.json(
         { success: false, error: "Internal sync error occurred" },
         { status: 500 }
      );
   }
}
