"use server";

import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/features/auth/api/require-session";
import { getUserYptConnection } from "../data/ypt-connection.repository";
import { syncUserYptStudy } from "./ypt-sync.service";

export async function getYptConnectionStatusAction() {
   try {
      const user = await requireSessionUser();
      const connection = await getUserYptConnection(user.id);

      return {
         ok: true,
         data: connection,
      };
   } catch (error) {
      return {
         ok: false,
         code: "FETCH_STATUS_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to retrieve YPT connection status.",
         data: null,
      };
   }
}

export async function syncYptStudyNowAction() {
   try {
      const user = await requireSessionUser();
      const result = await syncUserYptStudy(user.id);

      revalidatePath("/wallet");
      revalidatePath("/");
      revalidatePath("/dashboard");

      return result;
   } catch (error) {
      return {
         ok: false,
         code: "SYNC_ERROR",
         message:
            error instanceof Error
               ? error.message
               : "Study synchronization failed.",
         importedDurationSeconds: 0,
         coinsCredited: 0,
         isDuplicate: false,
         lastSyncedAt: null,
      };
   }
}
