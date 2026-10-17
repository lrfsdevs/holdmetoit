"use client";

import React from "react";
import { POKEMON_RARITIES, PokemonRarity } from "../domain/pokemon-rarity";
import { POKEMON_ELEMENTAL_TYPES } from "../domain/pokemon-types";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@/components/ui/select";

export type PokemonActiveTab = "pokedex" | "collection" | "summon";

interface PokemonFilterBarProps {
   activeTab: PokemonActiveTab;
   onTabChange: (tab: PokemonActiveTab) => void;
   search: string;
   onSearchChange: (search: string) => void;
   selectedRarity: string;
   onRarityChange: (rarity: string) => void;
   selectedType: string;
   onTypeChange: (type: string) => void;
   selectedGeneration: string;
   onGenerationChange: (gen: string) => void;
   selectedClassification: string;
   onClassificationChange: (classification: string) => void;
   sortBy: string;
   onSortChange: (sort: string) => void;
   isSpectator?: boolean;
   isAdmin?: boolean;
   onOpenHistory?: () => void;
   onOpenAdmin?: () => void;
}

export const GENERATION_OPTIONS = [
   { value: "1", label: "Gen 1 (Kanto)" },
   { value: "2", label: "Gen 2 (Johto)" },
   { value: "3", label: "Gen 3 (Hoenn)" },
   { value: "4", label: "Gen 4 (Sinnoh)" },
   { value: "5", label: "Gen 5 (Unova)" },
   { value: "6", label: "Gen 6 (Kalos)" },
   { value: "7", label: "Gen 7 (Alola)" },
   { value: "8", label: "Gen 8 (Galar)" },
   { value: "9", label: "Gen 9 (Paldea)" },
];

