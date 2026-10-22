import { prisma } from "@/core/db";
import {
   evaluateLockOutcome,
   resolveWinningTeamIds,
} from "@/features/accountability/domain/punishment";
import {
   getAuditTrail,
   recordAuditEvent,
} from "@/features/audit/data/audit-log.repository";
import {
   assertCanKickoffChallenge,
   assertCanLockChallenge,
   calculateChallengeStatus,
   ChallengeStateError,
   type ChallengeCreationInput,
} from "@/features/challenges/domain/challenge-lifecycle";
import { computeEventDetailsDiff } from "@/features/challenges/domain/event-audit-diff";
import { buildTeamTombstoneName } from "@/features/challenges/domain/team-deletion";
import { sumLoggedSeconds } from "@/features/leaderboard/domain/catch-up-presentation";
import { aggregateTeamScores } from "@/features/leaderboard/domain/leaderboard";
import { formatSecondsToClock } from "@/features/study-logs/domain/duration";
import { getOrCreateWallet } from "@/features/economy/data/wallet.repository";
import {
   settleChallengeWagers,
   refundAllChallengeWagers,
} from "@/features/wagers/data/wager.repository";
import {
   settleChallengeTrophies,
   reverseChallengeTrophies,
} from "@/features/trophies/data/trophy.repository";
import { listAllChallenges } from "./challenge.repository";

export async function listAllChallengesForAdmin() {
   return listAllChallenges();
}

export async function findAdminChallengeDetails(challengeId: string) {
   return prisma.challenge.findFirst({
      where: { id: challengeId, isDeleted: false },
      include: {
         host: {
            select: {
               id: true,
               displayName: true,
               username: true,
               image: true,
            },
         },
         teams: {
            where: { isDeleted: false },
            orderBy: { sortOrder: "asc" },
            include: {
               _count: {
                  select: { participants: true },
               },
            },
         },
         participants: {
            include: {
               user: {
                  select: {
                     id: true,
                     displayName: true,
                     username: true,
                     image: true,
                     discordId: true,
                  },
               },
               team: true,
               dailyStudyLogs: {
                  orderBy: { logDate: "asc" },
                  include: {
                     overrideBy: {
                        select: {
                           displayName: true,
                           username: true,
                        },
                     },
                  },
               },
               punishmentRecords: true,
            },
            orderBy: { enrolledAt: "asc" },
         },
      },
   });
}

export async function createAdminChallenge(
   input: ChallengeCreationInput,
   actor: { id: string; username: string }
) {
   const maxMembers =
      input.format === "SOLOS" ? null : input.format === "DUOS" ? 2 : null;

   return prisma.$transaction(async (tx) => {
      const challenge = await tx.challenge.create({
         data: {
            title: input.title.trim(),
            description: input.description?.trim() || null,
            format: input.format,
            startAt: new Date(input.startAt),
            endAt: new Date(input.endAt),
            eventBannerUrl: input.eventBannerUrl?.trim() || null,
            punishmentPfpUrl: input.punishmentPfpUrl?.trim() || null,
            rewardCoins:
               input.rewardCoins != null && input.rewardCoins >= 0
                  ? input.rewardCoins
                  : 0,
            isBettingEnabled: Boolean(input.isBettingEnabled),
            hostId: actor.id,
            teams: {
               create: input.teams.map((team, idx) => ({
                  name: team.name.trim(),
                  color: team.color?.trim() || null,
                  iconEmoji: team.iconEmoji?.trim() || null,
                  mascotUrl: team.mascotUrl?.trim() || null,
                  maxMembers,
                  sortOrder: idx,
               })),
            },
         },
         include: {
            teams: true,
         },
      });

      await recordAuditEvent({
         actorId: actor.id,
         actorUsername: actor.username,
         actionType: "CHALLENGE_CREATED",
         targetEntityId: challenge.id,
         targetEntityType: "CHALLENGE",
         targetEntityName: challenge.title,
         challengeId: challenge.id,
         newValue: {
            title: challenge.title,
            format: challenge.format,
            teamsCount: challenge.teams.length,
         },
         auditReason: "Admin created new challenge tournament",
      });

      return challenge;
   });
}

