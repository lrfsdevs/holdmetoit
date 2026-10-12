import { NextResponse } from "next/server";
import {
   AuthError,
   requireSessionUser,
} from "@/features/auth/api/require-session";
import { batchSyncSchema } from "@/features/tasks/domain/task-sync.schema";
import { processBatchSync } from "@/features/tasks/data/task-sync.repository";
import { cacheTags, invalidateTags } from "@/core/cache";
import { createLogger, logEvents } from "@/core/observability/logger";

const logger = createLogger("tasks.sync");

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
      if (result.success && result.processedMutationIds.length > 0) {
         invalidateTags([cacheTags.userTasks(user.id)]);
      }

      if (result.success) {
         logger.info(logEvents.tasksSyncBatchApplied, {
            context: {
               userId: user.id,
               processedCount: result.processedMutationIds.length,
            },
         });
      } else {
         logger.warn(logEvents.tasksSyncFailed, {
            context: {
               userId: user.id,
               processedCount: result.processedMutationIds.length,
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
