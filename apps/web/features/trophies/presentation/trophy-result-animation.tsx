"use client";

import React, { useState, useEffect } from "react";
import { Trophy, ArrowUp, ArrowDown, Sparkles, Crown } from "lucide-react";
import { TrophyRankRole } from "../domain/trophy-rank";

interface TrophyResultAnimationProps {
   outcome: "WIN" | "LOSS" | "DRAW";
   delta: number;
   previousBalance: number;
   newBalance: number;
   promotedRank?: TrophyRankRole | null;
   onClose?: () => void;
}

export function TrophyResultAnimation({
   outcome,
   delta,
   previousBalance,
   newBalance,
   promotedRank,
   onClose,
}: TrophyResultAnimationProps) {
   const [displayBalance, setDisplayBalance] = useState(previousBalance);
   const isWin = outcome === "WIN";
   const isLoss = outcome === "LOSS";

   useEffect(() => {
      // Respect prefers-reduced-motion
      const prefersReducedMotion =
         typeof window !== "undefined" &&
         window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReducedMotion) {
         setDisplayBalance(newBalance);
         return;
      }

      // Smooth count-up / count-down
      const duration = 1200; // ms
      const steps = 30;
      const stepDuration = duration / steps;
      const difference = newBalance - previousBalance;

      let currentStep = 0;
      const interval = setInterval(() => {
         currentStep++;
         const progress = currentStep / steps;
         const currentVal = Math.round(previousBalance + difference * progress);
         setDisplayBalance(currentVal);

         if (currentStep >= steps) {
            clearInterval(interval);
            setDisplayBalance(newBalance);
         }
      }, stepDuration);

      return () => clearInterval(interval);
   }, [previousBalance, newBalance]);

   return (
      <div
         className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300"
         role="dialog"
         aria-modal="true"
      >
         <div className="relative w-full max-w-sm rounded-3xl border border-obsidian-borderHighlight bg-obsidian-card p-6 text-center shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Ambient Background Glow */}
            <div
               className={`absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full blur-3xl opacity-30 ${
                  promotedRank
                     ? "bg-purple-500"
                     : isWin
                       ? "bg-emerald-500"
                       : "bg-rose-500"
               }`}
            />

            {/* Icon */}
            <div className="relative mx-auto mb-4">
               <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl mx-auto border shadow-xl ${
                     promotedRank
                        ? "bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-[0_0_25px_rgba(168,85,247,0.4)]"
                        : isWin
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.4)]"
                          : "bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-[0_0_25px_rgba(244,63,94,0.4)]"
                  }`}
               >
                  {promotedRank ? (
                     <Crown className="h-8 w-8 animate-bounce" />
                  ) : isWin ? (
                     <Trophy className="h-8 w-8 animate-pulse text-yellow-400" />
                  ) : (
                     <Trophy className="h-8 w-8 text-rose-400" />
                  )}
               </div>
            </div>

            {/* Result Header */}
            <h3
               className={`text-xl font-black font-display tracking-wider uppercase ${
                  promotedRank
                     ? "text-purple-300"
                     : isWin
                       ? "text-emerald-400"
                       : "text-rose-400"
               }`}
            >
               {promotedRank ? "Rank Up!" : isWin ? "Victory" : "Defeat"}
            </h3>

            {promotedRank && (
               <div className="mt-2 text-sm font-bold text-yellow-400 tracking-wide">
                  ⭐ REACHED {promotedRank.toUpperCase()} ⭐
               </div>
            )}

            {/* Delta Banner */}
            <div className="my-4 py-2 px-4 rounded-xl bg-obsidian-elevated border border-obsidian-borderSubtle inline-flex items-center gap-2">
               {isWin ? (
                  <ArrowUp className="h-5 w-5 text-emerald-400" />
               ) : (
                  <ArrowDown className="h-5 w-5 text-rose-400" />
               )}
               <span
                  className={`font-mono text-2xl font-black ${
                     isWin ? "text-emerald-400" : "text-rose-400"
                  }`}
               >
                  {delta > 0 ? `+${delta}` : delta} 🏆
               </span>
            </div>

            {/* Transition: previous -> new */}
            <div className="text-xs text-obsidian-textDim font-mono">
               <span>{previousBalance.toLocaleString()}</span>
               <span className="mx-2 text-obsidian-text">→</span>
               <span className="font-bold text-white text-sm">
                  {displayBalance.toLocaleString()}
               </span>
            </div>

            {onClose && (
               <button
                  type="button"
                  onClick={onClose}
                  className="mt-6 w-full rounded-xl bg-obsidian-elevated border border-obsidian-borderHighlight py-2.5 text-xs font-semibold text-white hover:bg-obsidian-card transition-colors"
               >
                  Continue
               </button>
            )}
         </div>
      </div>
   );
}
