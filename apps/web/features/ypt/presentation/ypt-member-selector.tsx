"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { ChevronDown, User as UserIcon, Lock, Loader2 } from "lucide-react";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import {
   Command,
   CommandInput,
   CommandItem,
   CommandList,
} from "@/components/ui/command";
import { getYptRosterAction } from "../api/ypt-claim.actions";
import type { YptRosterEntry } from "../data/ypt-claim.repository";

interface YptMemberSelectorProps {
   selectedMember: YptRosterEntry | null;
   onSelectMember: (member: YptRosterEntry) => void;
   disabled?: boolean;
}

export function YptMemberSelector({
   selectedMember,
   onSelectMember,
   disabled = false,
}: YptMemberSelectorProps) {
   const [isOpen, setIsOpen] = useState(false);
   const [searchQuery, setSearchQuery] = useState("");
   const [members, setMembers] = useState<YptRosterEntry[]>([]);
   const [isLoading, setIsLoading] = useState(false);

   const loadMembers = React.useCallback(async () => {
      setIsLoading(true);
      try {
         const res = await getYptRosterAction();
         if (res.ok && res.data) {
            setMembers(res.data);
         }
      } finally {
         setIsLoading(false);
      }
   }, []);

   useEffect(() => {
      void loadMembers();
   }, [loadMembers]);

   const filteredMembers = members.filter((m) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return m.nickname.toLowerCase().includes(q);
   });

   const handleSelect = (member: YptRosterEntry) => {
      if (member.claimStatus === "LINKED") return; // cannot select already verified by another
      onSelectMember(member);
      setIsOpen(false);
   };

   return (
      <div className="w-full">
         <Label
            htmlFor="ypt-member-select"
            className="text-xs font-semibold text-text-secondary block mb-1.5"
         >
            Select your YPT identity
         </Label>

         <Popover
            open={isOpen}
            onOpenChange={(open) => {
               setIsOpen(open);
               if (!open) setSearchQuery("");
            }}
         >
            {/* Trigger Button */}
            <PopoverTrigger asChild>
               <button
                  id="ypt-member-select"
                  type="button"
                  disabled={disabled}
                  className="w-full flex items-center justify-between rounded-xl border border-border-default bg-surface-elevated px-3 py-2.5 text-xs text-left text-text-primary hover:border-border-strong transition-colors disabled:opacity-50"
                  data-testid="ypt-member-select-trigger"
               >
                  {selectedMember ? (
                     <div className="flex items-center gap-2.5 truncate">
                        <div className="relative h-6 w-6 rounded-full overflow-hidden bg-surface-primary border border-border-subtle shrink-0">
                           {selectedMember.avatarUrl ? (
                              <Image
                                 src={selectedMember.avatarUrl}
                                 alt={selectedMember.nickname}
                                 fill
                                 sizes="24px"
                                 className="object-cover"
                              />
                           ) : (
                              <UserIcon className="h-3.5 w-3.5 m-auto text-text-tertiary" />
                           )}
                        </div>
                        <span className="font-semibold text-white truncate">
                           {selectedMember.nickname}
                        </span>
                     </div>
                  ) : (
                     <span className="text-text-tertiary">
                        Choose your account from the YPT member list...
                     </span>
                  )}
                  <ChevronDown
                     className={`h-4 w-4 text-text-tertiary transition-transform ${
                        isOpen ? "rotate-180" : ""
                     }`}
                  />
               </button>
            </PopoverTrigger>

            {/* Searchable Dropdown */}
            <PopoverContent
               align="start"
               className="w-[var(--radix-popover-trigger-width)] p-0"
            >
               <Command shouldFilter={false}>
                  <CommandInput
                     value={searchQuery}
                     onValueChange={setSearchQuery}
                     placeholder="Search members by nickname..."
                     autoFocus
                  />
                  <CommandList>
                     {isLoading && members.length === 0 ? (
                        <div className="py-6 text-center text-xs text-text-tertiary flex items-center justify-center gap-2">
                           <Loader2 className="h-4 w-4 animate-spin text-brand-1" />
                           <span>Loading Yeolpumta group members...</span>
                        </div>
                     ) : filteredMembers.length === 0 ? (
                        <div className="py-6 text-center text-xs text-text-tertiary">
                           {members.length === 0
                              ? "No joined YPT study groups or members found for this account."
                              : "No matching members found."}
                        </div>
                     ) : (
                        filteredMembers.map((m) => {
                           const isSelected =
                              selectedMember?.yptUserId === m.yptUserId;
                           const isLinked = m.claimStatus === "LINKED";

                           return (
                              <CommandItem
                                 key={m.yptUserId}
                                 value={m.yptUserId}
                                 disabled={isLinked}
                                 onSelect={() => handleSelect(m)}
                                 className={`items-center justify-between p-2 ${
                                    isSelected
                                       ? "bg-brand-1/15 text-white"
                                       : isLinked
                                         ? "opacity-50"
                                         : undefined
                                 }`}
                              >
                                 {/* Left: Avatar + Identity */}
                                 <div className="flex items-center gap-2.5 truncate">
                                    <div className="relative h-7 w-7 rounded-full overflow-hidden bg-surface-elevated border border-border-subtle shrink-0">
                                       {m.avatarUrl ? (
                                          <Image
                                             src={m.avatarUrl}
                                             alt={m.nickname}
                                             fill
                                             sizes="28px"
                                             className="object-cover"
                                          />
                                       ) : (
                                          <UserIcon className="h-4 w-4 m-auto text-text-tertiary" />
                                       )}
                                    </div>
                                    <div className="font-semibold text-white flex items-center gap-1.5 truncate">
                                       <span className="truncate">
                                          {m.nickname}
                                       </span>
                                       {m.isSelf && (
                                          <span className="text-label bg-brand-1/15 text-brand-1 border border-brand-1/30 px-1.5 py-0.2 rounded font-mono">
                                             You
                                          </span>
                                       )}
                                    </div>
                                 </div>

                                 {/* Right: lock only when already linked */}
                                 {isLinked && (
                                    <span className="inline-flex items-center gap-1 text-label text-zinc-500 font-medium px-2 py-0.5 rounded-md bg-zinc-800/60 border border-zinc-700/40 shrink-0">
                                       <Lock className="h-2.5 w-2.5" />
                                       Already linked
                                    </span>
                                 )}
                              </CommandItem>
                           );
                        })
                     )}
                  </CommandList>
               </Command>
            </PopoverContent>
         </Popover>
      </div>
   );
}
