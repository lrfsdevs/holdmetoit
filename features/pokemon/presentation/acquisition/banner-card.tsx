"use client";

import React, { useState } from "react";
import {
   BannerViewModel,
   AcquisitionResultViewModel,
} from "../../data/acquisition.repository";
import { PityState } from "../../domain/acquisition/pity-engine";
import { pullPokemonAction } from "../../api/acquisition.actions";
import { CoinsIcon } from "@/features/economy/presentation/coins-icon";
import { Button } from "@/components/ui/button";
import { PokemonRarityBadge } from "../pokemon-rarity-badge";
import { PokemonRevealModal } from "./pokemon-reveal-modal";
import {
   Sparkles,
   AlertCircle,
   Info,
   Flame,
   ShieldAlert,
   Check,
} from "lucide-react";
import { SignInWithDiscordButton } from "@/components/ui/header";

interface BannerCardProps {
   banner: BannerViewModel;
   userPity: PityState;
   userAvailableCoins?: number;
   isLoggedIn?: boolean;
   onAcquisitionSuccess?: (result: AcquisitionResultViewModel) => void;
   onViewCollection?: () => void;
}

export function BannerCard({
   banner,
   userPity,
   userAvailableCoins = 0,
   isLoggedIn = false,
   onAcquisitionSuccess,
   onViewCollection,
}: BannerCardProps) {
   const [isLoading, setIsLoading] = useState(false);
   const [errorMessage, setErrorMessage] = useState<string | null>(null);
   const [showRates, setShowRates] = useState(false);
   const [activeAcquisition, setActiveAcquisition] =
      useState<AcquisitionResultViewModel | null>(null);
   const [currentPity, setCurrentPity] = useState<PityState>(userPity);
   const [currentBalance, setCurrentBalance] =
      useState<number>(userAvailableCoins);

   const canAfford = currentBalance >= banner.pullCost;
   const hardPityThreshold = banner.pityConfig?.hardPityThreshold ?? 0;
   const pityPercentage =
      hardPityThreshold > 0
         ? Math.min(
              100,
              Math.round((currentPity.pityCount / hardPityThreshold) * 100)
           )
         : 0;

   const handlePull = async () => {
      if (!isLoggedIn) {
         setErrorMessage("Please log in to summon Pokémon companions.");
         return;
      }

      if (!canAfford) {
         setErrorMessage(
            `Insufficient balance (${currentBalance} coins). You need ${banner.pullCost} coins to summon.`
         );
         return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      // Generate unique client-side idempotency key for this attempt
      const idempotencyKey = `pull:${banner.id}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;

      try {
         const res = await pullPokemonAction({
            bannerId: banner.id,
            idempotencyKey,
         });

         if (res.ok) {
            setActiveAcquisition(res.data);
            setCurrentBalance(res.data.newBalance);
            setCurrentPity({
               pityCount: res.data.pityCountAfter,
               guaranteedFeatured: res.data.pityTriggered
                  ? false
                  : currentPity.guaranteedFeatured,
            });
            onAcquisitionSuccess?.(res.data);
         } else {
            setErrorMessage(res.error || "Failed to execute summon.");
         }
      } catch (err: any) {
         setErrorMessage(
            err instanceof Error ? err.message : "Network error during summon."
         );
      } finally {
         setIsLoading(false);
      }
   };

   return (
      <div
         className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-pokedex-border bg-gradient-to-b from-pokedex-elevated to-pokedex-card p-5 sm:p-7 shadow-xl text-white transition-all duration-300"
         data-testid={`banner-card-${banner.slug}`}
      >
         {/* Top Banner Header: Name, Type Pill & Cost */}
         <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
               <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                     {banner.bannerType}
                  </span>
                  {banner.isActive ? (
                     <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Active
                     </span>
                  ) : (
                     <span className="text-[11px] font-medium text-pokedex-textDim">
                        {banner.status}
                     </span>
                  )}
               </div>

               <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-pokedex-cardSubtle border border-pokedex-border text-xs font-semibold text-economy-gold">
                  <CoinsIcon className="w-3.5 h-3.5" />
                  <span>{banner.pullCost} Coins</span>
               </div>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-2.5">
               {banner.name}
            </h3>
            <p className="text-xs text-pokedex-textMuted mt-1 leading-relaxed">
               {banner.description}
            </p>

            {/* Featured Companion Spotlight */}
            {banner.featuredSpecies && (
               <div className="mt-4 p-4 rounded-2xl bg-pokedex-cardSubtle/80 border border-pokedex-border flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                     <div className="flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                           Featured Companion
                        </span>
                     </div>
                     <h4 className="text-base font-bold text-white truncate">
                        {banner.featuredSpecies.name}
                     </h4>
                     <PokemonRarityBadge
                        rarity={banner.featuredSpecies.rarity}
                        size="sm"
                     />
                  </div>

                  {banner.featuredSpecies.imageUrl && (
                     <img
                        src={banner.featuredSpecies.imageUrl}
                        alt={banner.featuredSpecies.name}
                        className="w-16 h-16 object-contain drop-shadow-md shrink-0"
                        loading="lazy"
                     />
                  )}
               </div>
            )}

            {/* Pity Progress Gauge */}
            {hardPityThreshold > 0 && (
               <div className="mt-4 p-3 rounded-xl bg-pokedex-inset/50 border border-pokedex-borderSubtle text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-pokedex-textMuted">
                     <span className="flex items-center gap-1 font-medium">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        Pity Progress:
                     </span>
                     <span className="font-mono text-white font-semibold">
                        {currentPity.pityCount} / {hardPityThreshold} Pulls
                     </span>
                  </div>

                  <div className="w-full h-1.5 bg-pokedex-cardSubtle rounded-full overflow-hidden">
                     <div
                        className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all duration-500"
                        style={{ width: `${pityPercentage}%` }}
                     />
                  </div>

                  <p className="text-[10px] text-pokedex-textDim">
                     Guaranteed {banner.pityConfig?.targetRarity ?? "Rare"}{" "}
                     companion at {hardPityThreshold} pulls.
                  </p>
               </div>
            )}

            {/* Probability Rates Accordion */}
            <div className="mt-3">
               <button
                  type="button"
                  onClick={() => setShowRates(!showRates)}
                  className="flex items-center gap-1 text-[11px] text-pokedex-textDim hover:text-pokedex-textMuted transition-colors"
               >
                  <Info className="w-3 h-3" />
                  <span>
                     {showRates
                        ? "Hide exact summon probabilities"
                        : "View exact summon probabilities"}
                  </span>
               </button>

               {showRates && (
                  <div className="mt-2 p-3 rounded-xl bg-pokedex-cardSubtle border border-pokedex-border text-[11px] space-y-1.5">
                     <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {Object.entries(banner.rarityRates).map(
                           ([rarity, bps]) => {
                              const pct = (bps / 100).toFixed(2);
                              return (
                                 <div
                                    key={rarity}
                                    className="flex items-center justify-between"
                                 >
                                    <span className="text-pokedex-textMuted font-medium">
                                       {rarity}:
                                    </span>
                                    <span className="font-mono font-semibold text-white">
                                       {pct}%
                                    </span>
                                 </div>
                              );
                           }
                        )}
                     </div>
                  </div>
               )}
            </div>
         </div>

         {/* Bottom Action Area: Error message, balance check & Summon Button */}
         <div className="mt-6 pt-4 border-t border-pokedex-borderSubtle/60 space-y-3">
            {errorMessage && (
               <div className="flex items-center gap-2 p-2.5 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="leading-tight">{errorMessage}</span>
               </div>
            )}

            {!isLoggedIn ? (
               <div className="text-center space-y-2">
                  <p className="text-xs text-pokedex-textDim">
                     Sign in with Discord to access HoldMeToIt coins and summon
                     companions.
                  </p>
                  <SignInWithDiscordButton className="w-full" />
               </div>
            ) : (
               <div>
                  <Button
                     type="button"
                     variant="gold"
                     size="default"
                     disabled={isLoading || !banner.isActive || !canAfford}
                     onClick={handlePull}
                     className="w-full text-xs font-bold uppercase tracking-wider py-5"
                     data-testid={`summon-button-${banner.slug}`}
                  >
                     {isLoading ? (
                        <span>Authorizing Summon...</span>
                     ) : !banner.isActive ? (
                        <span>Banner Inactive</span>
                     ) : !canAfford ? (
                        <span>
                           Insufficient Coins ({banner.pullCost} required)
                        </span>
                     ) : (
                        <span className="flex items-center justify-center gap-2">
                           <Sparkles className="w-4 h-4" />
                           <span>Summon Companion ({banner.pullCost}c)</span>
                        </span>
                     )}
                  </Button>
               </div>
            )}
         </div>

         {/* Cinematic Reveal Modal */}
         <PokemonRevealModal
            acquisition={activeAcquisition}
            isOpen={Boolean(activeAcquisition)}
            onClose={() => setActiveAcquisition(null)}
            onPullAgain={canAfford ? handlePull : undefined}
            canPullAgain={canAfford && banner.isActive}
            pullCost={banner.pullCost}
            userAvailableCoins={currentBalance}
            onViewCollection={onViewCollection}
         />
      </div>
   );
}
