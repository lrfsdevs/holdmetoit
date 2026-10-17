"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { PokemonSpeciesWithCounts } from "../data/pokemon-catalogue.repository";
import {
   UserCollectionSummary,
   UserPokemonInstance,
} from "../data/user-pokemon.repository";
import {
   BannerViewModel,
   AcquisitionResultViewModel,
} from "../data/acquisition.repository";
import { PityState } from "../domain/acquisition/pity-engine";
import {
   CATALOGUE_PAGE_SIZE,
   CatalogueSortKey,
} from "../domain/catalogue-query";
import { PokemonProgressHeader } from "./pokemon-progress-header";
import { PokemonActiveTab, PokemonFilterBar } from "./pokemon-filter-bar";
import { PokemonCard } from "./pokemon-card";
import { PokemonDetailModal } from "./pokemon-detail-modal";
import { BannerCard } from "./acquisition/banner-card";
import { AcquisitionHistoryModal } from "./acquisition/acquisition-history-modal";
import { AdminBannerModal } from "./acquisition/admin-banner-modal";
import { calculateCollectionProgress } from "../domain/collection-progress";
import { listActiveBannersAction } from "../api/acquisition.actions";
import { getPokemonCatalogueAction } from "../api/pokemon.actions";
import { Inbox, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataPagination } from "@/components/ui/data-pagination";

interface PokemonViewProps {
   initialSpecies: PokemonSpeciesWithCounts[];
   initialTotalCount: number;
   initialSummary: UserCollectionSummary | null;
   initialInstances: UserPokemonInstance[];
   initialBanners?: BannerViewModel[];
   initialUserPities?: Record<string, PityState>;
   userAvailableCoins?: number;
   isAdmin?: boolean;
   isSpectator?: boolean;
}

function CatalogueSkeleton() {
   return (
      <div
         className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
         data-testid="pokemon-cards-skeleton"
      >
         {Array.from({ length: 12 }).map((_, i) => (
            <div
               key={i}
               className="h-56 rounded-2xl bg-pokedex-cardSubtle/60 border border-pokedex-border animate-pulse"
            />
         ))}
      </div>
   );
}

