"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
   const [isSortOpen, setIsSortOpen] = useState(false);
   const sortRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
         if (
            sortRef.current &&
            !sortRef.current.contains(event.target as Node)
         ) {
            setIsSortOpen(false);
         }
      }
      if (isSortOpen) {
         document.addEventListener("mousedown", handleClickOutside);
      }
      return () => {
         document.removeEventListener("mousedown", handleClickOutside);
      };
   }, [isSortOpen]);

   return (
      <div className="space-y-5">
         {/* DevBoard Title & Subtitle */}
         <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#f4f3f6] font-display">
               DevBoard
            </h1>
            <p className="mt-1 text-sm text-[#868686] text-balance">
               Real-time runtime release toggles, tester assignments, and
               instant kill switches.
            </p>
         </div>

         {/* Top Filter Group & New Flag Button */}
         <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Status Filter Tabs Container */}
            <div className="inline-flex items-center gap-1 rounded-xl border border-[#262626] bg-[#121212] p-1.5 flex-wrap">
               {/* All */}
               <button
                  type="button"
                  onClick={() => onFilterChange("ALL")}
                  className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-150 active:scale-[0.96] ${
                     activeFilter === "ALL"
                        ? "bg-[#242424] text-[#f4f3f6] border border-[#383838]"
                        : "text-[#868686] hover:text-[#f4f3f6] hover:bg-[#1a1a1a]"
                  }`}
               >
                  <span>All</span>
                  <span className="rounded bg-[#1c1c1c] px-1.5 py-0.5 text-[11px] tabular-nums text-[#a3a3a3]">
                     {totalCount}
                  </span>
               </button>

               {/* Active Global */}
               <button
                  type="button"
                  onClick={() => onFilterChange("GLOBAL")}
                  className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-150 active:scale-[0.96] ${
                     activeFilter === "GLOBAL"
                        ? "bg-[#242424] text-[#f4f3f6] border border-[#383838]"
                        : "text-[#868686] hover:text-[#f4f3f6] hover:bg-[#1a1a1a]"
                  }`}
               >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>Active Global</span>
                  <span className="rounded bg-[#1c1c1c] px-1.5 py-0.5 text-[11px] tabular-nums text-[#a3a3a3]">
                     {globalCount}
                  </span>
               </button>

               {/* Targeted Beta */}
               <button
                  type="button"
                  onClick={() => onFilterChange("TARGETED")}
                  className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-150 active:scale-[0.96] ${
                     activeFilter === "TARGETED"
                        ? "bg-[#242424] text-[#f4f3f6] border border-[#383838]"
                        : "text-[#868686] hover:text-[#f4f3f6] hover:bg-[#1a1a1a]"
                  }`}
               >
                  <svg
                     className="h-3 w-3 text-[#a3a3a3] fill-current shrink-0"
                     viewBox="0 0 24 24"
                  >
                     <polygon points="12,2 22,12 12,22 2,12" />
                  </svg>
                  <span>Targeted Beta</span>
                  <span className="rounded bg-[#1c1c1c] px-1.5 py-0.5 text-[11px] tabular-nums text-[#a3a3a3]">
                     {targetedCount}
                  </span>
               </button>

               {/* Killed / Dormant */}
               <button
                  type="button"
                  onClick={() => onFilterChange("KILLED")}
                  className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-150 active:scale-[0.96] ${
                     activeFilter === "KILLED"
                        ? "bg-[#242424] text-[#f4f3f6] border border-[#383838]"
                        : "text-[#868686] hover:text-[#f4f3f6] hover:bg-[#1a1a1a]"
                  }`}
               >
                  <XCircle className="h-3.5 w-3.5 text-[#868686] shrink-0" />
                  <span>Killed/Dormant</span>
                  <span className="rounded bg-[#1c1c1c] px-1.5 py-0.5 text-[11px] tabular-nums text-[#a3a3a3]">
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
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#737373]" />
               <Input
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Filter flags..."
                  className="pl-9 bg-[#141414] border-[#262626] text-[#f4f3f6] placeholder:text-[#666666] text-xs rounded-xl w-60 h-9 focus-visible:ring-1 focus-visible:ring-neutral-400"
               />
            </div>

            {/* Right: Sort Dropdown */}
            <div className="relative self-end sm:self-auto" ref={sortRef}>
               <button
                  type="button"
                  onClick={() => setIsSortOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#262626] bg-[#141414] px-3 py-1.5 text-xs font-medium text-[#d1d1d1] hover:text-white hover:bg-[#1a1a1a] transition-colors active:scale-[0.96]"
               >
                  <span>{SORT_LABELS[sortBy]}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#868686]" />
               </button>

               {isSortOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-[#2e2e2e] bg-[#161616] py-1 shadow-2xl z-30 animate-in fade-in-0 duration-100">
                     {(
                        [
                           { id: "UPDATED", label: "Sort: Updated" },
                           { id: "KEY_ASC", label: "Sort: Key (A-Z)" },
                           { id: "CREATED_DESC", label: "Sort: Created" },
                           { id: "TESTERS_DESC", label: "Sort: Testers" },
                        ] as const
                     ).map((option) => (
                        <button
                           key={option.id}
                           type="button"
                           onClick={() => {
                              onSortChange(option.id);
                              setIsSortOpen(false);
                           }}
                           className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors ${
                              sortBy === option.id
                                 ? "bg-[#242424] text-white font-medium"
                                 : "text-[#868686] hover:text-[#f4f3f6] hover:bg-[#1c1c1c]"
                           }`}
                        >
                           <span>{option.label}</span>
                           {sortBy === option.id && (
                              <span className="h-1.5 w-1.5 rounded-full bg-white" />
                           )}
                        </button>
                     ))}
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}