export async function kickoffChallenge(
   challengeId: string,
   actor: { id: string; username: string }
) {
   const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
   });

   if (!challenge) {
      throw new Error("Challenge not found.");
   }

   const currentStatus = calculateChallengeStatus(challenge);
   assertCanKickoffChallenge(currentStatus);

   const now = new Date();
   const updated = await prisma.challenge.update({
      where: { id: challengeId },
      data: {
         startAt:
            now.getTime() > challenge.startAt.getTime()
               ? challenge.startAt
               : now,
      },
   });

   await recordAuditEvent({
      actorId: actor.id,
      actorUsername: actor.username,
      actionType: "CHALLENGE_KICKOFF",
      targetEntityId: challengeId,
      targetEntityType: "CHALLENGE",
      targetEntityName: challenge.title,
      challengeId,
      previousValue: { status: currentStatus },
      newValue: { status: "ACTIVE" },
      auditReason: "Host manually triggered event kickoff (FEAT-CHAL-02)",
   });

   return {
      ...updated,
      status: calculateChallengeStatus(updated),
   };
}

export async function lockChallengeResults(
   challengeId: string,
   actor: { id: string; username: string },
   options?: { settleTrophies?: boolean; settleRewards?: boolean }
) {
   const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
         teams: { select: { id: true } },
         participants: {
            include: {
               dailyStudyLogs: true,
               punishmentRecords: true,
            },
         },
      },
   });

   if (!challenge) {
      throw new Error("Challenge not found.");
   }

   const currentStatus = calculateChallengeStatus(challenge);
   assertCanLockChallenge(currentStatus, challenge.resultsLockedAt);

   const evaluatedParticipants = challenge.participants.filter(
      (participant) => !participant.isWithdrawn
   );

   const participantUserIds = evaluatedParticipants.map(
      (participant) => participant.userId
   );

   const weeklyTasks =
      participantUserIds.length > 0
         ? await prisma.task.findMany({
              where: {
                 challengeId,
                 taskType: "WEEKLY",
                 userId: { in: participantUserIds },
              },
              select: { userId: true, status: true },
           })
         : [];

   const weeklyTasksByUser = new Map<string, { status: string }[]>();
   for (const task of weeklyTasks) {
      const userTasks = weeklyTasksByUser.get(task.userId) ?? [];
      userTasks.push({ status: task.status });
      weeklyTasksByUser.set(task.userId, userTasks);
   }

   return prisma.$transaction(async (tx) => {
      // 1. Transition challenge status to COMPLETED by adjusting endAt (if ACTIVE) and setting resultsLockedAt
      const now = new Date();
      const completedChallenge = await tx.challenge.update({
         where: { id: challengeId },
         data: {
            endAt:
               now.getTime() < challenge.endAt.getTime()
                  ? now
                  : challenge.endAt,
            resultsLockedAt: now,
         },
      });

      // 2. Three-condition lock evaluation (FEAT-PUN-01): saved = hours met AND all
      //    challenge-linked weekly tasks completed AND in a winning team.
      //    Equal team totals never punish — every team at the max is a winner.
      //    In SOLOS format, participants compete individually: no team penalty applies.
      const isSoloChallenge = challenge.format === "SOLOS";

      const teamTotals = aggregateTeamScores(
         challenge.teams,
         evaluatedParticipants.map((participant) => ({
            teamId: participant.teamId ?? "no-assigned",
            loggedSeconds: sumLoggedSeconds(participant.dailyStudyLogs ?? []),
         }))
      ).filter((aggregate) =>
         challenge.teams.some((team) => team.id === aggregate.teamId)
      );

      const winningTeamIds = resolveWinningTeamIds(teamTotals);

      const punishedParticipantIds: string[] = [];
      const savedParticipantIds: string[] = [];

      for (const participant of evaluatedParticipants) {
         const isExcused =
            participant.status === "EXCUSED" ||
            participant.punishmentRecords.some((record) => record.isPardoned);

         if (isExcused) {
            continue;
         }

         const isInWinningTeam =
            isSoloChallenge ||
            (participant.teamId != null &&
               winningTeamIds.includes(participant.teamId));

         const outcome = evaluateLockOutcome({
            targetSeconds: participant.targetSeconds,
            loggedSeconds: sumLoggedSeconds(participant.dailyStudyLogs ?? []),
            weeklyTasks: weeklyTasksByUser.get(participant.userId) ?? [],
            isInWinningTeam,
         });

         if (outcome.isPunished) {
            punishedParticipantIds.push(participant.id);
         } else {
            savedParticipantIds.push(participant.id);
         }
      }

      if (savedParticipantIds.length > 0) {
         await tx.challengeParticipant.updateMany({
            where: { id: { in: savedParticipantIds } },
            data: { status: "NORMAL" },
         });
      }

      if (punishedParticipantIds.length > 0) {
         await tx.challengeParticipant.updateMany({
            where: { id: { in: punishedParticipantIds } },
            data: { status: "PUNISHED" },
         });
      }

      // Row presence = punished. Clear stale records but keep pardoned ones.
      await tx.punishmentRecord.deleteMany({
         where: { challengeId, isPardoned: false },
      });

      if (punishedParticipantIds.length > 0) {
         await tx.punishmentRecord.createMany({
            data: punishedParticipantIds.map((participantId) => ({
               challengeId,
               participantId,
            })),
         });
      }

      // 3. Challenge economic rewards settlement (Stage 3)
      if (
         options?.settleRewards !== false &&
         Boolean(challenge.rewardCoins) &&
         challenge.rewardCoins > 0 &&
         !challenge.isRewardSettled &&
         Boolean((tx as any)?.wallet)
      ) {
         const savedParticipants = evaluatedParticipants.filter((p) =>
            savedParticipantIds.includes(p.id)
         );

         for (const participant of savedParticipants) {
            const wallet = await getOrCreateWallet(participant.userId, tx);
            await tx.wallet.update({
               where: { id: wallet.id },
               data: {
                  totalBalance: wallet.totalBalance + challenge.rewardCoins,
                  lifetimeEarned: wallet.lifetimeEarned + challenge.rewardCoins,
               },
            });

            await tx.ledgerTransaction.create({
               data: {
                  walletId: wallet.id,
                  userId: participant.userId,
                  type: "CHALLENGE_REWARD",
                  amount: challenge.rewardCoins,
                  totalDelta: challenge.rewardCoins,
                  reservedDelta: 0,
                  sourceType: "CHALLENGE",
                  sourceId: challengeId,
                  idempotencyKey: `challenge-reward:${challengeId}:${participant.userId}`,
                  description: `Challenge victory bonus: +${challenge.rewardCoins} coins (${challenge.title})`,
                  metadata: {
                     challengeId,
                     challengeTitle: challenge.title,
                     rewardCoins: challenge.rewardCoins,
                     participantId: participant.id,
                  },
               },
            });
         }

         await tx.challenge.update({
            where: { id: challengeId },
            data: {
               isRewardSettled: true,
               rewardSettledAt: now,
            },
         });
      }

      // 4. Wager settlement (Stage 4)
      await settleChallengeWagers(challengeId, winningTeamIds, tx);

      // 5. Trophy settlement (Phase 5)
      if (options?.settleTrophies !== false) {
         await settleChallengeTrophies(
            {
               challengeId,
               challengeTitle: challenge.title,
               winningTeamIds,
               totalTeamsCount: challenge.teams.length,
               participants: evaluatedParticipants,
               savedParticipantIds,
            },
            tx
         );
      }

      await recordAuditEvent({
         actorId: actor.id,
         actorUsername: actor.username,
         actionType: "CHALLENGE_LOCKED",
         targetEntityId: challengeId,
         targetEntityType: "CHALLENGE",
         targetEntityName: challenge.title,
         challengeId,
         previousValue: {
            status: currentStatus,
            resultsLockedAt: challenge.resultsLockedAt,
            endAt: challenge.endAt.toISOString(),
         },
         newValue: {
            status: "COMPLETED",
            resultsLockedAt: completedChallenge.resultsLockedAt,
            participantsEvaluated: evaluatedParticipants.length,
            withdrawnParticipants:
               challenge.participants.length - evaluatedParticipants.length,
            winningTeamIds,
            punishedParticipants: punishedParticipantIds.length,
            savedParticipants: savedParticipantIds.length,
         },
         auditReason:
            "Host finalized results and locked challenge (FEAT-CHAL-05)",
      });

      return {
         ...completedChallenge,
         status: calculateChallengeStatus(completedChallenge),
      };
   });
}