export function PokemonFilterBar({
   activeTab,
   onTabChange,
   search,
   onSearchChange,
   selectedRarity,
   onRarityChange,
   selectedType,
   onTypeChange,
   selectedGeneration,
   onGenerationChange,
   selectedClassification,
   onClassificationChange,
   sortBy,
   onSortChange,
   isSpectator = false,
   isAdmin = false,
   onOpenHistory,
   onOpenAdmin,
}: PokemonFilterBarProps) {
   const hasActiveFilters =
      search.trim() !== "" ||
      selectedRarity !== "" ||
      selectedType !== "" ||
      selectedGeneration !== "" ||
      selectedClassification !== "";

   const handleClear = () => {
      onSearchChange("");
      onRarityChange("");
      onTypeChange("");
      onGenerationChange("");
      onClassificationChange("");
   };

   return (
      <div className="space-y-4">
         {/* Top row: Tab Switcher & Result Count */}
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pokedex-border/60 pb-3">
            <div className="inline-flex p-1 rounded-xl bg-pokedex-card border border-pokedex-border flex-wrap gap-1">
               <button
                  type="button"
                  onClick={() => onTabChange("pokedex")}
                  className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                     activeTab === "pokedex"
                        ? "bg-gradient-to-r from-purple-600 to-rose-600 text-white shadow-md shadow-purple-600/25"
                        : "text-pokedex-textMuted hover:text-white"
                  }`}
                  data-testid="tab-pokedex"
               >
                  Pokédex Catalogue
               </button>
               <button
                  type="button"
                  onClick={() => onTabChange("collection")}
                  disabled={isSpectator}
                  className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                     activeTab === "collection"
                        ? "bg-gradient-to-r from-purple-600 to-rose-600 text-white shadow-md shadow-purple-600/25"
                        : isSpectator
                          ? "text-pokedex-textDim cursor-not-allowed"
                          : "text-pokedex-textMuted hover:text-white"
                  }`}
                  data-testid="tab-collection"
                  title={
                     isSpectator ? "Log in to view your collection" : undefined
                  }
               >
                  My Collection {isSpectator && "(Login Req.)"}
               </button>
               <button
                  type="button"
                  onClick={() => onTabChange("summon")}
                  className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
                     activeTab === "summon"
                        ? "bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-md shadow-amber-500/25"
                        : "text-pokedex-textMuted hover:text-white"
                  }`}
                  data-testid="tab-summon"
               >
                  <span>Summon Portal</span>
               </button>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
               {onOpenHistory && !isSpectator && (
                  <button
                     type="button"
                     onClick={onOpenHistory}
                     className="px-3 py-1.5 rounded-xl bg-pokedex-cardSubtle border border-pokedex-border text-pokedex-textSecondary hover:text-white text-xs font-medium transition-colors"
                     data-testid="history-button"
                  >
                     Summon History
                  </button>
               )}

               {isAdmin && onOpenAdmin && (
                  <button
                     type="button"
                     onClick={onOpenAdmin}
                     className="px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 text-xs font-medium transition-colors"
                     data-testid="admin-banners-button"
                  >
                     Admin Banners
                  </button>
               )}
            </div>
         </div>

         {/* Filter controls row */}
         {activeTab !== "summon" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
               {/* Search */}
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pokedex-textDim" />
                  <Input
                     type="text"
                     placeholder="Search species or classification..."
                     value={search}
                     onChange={(e) => onSearchChange(e.target.value)}
                     data-testid="pokemon-search-input"
                     className="h-9 min-h-0 pl-9 pr-3 rounded-xl bg-pokedex-card border-pokedex-border text-xs sm:text-sm text-white placeholder:text-pokedex-textDim focus:border-rose-500/70"
                  />
               </div>

               {/* Generation Filter (Gen 1-9) */}
               <Select
                  value={selectedGeneration || "ALL"}
                  onValueChange={(v) =>
                     onGenerationChange(v === "ALL" ? "" : v)
                  }
               >
                  <SelectTrigger
                     data-testid="pokemon-generation-select"
                     className="h-9 rounded-xl bg-pokedex-card border-pokedex-border text-xs sm:text-sm text-white"
                  >
                     <SelectValue placeholder="All Generations (1–9)" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="ALL">All Generations (1–9)</SelectItem>
                     {GENERATION_OPTIONS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                           {g.label}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>

               {/* Rarity Filter */}
               <Select
                  value={selectedRarity || "ALL"}
                  onValueChange={(v) => onRarityChange(v === "ALL" ? "" : v)}
               >
                  <SelectTrigger
                     data-testid="pokemon-rarity-select"
                     className="h-9 rounded-xl bg-pokedex-card border-pokedex-border text-xs sm:text-sm text-white"
                  >
                     <SelectValue placeholder="All Rarities" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="ALL">All Rarities</SelectItem>
                     {POKEMON_RARITIES.map((r) => (
                        <SelectItem key={r} value={r}>
                           {r.charAt(0) + r.slice(1).toLowerCase()}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>

               {/* Type Filter */}
               <Select
                  value={selectedType || "ALL"}
                  onValueChange={(v) => onTypeChange(v === "ALL" ? "" : v)}
               >
                  <SelectTrigger
                     data-testid="pokemon-type-select"
                     className="h-9 rounded-xl bg-pokedex-card border-pokedex-border text-xs sm:text-sm text-white"
                  >
                     <SelectValue placeholder="All Elemental Types" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="ALL">All Elemental Types</SelectItem>
                     {POKEMON_ELEMENTAL_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                           {t.charAt(0) + t.slice(1).toLowerCase()}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>

               {/* Source Classification Filter (Legendary / Mythical / All) */}
               <Select
                  value={selectedClassification || "ALL"}
                  onValueChange={(v) =>
                     onClassificationChange(v === "ALL" ? "" : v)
                  }
               >
                  <SelectTrigger
                     data-testid="pokemon-classification-select"
                     className="h-9 rounded-xl bg-pokedex-card border-pokedex-border text-xs sm:text-sm text-white"
                  >
                     <SelectValue placeholder="All Classifications" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="ALL">All Classifications</SelectItem>
                     <SelectItem value="legendary">Legendary Only</SelectItem>
                     <SelectItem value="mythical">Mythical Only</SelectItem>
                     <SelectItem value="standard">
                        Standard (Non-Legendary)
                     </SelectItem>
                  </SelectContent>
               </Select>

               {/* Sort Options & Clear */}
               <div className="flex items-center gap-2">
                  <Select value={sortBy} onValueChange={onSortChange}>
                     <SelectTrigger
                        data-testid="pokemon-sort-select"
                        className="h-9 rounded-xl bg-pokedex-card border-pokedex-border text-xs sm:text-sm text-white"
                     >
                        <SelectValue placeholder="Pokédex # (Ascending)" />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="pokedex">
                           Pokédex # (Ascending)
                        </SelectItem>
                        <SelectItem value="name">Name (A-Z)</SelectItem>
                        <SelectItem value="rarity_desc">
                           Rarity (Highest First)
                        </SelectItem>
                        <SelectItem value="rarity_asc">
                           Rarity (Lowest First)
                        </SelectItem>
                        {activeTab === "collection" && (
                           <SelectItem value="recent">
                              Recently Obtained
                           </SelectItem>
                        )}
                     </SelectContent>
                  </Select>

                  {hasActiveFilters && (
                     <button
                        type="button"
                        onClick={handleClear}
                        className="p-2 rounded-xl bg-pokedex-elevated border border-pokedex-border text-pokedex-textMuted hover:text-white hover:border-rose-500/50 transition-colors shrink-0"
                        title="Clear all filters"
                        data-testid="clear-filters-btn"
                     >
                        <X className="h-4 w-4" />
                     </button>
                  )}
               </div>
            </div>
         )}
      </div>
   );
}
