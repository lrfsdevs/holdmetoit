"use client";

import React, { useEffect, useState, useCallback, useId } from "react";
import { AcquisitionResultViewModel } from "../../data/acquisition.repository";
import { getPokemonRarityConfig } from "../../domain/pokemon-rarity";
import { PokemonRarityBadge } from "../pokemon-rarity-badge";
import { PokemonTypeBadge } from "../pokemon-type-badge";
import { CoinsIcon } from "@/features/economy/presentation/coins-icon";
import { Button } from "@/components/ui/button";
import {
   Sparkles,
   X,
   FastForward,
   CheckCircle2,
   Copy,
   ExternalLink,
   RotateCw,
} from "lucide-react";

export type RevealStage = "anticipation" | "reveal" | "details";

interface PokemonRevealModalProps {
   acquisition: AcquisitionResultViewModel | null;
   isOpen: boolean;
   onClose: () => void;
   onPullAgain?: () => void;
   canPullAgain?: boolean;
   pullCost?: number;
   userAvailableCoins?: number;
   onViewCollection?: () => void;
   initialStage?: RevealStage;
}

export function PokemonRevealModal({
   acquisition,
   isOpen,
   onClose,
   onPullAgain,
   canPullAgain = false,
   pullCost = 0,
   userAvailableCoins = 0,
   onViewCollection,
   initialStage = "anticipation",
}: PokemonRevealModalProps) {
   const [stage, setStage] = useState<RevealStage>(initialStage);
   const [imageError, setImageError] = useState(false);
   const [isReducedMotion, setIsReducedMotion] = useState(false);
   const titleId = useId();

   // Check prefers-reduced-motion
   useEffect(() => {
      if (typeof window !== "undefined") {
         const mediaQuery = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
         );
         setIsReducedMotion(mediaQuery.matches);
         const listener = (e: MediaQueryListEvent) =>
            setIsReducedMotion(e.matches);
         mediaQuery.addEventListener("change", listener);
         return () => mediaQuery.removeEventListener("change", listener);
      }
   }, []);

   // Sequence controller
   useEffect(() => {
      if (!isOpen || !acquisition) {
         setStage(initialStage);
         setImageError(false);
         return;
      }

      if (isReducedMotion || initialStage === "details") {
         setStage("details");
         return;
      }

      // Stage A -> Stage B: Anticipation (1.2s) -> Stage C: Reveal flash (0.8s) -> Stage D: Details
      setStage("anticipation");
      const timer1 = setTimeout(() => {
         setStage("reveal");
      }, 1200);

      const timer2 = setTimeout(() => {
         setStage("details");
      }, 2000);

      return () => {
         clearTimeout(timer1);
         clearTimeout(timer2);
      };
   }, [isOpen, acquisition, isReducedMotion, initialStage]);

   // Handle escape key
   useEffect(() => {
      if (!isOpen) return;
      const handleKeyDown = (e: KeyboardEvent) => {
         if (e.key === "Escape") {
            onClose();
         }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
   }, [isOpen, onClose]);

   const handleSkip = useCallback(() => {
      setStage("details");
   }, []);

   if (!isOpen || !acquisition) return null;

   const species = acquisition.species;
   const rarityConfig = getPokemonRarityConfig(acquisition.rarity);
   const formattedNumber = `#${String(species.pokedexNumber).padStart(4, "0")}`;
   const displayImage = species.imageUrl || species.spriteUrl;

   // Custom rarity glow colors for anticipation and reveal burst
   const rarityGlowClass =
      acquisition.rarity === "MYTHICAL"
         ? "from-pink-500/40 via-rose-500/20 to-purple-900/40 border-pink-500/50 shadow-pink-500/30"
         : acquisition.rarity === "LEGENDARY"
           ? "from-amber-500/40 via-yellow-500/20 to-amber-950/40 border-amber-500/50 shadow-amber-500/30"
           : acquisition.rarity === "EPIC"
             ? "from-purple-500/40 via-violet-500/20 to-purple-950/40 border-purple-500/50 shadow-purple-500/30"
             : acquisition.rarity === "RARE"
               ? "from-sky-500/40 via-blue-500/20 to-blue-950/40 border-sky-500/50 shadow-sky-500/30"
               : acquisition.rarity === "UNCOMMON"
                 ? "from-emerald-500/40 via-teal-500/20 to-emerald-950/40 border-emerald-500/50 shadow-emerald-500/30"
                 : "from-slate-600/30 via-slate-800/20 to-slate-950/40 border-slate-700/50 shadow-slate-700/20";

   return (
      <div
         className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-xl select-none"
         role="dialog"
         aria-modal="true"
         aria-labelledby={titleId}
      >
         {/* Background ambient radial aura */}
         <div
            className={`absolute inset-0 pointer-events-none opacity-30 transition-opacity duration-700 bg-radial ${
               stage === "details" ? "opacity-60" : "opacity-30"
            } ${rarityConfig.glowColor}`}
         />

         {/* Skip Button (visible during anticipation and reveal) */}
         {stage !== "details" && (
            <button
               type="button"
               onClick={handleSkip}
               className="absolute top-5 right-5 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-obsidian-elevated/80 border border-obsidian-border text-obsidian-textDim hover:text-white hover:border-obsidian-borderHighlight text-xs font-medium backdrop-blur-sm transition-all"
               data-testid="skip-reveal-button"
            >
               <FastForward className="w-3.5 h-3.5" />
               <span>Skip Reveal</span>
            </button>
         )}

         {/* Main Container */}
         <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-pokedex-border bg-gradient-to-b from-pokedex-elevated to-pokedex-bg p-6 sm:p-8 shadow-2xl text-white text-center">
            {/* Close Button on Details */}
            {stage === "details" && (
               <button
                  type="button"
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-xl bg-pokedex-cardSubtle text-pokedex-textMuted hover:text-white hover:bg-pokedex-border transition-colors z-20"
                  aria-label="Close modal"
                  data-testid="reveal-modal-close"
               >
                  <X className="h-4 w-4" />
               </button>
            )}

            {/* STAGE A / B: ANTICIPATION & STAGE C: REVEAL BURST */}
            {stage !== "details" && (
               <div
                  className="flex flex-col items-center justify-center py-16 space-y-6"
                  data-testid="reveal-anticipation-stage"
               >
                  <div className="relative flex items-center justify-center w-36 h-36">
                     {/* Outer pulsing ring */}
                     <div
                        className={`absolute inset-0 rounded-full border-2 border-dashed transition-all duration-700 ${
                           stage === "reveal"
                              ? "scale-150 opacity-0 border-white"
                              : "animate-spin scale-110 opacity-70 border-rose-400"
                        }`}
                        style={{ animationDuration: "8s" }}
                     />

                     {/* Energy Core / Orb */}
                     <div
                        className={`relative flex items-center justify-center w-28 h-28 rounded-full border bg-gradient-to-br shadow-2xl transition-all duration-500 ${rarityGlowClass} ${
                           stage === "reveal"
                              ? "scale-125 brightness-150 animate-ping"
                              : "animate-pulse"
                        }`}
                     >
                        <Sparkles className="w-12 h-12 text-white/90 drop-shadow-md animate-bounce" />
                     </div>
                  </div>

                  <div className="space-y-1">
                     <h3 className="text-base font-semibold text-white tracking-wide">
                        {stage === "reveal"
                           ? "Summoning Companion..."
                           : "Opening Summon Portal..."}
                     </h3>
                     <p className="text-xs text-pokedex-textMuted font-mono">
                        Authorizing acquisition with HoldMeToIt Ledger...
                     </p>
                  </div>
               </div>
            )}

            {/* STAGE D & E: RESULT DETAILS */}
            {stage === "details" && (
               <div
                  className="space-y-5 animate-in fade-in zoom-in-95 duration-300"
                  data-testid="reveal-details-stage"
               >
                  {/* Top Tag & National Dex Number */}
                  <div className="flex items-center justify-between text-xs">
                     <div className="flex items-center gap-2">
                        <span className="font-mono text-pokedex-textMuted tracking-wider font-semibold">
                           {formattedNumber}
                        </span>
                        {acquisition.bannerName && (
                           <span className="px-2 py-0.5 rounded-md bg-pokedex-cardSubtle text-[10px] text-pokedex-textDim">
                              {acquisition.bannerName}
                           </span>
                        )}
                     </div>

                     {/* Ownership Status Pill */}
                     {acquisition.isDuplicate ? (
                        <span
                           className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-pokedex-cardSubtle text-pokedex-textSecondary border border-pokedex-border"
                           data-testid="badge-duplicate"
                        >
                           <Copy className="w-3 h-3 text-economy-gold" />
                           <span>Duplicate Acquired (Count +1)</span>
                        </span>
                     ) : (
                        <span
                           className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/20"
                           data-testid="badge-new-discovery"
                        >
                           <CheckCircle2 className="w-3 h-3" />
                           <span>New Discovery!</span>
                        </span>
                     )}
                  </div>

                  {/* Center Artwork with Rarity Aura */}
                  <div className="relative my-2 flex items-center justify-center h-44 w-full">
                     {/* Rarity Aura */}
                     <div
                        className={`absolute w-36 h-36 rounded-full blur-3xl opacity-50 ${rarityConfig.glowColor}`}
                     />

                     {displayImage && !imageError ? (
                        <img
                           src={displayImage}
                           alt={species.name}
                           onError={() => setImageError(true)}
                           className="relative z-10 max-h-40 max-w-[180px] object-contain drop-shadow-2xl transition-transform duration-300 hover:scale-105"
                           loading="eager"
                        />
                     ) : (
                        <div className="relative z-10 flex flex-col items-center justify-center text-pokedex-borderLight">
                           <svg
                              className="w-24 h-24 text-rose-400/50"
                              viewBox="0 0 100 100"
                              fill="none"
                           >
                              <circle
                                 cx="50"
                                 cy="50"
                                 r="45"
                                 stroke="currentColor"
                                 strokeWidth="7"
                              />
                              <path
                                 d="M5 50H95"
                                 stroke="currentColor"
                                 strokeWidth="7"
                              />
                              <circle
                                 cx="50"
                                 cy="50"
                                 r="16"
                                 fill="hsl(var(--pokedex-card))"
                                 stroke="currentColor"
                                 strokeWidth="7"
                              />
                              <circle
                                 cx="50"
                                 cy="50"
                                 r="7"
                                 fill="currentColor"
                              />
                           </svg>
                           <span className="text-xs text-pokedex-textDim mt-1">
                              Artwork Unavailable
                           </span>
                        </div>
                     )}
                  </div>

                  {/* Species Identification & Rarity */}
                  <div className="space-y-1.5">
                     <div className="flex items-center justify-center gap-2">
                        <h2
                           id={titleId}
                           className="text-2xl font-black text-white tracking-tight"
                        >
                           {species.name}
                        </h2>
                        {acquisition.isFeatured && (
                           <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Featured
                           </span>
                        )}
                     </div>

                     {species.classification && (
                        <p className="text-xs text-pokedex-textMuted">
                           {species.classification}
                        </p>
                     )}

                     <div className="flex items-center justify-center gap-2 pt-1">
                        <PokemonRarityBadge
                           rarity={acquisition.rarity}
                           size="md"
                        />
                        <PokemonTypeBadge
                           type={species.primaryType}
                           size="md"
                        />
                        {species.secondaryType && (
                           <PokemonTypeBadge
                              type={species.secondaryType}
                              size="md"
                           />
                        )}
                     </div>
                  </div>

                  {/* Acquisition Summary Info Card */}
                  <div className="p-3.5 rounded-2xl bg-pokedex-card/80 border border-pokedex-border text-xs text-left space-y-2">
                     <div className="flex items-center justify-between text-pokedex-textMuted">
                        <span>Summon Cost</span>
                        <span className="font-semibold text-economy-gold flex items-center gap-1 font-mono">
                           <CoinsIcon className="w-3.5 h-3.5" />
                           {acquisition.costPaid} Coins
                        </span>
                     </div>

                     <div className="flex items-center justify-between text-pokedex-textMuted">
                        <span>Updated Available Balance</span>
                        <span className="font-semibold text-white font-mono">
                           {acquisition.newBalance} Coins
                        </span>
                     </div>

                     {acquisition.pityTriggered && (
                        <div className="text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-center">
                           ✨ Guaranteed Hard Pity Activated on this summon!
                        </div>
                     )}
                  </div>

                  {/* Actions: View in Collection, Summon Again, Return */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                     {onViewCollection && (
                        <Button
                           type="button"
                           variant="outline"
                           size="default"
                           onClick={onViewCollection}
                           className="w-full sm:flex-1 border-pokedex-borderLight text-pokedex-textSecondary hover:text-white hover:border-pokedex-border text-xs"
                        >
                           View in Pokédex
                        </Button>
                     )}

                     {onPullAgain && canPullAgain && (
                        <Button
                           type="button"
                           variant="gold"
                           size="default"
                           onClick={onPullAgain}
                           className="w-full sm:flex-1 text-xs font-semibold"
                           data-testid="reveal-pull-again-button"
                        >
                           <RotateCw className="w-3.5 h-3.5 mr-1" />
                           Summon Again ({pullCost}c)
                        </Button>
                     )}

                     <Button
                        type="button"
                        variant="default"
                        size="default"
                        onClick={onClose}
                        className="w-full sm:w-auto text-xs"
                        data-testid="reveal-done-button"
                     >
                        Done
                     </Button>
                  </div>
               </div>
            )}
         </div>
      </div>
   );
}