/**
 * Rollback for a mistaken lock: clears `resultsLockedAt`, resets every
 * participant to `NORMAL`, deletes all punishment records for the challenge
 * (pardoned ones included), and optionally resets the wrapped flags. The lock
 * audit now records the previous `endAt`, so an early lock's original end time
 * is restored automatically; older locks can pass `options.endAt` explicitly.
 */
export async function unlockChallengeResults(
   challengeId: string,
   actor: { id: string; username: string },
   options?: { endAt?: Date; keepWrappedFlags?: boolean }
) {
   const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
   });

   if (!challenge) {
      throw new Error("Challenge not found.");
   }

   if (challenge.resultsLockedAt == null) {
      throw new ChallengeStateError("Challenge results are not locked.");
   }

   const lockedAt = challenge.resultsLockedAt;
   const currentEndAt = challenge.endAt;
   let restoredEndAt: Date | null = null;

   if (options?.endAt) {
      restoredEndAt = options.endAt;
   } else {
      const auditTrail = await getAuditTrail(challengeId);
      const lockEvent = auditTrail.find(
         (event) => event.actionType === "CHALLENGE_LOCKED"
      );
      const previousEndAt = (
         lockEvent?.previousValue as
            { endAt?: string | Date } | null | undefined
      )?.endAt;

      if (previousEndAt) {
         const parsed = new Date(previousEndAt);
         if (!Number.isNaN(parsed.getTime())) {
            restoredEndAt = parsed;
         }
      }
   }

   const wrappedFlagsReset = !options?.keepWrappedFlags;

   return prisma.$transaction(async (tx) => {
      const unlockedChallenge = await tx.challenge.update({
         where: { id: challengeId },
         data: {
            resultsLockedAt: null,
            ...(restoredEndAt ? { endAt: restoredEndAt } : {}),
         },
      });

      const participantsReset = await tx.challengeParticipant.updateMany({
         where: { challengeId },
         data: { status: "NORMAL" },
      });

      const recordsDeleted = await tx.punishmentRecord.deleteMany({
         where: { challengeId },
      });

      if (wrappedFlagsReset) {
         await tx.challengeParticipant.updateMany({
            where: { challengeId },
            data: { isWrappedSeen: false, isFeedbackFilled: false },
         });
      }

      // Refund any accepted wagers if challenge is unlocked
      await refundAllChallengeWagers(
         challengeId,
         tx,
         "Challenge results unlocked by admin"
      );

      // Reverse any awarded challenge trophies
      await reverseChallengeTrophies(
         challengeId,
         tx,
         "Challenge results unlocked by admin"
      );

      await recordAuditEvent({
         actorId: actor.id,
         actorUsername: actor.username,
         actionType: "CHALLENGE_UNLOCKED",
         targetEntityId: challengeId,
         targetEntityType: "CHALLENGE",
         targetEntityName: challenge.title,
         challengeId,
         previousValue: {
            resultsLockedAt: lockedAt.toISOString(),
            endAt: currentEndAt.toISOString(),
         },
         newValue: {
            resultsLockedAt: null,
            endAt: (restoredEndAt ?? currentEndAt).toISOString(),
            participantsReset: participantsReset.count,
            recordsDeleted: recordsDeleted.count,
            wrappedFlagsReset,
         },
         auditReason: "Results unlock rollback",
      });

      return {
         ...unlockedChallenge,
         status: calculateChallengeStatus(unlockedChallenge),
         participantsReset: participantsReset.count,
         recordsDeleted: recordsDeleted.count,
         wrappedFlagsReset,
         restoredEndAt,
      };
   });
}

