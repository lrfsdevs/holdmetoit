export type TrophyRankRole =
   | "Recruit"
   | "Bronze"
   | "Silver"
   | "Gold"
   | "Platinum"
   | "Diamond"
   | "Master"
   | "Grandmaster"
   | "Champion";

export interface TrophyRankTierConfig {
   role: TrophyRankRole;
   minTrophies: number;
   maxTrophies: number; // inclusive upper bound or Infinity for Champion
   badgeColor: string;
   borderColor: string;
   bgColor: string;
   textColor: string;
   accentColor: string;
   iconName: string;
}

export interface TrophyRankCalculation {
   role: TrophyRankRole;
   trophies: number;
   minTrophies: number;
   maxTrophies: number;
   nextRole: TrophyRankRole | null;
   nextThreshold: number | null;
   trophiesToNext: number;
   progressPercentage: number;
   isMaxRank: boolean;
   tierConfig: TrophyRankTierConfig;
}

export type TrophySettlementOutcome = "WIN" | "LOSS" | "DRAW" | "CANCELLED";

export interface TrophySettlementConfig {
   winBase: number;
   lossBase: number;
   floor: number;
}

export interface TrophyApplicationResult {
   previousBalance: number;
   balanceAfter: number;
   requestedDelta: number;
   effectiveDelta: number;
}

export interface RankChangeEvaluation {
   changed: boolean;
   type: "PROMOTED" | "DEMOTED" | "NONE";
   previousRole: TrophyRankRole;
   newRole: TrophyRankRole;
   previousTrophies: number;
   newTrophies: number;
}
