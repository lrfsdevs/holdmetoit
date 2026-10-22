import { prisma } from "@/core/db";
import { recordAuditEvent } from "@/features/audit/data/audit-log.repository";
import { calculateChallengeStatus } from "@/features/challenges/domain/challenge-lifecycle";
import { resolveWithdrawalEligibility } from "@/features/challenges/domain/withdrawal";

export async function findParticipantForUser(
   userId: string,
   challengeId?: string,
   now = new Date()
) {
   const include = {
      challenge: true,
      team: true,
      user: true,
      dailyStudyLogs: {
         orderBy: { logDate: "asc" as const },
      },
   };

   if (challengeId) {
      return prisma.challengeParticipant.findFirst({
         where: {
            userId,
            challengeId,
            isWithdrawn: false,
            challenge: { isDeleted: false },
         },
         include,
      });
   }

   const activeParticipant = await prisma.challengeParticipant.findFirst({
      where: {
         userId,
         isWithdrawn: false,
         challenge: {
            isDeleted: false,
            startAt: { lte: now },
            endAt: { gt: now },
         },
      },
      include,
      orderBy: { enrolledAt: "desc" },
   });

   if (activeParticipant) {
      return activeParticipant;
   }

   const upcomingParticipant = await prisma.challengeParticipant.findFirst({
      where: {
         userId,
         isWithdrawn: false,
         challenge: {
            isDeleted: false,
            startAt: { gt: now },
         },
      },
      include,
      orderBy: { enrolledAt: "desc" },
   });

   if (upcomingParticipant) {
      return upcomingParticipant;
   }

   return prisma.challengeParticipant.findFirst({
      where: {
         userId,
         isWithdrawn: false,
         challenge: {
            isDeleted: false,
            endAt: { lte: now },
         },
      },
      include,
      orderBy: { enrolledAt: "desc" },
   });
}

export async function findOwnedParticipant(
   userId: string,
   challengeId: string
) {
   return prisma.challengeParticipant.findFirst({
      where: {
         userId,
         challengeId,
         isWithdrawn: false,
         challenge: { isDeleted: false },
      },
      include: {
         challenge: true,
      },
   });
}

export interface ActiveChallengeEnrollment {
   challengeId: string;
   challengeTitle: string;
}

/**
 * Lightweight membership probe for surfaces that only need to know whether the
 * user is currently inside an ongoing (date-active, not-yet-locked) challenge.
 */
export async function findActiveChallengeEnrollment(
   userId: string,
   now = new Date()
): Promise<ActiveChallengeEnrollment | null> {
   const participant = await prisma.challengeParticipant.findFirst({
      where: {
         userId,
         isWithdrawn: false,
         challenge: {
            isDeleted: false,
            resultsLockedAt: null,
            startAt: { lte: now },
            endAt: { gt: now },
         },
      },
      select: {
         challenge: { select: { id: true, title: true } },
      },
      orderBy: { enrolledAt: "desc" },
   });

   return participant
      ? {
           challengeId: participant.challenge.id,
           challengeTitle: participant.challenge.title,
        }
      : null;
}

export async function enrollParticipantInChallenge(params: {
   userId: string;
   challengeId: string;
   teamId?: string | null;
   targetSeconds?: number;
   plannedLeaveDays?: number;
}) {
   const hasTeam = Boolean(params.teamId && params.teamId !== "no-assigned");

   const [challenge, existing, team] = await Promise.all([
      prisma.challenge.findUnique({
         where: { id: params.challengeId },
      }),
      prisma.challengeParticipant.findUnique({
         where: {
            challengeId_userId: {
               challengeId: params.challengeId,
               userId: params.userId,
            },
         },
      }),
      hasTeam
         ? prisma.team.findUnique({
              where: { id: params.teamId! },
              include: {
                 _count: {
                    select: {
                       participants: { where: { isWithdrawn: false } },
                    },
                 },
              },
           })
         : Promise.resolve(null),
   ]);

   if (!challenge || challenge.isDeleted) {
      throw new Error("Challenge not found.");
   }

   if (calculateChallengeStatus(challenge) === "COMPLETED") {
      throw new Error("Cannot enroll in a completed challenge.");
   }

   if (existing?.isWithdrawn) {
      throw new Error("You have already withdrawn from this challenge.");
   }

   if (existing) {
      throw new Error("User is already enrolled in this challenge.");
   }

   if (hasTeam) {
      if (!team || team.isDeleted || team.challengeId !== params.challengeId) {
         throw new Error("Selected team does not belong to this challenge.");
      }

      if (
         challenge.format !== "SOLOS" &&
         team.maxMembers &&
         team._count.participants >= team.maxMembers
      ) {
         throw new Error(
            `Team ${team.name} is full (max ${team.maxMembers} member${team.maxMembers === 1 ? "" : "s"}).`
         );
      }
   }

   return prisma.challengeParticipant.create({
      data: {
         userId: params.userId,
         challengeId: params.challengeId,
         teamId: hasTeam ? params.teamId! : null,
         targetSeconds: params.targetSeconds ?? 0,
         plannedLeaveDays: params.plannedLeaveDays ?? 0,
         status: "NORMAL",
      },
      include: {
         team: true,
         challenge: true,
         user: true,
      },
   });
}

export async function updateParticipantTargetSeconds(
   participantId: string,
   targetSeconds: number
) {
   return prisma.challengeParticipant.update({
      where: { id: participantId, isWithdrawn: false },
      data: { targetSeconds },
   });
}

export async function withdrawParticipant(params: {
   challengeId: string;
   userId: string;
}) {
   const participant = await prisma.challengeParticipant.findUnique({
      where: {
         challengeId_userId: {
            challengeId: params.challengeId,
            userId: params.userId,
         },
      },
      include: {
         challenge: {
            select: {
               id: true,
               startAt: true,
               endAt: true,
               resultsLockedAt: true,
            },
         },
         user: {
            select: {
               displayName: true,
               username: true,
            },
         },
         dailyStudyLogs: {
            select: { durationSeconds: true },
         },
      },
   });

   if (!participant) {
      throw new Error("You are not enrolled in this challenge.");
   }

   const eligibility = resolveWithdrawalEligibility({
      isWithdrawn: participant.isWithdrawn,
      resultsLockedAt: participant.challenge.resultsLockedAt,
      status: calculateChallengeStatus(participant.challenge),
   });

   if (!eligibility.allowed) {
      throw new Error(eligibility.message);
   }

   const now = new Date();
   const totalLoggedSeconds = participant.dailyStudyLogs.reduce(
      (total, log) => total + log.durationSeconds,
      0
   );
   const participantName =
      participant.user.displayName ||
      participant.user.username ||
      "Participant";

   await prisma.$transaction(async (tx) => {
      await tx.challengeParticipant.update({
         where: { id: participant.id },
         data: {
            isWithdrawn: true,
            withdrawalAt: now,
         },
      });

      await recordAuditEvent({
         actorId: participant.userId,
         actorUsername: participant.user.username ?? participantName,
         actorDisplayName: participant.user.displayName,
         actionType: "PARTICIPANT_WITHDRAWN",
         targetEntityId: participant.id,
         targetEntityType: "PARTICIPANT",
         targetEntityName: participantName,
         challengeId: participant.challengeId,
         previousValue: {
            teamId: participant.teamId,
            targetSeconds: participant.targetSeconds,
            totalLoggedSeconds,
            status: participant.status,
         },
         newValue: {
            isWithdrawn: true,
            withdrawalAt: now.toISOString(),
         },
         auditReason: "Participant self-withdrawal",
      });
   });

   return { participantId: participant.id, withdrawalAt: now };
}
