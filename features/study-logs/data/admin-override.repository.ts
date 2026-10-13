import { prisma } from "@/core/db";
import { recordAuditEvent } from "@/features/audit/data/audit-log.repository";

function toUtcDateOnly(dateInput: string | Date): Date {
   if (typeof dateInput === "string") {
      const [year, month, day] = dateInput.split("-").map(Number);
      return new Date(Date.UTC(year, month - 1, day));
   }

   return new Date(
      Date.UTC(
         dateInput.getUTCFullYear(),
         dateInput.getUTCMonth(),
         dateInput.getUTCDate()
      )
   );
}

export interface AdminOverrideInput {
   participantId: string;
   logDate: string | Date;
   durationSeconds: number;
   reason: string;
   admin: {
      id: string;
      username: string;
   };
}

/**
 * Executes a host manual hours adjustment for any participant (Law L5 / FEAT-LOG-04).
 * Always marks isOverride = true, stores admin ID and reason, and appends to the audit trail.
 */
export async function executeAdminHoursOverride(params: AdminOverrideInput) {
   const logDate = toUtcDateOnly(params.logDate);
   const logDateKey = logDate.toISOString().slice(0, 10);
   const todayDateKey = new Date().toISOString().slice(0, 10);

   if (logDateKey > todayDateKey) {
      throw new Error("Cannot log or edit study time for future dates.");
   }

   const existingLog = await prisma.dailyStudyLog.findUnique({
      where: {
         participantId_logDate: {
            participantId: params.participantId,
            logDate,
         },
      },
      include: {
         participant: {
            select: {
               challengeId: true,
               user: { select: { displayName: true, username: true } },
            },
         },
      },
   });

   const updatedLog = await prisma.dailyStudyLog.upsert({
      where: {
         participantId_logDate: {
            participantId: params.participantId,
            logDate,
         },
      },
      create: {
         participantId: params.participantId,
         logDate,
         durationSeconds: params.durationSeconds,
         isOverride: true,
         overrideById: params.admin.id,
         overrideReason: params.reason.trim(),
      },
      update: {
         durationSeconds: params.durationSeconds,
         isOverride: true,
         overrideById: params.admin.id,
         overrideReason: params.reason.trim(),
      },
      include: {
         participant: {
            select: {
               challengeId: true,
               user: { select: { displayName: true, username: true } },
            },
         },
      },
   });

   const challengeId =
      existingLog?.participant.challengeId ??
      updatedLog.participant.challengeId;
   const participantName =
      updatedLog.participant.user?.displayName ||
      updatedLog.participant.user?.username ||
      "Participant";

   await recordAuditEvent({
      actorId: params.admin.id,
      actorUsername: params.admin.username,
      actionType: "HOURS_OVERRIDE",
      targetEntityId: updatedLog.id,
      targetEntityType: "DAILY_STUDY_LOG",
      targetEntityName: participantName,
      challengeId,
      previousValue: existingLog
         ? {
              durationSeconds: existingLog.durationSeconds,
              isOverride: existingLog.isOverride,
           }
         : null,
      newValue: {
         durationSeconds: updatedLog.durationSeconds,
         isOverride: true,
         logDate: logDate.toISOString().split("T")[0],
      },
      auditReason: params.reason.trim(),
   });

   return updatedLog;
}

export interface AdminResetOverallHoursInput {
   participantId: string;
   challengeId: string;
   reason: string;
   admin: {
      id: string;
      username: string;
   };
}

/**
 * Resets a participant's overall challenge study hours to 0 (Law L5 / FEAT-LOG-04).
 * Sets all existing daily study logs for this participant to 0 seconds with audit flags,
 * or creates a baseline 0s log if none exist yet.
 */
export async function executeAdminResetOverallHours(
   params: AdminResetOverallHoursInput
) {
   const participant = await prisma.challengeParticipant.findUnique({
      where: { id: params.participantId },
      include: {
         user: { select: { displayName: true, username: true } },
         dailyStudyLogs: true,
      },
   });

   if (!participant) {
      throw new Error("Participant not found.");
   }

   const logs = participant.dailyStudyLogs ?? [];
   const previousTotalSeconds = logs.reduce(
      (acc, log) => acc + log.durationSeconds,
      0
   );

   if (logs.length > 0) {
      await prisma.dailyStudyLog.updateMany({
         where: { participantId: params.participantId },
         data: {
            durationSeconds: 0,
            isOverride: true,
            overrideById: params.admin.id,
            overrideReason: params.reason.trim(),
         },
      });
   } else {
      const today = toUtcDateOnly(new Date());
      await prisma.dailyStudyLog.create({
         data: {
            participantId: params.participantId,
            logDate: today,
            durationSeconds: 0,
            status: "Offline",
            isOverride: true,
            overrideById: params.admin.id,
            overrideReason: params.reason.trim(),
         },
      });
   }

   const participantName =
      participant.user?.displayName ||
      participant.user?.username ||
      "Participant";

   await recordAuditEvent({
      actorId: params.admin.id,
      actorUsername: params.admin.username,
      actionType: "HOURS_OVERRIDE",
      targetEntityId: params.participantId,
      targetEntityType: "PARTICIPANT",
      targetEntityName: participantName,
      challengeId: params.challengeId,
      previousValue: {
         totalLoggedSeconds: previousTotalSeconds,
         logsCount: logs.length,
      },
      newValue: {
         totalLoggedSeconds: 0,
         isOverride: true,
      },
      auditReason: params.reason.trim(),
   });

   return {
      participantId: params.participantId,
      previousTotalSeconds,
      resetCount: logs.length,
   };
}
