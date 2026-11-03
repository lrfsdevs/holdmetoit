"use server";

import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/features/auth/api/require-session";
import { getUserYptConnection } from "../data/ypt-connection.repository";
import { syncUserYptStudy } from "./ypt-sync.service";
import { toClientError } from "@/core/errors";

export async function getYptConnectionStatusAction() {
   try {
      const user = await requireSessionUser();
      const connection = await getUserYptConnection(user.id);

      return {
         ok: true,
         data: connection,
      };
   } catch (error) {
      const clientError = toClientError(error, {
         scope: "ypt.connection.status",
         defaultCode: "FETCH_STATUS_FAILED",
         defaultMessage: "Failed to retrieve YPT connection status.",
      });
      return {
         ok: false,
         code: clientError.code,
         message: clientError.message,
         data: null,
      };
   }
}

/**
 * Syncs the signed-in user’s study time through the shared service account and refreshes affected pages.
 */
export async function syncYptStudyNowAction() {
   try {
      const user = await requireSessionUser();
      const result = await syncUserYptStudy(user.id);

      revalidatePath("/wallet");
      revalidatePath("/");
      revalidatePath("/dashboard");

      return result;
   } catch (error) {
      const clientError = toClientError(error, {
         scope: "ypt.connection.sync_now",
         defaultCode: "SYNC_ERROR",
         defaultMessage: "Study synchronization failed.",
      });
      return {
         ok: false,
         code: clientError.code,
         message: clientError.message,
         importedDurationSeconds: 0,
         coinsCredited: 0,
         isDuplicate: false,
         lastSyncedAt: null,
      };
   }
}
