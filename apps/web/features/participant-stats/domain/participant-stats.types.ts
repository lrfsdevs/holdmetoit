import type { ParticipantPaceStatus } from "@/features/leaderboard/domain/leaderboard.types";

export interface ParticipantProfileHeader {
   participantId: string;
   userId: string;
   displayName: string;
   username: string | null;
   image: string | null;
   teamId: string | null;
   teamName: string | null;
   teamColor: string | null;
   teamIcon: string | null;
   rank: number;
   totalParticipants: number;
   paceStatus: ParticipantPaceStatus;
   paceLabel: string;
   challengeId: string;
   challengeTitle: string;
   challengeFormat: "TEAM_VS_TEAM" | "DUOS" | "SOLOS";
   challengeStatus: "UPCOMING" | "ACTIVE" | "COMPLETED";
   trophies?: number;
   role?: string;
   startDate?: string;
   endDate?: string;
   participantStatus?: "ACTIVE" | "COMPLETED" | "WITHDRAWN";
}

export interface ParticipantSummaryStats {
   totalLoggedSeconds: number;
   totalLoggedClock: string;
   totalLoggedHuman: string;
   todayLoggedSeconds: number;
   todayLoggedClock: string;
   todayLoggedHuman: string;
   targetSeconds: number;
   targetClock: string;
   targetHuman: string;
   completionPercentage: number;
   rank: number;
   totalParticipants: number;
   remainingSeconds: number;
   remainingClock: string;
   remainingHuman: string;
   isTargetMet: boolean;
   excessSeconds: number;
   excessClock: string;
   excessHuman: string;
   paceStatus: ParticipantPaceStatus;
   paceLabel: string;
   todayIsLeave: boolean;
   leavesCount: number;
}

export interface ParticipantDailyHistoryEntry {
   dayNumber: number;
   dateKey: string;
   dateFormatted: string;
   weekday: string;
   label: string;
   durationSeconds: number;
   durationClock: string;
   durationHuman: string;
   cumulativeSeconds: number;
   cumulativeClock: string;
   cumulativeHuman: string;
   isToday: boolean;
   isYesterday: boolean;
   isFuture: boolean;
   isPast: boolean;
   isOverride: boolean;
   isLeave: boolean;
}

export interface ParticipantTeamStats {
   teamId: string;
   teamName: string;
   teamColor: string | null;
   teamIcon: string | null;
   teamRank: number;
   participantTeamRank: number;
   teamTotalLoggedSeconds: number;
   teamTotalLoggedClock: string;
   participantContributionPercentage: number;
   companionCount: number;
}

export interface ParticipantAccountabilityStats {
   deficitSeconds: number;
   deficitClock: string;
   deficitHuman: string;
   requiredDailyPaceSeconds: number;
   requiredDailyPaceClock: string;
   requiredDailyPaceHuman: string;
   daysRemaining: number;
   isPunished: boolean;
   isPardoned: boolean;
   pardonReason: string | null;
   statusBadge: "On-Track" | "Catch-Up" | "Punished" | "Excused" | "Completed";
}

export interface ParticipantTrophyHistoryItem {
   id: string;
   amount: number;
   balanceAfter: number;
   type: string;
   description: string | null;
   createdAt: string;
}

export interface ParticipantCompetitiveStats {
   trophies: number;
   role: string;
   wins: number;
   losses: number;
   winRate: number;
   coins: number;
   totalStudySeconds: number;
   yptStatus: "VERIFIED" | "PENDING" | "REJECTED" | "NOT_CONNECTED";
   yptId: string | null;
   trophyHistory: ParticipantTrophyHistoryItem[];
}

export interface ParticipantStatsViewModel {
   profile: ParticipantProfileHeader;
   summary: ParticipantSummaryStats;
   dailyHistory: ParticipantDailyHistoryEntry[];
   teamStats: ParticipantTeamStats | null;
   accountability: ParticipantAccountabilityStats;
   competitive?: ParticipantCompetitiveStats | null;
   viewer: {
      isAdmin: boolean;
      isOwner: boolean;
   };
   isFallback?: boolean;
}
