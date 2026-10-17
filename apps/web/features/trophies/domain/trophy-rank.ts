import type {
   TrophyRankRole,
   TrophyRankTierConfig,
   TrophyRankCalculation,
   TrophySettlementOutcome,
   TrophySettlementConfig,
   TrophyApplicationResult,
   RankChangeEvaluation,
} from "./trophy-types";

export type {
   TrophyRankRole,
   TrophyRankTierConfig,
   TrophyRankCalculation,
   TrophySettlementOutcome,
   TrophySettlementConfig,
   TrophyApplicationResult,
   RankChangeEvaluation,
};

export const DEFAULT_TROPHY_CONFIG: TrophySettlementConfig = {
   winBase: 25,
   lossBase: 15,
   floor: 0,
};

export const TROPHY_TIERS: TrophyRankTierConfig[] = [
   {
      role: "Recruit",
      minTrophies: 0,
      maxTrophies: 99,
      badgeColor: "#71717a",
      borderColor: "border-zinc-500/30",
      bgColor: "bg-zinc-500/10",
      textColor: "text-zinc-300",
      accentColor: "#a1a1aa",
      iconName: "Shield",
   },
   {
      role: "Bronze",
      minTrophies: 100,
      maxTrophies: 249,
      badgeColor: "#cd7f32",
      borderColor: "border-amber-700/40",
      bgColor: "bg-amber-900/15",
      textColor: "text-amber-300",
      accentColor: "#d97706",
      iconName: "Shield",
   },
   {
      role: "Silver",
      minTrophies: 250,
      maxTrophies: 499,
      badgeColor: "#94a3b8",
      borderColor: "border-slate-400/40",
      bgColor: "bg-slate-400/10",
      textColor: "text-slate-200",
      accentColor: "#cbd5e1",
      iconName: "Shield",
   },
   {
      role: "Gold",
      minTrophies: 500,
      maxTrophies: 749,
      badgeColor: "#f59e0b",
      borderColor: "border-amber-500/40",
      bgColor: "bg-amber-500/10",
      textColor: "text-amber-400",
      accentColor: "#fbbf24",
      iconName: "Medal",
   },
   {
      role: "Platinum",
      minTrophies: 750,
      maxTrophies: 999,
      badgeColor: "#2dd4bf",
      borderColor: "border-teal-400/40",
      bgColor: "bg-teal-400/10",
      textColor: "text-teal-300",
      accentColor: "#5eead4",
      iconName: "Medal",
   },
   {
      role: "Diamond",
      minTrophies: 1000,
      maxTrophies: 1499,
      badgeColor: "#38bdf8",
      borderColor: "border-sky-400/40",
      bgColor: "bg-sky-400/15",
      textColor: "text-sky-300",
      accentColor: "#7dd3fc",
      iconName: "Gem",
   },
   {
      role: "Master",
      minTrophies: 1500,
      maxTrophies: 1999,
      badgeColor: "#a855f7",
      borderColor: "border-purple-500/40",
      bgColor: "bg-purple-500/15",
      textColor: "text-purple-300",
      accentColor: "#c084fc",
      iconName: "Flame",
   },
   {
      role: "Grandmaster",
      minTrophies: 2000,
      maxTrophies: 2499,
      badgeColor: "#ec4899",
      borderColor: "border-pink-500/40",
      bgColor: "bg-pink-500/15",
      textColor: "text-pink-300",
      accentColor: "#f472b6",
      iconName: "Crown",
   },
   {
      role: "Champion",
      minTrophies: 2500,
      maxTrophies: Infinity,
      badgeColor: "#eab308",
      borderColor: "border-yellow-400/50",
      bgColor: "bg-yellow-400/20",
      textColor: "text-yellow-300",
      accentColor: "#facc15",
      iconName: "Trophy",
   },
];

/**
 * Calculates current competitive rank, next role threshold, and progress percentage.
 * Clamps negative trophy inputs to floor 0.
 */
export function getRankForTrophies(trophies: number): TrophyRankCalculation {
   const safeTrophies = Math.max(0, Math.floor(trophies || 0));

   let activeIndex = 0;
   for (let i = 0; i < TROPHY_TIERS.length; i++) {
      if (safeTrophies >= TROPHY_TIERS[i].minTrophies) {
         activeIndex = i;
      } else {
         break;
      }
   }

   const tierConfig = TROPHY_TIERS[activeIndex];
   const isMaxRank = activeIndex === TROPHY_TIERS.length - 1;
   const nextTier = isMaxRank ? null : TROPHY_TIERS[activeIndex + 1];

   let progressPercentage = 100;
   let trophiesToNext = 0;
   let nextThreshold: number | null = null;

   if (nextTier) {
      const threshold = nextTier.minTrophies;
      nextThreshold = threshold;
      trophiesToNext = Math.max(0, threshold - safeTrophies);
      const span = threshold - tierConfig.minTrophies;
      const currentInSpan = safeTrophies - tierConfig.minTrophies;
      progressPercentage = Math.min(
         100,
         Math.max(0, Math.round((currentInSpan / span) * 100))
      );
   }

   return {
      role: tierConfig.role,
      trophies: safeTrophies,
      minTrophies: tierConfig.minTrophies,
      maxTrophies: tierConfig.maxTrophies,
      nextRole: nextTier ? nextTier.role : null,
      nextThreshold,
      trophiesToNext,
      progressPercentage,
      isMaxRank,
      tierConfig,
   };
}

/**
 * Computes trophy delta based on match outcome.
 */
export function calculateTrophyDelta(
   outcome: TrophySettlementOutcome,
   config: Partial<TrophySettlementConfig> = {}
): number {
   const effectiveConfig = { ...DEFAULT_TROPHY_CONFIG, ...config };

   switch (outcome) {
      case "WIN":
         return effectiveConfig.winBase;
      case "LOSS":
         return -effectiveConfig.lossBase;
      case "DRAW":
      case "CANCELLED":
      default:
         return 0;
   }
}

/**
 * Applies a trophy change to an existing balance with strict floor enforcement.
 * Trophies never become negative.
 */
export function applyTrophyChange(
   currentBalance: number,
   requestedDelta: number,
   floor: number = DEFAULT_TROPHY_CONFIG.floor
): TrophyApplicationResult {
   const previous = Math.max(floor, Math.floor(currentBalance || 0));
   const balanceAfter = Math.max(floor, previous + requestedDelta);
   const effectiveDelta = balanceAfter - previous;

   return {
      previousBalance: previous,
      balanceAfter,
      requestedDelta,
      effectiveDelta,
   };
}

/**
 * Evaluates whether a trophy delta resulted in a role promotion or demotion.
 */
export function detectRankChange(
   previousTrophies: number,
   newTrophies: number
): RankChangeEvaluation {
   const prevCalc = getRankForTrophies(previousTrophies);
   const newCalc = getRankForTrophies(newTrophies);

   const prevRole = prevCalc.role;
   const newRole = newCalc.role;

   if (prevRole === newRole) {
      return {
         changed: false,
         type: "NONE",
         previousRole: prevRole,
         newRole,
         previousTrophies,
         newTrophies,
      };
   }

   const prevIndex = TROPHY_TIERS.findIndex((t) => t.role === prevRole);
   const newIndex = TROPHY_TIERS.findIndex((t) => t.role === newRole);

   return {
      changed: true,
      type: newIndex > prevIndex ? "PROMOTED" : "DEMOTED",
      previousRole: prevRole,
      newRole,
      previousTrophies,
      newTrophies,
   };
}
