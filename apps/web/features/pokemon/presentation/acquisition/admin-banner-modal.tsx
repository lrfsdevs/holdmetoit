"use client";

import React, { useEffect, useState } from "react";
import {
   adminCreateBannerAction,
   adminListAllBannersAction,
   adminSetBannerStatusAction,
} from "../../api/acquisition.actions";
import { BannerViewModel } from "../../data/acquisition.repository";
import { BannerStatus } from "../../domain/acquisition/banner-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@/components/ui/select";
import {
   Shield,
   X,
   Plus,
   AlertCircle,
   CheckCircle2,
   Play,
   Pause,
} from "lucide-react";

interface AdminBannerModalProps {
   isOpen: boolean;
   onClose: () => void;
   onBannersChanged?: () => void;
}

export function AdminBannerModal({
   isOpen,
   onClose,
   onBannersChanged,
}: AdminBannerModalProps) {
   const [banners, setBanners] = useState<BannerViewModel[]>([]);
   const [isLoading, setIsLoading] = useState(false);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [errorMessage, setErrorMessage] = useState<string | null>(null);
   const [successMessage, setSuccessMessage] = useState<string | null>(null);
   const [showCreateForm, setShowCreateForm] = useState(false);

   // Form State
   const [name, setName] = useState("");
   const [slug, setSlug] = useState("");
   const [description, setDescription] = useState("");
   const [pullCost, setPullCost] = useState(500);
   const [hardPity, setHardPity] = useState(50);
   const [targetRarity, setTargetRarity] = useState("LEGENDARY");
   const [normalRate, setNormalRate] = useState(6000);
   const [uncommonRate, setUncommonRate] = useState(2500);
   const [rareRate, setRareRate] = useState(1000);
   const [epicRate, setEpicRate] = useState(400);
   const [legendaryRate, setLegendaryRate] = useState(90);
   const [mythicalRate, setMythicalRate] = useState(10);

   const totalRate =
      normalRate +
      uncommonRate +
      rareRate +
      epicRate +
      legendaryRate +
      mythicalRate;

   const loadBanners = async () => {
      setIsLoading(true);
      try {
         const res = await adminListAllBannersAction();
         if (res.ok) {
            setBanners(res.data.banners);
         }
      } catch (err: any) {
         setErrorMessage(err.message);
      } finally {
         setIsLoading(false);
      }
   };

   useEffect(() => {
      if (isOpen) {
         loadBanners();
         setErrorMessage(null);
         setSuccessMessage(null);
      }
   }, [isOpen]);

   const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (totalRate !== 10000) {
         setErrorMessage(
            `Total probability rates must sum to exactly 10,000 bps (currently: ${totalRate}).`
         );
         return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
         const res = await adminCreateBannerAction({
            name,
            slug,
            description,
            pullCost,
            status: "DRAFT",
            startAt: new Date().toISOString(),
            rarityRates: {
               NORMAL: normalRate,
               UNCOMMON: uncommonRate,
               RARE: rareRate,
               EPIC: epicRate,
               LEGENDARY: legendaryRate,
               MYTHICAL: mythicalRate,
            },
            pityConfig: {
               hardPityThreshold: hardPity,
               targetRarity: targetRarity as any,
               resetOnRarities: [targetRarity as any, "MYTHICAL"],
               featuredGuarantee: true,
            },
         });

         if (res.ok) {
            setSuccessMessage("Banner created successfully in DRAFT state.");
            setShowCreateForm(false);
            setName("");
            setSlug("");
            setDescription("");
            await loadBanners();
            onBannersChanged?.();
         } else {
            setErrorMessage(res.error);
         }
      } catch (err: any) {
         setErrorMessage(err.message);
      } finally {
         setIsSubmitting(false);
      }
   };

   const handleToggleStatus = async (banner: BannerViewModel) => {
      const nextStatus: BannerStatus =
         banner.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
      setIsLoading(true);
      try {
         const res = await adminSetBannerStatusAction(banner.id, nextStatus);
         if (res.ok) {
            await loadBanners();
            onBannersChanged?.();
         } else {
            setErrorMessage(res.error);
         }
      } catch (err: any) {
         setErrorMessage(err.message);
      } finally {
         setIsLoading(false);
      }
   };

   if (!isOpen) return null;

   return (
      <Dialog
         open={isOpen}
         onOpenChange={(open) => {
            if (!open) onClose();
         }}
      >
         <DialogContent className="max-w-2xl flex flex-col rounded-3xl border border-border-default bg-gradient-to-b from-surface-elevated to-surface-page text-white">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
               <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                     <Shield className="w-4 h-4" />
                  </div>
                  <div>
                     <DialogTitle className="text-base font-bold text-white">
                        Banner Management Console
                     </DialogTitle>
                     <p className="text-xs text-text-tertiary">
                        Host / Developer authority for summon banner
                        configuration
                     </p>
                  </div>
               </div>
            </div>

            {/* Feedback alerts */}
            {errorMessage && (
               <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
               </div>
            )}

            {successMessage && (
               <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMessage}</span>
               </div>
            )}

            {/* Content body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
               {!showCreateForm ? (
                  <div className="space-y-3">
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                           All Configured Banners ({banners.length})
                        </span>
                        <Button
                           type="button"
                           size="sm"
                           variant="admin"
                           onClick={() => setShowCreateForm(true)}
                           className="text-xs"
                        >
                           <Plus className="w-3.5 h-3.5 mr-1" />
                           New Draft Banner
                        </Button>
                     </div>

                     {banners.length === 0 && !isLoading ? (
                        <div className="py-8 text-center text-xs text-text-tertiary border border-dashed border-border-default rounded-2xl">
                           No banners configured yet. Create a new draft banner
                           to begin.
                        </div>
                     ) : (
                        banners.map((b) => (
                           <div
                              key={b.id}
                              className="p-3.5 rounded-2xl bg-surface-primary border border-border-default flex items-center justify-between gap-3 text-xs"
                           >
                              <div className="space-y-1 min-w-0">
                                 <div className="flex items-center gap-2">
                                    <span className="font-bold text-white truncate text-sm">
                                       {b.name}
                                    </span>
                                    <span
                                       className={`px-2 py-0.5 rounded-full text-label font-bold uppercase ${
                                          b.status === "ACTIVE"
                                             ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                             : "bg-surface-elevated text-text-tertiary border border-border-default"
                                       }`}
                                    >
                                       {b.status}
                                    </span>
                                 </div>
                                 <p className="text-meta text-text-tertiary truncate">
                                    Slug: {b.slug} • Pull Cost: {b.pullCost}c •
                                    Pity: {b.pityConfig?.hardPityThreshold ?? 0}
                                 </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                 <Button
                                    type="button"
                                    variant={
                                       b.status === "ACTIVE"
                                          ? "outline"
                                          : "admin"
                                    }
                                    size="sm"
                                    onClick={() => handleToggleStatus(b)}
                                    className="text-xs"
                                 >
                                    {b.status === "ACTIVE" ? (
                                       <>
                                          <Pause className="w-3 h-3 mr-1" />{" "}
                                          Pause
                                       </>
                                    ) : (
                                       <>
                                          <Play className="w-3 h-3 mr-1" />{" "}
                                          Activate
                                       </>
                                    )}
                                 </Button>
                              </div>
                           </div>
                        ))
                     )}
                  </div>
               ) : (
                  /* Create Banner Form */
                  <form onSubmit={handleCreate} className="space-y-4">
                     <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                        <h4 className="text-sm font-bold text-white">
                           Create New Banner Configuration
                        </h4>
                        <Button
                           type="button"
                           variant="ghost"
                           size="sm"
                           onClick={() => setShowCreateForm(false)}
                           className="text-xs text-text-tertiary"
                        >
                           Cancel
                        </Button>
                     </div>

                     <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                           <Label
                              htmlFor="banner-name"
                              className="block text-text-tertiary mb-1 font-medium"
                           >
                              Banner Name
                           </Label>
                           <Input
                              id="banner-name"
                              required
                              value={name}
                              onChange={(e) => {
                                 setName(e.target.value);
                                 if (!slug)
                                    setSlug(
                                       e.target.value
                                          .toLowerCase()
                                          .replace(/[^a-z0-9]/g, "-")
                                    );
                              }}
                              placeholder="e.g. Kanto Legends"
                              className="bg-surface-elevated text-white border-border-default h-9"
                           />
                        </div>
                        <div>
                           <Label
                              htmlFor="banner-slug"
                              className="block text-text-tertiary mb-1 font-medium"
                           >
                              Slug (URL)
                           </Label>
                           <Input
                              id="banner-slug"
                              required
                              value={slug}
                              onChange={(e) =>
                                 setSlug(
                                    e.target.value
                                       .toLowerCase()
                                       .replace(/[^a-z0-9-]/g, "")
                                 )
                              }
                              placeholder="kanto-legends"
                              className="bg-surface-elevated text-white border-border-default h-9 font-mono"
                           />
                        </div>
                     </div>

                     <div>
                        <Label
                           htmlFor="banner-description"
                           className="block text-text-tertiary mb-1 font-medium text-xs"
                        >
                           Description
                        </Label>
                        <Textarea
                           id="banner-description"
                           required
                           rows={2}
                           value={description}
                           onChange={(e) => setDescription(e.target.value)}
                           placeholder="Summon description and companion highlights..."
                           className="rounded-xl border-border-default bg-surface-elevated p-2 text-xs text-white placeholder:text-text-tertiary focus:bg-surface-elevated"
                        />
                     </div>

                     <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                           <Label
                              htmlFor="banner-pull-cost"
                              className="block text-text-tertiary mb-1 font-medium"
                           >
                              Pull Cost (Coins)
                           </Label>
                           <Input
                              id="banner-pull-cost"
                              type="number"
                              min={1}
                              value={pullCost}
                              onChange={(e) =>
                                 setPullCost(parseInt(e.target.value) || 0)
                              }
                              className="bg-surface-elevated text-white border-border-default h-9"
                           />
                        </div>
                        <div>
                           <Label
                              htmlFor="banner-hard-pity"
                              className="block text-text-tertiary mb-1 font-medium"
                           >
                              Hard Pity Pulls
                           </Label>
                           <Input
                              id="banner-hard-pity"
                              type="number"
                              min={1}
                              value={hardPity}
                              onChange={(e) =>
                                 setHardPity(parseInt(e.target.value) || 0)
                              }
                              className="bg-surface-elevated text-white border-border-default h-9"
                           />
                        </div>
                        <div>
                           <Label
                              htmlFor="banner-target-rarity"
                              className="block text-text-tertiary mb-1 font-medium"
                           >
                              Pity Target Rarity
                           </Label>
                           <Select
                              value={targetRarity}
                              onValueChange={setTargetRarity}
                           >
                              <SelectTrigger
                                 id="banner-target-rarity"
                                 className="h-9 rounded-xl border-border-default bg-surface-elevated text-xs text-white"
                              >
                                 <SelectValue placeholder="LEGENDARY" />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="LEGENDARY">
                                    LEGENDARY
                                 </SelectItem>
                                 <SelectItem value="MYTHICAL">
                                    MYTHICAL
                                 </SelectItem>
                                 <SelectItem value="EPIC">EPIC</SelectItem>
                                 <SelectItem value="RARE">RARE</SelectItem>
                              </SelectContent>
                           </Select>
                        </div>
                     </div>

                     {/* Rarity Rates in Basis Points */}
                     <div className="p-3 rounded-2xl bg-surface-secondary border border-border-default space-y-2 text-xs">
                        <div className="flex items-center justify-between font-semibold">
                           <span>
                              Rarity Probability Table (Basis Points: 100 bp =
                              1.00%)
                           </span>
                           <span
                              className={
                                 totalRate === 10000
                                    ? "text-emerald-400 font-mono"
                                    : "text-destructive font-mono"
                              }
                           >
                              {totalRate} / 10,000 bps
                           </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-1 text-meta">
                           <div>
                              <Label
                                 htmlFor="banner-rate-normal"
                                 className="text-text-tertiary"
                              >
                                 Normal ({(normalRate / 100).toFixed(1)}%)
                              </Label>
                              <Input
                                 id="banner-rate-normal"
                                 type="number"
                                 value={normalRate}
                                 onChange={(e) =>
                                    setNormalRate(parseInt(e.target.value) || 0)
                                 }
                                 className="bg-surface-elevated text-white h-7 text-xs"
                              />
                           </div>
                           <div>
                              <Label
                                 htmlFor="banner-rate-uncommon"
                                 className="text-text-tertiary"
                              >
                                 Uncommon ({(uncommonRate / 100).toFixed(1)}%)
                              </Label>
                              <Input
                                 id="banner-rate-uncommon"
                                 type="number"
                                 value={uncommonRate}
                                 onChange={(e) =>
                                    setUncommonRate(
                                       parseInt(e.target.value) || 0
                                    )
                                 }
                                 className="bg-surface-elevated text-white h-7 text-xs"
                              />
                           </div>
                           <div>
                              <Label
                                 htmlFor="banner-rate-rare"
                                 className="text-text-tertiary"
                              >
                                 Rare ({(rareRate / 100).toFixed(1)}%)
                              </Label>
                              <Input
                                 id="banner-rate-rare"
                                 type="number"
                                 value={rareRate}
                                 onChange={(e) =>
                                    setRareRate(parseInt(e.target.value) || 0)
                                 }
                                 className="bg-surface-elevated text-white h-7 text-xs"
                              />
                           </div>
                           <div>
                              <Label
                                 htmlFor="banner-rate-epic"
                                 className="text-text-tertiary"
                              >
                                 Epic ({(epicRate / 100).toFixed(1)}%)
                              </Label>
                              <Input
                                 id="banner-rate-epic"
                                 type="number"
                                 value={epicRate}
                                 onChange={(e) =>
                                    setEpicRate(parseInt(e.target.value) || 0)
                                 }
                                 className="bg-surface-elevated text-white h-7 text-xs"
                              />
                           </div>
                           <div>
                              <Label
                                 htmlFor="banner-rate-legendary"
                                 className="text-text-tertiary"
                              >
                                 Legendary ({(legendaryRate / 100).toFixed(1)}%)
                              </Label>
                              <Input
                                 id="banner-rate-legendary"
                                 type="number"
                                 value={legendaryRate}
                                 onChange={(e) =>
                                    setLegendaryRate(
                                       parseInt(e.target.value) || 0
                                    )
                                 }
                                 className="bg-surface-elevated text-white h-7 text-xs"
                              />
                           </div>
                           <div>
                              <Label
                                 htmlFor="banner-rate-mythical"
                                 className="text-text-tertiary"
                              >
                                 Mythical ({(mythicalRate / 100).toFixed(1)}%)
                              </Label>
                              <Input
                                 id="banner-rate-mythical"
                                 type="number"
                                 value={mythicalRate}
                                 onChange={(e) =>
                                    setMythicalRate(
                                       parseInt(e.target.value) || 0
                                    )
                                 }
                                 className="bg-surface-elevated text-white h-7 text-xs"
                              />
                           </div>
                        </div>
                     </div>

                     <div className="pt-2 flex justify-end gap-2">
                        <Button
                           type="button"
                           variant="outline"
                           onClick={() => setShowCreateForm(false)}
                           className="text-xs"
                        >
                           Cancel
                        </Button>
                        <Button
                           type="submit"
                           variant="admin"
                           disabled={isSubmitting || totalRate !== 10000}
                           className="text-xs"
                        >
                           {isSubmitting ? "Creating..." : "Save Draft Banner"}
                        </Button>
                     </div>
                  </form>
               )}
            </div>
         </DialogContent>
      </Dialog>
   );
}