export async function adminEnrollParticipant(params: {
   challengeId: string;
   userId: string;
   teamId: string;
   targetSeconds?: number;
   reason: string;
   admin: { id: string; username: string };
}) {
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
      prisma.team.findUnique({
         where: { id: params.teamId },
         include: {
            _count: {
               select: { participants: true },
            },
         },
      }),
   ]);

   if (!challenge) {
      throw new Error("Challenge not found.");
   }

   if (existing) {
      throw new Error("User is already enrolled in this challenge.");
   }

   if (!team || team.challengeId !== params.challengeId) {
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

   const participant = await prisma.challengeParticipant.create({
      data: {
         userId: params.userId,
         challengeId: params.challengeId,
         teamId: params.teamId,
         targetSeconds: params.targetSeconds ?? 0,
         status: "NORMAL",
      },
      include: {
         team: true,
         challenge: true,
         user: true,
      },
   });

   await recordAuditEvent({
      actorId: params.admin.id,
      actorUsername: params.admin.username,
      actionType: "ROSTER_EDIT",
      targetEntityId: participant.id,
      targetEntityType: "PARTICIPANT",
      targetEntityName:
         participant.user?.displayName ||
         participant.user?.username ||
         "Participant",
      challengeId: params.challengeId,
      previousValue: null,
      newValue: {
         userId: params.userId,
         teamId: params.teamId,
         targetSeconds: params.targetSeconds ?? 0,
      },
      auditReason: params.reason.trim(),
   });

   return participant;
}

