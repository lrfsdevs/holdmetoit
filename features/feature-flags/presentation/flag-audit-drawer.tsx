"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Clock, History, Loader2, X } from "lucide-react";
import { getFlagAuditTrailAction } from "../api/feature-flags.actions";
import type {
   FeatureFlagAuditLogEntry,
   FeatureFlagEntity,
} from "../domain/feature-flags.types";

interface FlagAuditDrawerProps {
   isOpen: boolean;
   onClose: () => void;
   flag: FeatureFlagEntity | null;
}

export function FlagAuditDrawer({
   isOpen,
   onClose,
   flag,
}: FlagAuditDrawerProps) {
   const [logs, setLogs] = useState<FeatureFlagAuditLogEntry[]>([]);
   const [isLoading, setIsLoading] = useState(false);

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
      if (!isOpen || !flag) return;

      let isMounted = true;
      setIsLoading(true);

      getFlagAuditTrailAction(flag.id).then((res) => {
         if (isMounted) {
            if (res.ok && Array.isArray(res.data)) {
               setLogs(res.data as FeatureFlagAuditLogEntry[]);
            }
            setIsLoading(false);
         }
      });

      return () => {
         isMounted = false;
      };
   }, [isOpen, flag]);

   if (!isOpen || !flag) return null;

   const renderDiff = (log: FeatureFlagAuditLogEntry) => {
      switch (log.action) {
         case "TOGGLED_MASTER": {
            const oldVal = (log.oldValue as { isEnabled?: boolean })?.isEnabled;
            const newVal = (log.newValue as { isEnabled?: boolean })?.isEnabled;
            return (
               <div className="text-xs">
                  Master Switch:{" "}
                  <span
                     className={oldVal ? "text-emerald-400" : "text-red-400"}
                  >
                     {oldVal ? "ON" : "OFF"}
                  </span>{" "}
                  ──►{" "}
                  <span
                     className={newVal ? "text-emerald-400" : "text-red-400"}
                  >
                     {newVal ? "ON" : "OFF"}
                  </span>
               </div>
            );
         }

         case "ROLLOUT_CHANGED": {
            const oldVal = (log.oldValue as { rolloutMode?: string })
               ?.rolloutMode;
            const newVal = (log.newValue as { rolloutMode?: string })
               ?.rolloutMode;
            return (
               <div className="text-xs">
                  Rollout Mode:{" "}
                  <span className="text-[#868686]">{oldVal || "N/A"}</span> ──►{" "}
                  <span className="text-emerald-400">{newVal || "N/A"}</span>
               </div>
            );
         }

         case "TARGET_ADDED": {
            const name =
               (log.newValue as { targetDisplayName?: string })
                  ?.targetDisplayName ||
               (log.newValue as { targetUsername?: string })?.targetUsername ||
               "tester";
            return (
               <div className="text-xs text-emerald-400">
                  + Added tester: <span className="font-semibold">{name}</span>
               </div>
            );
         }

         case "TARGET_REMOVED": {
            const name =
               (log.oldValue as { targetUsername?: string })?.targetUsername ||
               "tester";
            return (
               <div className="text-xs text-red-400">
                  - Removed tester:{" "}
                  <span className="font-semibold">{name}</span>
               </div>
            );
         }

         case "CREATED":
            return (
               <div className="text-xs text-[#868686]">
                  Initial Creation: {flag.key}
               </div>
            );

         case "SOFT_DELETED":
            return (
               <div className="text-xs text-red-400">
                  Flag decommissioned (soft deleted)
               </div>
            );

         default:
            return (
               <div className="text-xs text-[#868686]">
                  {JSON.stringify(log.newValue || log.oldValue)}
               </div>
            );
      }
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm animate-in fade-in-0 duration-150">
         <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-drawer-title"
            className="h-full w-full max-w-md bg-[#161616] border-l border-[#2e2e2e] p-6 shadow-2xl flex flex-col text-[#f4f3f6]"
         >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
               <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-[#868686]" />
                  <div>
                     <h2
                        id="audit-drawer-title"
                        className="text-base font-bold font-display tracking-tight text-[#f4f3f6]"
                     >
                        Audit Trail
                     </h2>
                     <p className="text-xs text-[#868686]">{flag.key}</p>
                  </div>
               </div>
               <button
                  onClick={onClose}
                  aria-label="Close drawer"
                  className="rounded-lg p-1 text-[#868686] hover:bg-[#262626] hover:text-white transition-colors active:scale-[0.96]"
               >
                  <X className="h-5 w-5" />
               </button>
            </div>

            {/* Audit list */}
            <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
               {isLoading ? (
                  <div className="flex items-center justify-center py-12 text-xs text-[#868686] gap-2">
                     <Loader2 className="h-4 w-4 animate-spin text-[#868686]" />
                     <span>Loading audit logs...</span>
                  </div>
               ) : logs.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#868686]">
                     No audit logs recorded for this flag.
                  </div>
               ) : (
                  logs.map((log) => (
                     <div
                        key={log.id}
                        className="rounded-xl border border-[#262626] bg-[#121212] p-3.5 space-y-2"
                     >
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                              <div className="relative h-5 w-5 rounded-full overflow-hidden bg-[#242424] outline outline-1 outline-white/10 shrink-0">
                                 {log.actor?.image ? (
                                    <Image
                                       src={log.actor.image}
                                       alt=""
                                       fill
                                       sizes="20px"
                                       className="object-cover"
                                    />
                                 ) : (
                                    <span className="flex h-full w-full items-center justify-center text-[10px] text-white">
                                       {(log.actor?.displayName || "D")[0]}
                                    </span>
                                 )}
                              </div>
                              <span className="text-xs font-semibold text-[#f4f3f6]">
                                 {log.actor?.displayName ||
                                    log.actor?.username ||
                                    "Developer"}
                              </span>
                           </div>

                           <span className="text-[10px] text-[#868686] flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(log.createdAt).toLocaleTimeString([], {
                                 hour: "2-digit",
                                 minute: "2-digit",
                              })}
                           </span>
                        </div>

                        <div className="flex items-center gap-2">
                           <span className="rounded bg-[#222222] border border-[#333333] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#d1d1d1]">
                              {log.action}
                           </span>
                        </div>

                        <div className="pt-1 border-t border-[#1a1a1a]">
                           {renderDiff(log)}
                        </div>
                     </div>
                  ))
               )}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-[#262626] flex justify-end">
               <button
                  onClick={onClose}
                  className="rounded-xl bg-[#222222] px-4 py-2 text-xs font-medium text-[#f4f3f6] hover:bg-[#2c2c2c] transition-colors active:scale-[0.96]"
               >
                  Close
               </button>
            </div>
         </div>
      </div>
   );
}
