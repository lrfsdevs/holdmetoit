"use client";

import { ChevronDown, Plus, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuRadioGroup,
   DropdownMenuRadioItem,
   DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type FilterStatus = "ALL" | "GLOBAL" | "TARGETED" | "KILLED";
export type SortOption =
   "UPDATED" | "KEY_ASC" | "CREATED_DESC" | "TESTERS_DESC";

interface DevBoardHeaderProps {
   totalCount: number;
   globalCount: number;
   targetedCount: number;
   killedOrDisabledCount: number;
   searchQuery: string;
   onSearchChange: (query: string) => void;
   activeFilter: FilterStatus;
   onFilterChange: (filter: FilterStatus) => void;
   sortBy: SortOption;
   onSortChange: (sort: SortOption) => void;
   onCreateClick: () => void;
}

const SORT_LABELS: Record<SortOption, string> = {
   UPDATED: "Sort: Updated",
   KEY_ASC: "Sort: Key (A-Z)",
   CREATED_DESC: "Sort: Created",
   TESTERS_DESC: "Sort: Testers",
};

/** Renders the DevBoard heading and developer-facing controls. */
export function DevBoardHeader({
   totalCount,
   globalCount,
   targetedCount,
   killedOrDisabledCount,
   searchQuery,
   onSearchChange,
   activeFilter,
   onFilterChange,
   sortBy,
   onSortChange,
   onCreateClick,
}: DevBoardHeaderProps) {
   return (
      <div className="space-y-5">
         {/* DevBoard Title & Subtitle */}
         <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary font-display">
               DevBoard
            </h1>
            <p className="mt-1 text-sm text-text-tertiary text-balance">
               Real-time runtime release toggles, tester assignments, and
               instant kill switches.
            </p>
         </div>

         {/* Top Filter Group & New Flag Button */}
         <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Status Filter Tabs Container */}
            <div className="inline-flex items-center gap-1 rounded-xl border border-border-default bg-surface-primary p-1.5 flex-wrap">
               {/* All */}
               <button
                  type="button"
                  onClick={() => onFilterChange("ALL")}
                  className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-150 active:scale-[0.96] ${
                     activeFilter === "ALL"
                        ? "bg-surface-nested text-text-primary border border-border-strong"
                        : "text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary"
                  }`}
               >
                  <span>All</span>
                  <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-meta tabular-nums text-text-tertiary">
                     {totalCount}
                  </span>
               </button>

               {/* Active Global */}
               <button
                  type="button"
                  onClick={() => onFilterChange("GLOBAL")}
                  className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-150 active:scale-[0.96] ${
                     activeFilter === "GLOBAL"
                        ? "bg-surface-nested text-text-primary border border-border-strong"
                        : "text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary"
                  }`}
               >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>Active Global</span>
                  <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-meta tabular-nums text-text-tertiary">
                     {globalCount}
                  </span>
               </button>

               {/* Targeted Beta */}
               <button
                  type="button"
                  onClick={() => onFilterChange("TARGETED")}
                  className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-150 active:scale-[0.96] ${
                     activeFilter === "TARGETED"
                        ? "bg-surface-nested text-text-primary border border-border-strong"
                        : "text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary"
                  }`}
               >
                  <svg
                     className="h-3 w-3 text-text-tertiary fill-current shrink-0"
                     viewBox="0 0 24 24"
                  >
                     <polygon points="12,2 22,12 12,22 2,12" />
                  </svg>
                  <span>Targeted Beta</span>
                  <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-meta tabular-nums text-text-tertiary">
                     {targetedCount}
                  </span>
               </button>

               {/* Killed / Dormant */}
               <button
                  type="button"
                  onClick={() => onFilterChange("KILLED")}
                  className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-150 active:scale-[0.96] ${
                     activeFilter === "KILLED"
                        ? "bg-surface-nested text-text-primary border border-border-strong"
                        : "text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary"
                  }`}
               >
                  <XCircle className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                  <span>Killed/Dormant</span>
                  <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-meta tabular-nums text-text-tertiary">
                     {killedOrDisabledCount}
                  </span>
               </button>
            </div>

            {/* New Flag CTA Button */}
            <Button
               onClick={onCreateClick}
               className="bg-white hover:bg-neutral-200 text-black font-semibold text-sm rounded-xl px-4 py-2 flex items-center gap-1.5 active:scale-[0.96] transition-transform duration-150 ease-out shadow-sm shrink-0 self-start lg:self-center"
            >
               <Plus className="h-4 w-4 text-black" />
               <span>New Flag</span>
            </Button>
         </div>

         {/* Sub-bar: Search and Sort */}
         <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: Search input */}
            <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
               <Input
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Filter flags..."
                  className="pl-9 bg-surface-primary border-border-default text-text-primary placeholder:text-text-tertiary text-xs rounded-xl w-60 h-9 focus-visible:ring-1 focus-visible:ring-neutral-400"
               />
            </div>

            {/* Right: Sort Dropdown */}
            <div className="self-end sm:self-auto">
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border-default bg-surface-primary px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-white hover:bg-surface-tertiary transition-colors active:scale-[0.96]"
                     >
                        <span>{SORT_LABELS[sortBy]}</span>
                        <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" />
                     </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                     <DropdownMenuRadioGroup
                        value={sortBy}
                        onValueChange={(value) =>
                           onSortChange(value as SortOption)
                        }
                     >
                        {(
                           Object.entries(SORT_LABELS) as [SortOption, string][]
                        ).map(([id, label]) => (
                           <DropdownMenuRadioItem key={id} value={id}>
                              {label}
                           </DropdownMenuRadioItem>
                        ))}
                     </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
               </DropdownMenu>
            </div>
         </div>
      </div>
   );
}