export interface UpdateAdminChallengeInput {
   title: string;
   description?: string | null;
   startAt: string;
   endAt: string;
   eventBannerUrl: string | null;
   punishmentPfpUrl: string | null;
   rewardCoins?: number;
   isBettingEnabled?: boolean;
   teams: Array<{
      id?: string;
      name: string;
      color?: string | null;
      iconEmoji?: string | null;
      mascotUrl?: string | null;
   }>;
}

export async function updateAdminChallenge(
   challengeId: string,
   input: UpdateAdminChallengeInput,
   actor: { id: string; username: string }
) {
   const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: { teams: true },
   });

   if (!challenge) {
      throw new Error("Challenge not found.");
   }

   const maxMembers =
      challenge.format === "SOLOS" ? 1 : challenge.format === "DUOS" ? 2 : null;

   const now = new Date();
   const isStarted = challenge.startAt.getTime() <= now.getTime();

   return prisma.$transaction(async (tx) => {
      // 1. Update challenge basic details (economic terms can only be modified before kickoff)
      const challengeUpdateData: {
         title: string;
         startAt: Date;
         endAt: Date;
         eventBannerUrl: string | null;
         punishmentPfpUrl: string | null;
         description?: string | null;
         rewardCoins?: number;
         isBettingEnabled?: boolean;
      } = {
         title: input.title.trim(),
         startAt: new Date(input.startAt),
         endAt: new Date(input.endAt),
         eventBannerUrl: input.eventBannerUrl,
         punishmentPfpUrl: input.punishmentPfpUrl,
      };

      if (input.description !== undefined) {
         challengeUpdateData.description = input.description?.trim() || null;
      }
      if (!isStarted && input.rewardCoins !== undefined) {
         challengeUpdateData.rewardCoins = Math.max(0, input.rewardCoins);
      }
      if (!isStarted && input.isBettingEnabled !== undefined) {
         challengeUpdateData.isBettingEnabled = input.isBettingEnabled;
      }

      const updatedChallenge = await tx.challenge.update({
         where: { id: challengeId },
         data: challengeUpdateData,
      });

      // 2. Process teams: update existing or create new ones
      const keptTeamIds: string[] = [];
      for (let i = 0; i < input.teams.length; i++) {
         const teamInput = input.teams[i];
         if (teamInput.id) {
            keptTeamIds.push(teamInput.id);
            await tx.team.update({
               where: { id: teamInput.id },
               data: {
                  name: teamInput.name.trim(),
                  color: teamInput.color?.trim() || null,
                  iconEmoji: teamInput.iconEmoji?.trim() || null,
                  mascotUrl: teamInput.mascotUrl?.trim() || null,
                  sortOrder: i,
               },
            });
         } else {
            const newTeam = await tx.team.create({
               data: {
                  challengeId,
                  name: teamInput.name.trim(),
                  color: teamInput.color?.trim() || null,
                  iconEmoji: teamInput.iconEmoji?.trim() || null,
                  mascotUrl: teamInput.mascotUrl?.trim() || null,
                  maxMembers,
                  sortOrder: i,
               },
            });
            if (newTeam?.id) {
               keptTeamIds.push(newTeam.id);
            }
         }
      }

      // Soft-delete removed teams that have no participants
      if (keptTeamIds.length > 0) {
         const teamsToSoftDelete =
            (await tx.team.findMany({
               where: {
                  challengeId,
                  id: { notIn: keptTeamIds },
                  isDeleted: false,
                  participants: { none: {} },
               },
            })) || [];

         const now = new Date();
         for (const t of teamsToSoftDelete) {
            await tx.team.update({
               where: { id: t.id },
               data: {
                  isDeleted: true,
                  deletionTime: now,
                  name: buildTeamTombstoneName(t.name, t.id),
               },
            });
         }
      }

      const diff = computeEventDetailsDiff(
         {
            title: challenge.title,
            description: challenge.description,
            startAt: challenge.startAt,
            endAt: challenge.endAt,
            eventBannerUrl: challenge.eventBannerUrl,
            punishmentPfpUrl: challenge.punishmentPfpUrl,
            teams: challenge.teams,
         },
         input
      );

      await recordAuditEvent({
         actorId: actor.id,
         actorUsername: actor.username,
         actionType: "EVENT_DETAILS_UPDATED",
         targetEntityId: challengeId,
         targetEntityType: "CHALLENGE",
         targetEntityName: updatedChallenge.title,
         challengeId,
         previousValue: diff.previousValue,
         newValue: diff.newValue,
         auditReason:
            diff.summary ||
            "Admin updated challenge configuration and team identities",
      });

      return updatedChallenge;
   });
}

