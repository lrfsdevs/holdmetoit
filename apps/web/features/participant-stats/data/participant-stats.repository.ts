import { prisma } from "@/core/db";
import { getChallengeScoreboard } from "@/features/leaderboard/data/leaderboard-data";
import {
   calculateParticipantDailyTimeline,
   calculateParticipantSummaryStats,
   calculateParticipantTeamStats,
   calculateParticipantAccountability,
} from "../domain/participant-stats";
import type { ParticipantStatsViewModel } from "../domain/participant-stats.types";
import {
   getUserCompetitiveStats,
   getTrophyHistory,
} from "@/features/trophies/data/trophy.repository";
import { getRankForTrophies } from "@/features/trophies/domain/trophy-rank";

export interface GetChallengeParticipantStatsOptions {
   currentUserId?: string;
   isAdmin?: boolean;
   /** True when the viewer is an admin/dev in global participant-preview mode. */
   isPreviewActive?: boolean;
}

export async function getChallengeParticipantStats(
   challengeId: string,
   participantId: string,
   options: GetChallengeParticipantStatsOptions = {}
): Promise<ParticipantStatsViewModel | null> {
   const { currentUserId, isAdmin = false, isPreviewActive = false } = options;

   // 1. Fetch participant record with relations, strictly scoped to challengeId
   const includeRelations = {
      user: {
         select: {
            id: true,
            displayName: true,
            username: true,
            name: true,
            image: true,
            trophyBalance: true,
         },
      },
      team: {
         select: {
            id: true,
            name: true,
            color: true,
            iconEmoji: true,
         },
      },
      challenge: {
         select: {
            id: true,
            title: true,
            format: true,
            startAt: true,
            endAt: true,
            hostId: true,
         },
      },
      dailyStudyLogs: {
         orderBy: { logDate: "asc" as const },
         select: {
            id: true,
            logDate: true,
            durationSeconds: true,
            isOverride: true,
            isLeave: true,
         },
      },
      punishmentRecords: {
         select: {
            isPardoned: true,
            pardonReason: true,
         },
         take: 1,
      },
   };

   let participant = await prisma.challengeParticipant.findUnique({
      where: { id: participantId, isWithdrawn: false },
      include: includeRelations,
   });

   // 1b. If not found by participantId, check if participantId was a userId in this challenge (or 'me' alias)
   if (!participant) {
      const lookupUserId =
         participantId === "me" && currentUserId
            ? currentUserId
            : participantId;
      participant = await prisma.challengeParticipant.findFirst({
         where: {
            userId: lookupUserId,
            challengeId,
            isWithdrawn: false,
            challenge: { isDeleted: false },
         },
         include: includeRelations,
      });
   }

   // 2. Strict Cross-Challenge Isolation: reject if participant belongs to another challenge
   if (participant && participant.challengeId !== challengeId) {
      return null;
   }

   // 3. Fallback Profile Resolution: if not enrolled in challenge, check if user exists
   if (!participant) {
      const targetUserId =
         participantId === "me" && currentUserId
            ? currentUserId
            : participantId;

      const [user, challenge, scoreboard] = await Promise.all([
         prisma.user.findUnique({
            where: { id: targetUserId },
            select: {
               id: true,
               displayName: true,
               username: true,
               name: true,
               image: true,
               trophyBalance: true,
            },
         }),
         prisma.challenge.findUnique({
            where: { id: challengeId, isDeleted: false },
            select: {
               id: true,
               title: true,
               format: true,
               startAt: true,
               endAt: true,
               hostId: true,
            },
         }),
         getChallengeScoreboard(challengeId, currentUserId),
      ]);

      if (!user || !challenge || !scoreboard) {
         return null;
      }

      const displayName =
         user.displayName || user.name || user.username || "Scholar";
      const totalParticipants = scoreboard.standings.length;
      const isHost = Boolean(
         currentUserId && challenge.hostId === currentUserId
      );
      const isEffectiveAdmin = isAdmin || (isHost && !isPreviewActive);
      const isOwner = Boolean(currentUserId && currentUserId === user.id);

      return {
         isFallback: true,
         profile: {
            participantId: `fallback-${user.id}`,
            userId: user.id,
            displayName,
            username: user.username,
            image: user.image,
            teamId: null,
            teamName: null,
            teamColor: null,
            teamIcon: null,
            rank: 0,
            totalParticipants,
            paceStatus: "on-track",
            paceLabel: "Not Enrolled",
            challengeId: challenge.id,
            challengeTitle: challenge.title,
            challengeFormat: challenge.format,
            challengeStatus: scoreboard.status,
         },
         summary: {
            totalLoggedSeconds: 0,
            totalLoggedClock: "00:00:00",
            totalLoggedHuman: "0s",
            todayLoggedSeconds: 0,
            todayLoggedClock: "00:00:00",
            todayLoggedHuman: "0s",
            targetSeconds: 0,
            targetClock: "00:00:00",
            targetHuman: "0s",
            completionPercentage: 0,
            rank: 0,
            totalParticipants,
            remainingSeconds: 0,
            remainingClock: "00:00:00",
            remainingHuman: "0s",
            isTargetMet: false,
            excessSeconds: 0,
            excessClock: "00:00:00",
            excessHuman: "0s",
            paceStatus: "on-track",
            paceLabel: "Not Enrolled",
            todayIsLeave: false,
            leavesCount: 0,
         },
         dailyHistory: calculateParticipantDailyTimeline(
            challenge.startAt,
            scoreboard.totalDays,
            [],
            new Date()
         ),
         teamStats: null,
         accountability: {
            deficitSeconds: 0,
            deficitClock: "00:00:00",
            deficitHuman: "0s",
            requiredDailyPaceSeconds: 0,
            requiredDailyPaceClock: "00:00:00",
            requiredDailyPaceHuman: "0s",
            daysRemaining: scoreboard.daysRemaining,
            isPunished: false,
            isPardoned: false,
            pardonReason: null,
            statusBadge:
               scoreboard.status === "COMPLETED" ? "Completed" : "On-Track",
         },
         viewer: {
            isAdmin: isEffectiveAdmin,
            isOwner,
         },
      };
   }

   // 4. Fetch authoritative scoreboard to reuse exact ranking, tie-breaking, and team totals
   const scoreboard = await getChallengeScoreboard(challengeId, currentUserId);
   if (!scoreboard) {
      return null;
   }

   const standing = scoreboard.standings.find(
      (s) => s.participantId === participant.id
   );

   const rank = standing?.rank ?? 1;
   const totalParticipants = scoreboard.standings.length;
   const paceStatus = standing?.paceStatus ?? "on-track";
   const paceLabel = standing?.paceLabel ?? "On Track";
   const todayLoggedSeconds = standing?.todayLoggedSeconds ?? 0;
   const totalLoggedSeconds = standing?.totalLoggedSeconds ?? 0;

   // 4. Calculate chronological daily timeline
   const logs = participant.dailyStudyLogs ?? [];
   const dailyHistory = calculateParticipantDailyTimeline(
      participant.challenge.startAt,
      scoreboard.totalDays,
      logs,
      new Date()
   );

   const leavesCount = dailyHistory.filter((d) => d.isLeave).length;
   const todayDay = dailyHistory.find((d) => d.isToday);
   const todayIsLeave = Boolean(todayDay?.isLeave);

   // 5. Summary statistics
   const summary = calculateParticipantSummaryStats({
      totalLoggedSeconds,
      todayLoggedSeconds,
      targetSeconds: participant.targetSeconds,
      rank,
      totalParticipants,
      paceStatus,
      paceLabel,
      todayIsLeave,
      leavesCount,
   });

   // 6. Team metrics (only for team-based challenges)
   let teamStats = null;
   if (participant.challenge.format !== "SOLOS" && participant.team) {
      const scoreboardTeam = scoreboard.teams.find(
         (t) => t.id === participant.teamId
      );
      const teamRankIndex = scoreboard.teams.findIndex(
         (t) => t.id === participant.teamId
      );

      // Rank of this participant among their team/house members
      const teamStandings = scoreboard.standings.filter(
         (s) => s.teamId === participant.teamId
      );
      const participantTeamRankIndex = teamStandings.findIndex(
         (s) => s.participantId === participant.id
      );
      const participantTeamRank =
         participantTeamRankIndex >= 0 ? participantTeamRankIndex + 1 : 1;
      const actualCompanionCount =
         teamStandings.length > 0
            ? teamStandings.length
            : (scoreboardTeam?.companionCount ?? 1);

      teamStats = calculateParticipantTeamStats({
         teamId: participant.team.id,
         teamName: participant.team.name,
         teamColor: participant.team.color,
         teamIcon: participant.team.iconEmoji,
         teamRank: teamRankIndex >= 0 ? teamRankIndex + 1 : 1,
         participantTeamRank,
         teamTotalLoggedSeconds: scoreboardTeam?.totalLoggedSeconds ?? 0,
         participantTotalLoggedSeconds: totalLoggedSeconds,
         companionCount: actualCompanionCount,
      });
   }

   // 7. Accountability metrics
   const accountability = calculateParticipantAccountability({
      targetSeconds: participant.targetSeconds,
      totalLoggedSeconds,
      daysRemaining: scoreboard.daysRemaining,
      isCompleted: scoreboard.status === "COMPLETED",
      status: participant.status,
      punishmentRecord: participant.punishmentRecords[0] ?? null,
   });

   // 8. Viewer permissions
   const isHost = Boolean(
      currentUserId && participant.challenge.hostId === currentUserId
   );
   const isEffectiveAdmin = isAdmin || (isHost && !isPreviewActive);
   const isOwner = Boolean(
      currentUserId && currentUserId === participant.userId
   );

   const displayName =
      participant.user.displayName ||
      participant.user.name ||
      participant.user.username ||
      "Scholar";

   const userTrophies = participant.user.trophyBalance ?? 0;
   const rankCalc = getRankForTrophies(userTrophies);
   let competitive = null;

   try {
      const [compStats, historyResult] = await Promise.all([
         getUserCompetitiveStats(participant.userId),
         getTrophyHistory(participant.userId, { limit: 10 }),
      ]);

      if (compStats) {
         competitive = {
            trophies: compStats.trophies,
            role: compStats.rank.role,
            wins: compStats.wins,
            losses: compStats.losses,
            winRate: compStats.winRate,
            coins: compStats.coins,
            totalStudySeconds: compStats.totalStudySeconds,
            yptStatus: compStats.yptStatus,
            yptId: compStats.yptId,
            trophyHistory: historyResult.transactions.map((h) => ({
               id: h.id,
               amount: h.amount,
               balanceAfter: h.balanceAfter,
               type: h.type,
               description: h.description,
               createdAt:
                  typeof h.createdAt === "string"
                     ? h.createdAt
                     : h.createdAt.toISOString(),
            })),
         };
      }
   } catch {
      competitive = null;
   }

   return {
      profile: {
         participantId: participant.id,
         userId: participant.userId,
         displayName,
         username: participant.user.username,
         image: participant.user.image,
         teamId: participant.team?.id ?? null,
         teamName:
            participant.team?.name ??
            (participant.challenge.format === "SOLOS" ? "Solo Scholar" : null),
         teamColor:
            participant.team?.color ??
            (participant.challenge.format === "SOLOS" ? "#3b82f6" : null),
         teamIcon:
            participant.team?.iconEmoji ??
            (participant.challenge.format === "SOLOS" ? "⚡" : null),
         rank,
         totalParticipants,
         paceStatus,
         paceLabel,
         challengeId: participant.challenge.id,
         challengeTitle: participant.challenge.title,
         challengeFormat: participant.challenge.format,
         challengeStatus: scoreboard.status,
         trophies: userTrophies,
         role: rankCalc.role,
      },
      summary,
      dailyHistory,
      teamStats,
      accountability,
      competitive,
      viewer: {
         isAdmin: isEffectiveAdmin,
         isOwner,
      },
   };
}
