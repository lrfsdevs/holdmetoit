import { Prisma, type Team } from "@prisma/client";

import { prisma } from "@/core/db";
import { recordAuditEvent } from "@/features/audit/data/audit-log.repository";
import { calculateChallengeStatus } from "@/features/challenges/domain/challenge-lifecycle";
import {
   canEditDuoTeamIdentity,
   DuoTeamIdentityError,
   validateDuoTeamEmoji,
   validateDuoTeamName,
} from "@/features/challenges/domain/duo-team-identity";

export interface UpdateDuoTeamIdentityParams {
   challengeId: string;
   userId: string;
   name: string;
   /** Send null to clear the icon. */
   iconEmoji: string | null;
   actor: { username: string; displayName: string | null };
}

/**
 * Updates the caller's duo team name and emoji for a DUOS challenge
 * (FEAT-CHAL-06). Authorization is membership-based: any enrolled,
 * non-withdrawn member may edit until the host locks results.
 */
export async function updateDuoTeamIdentity({
   challengeId,
   userId,
   name,
   iconEmoji,
   actor,
}: UpdateDuoTeamIdentityParams): Promise<Team> {
   const nameValidation = validateDuoTeamName(name);
   if (!nameValidation.ok) {
      throw new DuoTeamIdentityError(
         nameValidation.code,
         nameValidation.message
      );
   }
   const normalizedName = nameValidation.name;

   const emojiValidation = validateDuoTeamEmoji(iconEmoji);
   if (!emojiValidation.ok) {
      throw new DuoTeamIdentityError(
         emojiValidation.code,
         emojiValidation.message
      );
   }
   const normalizedEmoji = emojiValidation.emoji;

   const [challenge, participant] = await Promise.all([
      prisma.challenge.findUnique({ where: { id: challengeId } }),
      prisma.challengeParticipant.findUnique({
         where: { challengeId_userId: { challengeId, userId } },
         select: { id: true, teamId: true, isWithdrawn: true },
      }),
   ]);

   if (!challenge || challenge.isDeleted) {
      throw new DuoTeamIdentityError(
         "NOT_IN_TEAM",
         "Challenge not found or you are not enrolled."
      );
   }

   if (challenge.format !== "DUOS") {
      throw new DuoTeamIdentityError(
         "INVALID_FORMAT",
         "Only duo team identities can be changed by participants."
      );
   }

   const status = calculateChallengeStatus(challenge);
   if (status === "COMPLETED") {
      throw new DuoTeamIdentityError(
         "CHALLENGE_COMPLETED",
         "This challenge has already completed."
      );
   }

   if (
      !canEditDuoTeamIdentity({
         status,
         resultsLockedAt: challenge.resultsLockedAt,
      })
   ) {
      throw new DuoTeamIdentityError(
         "RESULTS_LOCKED",
         "Duo identities are locked after results are finalized."
      );
   }

   if (!participant || participant.isWithdrawn || !participant.teamId) {
      throw new DuoTeamIdentityError(
         "NOT_IN_TEAM",
         "You are not assigned to a duo team in this challenge."
      );
   }

   const team = await prisma.team.findUnique({
      where: { id: participant.teamId },
   });

   if (!team || team.isDeleted || team.challengeId !== challengeId) {
      throw new DuoTeamIdentityError(
         "NOT_IN_TEAM",
         "Your duo team could not be found."
      );
   }

   const nameChanged = team.name !== normalizedName;
   const emojiChanged = (team.iconEmoji ?? null) !== normalizedEmoji;

   if (!nameChanged && !emojiChanged) {
      return team;
   }

   if (nameChanged) {
      const duplicate = await prisma.team.findFirst({
         where: {
            challengeId,
            id: { not: team.id },
            isDeleted: false,
            name: { equals: normalizedName, mode: "insensitive" },
         },
         select: { id: true },
      });

      if (duplicate) {
         throw new DuoTeamIdentityError(
            "DUPLICATE_NAME",
            "Another duo in this challenge already uses that name."
         );
      }
   }

   let updatedTeam: Team;
   try {
      updatedTeam = await prisma.team.update({
         where: { id: team.id },
         data: { name: normalizedName, iconEmoji: normalizedEmoji },
      });
   } catch (error) {
      if (
         error instanceof Prisma.PrismaClientKnownRequestError &&
         error.code === "P2002"
      ) {
         throw new DuoTeamIdentityError(
            "DUPLICATE_NAME",
            "Another duo in this challenge already uses that name."
         );
      }
      throw error;
   }

   const changedFields: string[] = [];
   if (nameChanged) changedFields.push("name");
   if (emojiChanged) changedFields.push("emoji");

   await recordAuditEvent({
      actorId: userId,
      actorUsername: actor.username,
      actorDisplayName: actor.displayName,
      actionType: "HOUSE_IDENTITY_UPDATED",
      targetEntityId: team.id,
      targetEntityType: "TEAM",
      targetEntityName: normalizedName,
      challengeId,
      previousValue: { name: team.name, iconEmoji: team.iconEmoji ?? null },
      newValue: { name: normalizedName, iconEmoji: normalizedEmoji },
      auditReason: `${actor.displayName ?? actor.username} updated their duo team ${changedFields.join(" and ")}`,
   });

   return updatedTeam;
}
