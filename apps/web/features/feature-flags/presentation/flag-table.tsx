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
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@/components/ui/table";
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

/** Renders the searchable and filterable feature-flag table. */
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
      <div className="rounded-xl border border-border-subtle bg-surface-page overflow-hidden shadow-xl">
         <div className="overflow-x-auto">
            <Table className="w-full text-left border-collapse min-w-[860px]">
               {/* Table Header */}
               <TableHeader>
                  <TableRow className="border-b border-border-subtle bg-surface-page/90 text-meta font-semibold uppercase tracking-wider text-text-tertiary">
                     <TableHead
                        scope="col"
                        className="w-10 px-4 py-3 text-center"
                     >
                        <Checkbox
                           checked={isAllSelected}
                           onCheckedChange={onToggleSelectAll}
                           aria-label="Select all flags"
                           className="size-4 rounded border-border-strong bg-surface-secondary text-text-inverse shadow-none focus-visible:ring-1 focus-visible:ring-border-strong data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-text-inverse"
                        />
                     </TableHead>
                     <TableHead scope="col" className="px-4 py-3">
                        Key & Description
                     </TableHead>
                     <TableHead scope="col" className="px-4 py-3 text-center">
                        Environment Status
                     </TableHead>
                     <TableHead scope="col" className="px-4 py-3 text-center">
                        Rollout
                     </TableHead>
                     <TableHead scope="col" className="px-4 py-3 text-center">
                        Targeting
                     </TableHead>
                     <TableHead scope="col" className="px-4 py-3 text-right">
                        Last Modified
                     </TableHead>
                     <TableHead
                        scope="col"
                        className="w-12 px-4 py-3 text-center"
                     >
                        <span className="sr-only">Actions</span>
                     </TableHead>
                  </TableRow>
               </TableHeader>

               {/* Table Body */}
               <TableBody className="divide-y divide-surface-secondary">
                  {flags.map((flag) => {
                     const testersCount = flag.targets?.length ?? 0;
                     const isSelected = selectedFlagIds.has(flag.id);
                     const authorName =
                        flag.creator?.displayName ||
                        flag.creator?.username ||
                        "Unknown";

                     return (
                        <TableRow
                           key={flag.id}
                           className={`group transition-colors duration-150 hover:bg-surface-primary ${
                              isSelected ? "bg-surface-secondary/60" : ""
                           }`}
                        >
                           {/* Select Checkbox */}
                           <TableCell className="w-10 px-4 py-3.5 text-center align-middle">
                              <Checkbox
                                 checked={isSelected}
                                 onCheckedChange={() =>
                                    onToggleSelectRow(flag.id)
                                 }
                                 aria-label={`Select flag ${flag.key}`}
                                 className="size-4 rounded border-border-strong bg-surface-secondary text-text-inverse shadow-none focus-visible:ring-1 focus-visible:ring-border-strong data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-text-inverse"
                              />
                           </TableCell>

                           {/* Key & Description */}
                           <TableCell className="px-4 py-3.5 align-middle">
                              <div className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                                 <span>{flag.key}</span>
                                 <button
                                    type="button"
                                    onClick={() => handleCopy(flag.key)}
                                    title="Click to copy flag key"
                                    className="text-text-tertiary hover:text-text-primary p-0.5 rounded transition-colors active:scale-[0.96]"
                                 >
                                    {copiedKey === flag.key ? (
                                       <Check className="h-3.5 w-3.5 text-emerald-400" />
                                    ) : (
                                       <Copy className="h-3.5 w-3.5" />
                                    )}
                                 </button>
                              </div>
                              <p className="text-xs text-text-tertiary mt-0.5 truncate max-w-xs sm:max-w-md">
                                 {flag.description || flag.name}
                              </p>
                           </TableCell>

                           {/* Environment Status */}
                           <TableCell className="px-4 py-3.5 text-center align-middle whitespace-nowrap">
                              <span className="text-xs font-medium text-text-secondary">
                                 {!flag.isEnabled
                                    ? "Off"
                                    : flag.rolloutMode === "GLOBAL"
                                      ? "Global"
                                      : flag.rolloutMode === "TARGETED"
                                        ? "Targeted"
                                        : "Off"}
                              </span>
                           </TableCell>

                           {/* Rollout Segmented Control */}
                           <TableCell className="px-4 py-3.5 text-center align-middle whitespace-nowrap">
                              <div className="inline-flex items-center rounded-lg bg-surface-secondary p-0.5 border border-border-default text-xs font-medium">
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
                                             ? "bg-surface-nested text-white font-semibold shadow-sm"
                                             : "text-text-tertiary hover:text-text-secondary"
                                       }`}
                                    >
                                       {item.label}
                                    </button>
                                 ))}
                              </div>
                           </TableCell>

                           {/* Targeting Testers Button */}
                           <TableCell className="px-4 py-3.5 text-center align-middle whitespace-nowrap">
                              <button
                                 type="button"
                                 onClick={() => onManageTesters(flag)}
                                 className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-primary px-2.5 py-1 text-xs text-text-tertiary hover:text-white hover:border-border-strong transition-colors duration-150 active:scale-[0.96] cursor-pointer"
                              >
                                 <Users className="h-3.5 w-3.5 text-text-tertiary" />
                                 <span>{testersCount} testers</span>
                              </button>
                           </TableCell>

                           {/* Last Modified */}
                           <TableCell className="px-4 py-3.5 text-right align-middle text-xs text-text-tertiary whitespace-nowrap">
                              <span>
                                 Updated {formatRelativeTime(flag.updatedAt)} •
                                 by {authorName}
                              </span>
                           </TableCell>

                           {/* Actions Dropdown */}
                           <TableCell className="w-12 px-4 py-3.5 text-center align-middle relative">
                              <DropdownMenu>
                                 <DropdownMenuTrigger asChild>
                                    <button
                                       type="button"
                                       aria-label={`Actions for ${flag.key}`}
                                       className="rounded-lg p-1.5 text-text-tertiary hover:bg-surface-elevated hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong transition-colors active:scale-[0.96]"
                                    >
                                       <MoreHorizontal
                                          className="h-4 w-4"
                                          aria-hidden="true"
                                       />
                                    </button>
                                 </DropdownMenuTrigger>
                                 <DropdownMenuContent
                                    align="end"
                                    className="w-48 rounded-xl border-border-strong bg-surface-primary text-text-primary"
                                 >
                                    <DropdownMenuItem
                                       onSelect={() =>
                                          onToggleMaster(
                                             flag.id,
                                             !flag.isEnabled
                                          )
                                       }
                                       className="text-xs focus:bg-surface-nested focus:text-text-primary"
                                    >
                                       <Power
                                          className="text-text-tertiary"
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
                                       className="text-xs focus:bg-surface-nested focus:text-text-primary"
                                    >
                                       <Users
                                          className="text-text-tertiary"
                                          aria-hidden="true"
                                       />
                                       <span>Manage Testers</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                       onSelect={() => onViewAuditLogs(flag)}
                                       className="text-xs focus:bg-surface-nested focus:text-text-primary"
                                    >
                                       <FileText
                                          className="text-text-tertiary"
                                          aria-hidden="true"
                                       />
                                       <span>Audit History</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                       onSelect={() => onEdit(flag)}
                                       className="text-xs focus:bg-surface-nested focus:text-text-primary"
                                    >
                                       <Edit2
                                          className="text-text-tertiary"
                                          aria-hidden="true"
                                       />
                                       <span>Edit Flag</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-surface-nested" />
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
                           </TableCell>
                        </TableRow>
                     );
                  })}
               </TableBody>
            </Table>
         </div>
      </div>
   );
}
