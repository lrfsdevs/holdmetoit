"use client";

import React from "react";
import { Shield, Medal, Gem, Flame, Crown, Trophy } from "lucide-react";
import { getRankForTrophies, TrophyRankRole } from "../domain/trophy-rank";

interface TrophyRoleBadgeProps {
   trophies?: number;
   role?: TrophyRankRole;
   size?: "sm" | "md" | "lg";
   showTrophies?: boolean;
   className?: string;
}

export function TrophyRoleBadge({
   trophies = 0,
   role,
   size = "md",
   showTrophies = true,
   className = "",
}: TrophyRoleBadgeProps) {
   const rankCalc = getRankForTrophies(trophies);
   const activeRole = role || rankCalc.role;
   const tier = rankCalc.tierConfig;

   const getIcon = () => {
      const iconProps = {
         className:
            size === "sm"
               ? "h-3 w-3"
               : size === "lg"
                 ? "h-4 w-4"
                 : "h-3.5 w-3.5",
      };

      switch (activeRole) {
         case "Champion":
            return (
               <Trophy
                  {...iconProps}
                  className={`${iconProps.className} text-yellow-400`}
               />
            );
         case "Grandmaster":
            return (
               <Crown
                  {...iconProps}
                  className={`${iconProps.className} text-pink-400`}
               />
            );
         case "Master":
            return (
               <Flame
                  {...iconProps}
                  className={`${iconProps.className} text-purple-400`}
               />
            );
         case "Diamond":
            return (
               <Gem
                  {...iconProps}
                  className={`${iconProps.className} text-sky-400`}
               />
            );
         case "Platinum":
            return (
               <Medal
                  {...iconProps}
                  className={`${iconProps.className} text-teal-400`}
               />
            );
         case "Gold":
            return (
               <Medal
                  {...iconProps}
                  className={`${iconProps.className} text-amber-400`}
               />
            );
         case "Silver":
            return (
               <Shield
                  {...iconProps}
                  className={`${iconProps.className} text-slate-300`}
               />
            );
         case "Bronze":
            return (
               <Shield
                  {...iconProps}
                  className={`${iconProps.className} text-amber-600`}
               />
            );
         case "Recruit":
         default:
            return (
               <Shield
                  {...iconProps}
                  className={`${iconProps.className} text-zinc-400`}
               />
            );
      }
   };

   // Size styles
   const sizeStyles = {
      sm: "text-label px-2 py-0.5 gap-1 font-semibold",
      md: "text-xs px-2.5 py-1 gap-1.5 font-semibold",
      lg: "text-sm px-3.5 py-1.5 gap-2 font-bold",
   };

   return (
      <span
         data-testid="trophy-role-badge"
         className={`inline-flex items-center rounded-full border shadow-sm backdrop-blur-md transition-all duration-200 select-none ${tier.borderColor} ${tier.bgColor} ${tier.textColor} ${sizeStyles[size]} ${className}`}
         title={`${activeRole} Rank • ${trophies.toLocaleString()} Trophies`}
      >
         <span className="shrink-0">{getIcon()}</span>
         <span className="uppercase tracking-wider font-display">
            {activeRole}
         </span>
         {showTrophies && (
            <span className="opacity-90 font-mono font-medium pl-0.5">
               🏆 {trophies.toLocaleString()}
            </span>
         )}
      </span>
   );
}
