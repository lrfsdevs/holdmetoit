"use client";

import React from "react";
import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
   getSickModeTooltipText,
   isSickModeAutoExpired,
} from "../domain/sick-mode";
import type { SickStatusBadgeProps } from "../domain/sick-mode.types";

/**
 * Empathetic Sick Mode status badge visible across Leaderboard, Matchup cards, Cockpit, Profile, and Admin Directory.
 */
export function SickStatusBadge({
   isSick = false,
   activatedAt,
   note,
   variant = "compact",
   className,
   showTooltip = true,
}: SickStatusBadgeProps) {
   // If not sick, or if 7-day auto-expiry threshold is reached, do not render
   if (!isSick) return null;
   if (isSickModeAutoExpired({ isSick, activatedAt })) return null;

   const tooltipText = getSickModeTooltipText({
      activatedAt,
      note,
   });

   const sizeStyles = {
      compact: "text-label px-1.5 py-0.5 gap-1 font-semibold",
      default: "text-xs px-2 py-0.5 gap-1.5 font-semibold",
      prominent: "text-sm px-3 py-1 gap-2 font-bold",
   }[variant];

   const badgeContent = (
      <span
         role="status"
         aria-label={tooltipText.replace(/\n/g, " ")}
         title={!showTooltip ? tooltipText : undefined}
         data-testid="sick-status-badge"
         className={cn(
            "inline-flex items-center rounded-full shrink-0 select-none",
            "bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm",
            "transition-colors",
            sizeStyles,
            className
         )}
      >
         <span aria-hidden="true" className="shrink-0 text-xs">
            🤒
         </span>
         <span className="truncate">Resting</span>
      </span>
   );

   if (!showTooltip) {
      return badgeContent;
   }

   return (
      <TooltipProvider delayDuration={150}>
         <Tooltip>
            <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
            <TooltipContent
               side="top"
               align="center"
               className="max-w-xs text-xs whitespace-pre-line text-amber-100 bg-surface-page/95 border-amber-500/40 p-2.5 shadow-xl backdrop-blur-md"
            >
               <p className="font-semibold text-amber-300 flex items-center gap-1.5 mb-1">
                  <span>🩹</span>
                  <span>Resting (Under the Weather)</span>
               </p>
               <p className="text-text-secondary leading-relaxed">
                  {tooltipText}
               </p>
            </TooltipContent>
         </Tooltip>
      </TooltipProvider>
   );
}
