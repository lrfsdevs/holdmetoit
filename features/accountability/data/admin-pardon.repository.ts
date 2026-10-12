import { prisma } from "@/core/db";
import { recordAuditEvent } from "@/features/audit/data/audit-log.repository";

export async function adminPardonParticipant(params: {
   participantId: string;
   reason: string;
   admin: { id: string; username: string };
}) {
   const participant = await prisma.challengeParticipant.findUnique({
      where: { id: params.participantId },
      include: {
         punishmentRecords: true,
         user: { select: { displayName: true, username: true } },
      },
   });

   if (!participant) {
      throw new Error("Participant not found.");
   }

   const participantName =
      participant.user?.displayName ||
      participant.user?.username ||
      "Participant";
   const existingRecord = participant.punishmentRecords[0] ?? null;

   return prisma.$transaction(async (tx) => {
      const updatedParticipant = await tx.challengeParticipant.update({
         where: { id: params.participantId },
         data: { status: "EXCUSED" },
      });

      const pardonData = {
         isPardoned: true,
         pardonReason: params.reason.trim(),
         pardonedById: params.admin.id,
      };

      const updatedPunishment = existingRecord
         ? await tx.punishmentRecord.update({
              where: { id: existingRecord.id },
              data: pardonData,
           })
         : await tx.punishmentRecord.create({
              data: {
                 challengeId: participant.challengeId,
                 participantId: params.participantId,
                 ...pardonData,
              },
           });

      await recordAuditEvent({
         actorId: params.admin.id,
         actorUsername: params.admin.username,
         actionType: "PARTICIPANT_PARDONED",
         targetEntityId: params.participantId,
         targetEntityType: "PARTICIPANT",
         targetEntityName: participantName,
         challengeId: participant.challengeId,
         previousValue: {
            status: participant.status,
            isPardoned: existingRecord?.isPardoned ?? false,
         },
         newValue: {
            status: "EXCUSED",
            isPardoned: true,
            pardonReason: params.reason.trim(),
         },
         auditReason: params.reason.trim(),
      });

      return {
         participant: updatedParticipant,
         punishmentRecord: updatedPunishment,
      };
   });
}
