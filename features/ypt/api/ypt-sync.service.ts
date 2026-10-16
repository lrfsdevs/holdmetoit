import { prisma } from "@/core/db";
import { YptConnectionStatus } from "@prisma/client";
import { decryptSensitiveToken } from "@/core/security/encryption";
import {
   restoreYptClientSession,
   getYptUserStudyStatus,
} from "../data/ypt-client.service";
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
 * Synchronizes Yeolpumta study time for an authenticated and verified user.
 * Communicates with YPT API via ypt-js, ingests study activity, and awards virtual coins.
 */
export async function syncUserYptStudy(userId: string): Promise<YptSyncResult> {
   const now = new Date();

   // 1. Load connection and user
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

   const conn = user.yptConnection;

   // 2. Validate verification status
   if (!conn || conn.status !== YptConnectionStatus.VERIFIED) {
      return {
         ok: false,
         code: "YPT_NOT_VERIFIED",
         message:
            "Your Yeolpumta identity is not yet verified by an administrator. Study synchronization is locked.",
         importedDurationSeconds: 0,
         coinsCredited: 0,
         isDuplicate: false,
         lastSyncedAt: conn?.lastSyncedAt || null,
      };
   }

   // 3. Check for saved session credentials
   if (!conn.encryptedRefreshToken) {
      return {
         ok: false,
         code: "NO_ACTIVE_SESSION",
         message:
            "No active YPT session found. Please re-authenticate your YPT account to enable automatic study synchronization.",
         importedDurationSeconds: 0,
         coinsCredited: 0,
         isDuplicate: false,
         lastSyncedAt: conn.lastSyncedAt,
      };
   }

   let refreshToken: string;
   try {
      refreshToken = decryptSensitiveToken(conn.encryptedRefreshToken);
   } catch {
      await updateYptConnectionStatus({
         userId,
         status: YptConnectionStatus.REAUTHENTICATION_REQUIRED,
         errorMessage: "Saved session token corrupted or expired.",
      });
      return {
         ok: false,
         code: "SESSION_CORRUPTED",
         message:
            "Your saved YPT session is corrupted. Please re-enter your YPT credentials.",
         importedDurationSeconds: 0,
         coinsCredited: 0,
         isDuplicate: false,
         lastSyncedAt: conn.lastSyncedAt,
      };
   }

   // 4. Restore session using ypt-js
   let yptClient;
   try {
      yptClient = await restoreYptClientSession(refreshToken);
   } catch (error) {
      logger.warn(logEvents.yptSyncFailed, {
         context: {
            action: "syncUserYptStudy",
            reason: "Session restore failed",
            userId,
         },
         error,
      });

      await updateYptConnectionStatus({
         userId,
         status: YptConnectionStatus.REAUTHENTICATION_REQUIRED,
         errorMessage: "Session expired. Reauthentication required.",
      });

      return {
         ok: false,
         code: "REAUTHENTICATION_REQUIRED",
         message:
            "Your Yeolpumta session has expired. Please re-authenticate your account.",
         importedDurationSeconds: 0,
         coinsCredited: 0,
         isDuplicate: false,
         lastSyncedAt: conn.lastSyncedAt,
      };
   }

   // 5. Query live study statistics from ypt-js
   const yptNumId = Number(conn.yptUserId);
   if (isNaN(yptNumId) || yptNumId <= 0) {
      return {
         ok: false,
         code: "INVALID_YPT_ID",
         message: "Invalid numeric Yeolpumta user ID.",
         importedDurationSeconds: 0,
         coinsCredited: 0,
         isDuplicate: false,
         lastSyncedAt: conn.lastSyncedAt,
      };
   }

   let studyStatus;
   try {
      studyStatus = await getYptUserStudyStatus(yptClient, yptNumId);
   } catch (err) {
      logger.error(logEvents.yptSyncFailed, {
         context: { action: "syncUserYptStudy", yptNumId },
         error: err,
      });

      await updateYptConnectionStatus({
         userId,
         status: YptConnectionStatus.SYNC_ERROR,
         errorMessage:
            err instanceof Error
               ? err.message
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

   const todayDateStr =
      studyStatus?.studyDate || new Date().toISOString().slice(0, 10);
   const durationSeconds = studyStatus ? studyStatus.todayStudySeconds : 0;

   // 6. Ingest study activity into daily log and economy reward ledger
   const ingestResult = await ingestYptActivity(
      {
         yptId: conn.yptUserId,
         date: todayDateStr,
         durationSeconds,
         yptSubject: studyStatus?.currentSubject || undefined,
         externalActivityId: `ypt_${conn.yptUserId}_${todayDateStr}`,
      },
      "YPT_MANUAL"
   );

   // 7. Record YptSyncRun audit entry
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

   // 8. Update connection state
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
