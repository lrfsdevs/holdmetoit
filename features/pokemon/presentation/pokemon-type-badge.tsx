"use client";

import React from "react";
import {
   getPokemonTypeConfig,
   PokemonElementalType,
} from "../domain/pokemon-types";

interface PokemonTypeBadgeProps {
   type: string | null | undefined;
   size?: "sm" | "md";
}

export function PokemonTypeBadge({ type, size = "md" }: PokemonTypeBadgeProps) {
   const config = getPokemonTypeConfig(type);
   if (!config) return null;

   const sizeClasses =
      size === "sm"
         ? "text-[10px] px-1.5 py-0.5 rounded"
         : "text-xs px-2 py-0.5 rounded-md";

   return (
      <span
         className={`inline-flex items-center font-medium border ${config.badgeBg} ${config.badgeBorder} ${config.textColor} ${sizeClasses} tracking-wide uppercase`}
         data-testid={`pokemon-type-${config.type.toLowerCase()}`}
      >
         {config.label}
      </span>
   );
}
