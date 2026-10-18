"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Clock, History, Loader2 } from "lucide-react";
import {
   Sheet,
   SheetContent,
   SheetDescription,
   SheetHeader,
   SheetTitle,
} from "@/components/ui/sheet";
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

/** Renders the audit history drawer for a selected feature flag. */
export function FlagAuditDrawer({
   isOpen,
   onClose,
   flag,
}: FlagAuditDrawerProps) {
   const [logs, setLogs] = useState<FeatureFlagAuditLogEntry[]>([]);
   const [isLoading, setIsLoading] = useState(false);

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
                  <span className="text-text-tertiary">{oldVal || "N/A"}</span>{" "}
                  ──►{" "}
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
               <div className="text-xs text-text-tertiary">
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
               <div className="text-xs text-text-tertiary">
                  {JSON.stringify(log.newValue || log.oldValue)}
               </div>
            );
      }
   };

   return (
      <Sheet
         open={isOpen}
         onOpenChange={(open) => {
            if (!open) onClose();
         }}
      >
         <SheetContent
            side="right"
            className="w-full max-w-md bg-surface-primary border-l border-border-strong p-6"
         >
            {/* Header */}
            <SheetHeader className="pb-4 border-b border-border-default">
               <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-text-tertiary" />
                  <div>
                     <SheetTitle className="font-display tracking-tight">
                        Audit Trail
                     </SheetTitle>
                     <SheetDescription className="text-text-tertiary">
                        {flag.key}
                     </SheetDescription>
                  </div>
               </div>
            </SheetHeader>

            {/* Audit list */}
            <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
               {isLoading ? (
                  <div className="flex items-center justify-center py-12 text-xs text-text-tertiary gap-2">
                     <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
                     <span>Loading audit logs...</span>
                  </div>
               ) : logs.length === 0 ? (
                  <div className="py-12 text-center text-xs text-text-tertiary">
                     No audit logs recorded for this flag.
                  </div>
               ) : (
                  logs.map((log) => (
                     <div
                        key={log.id}
                        className="rounded-xl border border-border-default bg-surface-primary p-3.5 space-y-2"
                     >
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                              <div className="relative h-5 w-5 rounded-full overflow-hidden bg-surface-nested outline outline-1 outline-white/10 shrink-0">
                                 {log.actor?.image ? (
                                    <Image
                                       src={log.actor.image}
                                       alt=""
                                       fill
                                       sizes="20px"
                                       className="object-cover"
                                    />
                                 ) : (
                                    <span className="flex h-full w-full items-center justify-center text-label text-white">
                                       {(log.actor?.displayName || "D")[0]}
                                    </span>
                                 )}
                              </div>
                              <span className="text-xs font-semibold text-text-primary">
                                 {log.actor?.displayName ||
                                    log.actor?.username ||
                                    "Developer"}
                              </span>
                           </div>

                           <span className="text-label text-text-tertiary flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(log.createdAt).toLocaleTimeString([], {
                                 hour: "2-digit",
                                 minute: "2-digit",
                              })}
                           </span>
                        </div>

                        <div className="flex items-center gap-2">
                           <span className="rounded bg-surface-elevated border border-border-strong px-1.5 py-0.5 text-caption font-bold uppercase tracking-wider text-text-secondary">
                              {log.action}
                           </span>
                        </div>

                        <div className="pt-1 border-t border-surface-tertiary">
                           {renderDiff(log)}
                        </div>
                     </div>
                  ))
               )}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-border-default flex justify-end">
               <button
                  onClick={onClose}
                  className="rounded-xl bg-surface-elevated px-4 py-2 text-xs font-medium text-text-primary hover:bg-surface-nested transition-colors active:scale-[0.96]"
               >
                  Close
               </button>
            </div>
         </SheetContent>
      </Sheet>
   );
}
