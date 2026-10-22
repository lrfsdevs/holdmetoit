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
         include: {
            user: {
               select: {
                  displayName: true,
                  username: true,
               },
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

   if (existing && !existing.isWithdrawn) {
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

   if (existing?.isWithdrawn) {
      const now = new Date();
      const resolvedTeamId = hasTeam ? params.teamId! : null;
      const resolvedTargetSeconds = params.targetSeconds ?? 0;
      const resolvedLeaveDays = params.plannedLeaveDays ?? 0;
      const participantName =
         existing.user?.displayName || existing.user?.username || "Participant";

      const reenrolled = await prisma.challengeParticipant.update({
         where: { id: existing.id },
         data: {
            teamId: resolvedTeamId,
            targetSeconds: resolvedTargetSeconds,
            plannedLeaveDays: resolvedLeaveDays,
            usedLeaveDays: 0,
            status: "NORMAL",
            isWithdrawn: false,
            withdrawalAt: null,
            enrolledAt: now,
         },
         include: {
            team: true,
            challenge: true,
            user: true,
         },
      });

      await recordAuditEvent({
         actorId: params.userId,
         actorUsername: existing.user?.username ?? participantName,
         actorDisplayName: existing.user?.displayName ?? null,
         actionType: "PARTICIPANT_REENROLLED",
         targetEntityId: existing.id,
         targetEntityType: "PARTICIPANT",
         targetEntityName: participantName,
         challengeId: params.challengeId,
         previousValue: {
            isWithdrawn: true,
            withdrawalAt: existing.withdrawalAt?.toISOString() ?? null,
            teamId: existing.teamId,
            targetSeconds: existing.targetSeconds,
            plannedLeaveDays: existing.plannedLeaveDays,
            status: existing.status,
         },
         newValue: {
            isWithdrawn: false,
            withdrawalAt: null,
            teamId: resolvedTeamId,
            targetSeconds: resolvedTargetSeconds,
            plannedLeaveDays: resolvedLeaveDays,
            status: "NORMAL",
         },
         auditReason: "Participant re-enrollment",
      });

      return reenrolled;
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

export interface WithdrawalParticipantRecord {
   id: string;
   challengeId: string;
   userId: string;
   teamId: string | null;
   targetSeconds: number;
   status: string;
   isWithdrawn: boolean;
   challenge: {
      startAt: Date | string;
      endAt: Date | string;
      resultsLockedAt: Date | string | null;
   };
   dailyStudyLogs: { durationSeconds: number }[];
}

export async function applyParticipantWithdrawal(params: {
   participant: WithdrawalParticipantRecord;
   participantName: string;
   teamName?: string | null;
   actor: { id: string; username: string; displayName?: string | null };
   actionType: "PARTICIPANT_WITHDRAWN" | "PARTICIPANT_REMOVED";
   reason: string;
}) {
   const { participant, actor, actionType, reason } = params;

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

   await prisma.$transaction(async (tx) => {
      const { count } = await tx.challengeParticipant.updateMany({
         where: {
            id: participant.id,
            isWithdrawn: false,
            challenge: { resultsLockedAt: null },
         },
         data: {
            isWithdrawn: true,
            withdrawalAt: now,
         },
      });
      if (count === 0) {
         throw new Error("Withdrawal is no longer possible.");
      }

      await recordAuditEvent({
         actorId: actor.id,
         actorUsername: actor.username,
         actorDisplayName: actor.displayName ?? null,
         actionType,
         targetEntityId: participant.id,
         targetEntityType: "PARTICIPANT",
         targetEntityName: params.participantName,
         challengeId: participant.challengeId,
         previousValue: {
            teamId: participant.teamId,
            teamName: params.teamName ?? undefined,
            targetSeconds: participant.targetSeconds,
            totalLoggedSeconds,
            status: participant.status,
         },
         newValue: {
            isWithdrawn: true,
            withdrawalAt: now.toISOString(),
         },
         auditReason: reason,
      });
   });

   return { participantId: participant.id, withdrawalAt: now };
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

   const participantName =
      participant.user.displayName ||
      participant.user.username ||
      "Participant";

   return applyParticipantWithdrawal({
      participant,
      participantName,
      actor: {
         id: participant.userId,
         username: participant.user.username ?? participantName,
         displayName: participant.user.displayName,
      },
      actionType: "PARTICIPANT_WITHDRAWN",
      reason: "Participant self-withdrawal",
   });
}
