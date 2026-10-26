export interface ScoreboardTeam {
   id: string;
   name: string;
   color: string | null;
   iconEmoji: string | null;
   mascotUrl: string | null;
   sortOrder: number;
   companionCount: number;
   totalLoggedSeconds: number;
   totalLoggedClock: string;
   targetSeconds: number;
   targetClock: string;
   targetHours: number;
   completionPercentage: number;
   isLeader: boolean;
   isDeleted?: boolean;
}

export interface ScoreboardMatchHeader {
   hasMatchup: boolean;
   teamA: ScoreboardTeam | null;
   teamB: ScoreboardTeam | null;
   leadMarginSeconds: number;
   leadMarginClock: string;
   leadMarginHuman: string;
   leaderTeamId: string | null;
   leaderSide: "a" | "b" | "tie";
   ratioPercentageA: number;
   ratioPercentageB: number;
}

export type ParticipantPaceStatus =
   "serene" | "on-track" | "catch-up" | "punished" | "excused";

export interface ScoreboardStandingEntry {
   rank: number;
   participantId: string;
   userId: string;
   displayName: string;
   username: string | null;
   image: string | null;
   teamId: string;
   teamName: string;
   teamColor: string | null;
   teamIcon: string | null;
   totalLoggedSeconds: number;
   totalLoggedClock: string;
   todayLoggedSeconds: number;
   todayLoggedClock: string;
   targetSeconds: number;
   targetClock: string;
   completionPercentage: number;
   weeklyTasksCompletedCount: number;
   weeklyTasksTotalCount: number;
   paceStatus: ParticipantPaceStatus;
   paceLabel: string;
   status?: string | null;
   deficitSeconds: number;
   dailyLogs?: Record<string, number>;
   trophies?: number;
}

export interface ChallengeScoreboardViewModel {
   id: string;
   title: string;
   description?: string | null;
   heroImageUrl: string | null;
   eventBannerUrl: string | null;
   punishmentPfpUrl: string | null;
   format: "TEAM_VS_TEAM" | "DUOS" | "SOLOS";
   status: "UPCOMING" | "ACTIVE" | "COMPLETED";
   isDeleted?: boolean;
   deletionTime?: string | null;
   resultsLockedAt?: string | null;
   startAt: string;
   endAt: string;
   rewardCoins?: number;
   isRewardSettled?: boolean;
   isBettingEnabled?: boolean;
   daysRemaining: number;
   totalDays: number;
   currentDayNumber: number;
   timeRemainingHuman: string;
   teams: ScoreboardTeam[];
   matchHeader: ScoreboardMatchHeader;
   standings: ScoreboardStandingEntry[];
   currentUser: {
      isLoggedIn: boolean;
      isEnrolled: boolean;
      participantId: string | null;
      /** Caller's duo/team id for the current challenge, if assigned. */
      teamId?: string | null;
      /** Caller's current team name, if assigned. */
      teamName?: string | null;
      /** Caller's current team emoji, if assigned. */
      teamIcon?: string | null;
      /** True when the caller may edit their DUOS name/emoji right now. */
      canEditDuoTeam?: boolean;
      isWrappedSeen: boolean;
      isFeedbackFilled: boolean;
   };
}
