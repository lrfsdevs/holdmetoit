import { prisma } from "@/core/db";
import { YptConnectionStatus } from "@prisma/client";
import { findYptServiceMember } from "../data/ypt-service-account";
import { ingestYptActivity } from "./ypt-ingest.service";
import { updateYptConnectionStatus } from "../data/ypt-connection.repository";
import { createLogger, logEvents } from "@/core/observability/logger";

const logger = createLogger("ypt.sync-service");

export interface YptSyncResult {
   ok: boolean;
   code?: string;
   message: string;
   importedDurationSeconds: number;
   coinsCredited: number;
   isDuplicate: boolean;
   lastSyncedAt: Date | null;
}

/**
 * Synchronizes Yeolpumta study time for a verified user.
 * Study time is read from the shared YPT service account's group roster
 * (no per-user session), ingested as a daily log, and rewarded with coins.
 */
export async function syncUserYptStudy(userId: string): Promise<YptSyncResult> {
   const now = new Date();

   // 1. Load the user and their YPT connection
   const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
         yptConnection: true,
      },
   });

   if (!user) {
      return {
         ok: false,
         code: "USER_NOT_FOUND",
         message: "User not found.",
         importedDurationSeconds: 0,
         coinsCredited: 0,
         isDuplicate: false,
         lastSyncedAt: null,
      };
   }

   const yptId = user.yptId;

   // 2. The user must have a verified YPT identity
   if (!yptId) {
      return {
         ok: false,
         code: "YPT_NOT_VERIFIED",
         message:
            "Your Yeolpumta identity is not yet verified by an administrator. Study synchronization is locked.",
         importedDurationSeconds: 0,
         coinsCredited: 0,
         isDuplicate: false,
         lastSyncedAt: user.yptConnection?.lastSyncedAt ?? null,
      };
   }

   // 3. Ensure a connection row exists so sync runs can be audited
   const conn =
      user.yptConnection ??
      (await prisma.yptConnection.upsert({
         where: { userId },
         create: {
            userId,
            yptUserId: yptId,
            status: YptConnectionStatus.VERIFIED,
         },
         update: {
            yptUserId: yptId,
            status: YptConnectionStatus.VERIFIED,
         },
      }));

   // 4. Read live study time from the shared service account roster
   let member;
   try {
      member = await findYptServiceMember(yptId);
   } catch (error) {
      logger.error(logEvents.yptSyncFailed, {
         context: { action: "syncUserYptStudy", yptId },
         error,
      });

      await updateYptConnectionStatus({
         userId,
         status: YptConnectionStatus.SYNC_ERROR,
         errorMessage:
            error instanceof Error
               ? error.message
               : "Failed to retrieve YPT statistics.",
      });

      return {
         ok: false,
         code: "RETRIEVAL_FAILED",
         message:
            "Unable to retrieve your latest study statistics from Yeolpumta. Please try again shortly.",
         importedDurationSeconds: 0,
         coinsCredited: 0,
         isDuplicate: false,
         lastSyncedAt: conn.lastSyncedAt,
      };
   }

   if (!member) {
      await updateYptConnectionStatus({
         userId,
         status: YptConnectionStatus.SYNC_ERROR,
         errorMessage: "YPT member not found in the service account roster.",
      });

      return {
         ok: false,
         code: "MEMBER_NOT_FOUND",
         message:
            "We could not find your Yeolpumta account in the group roster. Please contact an administrator.",
         importedDurationSeconds: 0,
         coinsCredited: 0,
         isDuplicate: false,
         lastSyncedAt: conn.lastSyncedAt,
      };
   }

   const studyDate = member.studyDate || new Date().toISOString().slice(0, 10);
   const durationSeconds = member.todayStudySeconds;

   // 5. Ingest study activity into the daily log and economy reward ledger
   const ingestResult = await ingestYptActivity(
      {
         yptId,
         date: studyDate,
         durationSeconds,
         yptSubject: member.currentSubject || undefined,
         externalActivityId: `ypt_${yptId}_${studyDate}`,
      },
      "YPT_MANUAL"
   );

   // 6. Record the YptSyncRun audit entry
   await prisma.yptSyncRun.create({
      data: {
         connectionId: conn.id,
         userId,
         status: ingestResult.ok ? "SUCCESS" : "FAILED",
         startedAt: now,
         completedAt: new Date(),
         importedDurationSeconds: durationSeconds,
         eligibleDurationSeconds: ingestResult.ok
            ? ingestResult.durationSeconds
            : 0,
         coinsCredited: ingestResult.coinsCredited || 0,
         errorCode: ingestResult.ok
            ? null
            : ingestResult.code || "INGEST_FAILED",
         errorMessage: ingestResult.ok ? null : ingestResult.message,
      },
   });

   // 7. Update connection state
   if (ingestResult.ok) {
      await updateYptConnectionStatus({
         userId,
         status: YptConnectionStatus.VERIFIED,
         lastSyncedAt: new Date(),
         errorMessage: null,
      });
   } else {
      await updateYptConnectionStatus({
         userId,
         status: YptConnectionStatus.SYNC_ERROR,
         errorMessage: ingestResult.message,
      });
   }

   const importedMinutes = Math.floor(durationSeconds / 60);

   return {
      ok: ingestResult.ok,
      code: ingestResult.code,
      message: ingestResult.ok
         ? `Synchronization complete. Imported ${importedMinutes}m study time. Credited ${ingestResult.coinsCredited} virtual coins.`
         : ingestResult.message || "Synchronization encountered an issue.",
      importedDurationSeconds: durationSeconds,
      coinsCredited: ingestResult.coinsCredited || 0,
      isDuplicate: Boolean(ingestResult.isDuplicate),
      lastSyncedAt: new Date(),
   };
}
