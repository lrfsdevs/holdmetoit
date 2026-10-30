import { prisma } from "@/core/db";
import { Prisma } from "@prisma/client";
import { recordAuditEvent } from "@/features/audit/data/audit-log.repository";
import { ChallengeStateError } from "@/features/challenges/domain/challenge-lifecycle";
import { formatSecondsToClock } from "@/features/study-logs/domain/duration";
import { assertLeaveAllowance } from "@/features/study-logs/domain/leave-allowance";

const MAX_SERIALIZATION_RETRIES = 3;

function isSerializationConflict(error: unknown): boolean {
   return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
   );
}

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

function formatUtcDateKey(dateInput: string | Date): string {
   if (typeof dateInput === "string") {
      return dateInput.slice(0, 10);
   }
   return dateInput.toISOString().slice(0, 10);
}

export interface UpsertDailyStudyLogParams {
   participantId: string;
   logDate: string | Date;
   durationSeconds: number;
   isLeave?: boolean;
   challengeId?: string;
   source?: string;
   externalActivityId?: string;
   yptSubject?: string;
   actor?: {
      id: string;
      username: string;
      displayName?: string | null;
      image?: string | null;
   };
}

async function upsertDailyStudyLogOnce(params: UpsertDailyStudyLogParams) {
   const logDate = toUtcDateOnly(params.logDate);
   const isLeave = Boolean(params.isLeave);

   return prisma.$transaction(
      async (tx) => {
         const participant = await tx.challengeParticipant.findUnique({
            where: { id: params.participantId },
            select: {
               id: true,
               challengeId: true,
               plannedLeaveDays: true,
               usedLeaveDays: true,
            },
         });

         if (!participant) {
            throw new Error("Participant not found.");
         }

         // Freeze the accountability input once results are locked.
         const [challenge] = await tx.$queryRaw<
            { resultsLockedAt: Date | null }[]
         >`SELECT "resultsLockedAt" FROM "Challenge" WHERE "id" = ${participant.challengeId} FOR SHARE`;

         if (!challenge || challenge.resultsLockedAt != null) {
            throw new ChallengeStateError(
               "Challenge results are locked. Study logging is closed."
            );
         }

         const existingLog = await tx.dailyStudyLog.findUnique({
            where: {
               participantId_logDate: {
                  participantId: params.participantId,
                  logDate,
               },
            },
         });

         // Pure domain check for leave allowance and quota calculation
         const nextUsedLeaveDays = assertLeaveAllowance({
            plannedLeaveDays: participant.plannedLeaveDays,
            usedLeaveDays: participant.usedLeaveDays,
            isExistingLogLeave: Boolean(existingLog?.isLeave),
            isLeave,
         });

         if (nextUsedLeaveDays !== participant.usedLeaveDays) {
            await tx.challengeParticipant.update({
               where: { id: params.participantId },
               data: { usedLeaveDays: nextUsedLeaveDays },
            });
         }

         const updatedLog = await tx.dailyStudyLog.upsert({
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
               isLeave,
               status: "Offline",
               ...(params.source ? { source: params.source } : {}),
               ...(params.externalActivityId
                  ? { externalActivityId: params.externalActivityId }
                  : {}),
               ...(params.yptSubject ? { yptSubject: params.yptSubject } : {}),
            },
            update: {
               durationSeconds: params.durationSeconds,
               isLeave,
               isOverride: false,
               overrideById: null,
               overrideReason: null,
               ...(params.source ? { source: params.source } : {}),
               ...(params.externalActivityId
                  ? { externalActivityId: params.externalActivityId }
                  : {}),
               ...(params.yptSubject ? { yptSubject: params.yptSubject } : {}),
            },
         });

         if (params.actor && params.challengeId) {
            const dateKey = formatUtcDateKey(updatedLog.logDate);
            await recordAuditEvent(
               {
                  actorId: params.actor.id,
                  actorUsername: params.actor.username,
                  actorDisplayName: params.actor.displayName ?? null,
                  actorImage: params.actor.image ?? null,
                  actionType: "STUDY_LOG_ADDED",
                  targetEntityId: updatedLog.id,
                  targetEntityType: "DAILY_STUDY_LOG",
                  targetEntityName:
                     params.actor.displayName || params.actor.username,
                  challengeId: params.challengeId,
                  previousValue: existingLog
                     ? {
                          durationSeconds: existingLog.durationSeconds,
                          durationClock: formatSecondsToClock(
                             existingLog.durationSeconds
                          ),
                          logDate: dateKey,
                       }
                     : null,
                  newValue: {
                     durationSeconds: updatedLog.durationSeconds,
                     durationClock: formatSecondsToClock(
                        updatedLog.durationSeconds
                     ),
                     logDate: dateKey,
                  },
                  auditReason: isLeave
                     ? `Marked as leave (${formatSecondsToClock(updatedLog.durationSeconds)})`
                     : existingLog
                       ? `Updated study time from ${formatSecondsToClock(existingLog.durationSeconds)} to ${formatSecondsToClock(updatedLog.durationSeconds)}`
                       : `Logged ${formatSecondsToClock(updatedLog.durationSeconds)} of study time`,
               },
               { transactionClient: tx }
            );
         }

         return updatedLog;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
   );
}

export async function upsertDailyStudyLog(params: UpsertDailyStudyLogParams) {
   for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
         return await upsertDailyStudyLogOnce(params);
      } catch (error) {
         if (
            !isSerializationConflict(error) ||
            attempt === MAX_SERIALIZATION_RETRIES - 1
         ) {
            throw error;
         }
      }
   }

   throw new Error("Unreachable transaction retry state.");
}

export async function findDailyLog(
   participantId: string,
   logDate: string | Date
) {
   const normalized = toUtcDateOnly(logDate);

   return prisma.dailyStudyLog.findUnique({
      where: {
         participantId_logDate: {
            participantId,
            logDate: normalized,
         },
      },
   });
}
