"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, Plus, Search, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchDiscordUsersAction } from "../api/feature-flags.actions";
import type { FeatureFlagEntity } from "../domain/feature-flags.types";

interface UserResult {
   id: string;
   name?: string | null;
   username?: string | null;
   displayName?: string | null;
   image?: string | null;
   discordId?: string | null;
}

interface TesterSelectorDialogProps {
   isOpen: boolean;
   onClose: () => void;
   flag: FeatureFlagEntity | null;
   onAssignTester: (flagId: string, userId: string) => Promise<void>;
   onRemoveTester: (flagId: string, userId: string) => Promise<void>;
}

export function TesterSelectorDialog({
   isOpen,
   onClose,
   flag,
   onAssignTester,
   onRemoveTester,
}: TesterSelectorDialogProps) {
   const [searchQuery, setSearchQuery] = useState("");
   const [searchResults, setSearchResults] = useState<UserResult[]>([]);
   const [isSearching, setIsSearching] = useState(false);
   const [pendingActionUserId, setPendingActionUserId] = useState<
      string | null
   >(null);

   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         if (e.key === "Escape" && isOpen) {
            onClose();
         }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
   }, [isOpen, onClose]);

   useEffect(() => {
      if (!isOpen) return;

      let isMounted = true;
      setIsSearching(true);

      const timer = setTimeout(async () => {
         const res = await searchDiscordUsersAction(searchQuery);
         if (isMounted) {
            if (res.ok && Array.isArray(res.data)) {
               setSearchResults(res.data as UserResult[]);
            }
            setIsSearching(false);
         }
      }, 250);

      return () => {
         isMounted = false;
         clearTimeout(timer);
      };
   }, [searchQuery, isOpen]);

   if (!isOpen || !flag) return null;

   const assignedUserIds = new Set(flag.targets?.map((t) => t.userId) || []);

   const handleAssign = async (userId: string) => {
      try {
         setPendingActionUserId(userId);
         await onAssignTester(flag.id, userId);
      } finally {
         setPendingActionUserId(null);
      }
   };

   const handleRemove = async (userId: string) => {
      try {
         setPendingActionUserId(userId);
         await onRemoveTester(flag.id, userId);
      } finally {
         setPendingActionUserId(null);
      }
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in-0 duration-150">
         <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tester-dialog-title"
            className="w-full max-w-lg rounded-2xl border border-[#2e2e2e] bg-[#161616] p-6 shadow-2xl relative text-[#f4f3f6] max-h-[85vh] flex flex-col"
         >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
               <div>
                  <h2
                     id="tester-dialog-title"
                     className="text-xl font-semibold font-display leading-tight tracking-tight text-[#f4f3f6]"
                  >
                     Manage Testers
                  </h2>
                  <p className="text-xs text-[#868686]">{flag.key}</p>
               </div>
               <button
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="rounded-lg p-1 text-[#868686] hover:bg-[#262626] hover:text-white transition-colors active:scale-[0.96]"
               >
                  <X className="h-5 w-5" />
               </button>
            </div>

            {/* Assigned Testers Section */}
            <div className="mt-4">
               <span className="block text-xs font-semibold uppercase tracking-wider text-[#868686] mb-2">
                  Assigned Testers ({flag.targets?.length ?? 0})
               </span>

               {!flag.targets || flag.targets.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#292929] p-4 text-center text-xs text-[#868686]">
                     No testers assigned yet. Search and add Discord users
                     below.
                  </div>
               ) : (
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                     {flag.targets.map((target) => (
                        <div
                           key={target.userId}
                           className="flex items-center gap-2 rounded-lg border border-[#333333] bg-[#1a1a1a] px-2.5 py-1 text-xs"
                        >
                           <div className="relative h-5 w-5 rounded-full overflow-hidden bg-[#242424] outline outline-1 outline-white/10 shrink-0">
                              {target.user?.image ? (
                                 <Image
                                    src={target.user.image}
                                    alt=""
                                    fill
                                    sizes="20px"
                                    className="object-cover"
                                 />
                              ) : (
                                 <span className="flex h-full w-full items-center justify-center text-[10px] text-white">
                                    {(target.user?.displayName || "T")[0]}
                                 </span>
                              )}
                           </div>
                           <span className="font-medium text-[#f4f3f6] max-w-[120px] truncate">
                              {target.user?.displayName ||
                                 target.user?.username ||
                                 "Tester"}
                           </span>
                           <button
                              onClick={() => handleRemove(target.userId)}
                              disabled={pendingActionUserId === target.userId}
                              title="Remove tester"
                              className="text-[#868686] hover:text-red-400 p-0.5 rounded transition-colors active:scale-[0.96]"
                           >
                              <X className="h-3.5 w-3.5" />
                           </button>
                        </div>
                     ))}
                  </div>
               )}
            </div>

            {/* Search Input */}
            <div className="mt-5">
               <label className="block text-xs font-semibold uppercase tracking-wider text-[#868686] mb-1.5">
                  Search Discord Scholars
               </label>
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#868686]" />
                  <Input
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     placeholder="Search by display name, username, or Snowflake..."
                     className="pl-9 bg-[#111111] border-[#292929] text-[#f4f3f6] placeholder:text-[#666666] text-xs rounded-xl"
                  />
               </div>
            </div>

            {/* Search Results List */}
            <div className="mt-3 flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[160px]">
               {isSearching ? (
                  <div className="flex items-center justify-center py-8 text-xs text-[#868686] gap-2">
                     <Loader2 className="h-4 w-4 animate-spin text-[#868686]" />
                     <span>Searching users...</span>
                  </div>
               ) : searchResults.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#868686]">
                     No users matching &quot;{searchQuery}&quot; found.
                  </div>
               ) : (
                  searchResults.map((user) => {
                     const isAssigned = assignedUserIds.has(user.id);
                     return (
                        <div
                           key={user.id}
                           className="flex items-center justify-between p-2 rounded-xl bg-[#1a1a1a] border border-[#262626] hover:border-[#383838] transition-colors"
                        >
                           <div className="flex items-center gap-2.5 min-w-0">
                              <div className="relative h-7 w-7 rounded-full overflow-hidden bg-[#242424] outline outline-1 outline-white/10 shrink-0">
                                 {user.image ? (
                                    <Image
                                       src={user.image}
                                       alt=""
                                       fill
                                       sizes="28px"
                                       className="object-cover"
                                    />
                                 ) : (
                                    <span className="flex h-full w-full items-center justify-center text-xs text-white">
                                       {
                                          (user.displayName ||
                                             user.username ||
                                             "U")[0]
                                       }
                                    </span>
                                 )}
                              </div>
                              <div className="min-w-0">
                                 <p className="text-xs font-semibold text-[#f4f3f6] truncate">
                                    {user.displayName || user.name || "Scholar"}
                                 </p>
                                 <p className="text-[10px] text-[#868686] truncate">
                                    @{user.username || "unknown"}{" "}
                                    {user.discordId && `• ${user.discordId}`}
                                 </p>
                              </div>
                           </div>

                           {isAssigned ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-2 py-1 rounded-lg shrink-0">
                                 <UserCheck className="h-3 w-3" />
                                 Assigned
                              </span>
                           ) : (
                              <Button
                                 size="sm"
                                 onClick={() => handleAssign(user.id)}
                                 disabled={pendingActionUserId === user.id}
                                 className="bg-[#242424] hover:bg-[#303030] border border-[#3a3a3a] text-[#f4f3f6] rounded-lg text-xs h-7 px-2.5 active:scale-[0.96] transition-transform duration-150 shrink-0"
                              >
                                 <Plus className="h-3 w-3 mr-1" />
                                 Add Tester
                              </Button>
                           )}
                        </div>
                     );
                  })
               )}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-[#262626] flex justify-end">
               <Button
                  onClick={onClose}
                  className="bg-[#292929] hover:bg-[#333333] text-[#f4f3f6] rounded-xl text-xs active:scale-[0.96]"
               >
                  Done
               </Button>
            </div>
         </div>
      </div>
   );
}
