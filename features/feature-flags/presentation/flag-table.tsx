"use client";

import { useState } from "react";
import {
   Check,
   Copy,
   Edit2,
   FileText,
   MoreHorizontal,
   Power,
   Trash2,
   Users,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
   FeatureFlagEntity,
   RolloutModeType,
} from "../domain/feature-flags.types";
import { formatRelativeTime } from "../domain/relative-time";

interface FlagTableProps {
   flags: FeatureFlagEntity[];
   selectedFlagIds: Set<string>;
   onToggleSelectAll: () => void;
   onToggleSelectRow: (flagId: string) => void;
   onToggleMaster: (flagId: string, isEnabled: boolean) => Promise<void>;
   onSetRolloutMode: (flagId: string, mode: RolloutModeType) => Promise<void>;
   onManageTesters: (flag: FeatureFlagEntity) => void;
   onViewAuditLogs: (flag: FeatureFlagEntity) => void;
   onEdit: (flag: FeatureFlagEntity) => void;
   onDelete: (flagId: string) => Promise<void>;
}

export function FlagTable({
   flags,
   selectedFlagIds,
   onToggleSelectAll,
   onToggleSelectRow,
   onToggleMaster,
   onSetRolloutMode,
   onManageTesters,
   onViewAuditLogs,
   onEdit,
   onDelete,
}: FlagTableProps) {
   const [copiedKey, setCopiedKey] = useState<string | null>(null);
   const [pendingModeFlagId, setPendingModeFlagId] = useState<string | null>(
      null
   );

   const handleCopy = (key: string) => {
      navigator.clipboard.writeText(key);
      setCopiedKey(key);
      setTimeout(() => {
         setCopiedKey((curr) => (curr === key ? null : curr));
      }, 2000);
   };

   const handleModeChange = async (
      flagId: string,
      newMode: RolloutModeType
   ) => {
      try {
         setPendingModeFlagId(flagId);
         await onSetRolloutMode(flagId, newMode);
      } finally {
         setPendingModeFlagId(null);
      }
   };

   const isAllSelected =
      flags.length > 0 && selectedFlagIds.size === flags.length;

   return (
      <div className="rounded-xl border border-[#222222] bg-[#0c0c0c] overflow-hidden shadow-xl">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[860px]">
               {/* Table Header */}
               <thead>
                  <tr className="border-b border-[#1c1c1c] bg-[#101010]/90 text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                     <th scope="col" className="w-10 px-4 py-3 text-center">
                        <Checkbox
                           checked={isAllSelected}
                           onCheckedChange={onToggleSelectAll}
                           aria-label="Select all flags"
                           className="size-4 rounded border-[#434343] bg-[#181818] text-[#0d0d0d] shadow-none focus-visible:ring-1 focus-visible:ring-[#868686] data-[state=checked]:border-[#f4f3f6] data-[state=checked]:bg-[#f4f3f6] data-[state=checked]:text-[#0d0d0d]"
                        />
                     </th>
                     <th scope="col" className="px-4 py-3">
                        Key & Description
                     </th>
                     <th scope="col" className="px-4 py-3 text-center">
                        Environment Status
                     </th>
                     <th scope="col" className="px-4 py-3 text-center">
                        Rollout
                     </th>
                     <th scope="col" className="px-4 py-3 text-center">
                        Targeting
                     </th>
                     <th scope="col" className="px-4 py-3 text-right">
                        Last Modified
                     </th>
                     <th scope="col" className="w-12 px-4 py-3 text-center">
                        <span className="sr-only">Actions</span>
                     </th>
                  </tr>
               </thead>

               {/* Table Body */}
               <tbody className="divide-y divide-[#181818]">
                  {flags.map((flag) => {
                     const testersCount = flag.targets?.length ?? 0;
                     const isSelected = selectedFlagIds.has(flag.id);
                     const authorName =
                        flag.creator?.displayName ||
                        flag.creator?.username ||
                        "Unknown";

                     return (
                        <tr
                           key={flag.id}
                           className={`group transition-colors duration-150 hover:bg-[#141414] ${
                              isSelected ? "bg-[#181818]/60" : ""
                           }`}
                        >
                           {/* Select Checkbox */}
                           <td className="w-10 px-4 py-3.5 text-center align-middle">
                              <Checkbox
                                 checked={isSelected}
                                 onCheckedChange={() =>
                                    onToggleSelectRow(flag.id)
                                 }
                                 aria-label={`Select flag ${flag.key}`}
                                 className="size-4 rounded border-[#434343] bg-[#181818] text-[#0d0d0d] shadow-none focus-visible:ring-1 focus-visible:ring-[#868686] data-[state=checked]:border-[#f4f3f6] data-[state=checked]:bg-[#f4f3f6] data-[state=checked]:text-[#0d0d0d]"
                              />
                           </td>

                           {/* Key & Description */}
                           <td className="px-4 py-3.5 align-middle">
                              <div className="flex items-center gap-1.5 text-sm font-semibold text-[#f4f3f6]">
                                 <span>{flag.key}</span>
                                 <button
                                    type="button"
                                    onClick={() => handleCopy(flag.key)}
                                    title="Click to copy flag key"
                                    className="text-[#737373] hover:text-[#f4f3f6] p-0.5 rounded transition-colors active:scale-[0.96]"
                                 >
                                    {copiedKey === flag.key ? (
                                       <Check className="h-3.5 w-3.5 text-emerald-400" />
                                    ) : (
                                       <Copy className="h-3.5 w-3.5" />
                                    )}
                                 </button>
                              </div>
                              <p className="text-xs text-[#868686] mt-0.5 truncate max-w-xs sm:max-w-md">
                                 {flag.description || flag.name}
                              </p>
                           </td>

                           {/* Environment Status */}
                           <td className="px-4 py-3.5 text-center align-middle whitespace-nowrap">
                              <span className="text-xs font-medium text-[#d1d1d1]">
                                 {!flag.isEnabled
                                    ? "Off"
                                    : flag.rolloutMode === "GLOBAL"
                                      ? "Global"
                                      : flag.rolloutMode === "TARGETED"
                                        ? "Targeted"
                                        : "Off"}
                              </span>
                           </td>

                           {/* Rollout Segmented Control */}
                           <td className="px-4 py-3.5 text-center align-middle whitespace-nowrap">
                              <div className="inline-flex items-center rounded-lg bg-[#181818] p-0.5 border border-[#282828] text-xs font-medium">
                                 {(
                                    [
                                       { mode: "DISABLED", label: "Disabled" },
                                       { mode: "TARGETED", label: "Targeted" },
                                       { mode: "GLOBAL", label: "Global" },
                                    ] as const
                                 ).map((item) => (
                                    <button
                                       key={item.mode}
                                       type="button"
                                       disabled={pendingModeFlagId === flag.id}
                                       onClick={() =>
                                          handleModeChange(flag.id, item.mode)
                                       }
                                       className={`rounded px-2.5 py-1 text-xs font-medium transition-colors duration-150 active:scale-[0.96] ${
                                          flag.rolloutMode === item.mode
                                             ? "bg-[#2f2f2f] text-white font-semibold shadow-sm"
                                             : "text-[#737373] hover:text-[#d1d1d1]"
                                       }`}
                                    >
                                       {item.label}
                                    </button>
                                 ))}
                              </div>
                           </td>

                           {/* Targeting Testers Button */}
                           <td className="px-4 py-3.5 text-center align-middle whitespace-nowrap">
                              <button
                                 type="button"
                                 onClick={() => onManageTesters(flag)}
                                 className="inline-flex items-center gap-1.5 rounded-lg border border-[#282828] bg-[#161616] px-2.5 py-1 text-xs text-[#a3a3a3] hover:text-white hover:border-[#383838] transition-colors duration-150 active:scale-[0.96] cursor-pointer"
                              >
                                 <Users className="h-3.5 w-3.5 text-[#868686]" />
                                 <span>{testersCount} testers</span>
                              </button>
                           </td>

                           {/* Last Modified */}
                           <td className="px-4 py-3.5 text-right align-middle text-xs text-[#868686] whitespace-nowrap">
                              <span>
                                 Updated {formatRelativeTime(flag.updatedAt)} •
                                 by {authorName}
                              </span>
                           </td>

                           {/* Actions Dropdown */}
                           <td className="w-12 px-4 py-3.5 text-center align-middle relative">
                              <DropdownMenu>
                                 <DropdownMenuTrigger asChild>
                                    <button
                                       type="button"
                                       aria-label={`Actions for ${flag.key}`}
                                       className="rounded-lg p-1.5 text-[#868686] hover:bg-[#222222] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#868686] transition-colors active:scale-[0.96]"
                                    >
                                       <MoreHorizontal
                                          className="h-4 w-4"
                                          aria-hidden="true"
                                       />
                                    </button>
                                 </DropdownMenuTrigger>
                                 <DropdownMenuContent
                                    align="end"
                                    className="w-48 rounded-xl border-[#2e2e2e] bg-[#161616] text-[#f4f3f6]"
                                 >
                                    <DropdownMenuItem
                                       onSelect={() =>
                                          onToggleMaster(
                                             flag.id,
                                             !flag.isEnabled
                                          )
                                       }
                                       className="text-xs focus:bg-[#242424] focus:text-[#f4f3f6]"
                                    >
                                       <Power
                                          className="text-[#868686]"
                                          aria-hidden="true"
                                       />
                                       <span>
                                          {flag.isEnabled
                                             ? "Turn Off (Kill Switch)"
                                             : "Turn On (Enable Switch)"}
                                       </span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                       onSelect={() => onManageTesters(flag)}
                                       className="text-xs focus:bg-[#242424] focus:text-[#f4f3f6]"
                                    >
                                       <Users
                                          className="text-[#868686]"
                                          aria-hidden="true"
                                       />
                                       <span>Manage Testers</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                       onSelect={() => onViewAuditLogs(flag)}
                                       className="text-xs focus:bg-[#242424] focus:text-[#f4f3f6]"
                                    >
                                       <FileText
                                          className="text-[#868686]"
                                          aria-hidden="true"
                                       />
                                       <span>Audit History</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                       onSelect={() => onEdit(flag)}
                                       className="text-xs focus:bg-[#242424] focus:text-[#f4f3f6]"
                                    >
                                       <Edit2
                                          className="text-[#868686]"
                                          aria-hidden="true"
                                       />
                                       <span>Edit Flag</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-[#262626]" />
                                    <DropdownMenuItem
                                       onSelect={() => onDelete(flag.id)}
                                       className="text-xs text-red-400 focus:bg-red-950/30 focus:text-red-300"
                                    >
                                       <Trash2
                                          className="text-red-400"
                                          aria-hidden="true"
                                       />
                                       <span>Delete Flag</span>
                                    </DropdownMenuItem>
                                 </DropdownMenuContent>
                              </DropdownMenu>
                           </td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>
      </div>
   );
}
