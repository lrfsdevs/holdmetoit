"use client";

import React, { useMemo, useState } from "react";
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
import { PokemonProgressHeader } from "./pokemon-progress-header";
import { PokemonActiveTab, PokemonFilterBar } from "./pokemon-filter-bar";
import { PokemonCard } from "./pokemon-card";
import { PokemonDetailModal } from "./pokemon-detail-modal";
import { BannerCard } from "./acquisition/banner-card";
import { AcquisitionHistoryModal } from "./acquisition/acquisition-history-modal";
import { AdminBannerModal } from "./acquisition/admin-banner-modal";
import { calculateCollectionProgress } from "../domain/collection-progress";
import { listActiveBannersAction } from "../api/acquisition.actions";
import { AlertCircle, Inbox, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PokemonViewProps {
   initialSpecies: PokemonSpeciesWithCounts[];
   initialSummary: UserCollectionSummary | null;
   initialInstances: UserPokemonInstance[];
   initialBanners?: BannerViewModel[];
   initialUserPities?: Record<string, PityState>;
   userAvailableCoins?: number;
   isAdmin?: boolean;
   isSpectator?: boolean;
}

export function PokemonView({
   initialSpecies,
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
   const [selectedRarity, setSelectedRarity] = useState("");
   const [selectedType, setSelectedType] = useState("");
   const [selectedGeneration, setSelectedGeneration] = useState("");
   const [selectedClassification, setSelectedClassification] = useState("");
   const [sortBy, setSortBy] = useState("pokedex");
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

   // Filter and sort items based on active tab and filter criteria
   const filteredSpecies = useMemo(() => {
      let list = [...initialSpecies];

      // If active tab is collection, restrict only to owned species
      if (activeTab === "collection") {
         list = list.filter((sp) => (ownershipMap[sp.id] ?? 0) > 0);
      }

      // Text search
      if (search.trim()) {
         const q = search.trim().toLowerCase();
         list = list.filter(
            (sp) =>
               sp.name.toLowerCase().includes(q) ||
               sp.slug.toLowerCase().includes(q) ||
               (sp.classification &&
                  sp.classification.toLowerCase().includes(q))
         );
      }

      // Generation filter
      if (selectedGeneration) {
         const genNum = parseInt(selectedGeneration, 10);
         list = list.filter((sp) => sp.generation === genNum);
      }

      // Classification filter (Source classification: legendary / mythical / standard)
      if (selectedClassification === "legendary") {
         list = list.filter((sp) => Boolean(sp.isLegendary));
      } else if (selectedClassification === "mythical") {
         list = list.filter((sp) => Boolean(sp.isMythical));
      } else if (selectedClassification === "standard") {
         list = list.filter((sp) => !sp.isLegendary && !sp.isMythical);
      }

      // Rarity filter
      if (selectedRarity) {
         list = list.filter((sp) => sp.rarity === selectedRarity);
      }

      // Type filter
      if (selectedType) {
         const typeUpper = selectedType.toUpperCase();
         list = list.filter(
            (sp) =>
               sp.primaryType.toUpperCase() === typeUpper ||
               sp.secondaryType?.toUpperCase() === typeUpper
         );
      }

      // Sorting
      const rankMap: Record<string, number> = {
         MYTHICAL: 6,
         LEGENDARY: 5,
         EPIC: 4,
         RARE: 3,
         UNCOMMON: 2,
         NORMAL: 1,
      };

      if (sortBy === "name") {
         list.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortBy === "rarity_desc") {
         list.sort(
            (a, b) =>
               (rankMap[b.rarity] ?? 0) - (rankMap[a.rarity] ?? 0) ||
               a.pokedexNumber - b.pokedexNumber
         );
      } else if (sortBy === "rarity_asc") {
         list.sort(
            (a, b) =>
               (rankMap[a.rarity] ?? 0) - (rankMap[b.rarity] ?? 0) ||
               a.pokedexNumber - b.pokedexNumber
         );
      } else if (sortBy === "recent" && activeTab === "collection") {
         list.sort((a, b) => {
            const dateA = earliestMap[a.id]
               ? new Date(earliestMap[a.id]).getTime()
               : 0;
            const dateB = earliestMap[b.id]
               ? new Date(earliestMap[b.id]).getTime()
               : 0;
            return dateB - dateA;
         });
      } else {
         // Default: Pokedex number
         list.sort((a, b) => a.pokedexNumber - b.pokedexNumber);
      }

      return list;
   }, [
      initialSpecies,
      activeTab,
      ownershipMap,
      search,
      selectedGeneration,
      selectedClassification,
      selectedRarity,
      selectedType,
      sortBy,
      earliestMap,
   ]);

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
            onTabChange={setActiveTab}
            search={search}
            onSearchChange={setSearch}
            selectedRarity={selectedRarity}
            onRarityChange={setSelectedRarity}
            selectedType={selectedType}
            onTypeChange={setSelectedType}
            selectedGeneration={selectedGeneration}
            onGenerationChange={setSelectedGeneration}
            selectedClassification={selectedClassification}
            onClassificationChange={setSelectedClassification}
            sortBy={sortBy}
            onSortChange={setSortBy}
            isSpectator={isSpectator}
            isAdmin={isAdmin}
            totalFilteredCount={
               activeTab !== "summon" ? filteredSpecies.length : undefined
            }
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
                        onViewCollection={() => setActiveTab("collection")}
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
         ) : filteredSpecies.length > 0 ? (
            <div
               className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
               data-testid="pokemon-cards-grid"
            >
               {filteredSpecies.map((sp) => (
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
               {(search ||
                  selectedRarity ||
                  selectedType ||
                  selectedGeneration ||
                  selectedClassification) && (
                  <Button
                     variant="outline"
                     size="sm"
                     onClick={() => {
                        setSearch("");
                        setSelectedRarity("");
                        setSelectedType("");
                        setSelectedGeneration("");
                        setSelectedClassification("");
                     }}
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