export async function reassignParticipantTeam(params: {
   participantId: string;
   newTeamId: string;
   reason?: string;
   admin: { id: string; username: string };
}) {
   const participant = await prisma.challengeParticipant.findUnique({
      where: { id: params.participantId },
      include: { team: true, user: true, challenge: true },
   });

   if (!participant) {
      throw new Error("Participant not found.");
   }

   const isUnassigning =
      params.newTeamId === "no-assigned" || !params.newTeamId;

   if (isUnassigning) {
      if (!participant.teamId) {
         return participant;
      }

      const updatedParticipant = await prisma.challengeParticipant.update({
         where: { id: params.participantId },
         data: { teamId: null },
         include: { team: true, user: true },
      });

      const participantName =
         participant.user?.displayName ||
         participant.user?.username ||
         "Participant";

      await recordAuditEvent({
         actorId: params.admin.id,
         actorUsername: params.admin.username,
         actionType: "ROSTER_EDIT",
         targetEntityId: participant.id,
         targetEntityType: "PARTICIPANT",
         targetEntityName: participantName,
         challengeId: participant.challengeId,
         previousValue: {
            teamId: participant.teamId,
            teamName: participant.team?.name ?? "Not Assigned",
         },
         newValue: {
            teamId: null,
            teamName: "Not Assigned",
         },
         auditReason:
            params.reason?.trim() ||
            `Host moved ${participantName} to unassigned roster`,
      });

      return updatedParticipant;
   }

   if (participant.teamId === params.newTeamId) {
      return participant;
   }

   const destinationTeam = await prisma.team.findUnique({
      where: { id: params.newTeamId },
      include: {
         _count: { select: { participants: true } },
      },
   });

   if (
      !destinationTeam ||
      destinationTeam.challengeId !== participant.challengeId
   ) {
      throw new Error(
         "Selected destination team does not belong to this challenge."
      );
   }

   if (
      participant.challenge?.format !== "SOLOS" &&
      destinationTeam.maxMembers &&
      destinationTeam._count.participants >= destinationTeam.maxMembers
   ) {
      throw new Error(
         `Team ${destinationTeam.name} is full (max ${destinationTeam.maxMembers} member${destinationTeam.maxMembers === 1 ? "" : "s"}).`
      );
   }

   const updatedParticipant = await prisma.challengeParticipant.update({
      where: { id: params.participantId },
      data: { teamId: params.newTeamId },
      include: { team: true, user: true },
   });

   const participantName =
      participant.user?.displayName ||
      participant.user?.username ||
      "Participant";

   await recordAuditEvent({
      actorId: params.admin.id,
      actorUsername: params.admin.username,
      actionType: "ROSTER_EDIT",
      targetEntityId: participant.id,
      targetEntityType: "PARTICIPANT",
      targetEntityName: participantName,
      challengeId: participant.challengeId,
      previousValue: {
         teamId: participant.teamId,
         teamName: participant.team?.name ?? "Not Assigned",
      },
      newValue: {
         teamId: updatedParticipant.teamId,
         teamName: updatedParticipant.team?.name ?? destinationTeam.name,
      },
      auditReason:
         params.reason?.trim() ||
         `Host reassigned ${participantName} from ${participant.team?.name ?? "Not Assigned"} to ${destinationTeam.name}`,
   });

   return updatedParticipant;
}

