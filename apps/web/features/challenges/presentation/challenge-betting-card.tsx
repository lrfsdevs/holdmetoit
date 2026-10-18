"use client";

import React, { useState, useEffect } from "react";
import { CoinsIcon } from "@/features/economy/presentation/coins-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <div className="rounded-xl border border-brand-1/20 bg-gradient-to-br from-brand-1/[0.04] via-surface-primary to-surface-page p-5 shadow-lg backdrop-blur-md">
         {/* Reward Header */}
         {hasReward && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-brand-1/30 bg-brand-1/10 px-4 py-2.5 text-xs text-brand-1-light">
               <div className="flex items-center gap-2">
                  <span className="text-base">🏆</span>
                  <span>
                     <strong>Victory Bonus:</strong> {challenge.rewardCoins}{" "}
                     coins awarded to each surviving participant on winning
                     teams!
                  </span>
               </div>
               {challenge.isRewardSettled && (
                  <span className="rounded bg-feedback-success/20 px-2 py-0.5 text-label font-semibold text-feedback-success">
                     Settled
                  </span>
               )}
            </div>
         )}

         {/* Betting Section */}
         {isBettingEnabled && (
            <div>
               <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                  <div className="flex items-center gap-2">
                     <CoinsIcon className="h-5 w-5 text-brand-1" />
                     <h3 className="text-sm font-semibold text-text-primary">
                        Virtual Coin Wagers
                     </h3>
                  </div>
                  <span
                     className={`rounded-full px-2.5 py-0.5 text-meta font-medium ${
                        isUpcoming
                           ? "bg-brand-1/20 text-brand-1-light border border-brand-1/30"
                           : "bg-surface-elevated text-text-tertiary"
                     }`}
                  >
                     {isUpcoming ? "Betting Open" : "Betting Locked (Kickoff)"}
                  </span>
               </div>

               {isUpcoming ? (
                  <form onSubmit={handlePlaceBet} className="mt-4 space-y-4">
                     {/* Team Picker */}
                     <div>
                        <Label
                           id="betting-back-team"
                           className="block text-xs font-medium text-text-secondary mb-2"
                        >
                           Back a Team to Win
                        </Label>
                        <div
                           role="group"
                           aria-labelledby="betting-back-team"
                           className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                        >
                           {challenge.teams.map((team) => {
                              const isSelected = selectedTeamId === team.id;
                              return (
                                 <button
                                    key={team.id}
                                    type="button"
                                    onClick={() => setSelectedTeamId(team.id)}
                                    className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition-all ${
                                       isSelected
                                          ? "border-brand-1 bg-brand-1/15 text-text-primary shadow-sm"
                                          : "border-border-default bg-surface-elevated/60 text-text-tertiary hover:border-border-strong hover:text-text-secondary"
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
                        <div className="flex justify-between text-xs font-medium text-text-secondary mb-1.5">
                           <span>Stake (Coins)</span>
                           <span className="text-text-tertiary">
                              Potential Payout:{" "}
                              <strong className="text-brand-1-light">
                                 {stake * 2} Coins
                              </strong>{" "}
                              (1:1 Odds)
                           </span>
                        </div>
                        <div className="flex items-center gap-2">
                           <Input
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
                              className="w-32 h-9 rounded-lg border-border-default bg-surface-elevated px-3 py-1.5 text-sm text-text-primary focus:border-brand-1"
                           />
                           <div className="flex flex-wrap gap-1">
                              {[10, 50, 100, 250, 500].map((preset) => (
                                 <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setStake(preset)}
                                    className={`rounded px-2 py-1 text-meta font-medium transition ${
                                       stake === preset
                                          ? "bg-brand-1 text-surface-page font-semibold"
                                          : "bg-surface-elevated text-text-tertiary hover:bg-surface-nested"
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
                                 ? "bg-feedback-success/10 border border-feedback-success/30 text-feedback-success"
                                 : "bg-destructive/10 border border-destructive/30 text-destructive"
                           }`}
                        >
                           {message.text}
                        </div>
                     )}

                     <Button
                        type="submit"
                        variant="gold"
                        size="default"
                        disabled={
                           isLoading || !challenge.currentUser?.isLoggedIn
                        }
                        className="w-full text-xs font-semibold"
                     >
                        {isLoading
                           ? "Reserving Coins..."
                           : !challenge.currentUser?.isLoggedIn
                             ? "Log in to Place Wager"
                             : `Place ${stake} Coin Wager`}
                     </Button>
                  </form>
               ) : (
                  <p className="mt-3 text-xs text-text-tertiary">
                     Betting is closed for this tournament. Wagers were locked
                     when the challenge started.
                  </p>
               )}

               {/* Existing user bets */}
               {userWagers.length > 0 && (
                  <div className="mt-5 border-t border-border-subtle pt-4">
                     <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2.5">
                        Your Tournament Wagers ({userWagers.length})
                     </h4>
                     <div className="space-y-2">
                        {userWagers.map((w) => (
                           <div
                              key={w.id}
                              className="flex items-center justify-between rounded-lg border border-border-default bg-surface-elevated/50 p-2.5 text-xs"
                           >
                              <div>
                                 <span className="font-semibold text-text-primary">
                                    {w.team?.name ||
                                       w.targetTeam?.name ||
                                       "Team"}
                                 </span>
                                 <p className="text-meta text-text-tertiary">
                                    Stake: {w.stake} coins → Payout:{" "}
                                    {w.payout ??
                                       w.potentialPayout ??
                                       w.stake * 2}{" "}
                                    coins
                                 </p>
                              </div>
                              <span
                                 className={`rounded px-2 py-0.5 text-label font-semibold uppercase ${
                                    w.status === "ACCEPTED"
                                       ? "bg-brand-1/20 text-brand-1-light"
                                       : w.status === "WON"
                                         ? "bg-feedback-success/20 text-feedback-success"
                                         : w.status === "LOST"
                                           ? "bg-destructive/20 text-destructive"
                                           : "bg-feedback-info/20 text-feedback-info"
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
