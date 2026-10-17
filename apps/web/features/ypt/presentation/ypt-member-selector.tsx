"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
   Search,
   ChevronDown,
   User as UserIcon,
   CheckCircle2,
   Lock,
   Clock,
   Loader2,
   BookOpen,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { getRealYptGroupMembersAction } from "../api/ypt-connection.actions";
import type { YptRealGroupMemberItem } from "../data/ypt-connection.repository";

interface YptMemberSelectorProps {
   selectedMember: YptRealGroupMemberItem | null;
   onSelectMember: (member: YptRealGroupMemberItem) => void;
   disabled?: boolean;
}

export function YptMemberSelector({
   selectedMember,
   onSelectMember,
   disabled = false,
}: YptMemberSelectorProps) {
   const [isOpen, setIsOpen] = useState(false);
   const [searchQuery, setSearchQuery] = useState("");
   const [members, setMembers] = useState<YptRealGroupMemberItem[]>([]);
   const [isLoading, setIsLoading] = useState(false);
   const dropdownRef = useRef<HTMLDivElement>(null);

   const loadMembers = React.useCallback(async () => {
      setIsLoading(true);
      try {
         const res = await getRealYptGroupMembersAction();
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

   // Handle click outside to close dropdown
   useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
         if (
            dropdownRef.current &&
            !dropdownRef.current.contains(event.target as Node)
         ) {
            setIsOpen(false);
         }
      }

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
         document.removeEventListener("mousedown", handleClickOutside);
      };
   }, []);

   const filteredMembers = members.filter((m) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
         m.nickname.toLowerCase().includes(q) ||
         m.yptUserId.includes(q) ||
         (m.currentSubject && m.currentSubject.toLowerCase().includes(q))
      );
   });

   const handleSelect = (member: YptRealGroupMemberItem) => {
      if (member.claimStatus === "LINKED") return; // cannot select already verified by another
      onSelectMember(member);
      setIsOpen(false);
   };

   return (
      <div className="relative w-full" ref={dropdownRef}>
         <label className="text-xs font-semibold text-obsidian-textMuted block mb-1.5">
            Select your YPT identity
         </label>

         {/* Trigger Button */}
         <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between rounded-xl border border-obsidian-border bg-obsidian-elevated px-3 py-2.5 text-xs text-left text-obsidian-text hover:border-obsidian-borderHighlight transition-colors disabled:opacity-50"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            data-testid="ypt-member-select-trigger"
         >
            {selectedMember ? (
               <div className="flex items-center gap-2.5 truncate">
                  <div className="relative h-6 w-6 rounded-full overflow-hidden bg-obsidian-card border border-obsidian-borderSubtle shrink-0">
                     {selectedMember.avatarUrl ? (
                        <Image
                           src={selectedMember.avatarUrl}
                           alt={selectedMember.nickname}
                           fill
                           sizes="24px"
                           className="object-cover"
                        />
                     ) : (
                        <UserIcon className="h-3.5 w-3.5 m-auto text-obsidian-textDim" />
                     )}
                  </div>
                  <div className="truncate">
                     <span className="font-semibold text-white">
                        {selectedMember.nickname}
                     </span>
                     <span className="text-[11px] text-economy-gold font-mono pl-2">
                        YPT ID: {selectedMember.yptUserId}
                     </span>
                     {selectedMember.isStudying && (
                        <span className="text-[10px] text-emerald-400 pl-2">
                           ● Studying {selectedMember.currentSubject || ""}
                        </span>
                     )}
                  </div>
               </div>
            ) : (
               <span className="text-obsidian-textDim">
                  Choose your account from the YPT member list...
               </span>
            )}
            <ChevronDown
               className={`h-4 w-4 text-obsidian-textDim transition-transform ${
                  isOpen ? "rotate-180" : ""
               }`}
            />
         </button>

         {/* Searchable Dropdown Popup */}
         {isOpen && (
            <div
               className="absolute z-50 mt-1.5 w-full rounded-2xl border border-obsidian-borderHighlight bg-[#141414] shadow-2xl backdrop-blur-xl p-2 animate-in fade-in zoom-in-95 duration-150"
               role="listbox"
            >
               {/* Search Box */}
               <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-obsidian-textDim" />
                  <Input
                     type="text"
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     placeholder="Search members by nickname or YPT ID..."
                     className="h-8 min-h-0 rounded-xl border-obsidian-border bg-obsidian-elevated pl-8 pr-3 py-2 text-xs text-white placeholder:text-obsidian-textDim focus:border-economy-gold/50 focus:bg-obsidian-elevated"
                     autoFocus
                  />
               </div>

               {/* Members List */}
               <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {isLoading && members.length === 0 ? (
                     <div className="py-6 text-center text-xs text-obsidian-textDim flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-economy-gold" />
                        <span>Loading Yeolpumta group members...</span>
                     </div>
                  ) : filteredMembers.length === 0 ? (
                     <div className="py-6 text-center text-xs text-obsidian-textDim">
                        {members.length === 0
                           ? "No joined YPT study groups or members found for this account."
                           : "No matching members found."}
                     </div>
                  ) : (
                     filteredMembers.map((m) => {
                        const isSelected =
                           selectedMember?.yptUserId === m.yptUserId;
                        const isLinked = m.claimStatus === "LINKED";
                        const isPending = m.claimStatus === "PENDING";
                        const isVerified = m.claimStatus === "VERIFIED";

                        return (
                           <button
                              key={m.yptUserId}
                              type="button"
                              onClick={() => handleSelect(m)}
                              disabled={isLinked}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
                                 isSelected
                                    ? "bg-economy-gold/15 border border-economy-gold/40 text-white"
                                    : isLinked
                                      ? "opacity-50 cursor-not-allowed bg-obsidian-card/40"
                                      : "hover:bg-obsidian-elevated text-obsidian-text"
                              }`}
                              role="option"
                              aria-selected={isSelected}
                           >
                              {/* Left: Avatar + Identity */}
                              <div className="flex items-center gap-2.5 truncate">
                                 <div className="relative h-7 w-7 rounded-full overflow-hidden bg-obsidian-elevated border border-obsidian-borderSubtle shrink-0">
                                    {m.avatarUrl ? (
                                       <Image
                                          src={m.avatarUrl}
                                          alt={m.nickname}
                                          fill
                                          sizes="28px"
                                          className="object-cover"
                                       />
                                    ) : (
                                       <UserIcon className="h-4 w-4 m-auto text-obsidian-textDim" />
                                    )}
                                 </div>
                                 <div className="text-left truncate">
                                    <div className="font-semibold text-white flex items-center gap-1.5 truncate">
                                       <span className="truncate">
                                          {m.nickname}
                                       </span>
                                       {m.isSelf && (
                                          <span className="text-[10px] bg-economy-gold/15 text-economy-gold border border-economy-gold/30 px-1.5 py-0.2 rounded font-mono">
                                             You
                                          </span>
                                       )}
                                       {m.isStudying && (
                                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1 rounded flex items-center gap-1">
                                             <BookOpen className="h-2.5 w-2.5" />
                                             {m.currentSubject || "Studying"}
                                          </span>
                                       )}
                                    </div>
                                    <div className="text-[11px] text-obsidian-textDim flex items-center gap-2 font-mono">
                                       <span>ID: {m.yptUserId}</span>
                                       {m.todayStudySeconds > 0 && (
                                          <span className="text-emerald-400">
                                             Today:{" "}
                                             {Math.floor(
                                                m.todayStudySeconds / 3600
                                             )}
                                             h{" "}
                                             {Math.floor(
                                                (m.todayStudySeconds % 3600) /
                                                   60
                                             )}
                                             m
                                          </span>
                                       )}
                                    </div>
                                 </div>
                              </div>

                              {/* Right: Status Tag */}
                              <div className="shrink-0 pl-2">
                                 {isLinked ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 font-medium px-2 py-0.5 rounded-md bg-zinc-800/60 border border-zinc-700/40">
                                       <Lock className="h-2.5 w-2.5" />
                                       Already linked
                                    </span>
                                 ) : isPending ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-medium px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30">
                                       <Clock className="h-2.5 w-2.5" />
                                       Pending
                                    </span>
                                 ) : isVerified ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30">
                                       <CheckCircle2 className="h-2.5 w-2.5" />
                                       Verified
                                    </span>
                                 ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/90 font-medium px-2 py-0.5 rounded-md bg-emerald-500/5 border border-emerald-500/20">
                                       ✓ Available
                                    </span>
                                 )}
                              </div>
                           </button>
                        );
                     })
                  )}
               </div>
            </div>
         )}
      </div>
   );
}
