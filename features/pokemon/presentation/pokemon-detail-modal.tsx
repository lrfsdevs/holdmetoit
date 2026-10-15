"use client";

import React, { useEffect, useState } from "react";
import { PokemonSpeciesWithCounts } from "../data/pokemon-catalogue.repository";
import { getPokemonRarityConfig } from "../domain/pokemon-rarity";
import { PokemonRarityBadge } from "./pokemon-rarity-badge";
import { PokemonTypeBadge } from "./pokemon-type-badge";
import {
   ExternalLink,
   Shield,
   Swords,
   Heart,
   X,
   CheckCircle2,
   Calendar,
   Layers,
} from "lucide-react";

interface PokemonDetailModalProps {
   species: PokemonSpeciesWithCounts | null;
   isOpen: boolean;
   onClose: () => void;
   ownedCount?: number;
   earliestObtainedAt?: string | null;
}

export function PokemonDetailModal({
   species,
   isOpen,
   onClose,
   ownedCount = 0,
   earliestObtainedAt,
}: PokemonDetailModalProps) {
   const [imageError, setImageError] = useState(false);

   useEffect(() => {
      setImageError(false);
   }, [species]);

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

   if (!isOpen || !species) return null;

   const isOwned = ownedCount > 0;
   const rarityConfig = getPokemonRarityConfig(species.rarity);
   const formattedNumber = `#${String(species.pokedexNumber).padStart(4, "0")}`;
   const displayImage = species.imageUrl || species.spriteUrl;

   const formattedDate = earliestObtainedAt
      ? new Date(earliestObtainedAt).toLocaleDateString("en-US", {
           year: "numeric",
           month: "short",
           day: "numeric",
        })
      : null;

   return (
      <div
         className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
         onClick={onClose}
         role="dialog"
         aria-modal="true"
         aria-labelledby="pokemon-modal-title"
      >
         <div
            className={`relative w-full max-w-lg overflow-hidden rounded-2xl border bg-gradient-to-b from-pokedex-elevated to-pokedex-bg border-pokedex-border p-6 shadow-2xl shadow-black/80 text-white ${rarityConfig.glowColor}`}
            onClick={(e) => e.stopPropagation()}
         >
            {/* Close Button */}
            <button
               type="button"
               onClick={onClose}
               className="absolute top-4 right-4 p-2 rounded-xl bg-pokedex-cardSubtle text-pokedex-textMuted hover:text-white hover:bg-pokedex-border transition-colors z-20"
               aria-label="Close modal"
               data-testid="pokemon-modal-close"
            >
               <X className="h-4 w-4" />
            </button>

            {/* Ambient Top Glow */}
            <div
               className={`absolute -top-20 -left-20 w-60 h-60 rounded-full blur-3xl opacity-30 pointer-events-none ${
                  rarityConfig.rank >= 5
                     ? "bg-amber-500"
                     : rarityConfig.rank === 4
                       ? "bg-purple-500"
                       : rarityConfig.rank === 3
                         ? "bg-sky-500"
                         : "bg-emerald-500"
               }`}
            />

            <div className="relative z-10 space-y-5">
               {/* Top Info Banner */}
               <div className="flex items-start justify-between pr-8">
                  <div>
                     <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-pokedex-textMuted tracking-widest uppercase">
                           {formattedNumber} • Gen {species.generation}
                        </span>
                        {species.isMythical && (
                           <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              Mythical
                           </span>
                        )}
                        {species.isLegendary && !species.isMythical && (
                           <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Legendary
                           </span>
                        )}
                     </div>
                     <h2
                        id="pokemon-modal-title"
                        className="text-2xl font-extrabold tracking-tight text-white mt-0.5"
                     >
                        {species.name}
                     </h2>
                     {species.classification && (
                        <p className="text-xs text-pokedex-textMuted">
                           {species.classification}
                        </p>
                     )}
                  </div>

                  <PokemonRarityBadge rarity={species.rarity} size="md" />
               </div>

               {/* Center Visual & Artwork */}
               <div className="relative flex items-center justify-center py-4 bg-pokedex-inset/60 rounded-xl border border-pokedex-border/60">
                  {displayImage && !imageError ? (
                     <img
                        src={displayImage}
                        alt={species.name}
                        onError={() => setImageError(true)}
                        className="max-h-48 max-w-[200px] object-contain drop-shadow-xl"
                     />
                  ) : (
                     <div className="flex flex-col items-center justify-center py-8 text-pokedex-borderLight">
                        <svg
                           className="w-24 h-24 text-slate-700/60"
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
                           <circle cx="50" cy="50" r="7" fill="currentColor" />
                        </svg>
                        <span className="text-xs text-pokedex-textDim mt-2">
                           Artwork illustration unavailable
                        </span>
                     </div>
                  )}
               </div>

               {/* Elemental Types */}
               <div className="flex items-center gap-2">
                  <span className="text-xs text-pokedex-textMuted font-medium mr-1">
                     Types:
                  </span>
                  <PokemonTypeBadge type={species.primaryType} size="md" />
                  {species.secondaryType && (
                     <PokemonTypeBadge type={species.secondaryType} size="md" />
                  )}
               </div>

               {/* Species Description */}
               <div className="p-3.5 rounded-xl bg-pokedex-card border border-pokedex-border/80 text-xs sm:text-sm text-pokedex-textSecondary leading-relaxed">
                  {species.description}
               </div>

               {/* Base Stats / Progression Foundation */}
               <div className="space-y-2 p-3.5 rounded-xl bg-pokedex-card/60 border border-pokedex-border/60">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-pokedex-textMuted flex items-center gap-1.5">
                     <Layers className="w-3.5 h-3.5 text-rose-400" />
                     Base Species Attributes
                  </h4>

                  <div className="space-y-1.5 pt-1 text-xs">
                     {/* HP */}
                     <div className="flex items-center gap-2">
                        <span className="w-14 text-pokedex-textMuted flex items-center gap-1">
                           <Heart className="w-3 h-3 text-emerald-400" /> HP
                        </span>
                        <span className="w-8 font-mono text-right text-white font-semibold">
                           {species.baseHp}
                        </span>
                        <div className="flex-1 h-1.5 bg-pokedex-cardSubtle rounded-full overflow-hidden">
                           <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{
                                 width: `${Math.min(100, (species.baseHp / 160) * 100)}%`,
                              }}
                           />
                        </div>
                     </div>

                     {/* Attack */}
                     <div className="flex items-center gap-2">
                        <span className="w-14 text-pokedex-textMuted flex items-center gap-1">
                           <Swords className="w-3 h-3 text-rose-400" /> ATK
                        </span>
                        <span className="w-8 font-mono text-right text-white font-semibold">
                           {species.baseAttack}
                        </span>
                        <div className="flex-1 h-1.5 bg-pokedex-cardSubtle rounded-full overflow-hidden">
                           <div
                              className="h-full bg-rose-500 rounded-full"
                              style={{
                                 width: `${Math.min(100, (species.baseAttack / 160) * 100)}%`,
                              }}
                           />
                        </div>
                     </div>

                     {/* Defense */}
                     <div className="flex items-center gap-2">
                        <span className="w-14 text-pokedex-textMuted flex items-center gap-1">
                           <Shield className="w-3 h-3 text-sky-400" /> DEF
                        </span>
                        <span className="w-8 font-mono text-right text-white font-semibold">
                           {species.baseDefense}
                        </span>
                        <div className="flex-1 h-1.5 bg-pokedex-cardSubtle rounded-full overflow-hidden">
                           <div
                              className="h-full bg-sky-500 rounded-full"
                              style={{
                                 width: `${Math.min(100, (species.baseDefense / 160) * 100)}%`,
                              }}
                           />
                        </div>
                     </div>
                  </div>
               </div>

               {/* Physical Dimensions (Height & Weight) */}
               {(species.metadata?.heightDecimetres ||
                  species.metadata?.weightHectograms) && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                     {species.metadata?.heightDecimetres && (
                        <div className="p-2.5 rounded-xl bg-pokedex-card/80 border border-pokedex-border/60 flex items-center justify-between">
                           <span className="text-pokedex-textMuted">
                              Height
                           </span>
                           <span className="font-semibold text-white">
                              {(species.metadata.heightDecimetres / 10).toFixed(
                                 1
                              )}{" "}
                              m
                           </span>
                        </div>
                     )}
                     {species.metadata?.weightHectograms && (
                        <div className="p-2.5 rounded-xl bg-pokedex-card/80 border border-pokedex-border/60 flex items-center justify-between">
                           <span className="text-pokedex-textMuted">
                              Weight
                           </span>
                           <span className="font-semibold text-white">
                              {(species.metadata.weightHectograms / 10).toFixed(
                                 1
                              )}{" "}
                              kg
                           </span>
                        </div>
                     )}
                  </div>
               )}

               {/* Alternate Forms & Special Variations */}
               {species.metadata?.forms &&
                  species.metadata.forms.length > 0 && (
                     <div className="space-y-2 p-3.5 rounded-xl bg-pokedex-card/60 border border-pokedex-border/60">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-pokedex-textMuted flex items-center justify-between">
                           <span>Form Variations</span>
                           <span className="text-rose-400 font-mono text-[11px]">
                              {species.metadata.forms.length}{" "}
                              {species.metadata.forms.length === 1
                                 ? "variant"
                                 : "variants"}
                           </span>
                        </h4>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                           {species.metadata.forms.map((f: any) => (
                              <span
                                 key={f.slug}
                                 className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs bg-pokedex-inset border border-pokedex-borderLight text-pokedex-textSecondary"
                              >
                                 {f.name}
                              </span>
                           ))}
                        </div>
                     </div>
                  )}

               {/* User Ownership Section */}
               <div className="p-3.5 rounded-xl bg-pokedex-card/80 border border-pokedex-border text-xs">
                  {isOwned ? (
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-emerald-400">
                        <div className="flex items-center gap-1.5 font-semibold">
                           <CheckCircle2 className="w-4 h-4 shrink-0" />
                           <span>
                              Owned in Collection ({ownedCount}{" "}
                              {ownedCount === 1 ? "copy" : "copies"})
                           </span>
                        </div>
                        {formattedDate && (
                           <div className="flex items-center gap-1 text-pokedex-textMuted text-[11px]">
                              <Calendar className="w-3 h-3" />
                              First acquired: {formattedDate}
                           </div>
                        )}
                     </div>
                  ) : (
                     <p className="text-pokedex-textMuted">
                        Not yet in your collection. Keep studying and staying
                        accountable to expand your Pokédex!
                     </p>
                  )}
               </div>

               {/* Official Reference Link */}
               {species.referenceUrl && (
                  <div className="pt-1 flex items-center justify-between text-[11px] text-pokedex-textDim">
                     <span>Reference data from official Pokédex</span>
                     <a
                        href={species.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 transition-colors underline"
                     >
                        Official Entry <ExternalLink className="w-3 h-3" />
                     </a>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}