export interface AdminUpdateParticipantTargetParams {
   challengeId: string;
   participantId: string;
   targetSeconds: number;
   reason?: string;
   admin: {
      id: string;
      username: string;
   };
}

export async function adminUpdateParticipantTarget(
   params: AdminUpdateParticipantTargetParams
) {
   const participant = await prisma.challengeParticipant.findUnique({
      where: { id: params.participantId },
      include: { user: true, team: true, challenge: true },
   });

   if (!participant) {
      throw new Error("Participant not found.");
   }

   if (participant.challengeId !== params.challengeId) {
      throw new Error("Participant does not belong to this challenge.");
   }

   const previousTargetSeconds = participant.targetSeconds;

   const updatedParticipant = await prisma.challengeParticipant.update({
      where: { id: params.participantId },
      data: { targetSeconds: params.targetSeconds },
      include: { user: true, team: true, challenge: true },
   });

   const participantName =
      participant.user?.displayName ||
      participant.user?.username ||
      "Participant";

   const effectiveReason =
      params.reason?.trim() ||
      `Host adjusted target hours from ${formatSecondsToClock(previousTargetSeconds)} to ${formatSecondsToClock(params.targetSeconds)}`;

   await recordAuditEvent({
      actorId: params.admin.id,
      actorUsername: params.admin.username,
      actionType: "TARGET_HOURS_OVERRIDE",
      targetEntityId: participant.id,
      targetEntityType: "PARTICIPANT",
      targetEntityName: participantName,
      challengeId: params.challengeId,
      previousValue: {
         targetSeconds: previousTargetSeconds,
         targetClock: formatSecondsToClock(previousTargetSeconds),
      },
      newValue: {
         targetSeconds: params.targetSeconds,
         targetClock: formatSecondsToClock(params.targetSeconds),
      },
      auditReason: effectiveReason,
   });

   return updatedParticipant;
}