export function PokemonView({
   initialSpecies,
   initialTotalCount,
   initialSummary,
   initialInstances,
   initialBanners = [],
   initialUserPities = {},
   userAvailableCoins = 0,
   isAdmin = false,
   isSpectator = false,
}: PokemonViewProps) {
   const [activeTab, setActiveTab] = useState<PokemonActiveTab>("pokedex");
   const [search, setSearch] = useState("");
   const [debouncedSearch, setDebouncedSearch] = useState("");
   const [selectedRarity, setSelectedRarity] = useState("");
   const [selectedType, setSelectedType] = useState("");
   const [selectedGeneration, setSelectedGeneration] = useState("");
   const [selectedClassification, setSelectedClassification] = useState("");
   const [sortBy, setSortBy] = useState("pokedex");

   const [species, setSpecies] =
      useState<PokemonSpeciesWithCounts[]>(initialSpecies);
   const [totalCount, setTotalCount] = useState(initialTotalCount);
   const [currentPage, setCurrentPage] = useState(1);
   const [error, setError] = useState<string | null>(null);
   const [reloadKey, setReloadKey] = useState(0);
   const [isPending, startTransition] = useTransition();

   const [selectedSpecies, setSelectedSpecies] =
      useState<PokemonSpeciesWithCounts | null>(null);

   // Dynamic user and collection state to reflect immediate pull outcomes
   const [ownershipMap, setOwnershipMap] = useState<Record<string, number>>(
      () => initialSummary?.speciesOwnershipCounts ?? {}
   );
   const [earliestMap, setEarliestMap] = useState<Record<string, string>>(
      () => initialSummary?.speciesEarliestObtained ?? {}
   );
   const [summary, setSummary] = useState<UserCollectionSummary | null>(
      initialSummary
   );
   const [banners, setBanners] = useState<BannerViewModel[]>(initialBanners);
   const [userPities, setUserPities] =
      useState<Record<string, PityState>>(initialUserPities);
   const [availableCoins, setAvailableCoins] =
      useState<number>(userAvailableCoins);

   // Modals
   const [isHistoryOpen, setIsHistoryOpen] = useState(false);
   const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

   const didMountRef = useRef(false);
   const requestIdRef = useRef(0);

   // Debounce the search box so typing doesn't hammer the DB.
   useEffect(() => {
      const trimmed = search.trim();
      const timer = setTimeout(() => setDebouncedSearch(trimmed), 300);
      return () => clearTimeout(timer);
   }, [search]);

   // Server-side (re)fetch: page + filters + sort all resolve in the DB.
   useEffect(() => {
      if (!didMountRef.current) {
         didMountRef.current = true;
         return;
      }

      const requestId = ++requestIdRef.current;
      startTransition(async () => {
         setError(null);
         const res = await getPokemonCatalogueAction({
            scope: activeTab === "collection" ? "collection" : "catalogue",
            page: currentPage,
            limit: CATALOGUE_PAGE_SIZE,
            search: debouncedSearch || undefined,
            rarity: selectedRarity || undefined,
            type: selectedType || undefined,
            generation: selectedGeneration
               ? Number(selectedGeneration)
               : undefined,
            classification: (selectedClassification || undefined) as
               "legendary" | "mythical" | "standard" | undefined,
            sortBy: sortBy as CatalogueSortKey,
         });

         if (requestId !== requestIdRef.current) return;

         if (res.ok) {
            setSpecies(res.data.species);
            setTotalCount(res.data.totalCount);
         } else {
            setError(res.error || "Failed to load the catalogue.");
         }
      });
   }, [
      activeTab,
      debouncedSearch,
      selectedRarity,
      selectedType,
      selectedGeneration,
      selectedClassification,
      sortBy,
      currentPage,
      reloadKey,
      startTransition,
   ]);

   // Every filter/search/sort/tab change resets to page 1 (avoids stale pages).
   const handleTabChange = (tab: PokemonActiveTab) => {
      setActiveTab(tab);
      setCurrentPage(1);
   };
   const handleSearchChange = (value: string) => {
      setSearch(value);
      setCurrentPage(1);
   };
   const handleRarityChange = (value: string) => {
      setSelectedRarity(value);
      setCurrentPage(1);
   };
   const handleTypeChange = (value: string) => {
      setSelectedType(value);
      setCurrentPage(1);
   };
   const handleGenerationChange = (value: string) => {
      setSelectedGeneration(value);
      setCurrentPage(1);
   };
   const handleClassificationChange = (value: string) => {
      setSelectedClassification(value);
      setCurrentPage(1);
   };
   const handleSortChange = (value: string) => {
      setSortBy(value);
      setCurrentPage(1);
   };
   const handleResetFilters = () => {
      setSearch("");
      setSelectedRarity("");
      setSelectedType("");
      setSelectedGeneration("");
      setSelectedClassification("");
      setCurrentPage(1);
   };

   // Handle live acquisition outcome without full page reload
   const handleAcquisitionSuccess = (result: AcquisitionResultViewModel) => {
      // 1. Update available balance
      setAvailableCoins(result.newBalance);

      // 2. Update pity state for this banner
      setUserPities((prev) => ({
         ...prev,
         [result.bannerId]: {
            pityCount: result.pityCountAfter,
            guaranteedFeatured: result.pityTriggered
               ? false
               : (prev[result.bannerId]?.guaranteedFeatured ?? false),
         },
      }));

      // 3. Update species ownership count
      const speciesId = result.species.id;
      const isFirstTime =
         !ownershipMap[speciesId] || ownershipMap[speciesId] === 0;

      setOwnershipMap((prev) => ({
         ...prev,
         [speciesId]: (prev[speciesId] ?? 0) + 1,
      }));

      if (isFirstTime) {
         setEarliestMap((prev) => ({
            ...prev,
            [speciesId]: new Date().toISOString(),
         }));
      }

      // 4. Update summary progress statistics
      setSummary((prev) => {
         if (!prev) return null;
         const newUnique =
            prev.progress.uniqueOwnedCount + (isFirstTime ? 1 : 0);
         const newInstances = prev.progress.totalInstancesCount + 1;
         const newProgress = calculateCollectionProgress(
            newUnique,
            prev.progress.totalAvailableCount,
            newInstances
         );
         return {
            ...prev,
            progress: newProgress,
         };
      });
   };

   const handleBannersChanged = async () => {
      const res = await listActiveBannersAction();
      if (res.ok) {
         setBanners(res.data.banners);
      }
   };

   const totalPages = Math.max(1, Math.ceil(totalCount / CATALOGUE_PAGE_SIZE));
   const hasActiveFilters =
      search.trim() !== "" ||
      selectedRarity !== "" ||
      selectedType !== "" ||
      selectedGeneration !== "" ||
      selectedClassification !== "";

   return (
      <div className="space-y-6 pb-12">
         {/* Pokédex Progress Header */}
         <PokemonProgressHeader
            progress={summary?.progress ?? null}
            isSpectator={isSpectator}
         />

         {/* Filter and Tab Navigation Bar */}
         <PokemonFilterBar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            search={search}
            onSearchChange={handleSearchChange}
            selectedRarity={selectedRarity}
            onRarityChange={handleRarityChange}
            selectedType={selectedType}
            onTypeChange={handleTypeChange}
            selectedGeneration={selectedGeneration}
            onGenerationChange={handleGenerationChange}
            selectedClassification={selectedClassification}
            onClassificationChange={handleClassificationChange}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            isSpectator={isSpectator}
            isAdmin={isAdmin}
            onOpenHistory={() => setIsHistoryOpen(true)}
            onOpenAdmin={() => setIsAdminModalOpen(true)}
         />

         {/* Main Tab Views */}
         {activeTab === "summon" ? (
            banners.length > 0 ? (
               <div
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  data-testid="summon-banners-grid"
               >
                  {banners.map((banner) => (
                     <BannerCard
                        key={banner.id}
                        banner={banner}
                        userPity={
                           userPities[banner.id] ?? {
                              pityCount: 0,
                              guaranteedFeatured: false,
                           }
                        }
                        userAvailableCoins={availableCoins}
                        isLoggedIn={!isSpectator}
                        onAcquisitionSuccess={handleAcquisitionSuccess}
                        onViewCollection={() => handleTabChange("collection")}
                     />
                  ))}
               </div>
            ) : (
               <div
                  className="flex flex-col items-center justify-center py-16 px-4 rounded-2xl bg-pokedex-cardSubtle/50 border border-pokedex-border text-center"
                  data-testid="summon-empty-state"
               >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pokedex-inset text-amber-400 mb-4 border border-amber-500/20 shadow-lg shadow-amber-500/10">
                     <Sparkles className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">
                     Summon Portals Currently Sealed
                  </h3>
                  <p className="text-xs sm:text-sm text-pokedex-textMuted max-w-md mb-6 leading-relaxed">
                     No companion banners are currently active. Event banners
                     become available during seasonal challenges, milestones,
                     and special community study events!
                  </p>
                  {isAdmin && (
                     <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAdminModalOpen(true)}
                        className="text-xs border-purple-500/40 text-purple-300 hover:bg-purple-500/20"
                        data-testid="empty-admin-banners-btn"
                     >
                        Open Admin Banner Manager
                     </Button>
                  )}
               </div>
            )
         ) : error ? (
            <div
               className="flex flex-col items-center justify-center py-16 px-4 rounded-2xl bg-red-500/5 border border-red-500/30 text-center"
               data-testid="pokemon-error-state"
            >
               <h3 className="text-base font-semibold text-white mb-1">
                  Couldn&apos;t load the Pokédex
               </h3>
               <p className="text-xs sm:text-sm text-pokedex-textMuted max-w-sm mb-4">
                  {error}
               </p>
               <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="text-xs border-pokedex-borderLight text-pokedex-textSecondary hover:text-white hover:border-pokedex-border"
               >
                  Retry
               </Button>
            </div>
         ) : species.length > 0 ? (
            <div className="space-y-4">
               <div
                  className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 transition-opacity ${
                     isPending ? "opacity-50" : "opacity-100"
                  }`}
                  data-testid="pokemon-cards-grid"
               >
                  {species.map((sp) => (
                     <PokemonCard
                        key={sp.id}
                        species={sp}
                        ownedCount={ownershipMap[sp.id] ?? 0}
                        earliestObtainedAt={earliestMap[sp.id] ?? null}
                        mode={activeTab}
                        onClick={() => setSelectedSpecies(sp)}
                     />
                  ))}
               </div>
               <DataPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalCount}
                  pageSize={CATALOGUE_PAGE_SIZE}
                  onPageChange={setCurrentPage}
                  itemLabel="Pokémon"
               />
            </div>
         ) : isPending ? (
            <CatalogueSkeleton />
         ) : (
            /* Empty State (Law L9) */
            <div
               className="flex flex-col items-center justify-center py-16 px-4 rounded-2xl bg-pokedex-cardSubtle/50 border border-pokedex-border text-center"
               data-testid="pokemon-empty-state"
            >
               <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pokedex-inset text-pokedex-textMuted mb-3">
                  <Inbox className="w-6 h-6" />
               </div>
               <h3 className="text-base font-semibold text-white mb-1">
                  {activeTab === "collection"
                     ? "Your Collection is Empty"
                     : "No Pokémon Match Your Filters"}
               </h3>
               <p className="text-xs sm:text-sm text-pokedex-textMuted max-w-sm mb-4">
                  {activeTab === "collection"
                     ? "You haven't obtained any Pokémon yet. Complete your daily study goals, earn coins, and head to the Summon Portal to unlock companions!"
                     : "Try adjusting your search terms or clearing your filters."}
               </p>
               {hasActiveFilters && (
                  <Button
                     variant="outline"
                     size="sm"
                     onClick={handleResetFilters}
                     className="text-xs border-pokedex-borderLight text-pokedex-textSecondary hover:text-white hover:border-pokedex-border"
                  >
                     Reset Filters
                  </Button>
               )}
            </div>
         )}

         {/* Detail Modal */}
         <PokemonDetailModal
            species={selectedSpecies}
            isOpen={Boolean(selectedSpecies)}
            onClose={() => setSelectedSpecies(null)}
            ownedCount={
               selectedSpecies ? (ownershipMap[selectedSpecies.id] ?? 0) : 0
            }
            earliestObtainedAt={
               selectedSpecies
                  ? (earliestMap[selectedSpecies.id] ?? null)
                  : null
            }
         />

         {/* Acquisition History Modal */}
         <AcquisitionHistoryModal
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
         />

         {/* Admin Banner Management Modal */}
         {isAdmin && (
            <AdminBannerModal
               isOpen={isAdminModalOpen}
               onClose={() => setIsAdminModalOpen(false)}
               onBannersChanged={handleBannersChanged}
            />
         )}
      </div>
   );
}
