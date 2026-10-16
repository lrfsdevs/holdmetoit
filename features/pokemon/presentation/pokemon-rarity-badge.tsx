"use client";

import React from "react";
import {
   getPokemonRarityConfig,
   PokemonRarity,
} from "../domain/pokemon-rarity";
import { Star } from "lucide-react";

interface PokemonRarityBadgeProps {
   rarity: PokemonRarity | string;
   showStars?: boolean;
   size?: "sm" | "md" | "lg";
}

export function PokemonRarityBadge({
   rarity,
   showStars = true,
   size = "md",
}: PokemonRarityBadgeProps) {
   const config = getPokemonRarityConfig(rarity);

   const starCount = config.stars;

   const sizeClasses =
      size === "sm"
         ? "text-[10px] px-1.5 py-0.5 gap-1"
         : size === "lg"
           ? "text-sm px-3 py-1 gap-2"
           : "text-xs px-2 py-0.5 gap-1.5";

   return (
      <span
         className={`inline-flex items-center font-semibold rounded-md border shadow-sm ${config.bgColor} ${config.borderColor} ${config.textColor} ${config.glowColor} ${sizeClasses}`}
         data-testid={`pokemon-rarity-${config.rarity.toLowerCase()}`}
      >
         <span>{config.label}</span>
         {showStars && (
            <span className="flex items-center gap-0.5">
               {Array.from({ length: starCount }).map((_, i) => (
                  <Star
                     key={i}
                     className={`fill-current ${
                        size === "sm"
                           ? "w-2.5 h-2.5"
                           : size === "lg"
                             ? "w-3.5 h-3.5"
                             : "w-3 h-3"
                     }`}
                  />
               ))}
            </span>
         )}
      </span>
   );
}
