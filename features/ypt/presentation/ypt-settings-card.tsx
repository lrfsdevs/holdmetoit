"use client";

import React, { useState } from "react";
import { linkYptAccountAction, importYptLogsAction } from "../api/ypt.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
   Link2,
   Upload,
   CheckCircle2,
   AlertCircle,
   Loader2,
} from "lucide-react";

interface YptSettingsCardProps {
   initialYptId?: string | null;
}

export function YptSettingsCard({ initialYptId }: YptSettingsCardProps) {
   const [yptId, setYptId] = useState(initialYptId || "");
   const [isLinking, setIsLinking] = useState(false);
   const [linkMessage, setLinkMessage] = useState<{
      type: "success" | "error";
      text: string;
   } | null>(null);

   const [isManualImportOpen, setIsManualImportOpen] = useState(false);
   const [manualDate, setManualDate] = useState(
      new Date().toISOString().slice(0, 10)
   );
   const [manualHours, setManualHours] = useState(1);
   const [manualMinutes, setManualMinutes] = useState(0);
   const [manualSubject, setManualSubject] = useState("");
   const [isImporting, setIsImporting] = useState(false);
   const [importMessage, setImportMessage] = useState<{
      type: "success" | "error";
      text: string;
   } | null>(null);

   const handleLink = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!yptId.trim()) return;

      setIsLinking(true);
      setLinkMessage(null);

      try {
         const res = await linkYptAccountAction({ yptId: yptId.trim() });
         if (res.ok) {
            setLinkMessage({
               type: "success",
               text: `YPT ID linked successfully: ${res.yptId}`,
            });
         } else {
            setLinkMessage({
               type: "error",
               text: res.message || "Failed to link YPT ID.",
            });
         }
      } catch (err) {
         setLinkMessage({
            type: "error",
            text: err instanceof Error ? err.message : "Network error.",
         });
      } finally {
         setIsLinking(false);
      }
   };

   const handleManualImport = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsImporting(true);
      setImportMessage(null);

      const durationSeconds = manualHours * 3600 + manualMinutes * 60;

      try {
         const res = await importYptLogsAction({
            records: [
               {
                  date: manualDate,
                  durationSeconds,
                  subject: manualSubject.trim() || undefined,
               },
            ],
         });

         if (res.ok) {
            setImportMessage({
               type: "success",
               text: `Imported successfully! Credited ${res.totalCoinsCredited} virtual coins.`,
            });
         } else {
            setImportMessage({
               type: "error",
               text: res.message || "Failed to import YPT session.",
            });
         }
      } catch (err) {
         setImportMessage({
            type: "error",
            text: err instanceof Error ? err.message : "Import failed.",
         });
      } finally {
         setIsImporting(false);
      }
   };

   return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-lg backdrop-blur-md">
         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-zinc-800">
            <div>
               <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 font-bold text-xs">
                     Y
                  </span>
                  Yeolpumta (YPT) Study Integration
               </h3>
               <p className="text-xs text-zinc-400 mt-1">
                  Connect your Yeolpumta ID for companion bot synchronization
                  and automated coin rewards.
               </p>
            </div>
            <Button
               type="button"
               variant="outline"
               size="sm"
               onClick={() => setIsManualImportOpen(!isManualImportOpen)}
               className="text-xs border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-zinc-100"
            >
               <Upload className="h-3.5 w-3.5 mr-1.5" />
               Manual Sync
            </Button>
         </div>

         {/* Link Form */}
         <form
            onSubmit={handleLink}
            className="mt-4 flex flex-col sm:flex-row items-center gap-2"
         >
            <div className="relative flex-1 w-full">
               <Input
                  type="text"
                  placeholder="Enter YPT Username / ID (e.g. StudyMaster)"
                  value={yptId}
                  onChange={(e) => setYptId(e.target.value)}
                  className="rounded-xl border-zinc-800 bg-zinc-900 text-xs text-zinc-100 placeholder:text-zinc-500"
               />
            </div>
            <Button
               type="submit"
               size="sm"
               disabled={isLinking || !yptId.trim()}
               className="w-full sm:w-auto rounded-xl bg-amber-500 text-zinc-950 font-semibold hover:bg-amber-400 text-xs gap-1.5 shrink-0"
            >
               {isLinking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
               ) : (
                  <Link2 className="h-3.5 w-3.5" />
               )}
               {initialYptId ? "Update YPT ID" : "Link YPT ID"}
            </Button>
         </form>

         {linkMessage && (
            <div
               className={`mt-3 flex items-center gap-2 rounded-lg p-2.5 text-xs ${
                  linkMessage.type === "success"
                     ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                     : "bg-rose-500/10 border border-rose-500/20 text-rose-300"
               }`}
            >
               {linkMessage.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
               ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
               )}
               <span>{linkMessage.text}</span>
            </div>
         )}

         {/* Manual Import Section */}
         {isManualImportOpen && (
            <div className="mt-4 pt-4 border-t border-zinc-800/80">
               <h4 className="text-xs font-semibold text-zinc-300 mb-2">
                  Manual Activity Session Import
               </h4>
               <form onSubmit={handleManualImport} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                     <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">
                           Date
                        </label>
                        <Input
                           type="date"
                           value={manualDate}
                           onChange={(e) => setManualDate(e.target.value)}
                           className="rounded-lg border-zinc-800 bg-zinc-900 text-xs text-zinc-200"
                        />
                     </div>
                     <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">
                           Study Duration
                        </label>
                        <div className="flex items-center gap-1">
                           <Input
                              type="number"
                              min={0}
                              max={24}
                              value={manualHours}
                              onChange={(e) =>
                                 setManualHours(parseInt(e.target.value) || 0)
                              }
                              className="rounded-lg border-zinc-800 bg-zinc-900 text-xs text-zinc-200 w-16"
                           />
                           <span className="text-xs text-zinc-500">h</span>
                           <Input
                              type="number"
                              min={0}
                              max={59}
                              value={manualMinutes}
                              onChange={(e) =>
                                 setManualMinutes(parseInt(e.target.value) || 0)
                              }
                              className="rounded-lg border-zinc-800 bg-zinc-900 text-xs text-zinc-200 w-16"
                           />
                           <span className="text-xs text-zinc-500">m</span>
                        </div>
                     </div>
                     <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">
                           Subject (Optional)
                        </label>
                        <Input
                           type="text"
                           placeholder="e.g. Physics"
                           value={manualSubject}
                           onChange={(e) => setManualSubject(e.target.value)}
                           className="rounded-lg border-zinc-800 bg-zinc-900 text-xs text-zinc-200"
                        />
                     </div>
                  </div>

                  {importMessage && (
                     <div
                        className={`flex items-center gap-2 rounded-lg p-2.5 text-xs ${
                           importMessage.type === "success"
                              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                              : "bg-rose-500/10 border border-rose-500/20 text-rose-300"
                        }`}
                     >
                        {importMessage.type === "success" ? (
                           <CheckCircle2 className="h-4 w-4 shrink-0" />
                        ) : (
                           <AlertCircle className="h-4 w-4 shrink-0" />
                        )}
                        <span>{importMessage.text}</span>
                     </div>
                  )}

                  <div className="flex justify-end gap-2">
                     <Button
                        type="submit"
                        size="sm"
                        disabled={
                           isImporting ||
                           (manualHours === 0 && manualMinutes === 0)
                        }
                        className="rounded-xl bg-amber-500 text-zinc-950 font-semibold hover:bg-amber-400 text-xs"
                     >
                        {isImporting ? "Importing..." : "Import & Reward"}
                     </Button>
                  </div>
               </form>
            </div>
         )}
      </div>
   );
}