export async function removeChallengeParticipant(params: {
   participantId: string;
   reason: string;
   admin: { id: string; username: string };
}) {
   const participant = await prisma.challengeParticipant.findUnique({
      where: { id: params.participantId },
      include: {
         user: { select: { id: true, displayName: true, username: true } },
         team: { select: { id: true, name: true } },
         challenge: {
            select: { id: true, title: true, startAt: true, endAt: true },
         },
      },
   });

   if (!participant) {
      throw new Error("Participant not found.");
   }

   if (calculateChallengeStatus(participant.challenge) === "COMPLETED") {
      throw new Error(
         "Cannot remove a participant from a completed challenge."
      );
   }

   const participantName =
      participant.user?.displayName ||
      participant.user?.username ||
      "Participant";

   return prisma.$transaction(async (tx) => {
      await tx.dailyStudyLog.deleteMany({
         where: { participantId: params.participantId },
      });

      await tx.punishmentRecord.deleteMany({
         where: { participantId: params.participantId },
      });

      await recordAuditEvent({
         actorId: params.admin.id,
         actorUsername: params.admin.username,
         actionType: "ROSTER_EDIT",
         targetEntityId: participant.id,
         targetEntityType: "PARTICIPANT",
         targetEntityName: participantName,
         challengeId: participant.challengeId,
         previousValue: {
            userId: participant.userId,
            teamId: participant.teamId,
            teamName: participant.team?.name ?? "Not Assigned",
            targetSeconds: participant.targetSeconds,
            status: participant.status,
         },
         newValue: null,
         auditReason: params.reason.trim(),
      });

      await tx.challengeParticipant.delete({
         where: { id: params.participantId },
      });

      return { participantId: participant.id, removedName: participantName };
   });
}

export async function deleteAdminChallenge(
   challengeId: string,
   actor: { id: string; username: string }
) {
   const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: { teams: true },
   });

   if (!challenge) {
      throw new Error("Challenge not found.");
   }

   const now = new Date();

   return prisma.$transaction(async (tx) => {
      // 1. Soft-delete active teams for this challenge
      await tx.team.updateMany({
         where: { challengeId, isDeleted: false },
         data: {
            isDeleted: true,
            deletionTime: now,
         },
      });

      // 2. Soft-delete challenge-linked tasks
      await tx.task.updateMany({
         where: { challengeId, isDeleted: false },
         data: {
            isDeleted: true,
            deletionTime: now,
         },
      });

      // 3. Record audit log for soft challenge deletion
      await recordAuditEvent({
         actorId: actor.id,
         actorUsername: actor.username,
         actionType: "CHALLENGE_DELETED",
         targetEntityId: challengeId,
         targetEntityType: "CHALLENGE",
         targetEntityName: challenge.title,
         challengeId,
         previousValue: {
            title: challenge.title,
            status: calculateChallengeStatus(challenge),
            isDeleted: false,
         },
         newValue: {
            isDeleted: true,
            deletionTime: now,
         },
         auditReason: `Host deleted challenge "${challenge.title}"`,
      });

      // 4. Soft-delete the challenge
      const deleted = await tx.challenge.update({
         where: { id: challengeId },
         data: {
            isDeleted: true,
            deletionTime: now,
         },
      });

      return deleted;
   });
}
