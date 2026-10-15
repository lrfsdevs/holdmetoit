"use client";

import React, { useState } from "react";
import Image from "next/image";
import { PokemonSpeciesWithCounts } from "../data/pokemon-catalogue.repository";
import { getPokemonRarityConfig } from "../domain/pokemon-rarity";
import { PokemonRarityBadge } from "./pokemon-rarity-badge";
import { PokemonTypeBadge } from "./pokemon-type-badge";
import { CheckCircle2, CircleDashed } from "lucide-react";

interface PokemonCardProps {
   species: PokemonSpeciesWithCounts;
   ownedCount?: number;
   earliestObtainedAt?: string | null;
   onClick?: () => void;
   mode?: "pokedex" | "collection";
}

export function PokemonCard({
   species,
   ownedCount = 0,
   earliestObtainedAt,
   onClick,
   mode = "pokedex",
}: PokemonCardProps) {
   const [imageError, setImageError] = useState(false);
   const isOwned = ownedCount > 0;
   const rarityConfig = getPokemonRarityConfig(species.rarity);

   const formattedNumber = `#${String(species.pokedexNumber).padStart(4, "0")}`;
   const displayImage = species.imageUrl || species.spriteUrl;

   return (
      <div
         onClick={onClick}
         role="button"
         tabIndex={0}
         onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
               e.preventDefault();
               onClick?.();
            }
         }}
         className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-300 text-left cursor-pointer p-4 select-none ${
            isOwned
               ? `bg-gradient-to-b ${rarityConfig.gradient} border-pokedex-border hover:border-rose-500/60 hover:shadow-lg ${rarityConfig.glowColor} hover:-translate-y-1`
               : "bg-pokedex-cardSubtle/80 border-pokedex-borderSubtle opacity-75 hover:opacity-100 hover:border-pokedex-borderLight hover:-translate-y-0.5"
         }`}
         data-testid={`pokemon-card-${species.slug}`}
      >
         {/* Top Header: Pokédex Number & Ownership Badge */}
         <div className="flex items-center justify-between text-xs font-medium">
            <div className="flex items-center gap-1.5">
               <span className="font-mono text-pokedex-textMuted tracking-wider text-[11px]">
                  {formattedNumber}
               </span>
               {species.isMythical && (
                  <span
                     className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40"
                     title="Official Mythical Classification"
                  >
                     Mythical
                  </span>
               )}
               {species.isLegendary && !species.isMythical && (
                  <span
                     className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40"
                     title="Official Legendary Classification"
                  >
                     Legendary
                  </span>
               )}
            </div>

            {isOwned ? (
               <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/20"
                  data-testid="badge-owned"
               >
                  <CheckCircle2 className="w-3 h-3" />
                  {ownedCount > 1 ? `x${ownedCount} Owned` : "Owned"}
               </span>
            ) : (
               <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-pokedex-cardSubtle text-pokedex-textDim border border-pokedex-border"
                  data-testid="badge-unowned"
               >
                  <CircleDashed className="w-3 h-3" />
                  Unowned
               </span>
            )}
         </div>

         {/* Center Asset / Illustration */}
         <div className="relative my-3 flex items-center justify-center h-36 w-full">
            {/* Glow backdrop for owned rare/epic/legendary/mythical */}
            {isOwned && rarityConfig.rank >= 3 && (
               <div
                  className={`absolute w-24 h-24 rounded-full blur-2xl opacity-40 transition-all group-hover:scale-125 ${
                     rarityConfig.rank >= 5
                        ? "bg-amber-500"
                        : rarityConfig.rank === 4
                          ? "bg-purple-500"
                          : "bg-sky-500"
                  }`}
               />
            )}

            {displayImage && !imageError ? (
               <img
                  src={displayImage}
                  alt={species.name}
                  onError={() => setImageError(true)}
                  className={`relative z-10 max-h-32 max-w-[130px] object-contain drop-shadow-md transition-transform duration-300 group-hover:scale-110 ${
                     !isOwned && mode === "pokedex"
                        ? "grayscale contrast-125 brightness-75 opacity-60"
                        : ""
                  }`}
                  loading="lazy"
               />
            ) : (
               /* Sleek fallback SVG Pokéball silhouette */
               <div className="relative z-10 flex flex-col items-center justify-center text-pokedex-borderLight">
                  <svg
                     className={`w-20 h-20 transition-transform duration-300 group-hover:scale-110 ${
                        isOwned ? "text-rose-400/50" : "text-slate-700/60"
                     }`}
                     viewBox="0 0 100 100"
                     fill="none"
                     xmlns="http://www.w3.org/2000/svg"
                  >
                     <circle
                        cx="50"
                        cy="50"
                        r="45"
                        stroke="currentColor"
                        strokeWidth="7"
                     />
                     <path d="M5 50H95" stroke="currentColor" strokeWidth="7" />
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
                  <span className="text-[10px] text-pokedex-textDim mt-1">
                     {species.name}
                  </span>
               </div>
            )}
         </div>

         {/* Bottom Info: Species Name, Types, Rarity */}
         <div className="space-y-2 pt-2 border-t border-pokedex-borderSubtle/60">
            <div>
               <h3 className="font-bold text-sm sm:text-base text-white tracking-tight group-hover:text-rose-300 transition-colors truncate">
                  {species.name}
               </h3>
               {species.classification && (
                  <p className="text-[11px] text-pokedex-textMuted truncate">
                     {species.classification}
                  </p>
               )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
               <PokemonRarityBadge rarity={species.rarity} size="sm" />
               <div className="flex items-center gap-1">
                  <PokemonTypeBadge type={species.primaryType} size="sm" />
                  {species.secondaryType && (
                     <PokemonTypeBadge type={species.secondaryType} size="sm" />
                  )}
               </div>
            </div>
         </div>
      </div>
   );
}
