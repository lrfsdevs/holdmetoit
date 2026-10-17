"use client";

import React, { useEffect, useState } from "react";
import { getUserAcquisitionHistoryAction } from "../../api/acquisition.actions";
import { UserAcquisitionHistoryItem } from "../../data/acquisition-history.repository";
import { PokemonRarityBadge } from "../pokemon-rarity-badge";
import { CoinsIcon } from "@/features/economy/presentation/coins-icon";
import { Button } from "@/components/ui/button";
import {
   History,
   X,
   Copy,
   CheckCircle2,
   ChevronRight,
   Loader2,
   Sparkles,
} from "lucide-react";

interface AcquisitionHistoryModalProps {
   isOpen: boolean;
   onClose: () => void;
   bannerId?: string;
}

export function AcquisitionHistoryModal({
   isOpen,
   onClose,
   bannerId,
}: AcquisitionHistoryModalProps) {
   const [items, setItems] = useState<UserAcquisitionHistoryItem[]>([]);
   const [nextCursor, setNextCursor] = useState<string | null>(null);
   const [isLoading, setIsLoading] = useState(false);
   const [totalCount, setTotalCount] = useState<number>(0);

   const loadHistory = async (cursor?: string) => {
      setIsLoading(true);
      try {
         const res = await getUserAcquisitionHistoryAction({
            bannerId,
            limit: 15,
            cursor,
         });

         if (res.ok) {
            if (cursor) {
               setItems((prev) => [...prev, ...res.data.items]);
            } else {
               setItems(res.data.items);
            }
            setNextCursor(res.data.nextCursor);
            setTotalCount(res.data.totalCount);
         }
      } catch {
         // Handled silently
      } finally {
         setIsLoading(false);
      }
   };

   useEffect(() => {
      if (isOpen) {
         loadHistory();
      } else {
         setItems([]);
         setNextCursor(null);
      }
   }, [isOpen, bannerId]);

   // Escape key handler
   useEffect(() => {
      if (!isOpen) return;
      const handleKeyDown = (e: KeyboardEvent) => {
         if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
   }, [isOpen, onClose]);

   if (!isOpen) return null;

   return (
      <div
         className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
         role="dialog"
         aria-modal="true"
         aria-labelledby="history-modal-title"
      >
         <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border border-pokedex-border bg-gradient-to-b from-pokedex-elevated to-pokedex-bg p-5 sm:p-6 shadow-2xl text-white">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-pokedex-borderSubtle">
               <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-pokedex-cardSubtle border border-pokedex-border text-pokedex-textSecondary">
                     <History className="w-4 h-4" />
                  </div>
                  <div>
                     <h3
                        id="history-modal-title"
                        className="text-base font-bold text-white"
                     >
                        Summon Acquisition History
                     </h3>
                     <p className="text-xs text-pokedex-textMuted">
                        {totalCount} total summon{" "}
                        {totalCount === 1 ? "record" : "records"} on ledger
                     </p>
                  </div>
               </div>

               <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl bg-pokedex-cardSubtle text-pokedex-textMuted hover:text-white hover:bg-pokedex-border transition-colors"
                  aria-label="Close history modal"
               >
                  <X className="w-4 h-4" />
               </button>
            </div>

            {/* Scrollable Records List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
               {items.length === 0 && !isLoading ? (
                  <div className="py-12 text-center text-pokedex-textMuted text-xs">
                     No summon acquisitions found. Start summoning from active
                     banners to build your history!
                  </div>
               ) : (
                  items.map((item) => {
                     const formattedDate = new Date(
                        item.createdAt
                     ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                     });

                     return (
                        <div
                           key={item.id}
                           className="p-3 rounded-2xl bg-pokedex-cardSubtle/70 border border-pokedex-borderSubtle hover:border-pokedex-border transition-colors flex items-center justify-between gap-3 text-xs"
                        >
                           <div className="flex items-center gap-3 min-w-0">
                              {item.species.imageUrl ? (
                                 <img
                                    src={item.species.imageUrl}
                                    alt={item.species.name}
                                    className="w-10 h-10 object-contain drop-shadow-sm shrink-0"
                                    loading="lazy"
                                 />
                              ) : (
                                 <div className="w-10 h-10 rounded-xl bg-pokedex-inset flex items-center justify-center text-pokedex-textDim shrink-0 font-bold">
                                    ?
                                 </div>
                              )}

                              <div className="min-w-0 space-y-0.5">
                                 <div className="flex items-center gap-2">
                                    <span className="font-bold text-white truncate text-sm">
                                       {item.species.name}
                                    </span>
                                    <PokemonRarityBadge
                                       rarity={item.rarity}
                                       size="sm"
                                       showStars={false}
                                    />
                                    {item.isFeatured && (
                                       <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                          Featured
                                       </span>
                                    )}
                                 </div>

                                 <div className="flex items-center gap-2 text-[11px] text-pokedex-textMuted">
                                    <span>{item.bannerName}</span>
                                    <span>•</span>
                                    <span>{formattedDate}</span>
                                 </div>
                              </div>
                           </div>

                           <div className="text-right space-y-1 shrink-0">
                              <div className="font-semibold text-economy-gold flex items-center justify-end gap-1 font-mono">
                                 <CoinsIcon className="w-3 h-3" />
                                 <span>{item.costPaid}c</span>
                              </div>

                              <div className="flex items-center justify-end gap-1 text-[10px]">
                                 {item.isDuplicate ? (
                                    <span className="text-pokedex-textDim flex items-center gap-0.5">
                                       <Copy className="w-2.5 h-2.5" />{" "}
                                       Duplicate
                                    </span>
                                 ) : (
                                    <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                                       <CheckCircle2 className="w-2.5 h-2.5" />{" "}
                                       Discovery
                                    </span>
                                 )}
                                 {item.pityTriggered && (
                                    <span className="text-amber-400 font-semibold ml-1">
                                       [Pity]
                                    </span>
                                 )}
                              </div>
                           </div>
                        </div>
                     );
                  })
               )}

               {isLoading && (
                  <div className="py-6 flex items-center justify-center gap-2 text-xs text-pokedex-textMuted">
                     <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                     <span>Loading records...</span>
                  </div>
               )}

               {nextCursor && !isLoading && (
                  <div className="pt-2 text-center">
                     <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => loadHistory(nextCursor)}
                        className="text-xs border-pokedex-borderLight text-pokedex-textSecondary hover:text-white"
                     >
                        Load More Records
                     </Button>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}
