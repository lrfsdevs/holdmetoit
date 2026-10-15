"use client";

import { useState } from "react";
import Image from "next/image";
import {
   AlertTriangle,
   Check,
   Clock,
   Copy,
   Edit2,
   FileText,
   Trash2,
   Users,
} from "lucide-react";
import type {
   FeatureFlagEntity,
   RolloutModeType,
} from "../domain/feature-flags.types";

interface FlagCardProps {
   flag: FeatureFlagEntity;
   onToggleMaster: (flagId: string, isEnabled: boolean) => Promise<void>;
   onSetRolloutMode: (flagId: string, mode: RolloutModeType) => Promise<void>;
   onManageTesters: (flag: FeatureFlagEntity) => void;
   onViewAuditLogs: (flag: FeatureFlagEntity) => void;
   onEdit: (flag: FeatureFlagEntity) => void;
   onDelete: (flagId: string) => Promise<void>;
}

export function FlagCard({
   flag,
   onToggleMaster,
   onSetRolloutMode,
   onManageTesters,
   onViewAuditLogs,
   onEdit,
   onDelete,
}: FlagCardProps) {
   const [isCopied, setIsCopied] = useState(false);
   const [isToggling, setIsToggling] = useState(false);
   const [isChangingMode, setIsChangingMode] = useState(false);

   const copyKey = () => {
      navigator.clipboard.writeText(flag.key);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
   };

   const handleToggle = async () => {
      try {
         setIsToggling(true);
         await onToggleMaster(flag.id, !flag.isEnabled);
      } finally {
         setIsToggling(false);
      }
   };

   const handleModeChange = async (newMode: RolloutModeType) => {
      if (newMode === flag.rolloutMode) return;
      try {
         setIsChangingMode(true);
         await onSetRolloutMode(flag.id, newMode);
      } finally {
         setIsChangingMode(false);
      }
   };

   const isEmergencyKilled = !flag.isEnabled;
   const testersCount = flag.targets?.length ?? 0;

   return (
      <div
         className={`rounded-xl border p-4 sm:p-5 transition-colors duration-150 ${
            isEmergencyKilled
               ? "border-red-950/60 bg-[#141010]/80"
               : flag.rolloutMode === "GLOBAL"
                 ? "border-emerald-950/50 bg-[#101412]"
                 : "border-[#292929] bg-[#141414]"
         }`}
      >
         <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* Title and Key metadata */}
            <div className="space-y-1.5 flex-1 min-w-0">
               <div className="flex items-center gap-2 flex-wrap">
                  <button
                     onClick={copyKey}
                     title="Click to copy flag key"
                     className="inline-flex items-center gap-1.5 rounded-md border border-[#333333] bg-[#1a1a1a] px-2 py-0.5 text-xs text-[#d1d1d1] hover:bg-[#252525] hover:text-white transition-colors duration-150 active:scale-[0.96]"
                  >
                     <span>{flag.key}</span>
                     {isCopied ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                     ) : (
                        <Copy className="h-3 w-3 text-[#868686]" />
                     )}
                  </button>

                  {/* Status Pills */}
                  {isEmergencyKilled ? (
                     <span className="inline-flex items-center gap-1 rounded-full bg-red-950/80 border border-red-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">
                        <AlertTriangle className="h-3 w-3" />
                        Kill Switch Active
                     </span>
                  ) : flag.rolloutMode === "GLOBAL" ? (
                     <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                        ● 100% Global
                     </span>
                  ) : flag.rolloutMode === "TARGETED" ? (
                     <span className="inline-flex items-center gap-1 rounded-full bg-[#1c1c1c] border border-[#333333] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#d1d1d1]">
                        ● Targeted Beta ({testersCount})
                     </span>
                  ) : (
                     <span className="inline-flex items-center gap-1 rounded-full bg-[#242424] border border-[#383838] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#a3a3a3]">
                        Dormant
                     </span>
                  )}
               </div>

               <h3 className="text-base font-semibold text-[#f4f3f6] text-wrap:balance">
                  {flag.name}
               </h3>

               {flag.description && (
                  <p className="text-xs text-[#868686] text-wrap:pretty leading-relaxed">
                     {flag.description}
                  </p>
               )}
            </div>

            {/* Master Kill Switch */}
            <div className="flex items-center gap-3 self-end sm:self-start bg-[#1c1c1c] border border-[#292929] rounded-xl px-3 py-2 shrink-0">
               <div className="text-right">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#868686]">
                     Master Switch
                  </span>
                  <span
                     className={`text-xs font-bold ${
                        flag.isEnabled ? "text-emerald-400" : "text-red-400"
                     }`}
                  >
                     {flag.isEnabled ? "ENABLED" : "OFF / KILLED"}
                  </span>
               </div>

               <button
                  type="button"
                  onClick={handleToggle}
                  disabled={isToggling}
                  aria-label={`Toggle master switch for ${flag.key}`}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-[0.96] ${
                     flag.isEnabled ? "bg-emerald-600" : "bg-[#333333]"
                  }`}
               >
                  <span
                     className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        flag.isEnabled ? "translate-x-5" : "translate-x-0"
                     }`}
                  />
               </button>
            </div>
         </div>

         {/* Rollout Mode Segmented Control */}
         <div className="mt-4 pt-4 border-t border-[#222222] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
               <span className="text-xs font-medium text-[#868686]">
                  Rollout:
               </span>
               <div className="inline-flex rounded-lg bg-[#1a1a1a] p-1 border border-[#2e2e2e]">
                  {(
                     [
                        { mode: "DISABLED", label: "Disabled" },
                        { mode: "TARGETED", label: "Targeted" },
                        { mode: "GLOBAL", label: "Global" },
                     ] as const
                  ).map((item) => (
                     <button
                        key={item.mode}
                        onClick={() => handleModeChange(item.mode)}
                        disabled={isChangingMode}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 active:scale-[0.96] ${
                           flag.rolloutMode === item.mode
                              ? "bg-[#292929] text-[#f4f3f6] shadow-sm font-semibold"
                              : "text-[#868686] hover:text-[#d1d1d1]"
                        }`}
                     >
                        {item.label}
                     </button>
                  ))}
               </div>
            </div>

            {/* Tester avatars & Manage Button */}
            <div className="flex items-center gap-2 flex-wrap">
               {testersCount > 0 && (
                  <div className="flex items-center -space-x-1.5 overflow-hidden">
                     {flag.targets?.slice(0, 4).map((target) => (
                        <div
                           key={target.userId}
                           title={
                              target.user?.displayName ||
                              target.user?.username ||
                              "Tester"
                           }
                           className="relative h-6 w-6 rounded-full overflow-hidden bg-[#222222] outline outline-1 outline-white/10"
                        >
                           {target.user?.image ? (
                              <Image
                                 src={target.user.image}
                                 alt="Avatar"
                                 fill
                                 sizes="24px"
                                 className="object-cover"
                              />
                           ) : (
                              <span className="flex h-full w-full items-center justify-center text-[10px] text-[#f4f3f6]">
                                 {(target.user?.displayName || "T")[0]}
                              </span>
                           )}
                        </div>
                     ))}
                     {testersCount > 4 && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#292929] text-[10px] tabular-nums text-[#868686] outline outline-1 outline-white/10">
                           +{testersCount - 4}
                        </span>
                     )}
                  </div>
               )}

               <button
                  onClick={() => onManageTesters(flag)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#333333] bg-[#1a1a1a] px-2.5 py-1 text-xs font-medium text-[#d1d1d1] hover:bg-[#252525] hover:text-white transition-colors duration-150 active:scale-[0.96]"
               >
                  <Users className="h-3.5 w-3.5 text-[#868686]" />
                  <span>Testers ({testersCount})</span>
               </button>
            </div>
         </div>

         {/* Footer: Meta & Action Buttons */}
         <div className="mt-3 pt-3 border-t border-[#1f1f1f] flex items-center justify-between text-xs text-[#868686]">
            <div className="flex items-center gap-1.5">
               <Clock className="h-3 w-3" />
               <span>
                  Updated {new Date(flag.updatedAt).toLocaleDateString()}
               </span>
            </div>

            <div className="flex items-center gap-1">
               <button
                  onClick={() => onViewAuditLogs(flag)}
                  title="View Audit Logs"
                  className="inline-flex items-center gap-1 rounded-md p-1.5 hover:bg-[#222222] hover:text-[#f4f3f6] transition-colors active:scale-[0.96]"
               >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Audit</span>
               </button>

               <button
                  onClick={() => onEdit(flag)}
                  title="Edit Flag"
                  className="inline-flex items-center gap-1 rounded-md p-1.5 hover:bg-[#222222] hover:text-[#f4f3f6] transition-colors active:scale-[0.96]"
               >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Edit</span>
               </button>

               <button
                  onClick={() => onDelete(flag.id)}
                  title="Delete Flag"
                  className="inline-flex items-center gap-1 rounded-md p-1.5 hover:bg-red-950/40 text-red-400 hover:text-red-300 transition-colors active:scale-[0.96]"
               >
                  <Trash2 className="h-3.5 w-3.5" />
               </button>
            </div>
         </div>
      </div>
   );
}
