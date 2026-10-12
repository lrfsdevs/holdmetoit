import { prisma } from "@/core/db";
import { getChallengeScoreboard } from "@/features/leaderboard/data/leaderboard-data";
import {
   calculateParticipantDailyTimeline,
   calculateParticipantSummaryStats,
   calculateParticipantTeamStats,
   calculateParticipantAccountability,
} from "../domain/participant-stats";
import type { ParticipantStatsViewModel } from "../domain/participant-stats.types";

export interface GetChallengeParticipantStatsOptions {
   currentUserId?: string;
   isAdmin?: boolean;
}

export async function getChallengeParticipantStats(
   challengeId: string,
   participantId: string,
   options: GetChallengeParticipantStatsOptions = {}
): Promise<ParticipantStatsViewModel | null> {
   const { currentUserId, isAdmin = false } = options;

   // 1. Fetch participant record with relations, strictly scoped to challengeId
   const participant = await prisma.challengeParticipant.findUnique({
      where: { id: participantId },
      include: {
         user: {
            select: {
               id: true,
               displayName: true,
               username: true,
               name: true,
               image: true,
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
         dailyStudyLogsV2: {
            orderBy: { logDate: "asc" },
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
      },
   });

   // 2. Strict Cross-Challenge Isolation: reject if participant doesn't belong to challengeId
   if (!participant || participant.challengeId !== challengeId) {
      return null;
   }

   // 3. Fetch authoritative scoreboard to reuse exact ranking, tie-breaking, and team totals
   const scoreboard = await getChallengeScoreboard(challengeId, currentUserId);
   if (!scoreboard) {
      return null;
   }

   const standing = scoreboard.standings.find(
      (s) => s.participantId === participantId
   );

   const rank = standing?.rank ?? 1;
   const totalParticipants = scoreboard.standings.length;
   const paceStatus = standing?.paceStatus ?? "on-track";
   const paceLabel = standing?.paceLabel ?? "On Track";
   const todayLoggedSeconds = standing?.todayLoggedSeconds ?? 0;
   const totalLoggedSeconds = standing?.totalLoggedSeconds ?? 0;

   // 4. Calculate chronological daily timeline
   const logs = participant.dailyStudyLogsV2 ?? [];
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
   const isEffectiveAdmin = isAdmin || isHost;
   const isOwner = Boolean(
      currentUserId && currentUserId === participant.userId
   );

   const displayName =
      participant.user.displayName ||
      participant.user.name ||
      participant.user.username ||
      "Scholar";

   return {
      profile: {
         participantId: participant.id,
         userId: participant.userId,
         displayName,
         username: participant.user.username,
         image: participant.user.image,
         teamId: participant.team?.id ?? null,
         teamName: participant.team?.name ?? null,
         teamColor: participant.team?.color ?? null,
         teamIcon: participant.team?.iconEmoji ?? null,
         rank,
         totalParticipants,
         paceStatus,
         paceLabel,
         challengeId: participant.challenge.id,
         challengeTitle: participant.challenge.title,
         challengeFormat: participant.challenge.format,
         challengeStatus: scoreboard.status,
      },
      summary,
      dailyHistory,
      teamStats,
      accountability,
      viewer: {
         isAdmin: isEffectiveAdmin,
         isOwner,
      },
   };
}
