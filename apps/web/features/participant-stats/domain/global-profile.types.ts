import type { TrophyRankCalculation } from "@/features/trophies/domain/trophy-rank";

export interface GlobalCareerStats {
   lifetimeStudyHours: number;
   lifetimeStudySeconds: number;
   lifetimeStudyClock: string;
   lifetimeStudyHuman: string;
   totalActiveStudyDays: number;
   currentStreak: number;
   longestStreak: number;
   totalChallengesEntered: number;
   challengesCompleted: number;
   totalTasksCompleted: number;
   trophyTotal: number;
   trophyRank: string;
   trophyRankDetails?: TrophyRankCalculation;
   pokedexCount: number;
}

export interface ParticipatedChallengeItem {
   challengeId: string;
   participantId: string;
   title: string;
   mode: string;
   status: string;
   startDate: string;
   endDate: string;
   targetHours: number;
   loggedHours: number;
   trophyDelta: number;
}

export interface GlobalUserProfileIdentity {
   id: string;
   displayName: string;
   username: string | null;
   image: string | null;
   role: string;
   joinedAt: string;
   trophyBalance: number;
}

export interface GlobalUserProfile {
   user: GlobalUserProfileIdentity;
   careerStats: GlobalCareerStats;
   challengeHistory: ParticipatedChallengeItem[];
}
