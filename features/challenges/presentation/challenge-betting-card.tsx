"use client";

import React, { useState, useEffect } from "react";
import { CoinsIcon } from "@/features/economy/presentation/coins-icon";
import { ChallengeScoreboardViewModel } from "@/features/leaderboard/domain/leaderboard.types";
import {
   placeWagerAction,
   getUserChallengeWagersAction,
} from "@/features/wagers/api/wager.actions";
import {
   MIN_WAGER_STAKE,
   MAX_WAGER_STAKE,
} from "@/features/economy/domain/economy-settings";

interface ChallengeBettingCardProps {
   challenge: ChallengeScoreboardViewModel;
}

export function ChallengeBettingCard({ challenge }: ChallengeBettingCardProps) {
   const [selectedTeamId, setSelectedTeamId] = useState<string>(
      challenge.teams?.[0]?.id || ""
   );
   const [stake, setStake] = useState<number>(50);
   const [isLoading, setIsLoading] = useState(false);
   const [message, setMessage] = useState<{
      type: "success" | "error";
      text: string;
   } | null>(null);
   const [userWagers, setUserWagers] = useState<any[]>([]);

   const isUpcoming = challenge.status === "UPCOMING";
   const hasReward = (challenge.rewardCoins ?? 0) > 0;
   const isBettingEnabled = Boolean(challenge.isBettingEnabled);

   const loadUserWagers = async () => {
      if (!challenge.currentUser?.isLoggedIn) return;
      try {
         const res = await getUserChallengeWagersAction(challenge.id);
         if (res.ok) {
            setUserWagers(res.wagers);
         }
      } catch {
         // Silently handle
      }
   };

   useEffect(() => {
      loadUserWagers();
   }, [challenge.id, challenge.currentUser?.isLoggedIn]);

   if (!isBettingEnabled && !hasReward) {
      return null;
   }

   const handlePlaceBet = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!challenge.currentUser?.isLoggedIn) {
         setMessage({
            type: "error",
            text: "Please log in to place virtual-coin wagers.",
         });
         return;
      }

      if (!selectedTeamId) {
         setMessage({ type: "error", text: "Please select a team to back." });
         return;
      }

      setIsLoading(true);
      setMessage(null);

      try {
         const res = await placeWagerAction({
            challengeId: challenge.id,
            targetTeamId: selectedTeamId,
            stake,
         });

         if (res.ok) {
            setMessage({
               type: "success",
               text: `Wager accepted! ${stake} coins reserved.`,
            });
            await loadUserWagers();
         } else {
            setMessage({
               type: "error",
               text: res.message || "Failed to place wager.",
            });
         }
      } catch (err) {
         setMessage({
            type: "error",
            text: err instanceof Error ? err.message : "Network error.",
         });
      } finally {
         setIsLoading(false);
      }
   };

   return (
      <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.04] via-zinc-950/70 to-zinc-950 p-5 shadow-lg backdrop-blur-md">
         {/* Reward Header */}
         {hasReward && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
               <div className="flex items-center gap-2">
                  <span className="text-base">🏆</span>
                  <span>
                     <strong>Victory Bonus:</strong> {challenge.rewardCoins}{" "}
                     coins awarded to each surviving participant on winning
                     teams!
                  </span>
               </div>
               {challenge.isRewardSettled && (
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                     Settled
                  </span>
               )}
            </div>
         )}

         {/* Betting Section */}
         {isBettingEnabled && (
            <div>
               <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                     <CoinsIcon className="h-5 w-5 text-amber-400" />
                     <h3 className="text-sm font-semibold text-zinc-100">
                        Virtual Coin Wagers
                     </h3>
                  </div>
                  <span
                     className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        isUpcoming
                           ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                           : "bg-zinc-800 text-zinc-400"
                     }`}
                  >
                     {isUpcoming ? "Betting Open" : "Betting Locked (Kickoff)"}
                  </span>
               </div>

               {isUpcoming ? (
                  <form onSubmit={handlePlaceBet} className="mt-4 space-y-4">
                     {/* Team Picker */}
                     <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-2">
                           Back a Team to Win
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                           {challenge.teams.map((team) => {
                              const isSelected = selectedTeamId === team.id;
                              return (
                                 <button
                                    key={team.id}
                                    type="button"
                                    onClick={() => setSelectedTeamId(team.id)}
                                    className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition-all ${
                                       isSelected
                                          ? "border-amber-400 bg-amber-500/15 text-zinc-100 shadow-sm"
                                          : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                                    }`}
                                 >
                                    <span className="text-sm">
                                       {team.iconEmoji || "🛡️"}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                       <p className="truncate font-medium">
                                          {team.name}
                                       </p>
                                    </div>
                                 </button>
                              );
                           })}
                        </div>
                     </div>

                     {/* Stake Input */}
                     <div>
                        <div className="flex justify-between text-xs font-medium text-zinc-300 mb-1.5">
                           <span>Stake (Coins)</span>
                           <span className="text-zinc-400">
                              Potential Payout:{" "}
                              <strong className="text-amber-300">
                                 {stake * 2} Coins
                              </strong>{" "}
                              (1:1 Odds)
                           </span>
                        </div>
                        <div className="flex items-center gap-2">
                           <input
                              type="number"
                              min={MIN_WAGER_STAKE}
                              max={MAX_WAGER_STAKE}
                              step={5}
                              value={stake}
                              onChange={(e) =>
                                 setStake(
                                    Math.max(0, parseInt(e.target.value) || 0)
                                 )
                              }
                              className="w-32 rounded-lg border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
                           />
                           <div className="flex flex-wrap gap-1">
                              {[10, 50, 100, 250, 500].map((preset) => (
                                 <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setStake(preset)}
                                    className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                                       stake === preset
                                          ? "bg-amber-500 text-zinc-950"
                                          : "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700"
                                    }`}
                                 >
                                    {preset}
                                 </button>
                              ))}
                           </div>
                        </div>
                     </div>

                     {message && (
                        <div
                           className={`rounded-lg p-2.5 text-xs ${
                              message.type === "success"
                                 ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                                 : "bg-rose-500/10 border border-rose-500/30 text-rose-300"
                           }`}
                        >
                           {message.text}
                        </div>
                     )}

                     <button
                        type="submit"
                        disabled={
                           isLoading || !challenge.currentUser?.isLoggedIn
                        }
                        className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
                     >
                        {isLoading
                           ? "Reserving Coins..."
                           : !challenge.currentUser?.isLoggedIn
                             ? "Log in to Place Wager"
                             : `Place ${stake} Coin Wager`}
                     </button>
                  </form>
               ) : (
                  <p className="mt-3 text-xs text-zinc-400">
                     Betting is closed for this tournament. Wagers were locked
                     when the challenge started.
                  </p>
               )}

               {/* Existing user bets */}
               {userWagers.length > 0 && (
                  <div className="mt-5 border-t border-zinc-800/80 pt-4">
                     <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2.5">
                        Your Tournament Wagers ({userWagers.length})
                     </h4>
                     <div className="space-y-2">
                        {userWagers.map((w) => (
                           <div
                              key={w.id}
                              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5 text-xs"
                           >
                              <div>
                                 <span className="font-semibold text-zinc-200">
                                    {w.team?.name ||
                                       w.targetTeam?.name ||
                                       "Team"}
                                 </span>
                                 <p className="text-[11px] text-zinc-400">
                                    Stake: {w.stake} coins → Payout:{" "}
                                    {w.payout ??
                                       w.potentialPayout ??
                                       w.stake * 2}{" "}
                                    coins
                                 </p>
                              </div>
                              <span
                                 className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                    w.status === "ACCEPTED"
                                       ? "bg-amber-500/20 text-amber-300"
                                       : w.status === "WON"
                                         ? "bg-emerald-500/20 text-emerald-300"
                                         : w.status === "LOST"
                                           ? "bg-rose-500/20 text-rose-300"
                                           : "bg-blue-500/20 text-blue-300"
                                 }`}
                              >
                                 {w.status === "ACCEPTED"
                                    ? "In Play"
                                    : w.status}
                              </span>
                           </div>
                        ))}
                     </div>
                  </div>
               )}
            </div>
         )}
      </div>
   );
}
