"use client";

import { useMemo, useState } from "react";
import { Flag, Plus, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
   assignTesterAction,
   createFeatureFlagAction,
   deleteFeatureFlagAction,
   removeTesterAction,
   setRolloutModeAction,
   updateFeatureFlagAction,
} from "../api/feature-flags.actions";
import type {
   FeatureFlagEntity,
   RolloutModeType,
} from "../domain/feature-flags.types";
import {
   DevBoardHeader,
   type FilterStatus,
   type SortOption,
} from "./devboard-header";
import { FlagAuditDrawer } from "./flag-audit-drawer";
import { FlagEditorModal } from "./flag-editor-modal";
import { FlagTable } from "./flag-table";
import { TesterSelectorDialog } from "./tester-selector-dialog";
import { YptVerificationPanel } from "@/features/ypt/presentation/ypt-verification-panel";

interface DevBoardViewProps {
   initialFlags: FeatureFlagEntity[];
}

/** Renders the feature-flag administration surface from server-provided flags. */
export function DevBoardView({ initialFlags }: DevBoardViewProps) {
   const [flags, setFlags] = useState<FeatureFlagEntity[]>(initialFlags);
   const [searchQuery, setSearchQuery] = useState("");
   const [activeFilter, setActiveFilter] = useState<FilterStatus>("ALL");
   const [sortBy, setSortBy] = useState<SortOption>("UPDATED");
   const [selectedFlagIds, setSelectedFlagIds] = useState<Set<string>>(
      () => new Set()
   );

   // Section switcher (Feature Flags | YPT Verification)
   const [section, setSection] = useState<"flags" | "ypt">("flags");

   // Modals state
   const [isEditorOpen, setIsEditorOpen] = useState(false);
   const [editingFlag, setEditingFlag] = useState<FeatureFlagEntity | null>(
      null
   );

   const [testerFlag, setTesterFlag] = useState<FeatureFlagEntity | null>(null);
   const [auditFlag, setAuditFlag] = useState<FeatureFlagEntity | null>(null);
   const [pendingDelete, setPendingDelete] = useState<FeatureFlagEntity | null>(
      null
   );

   // Counters
   const totalCount = flags.length;
   const globalCount = flags.filter((f) => f.rolloutMode === "GLOBAL").length;
   const targetedCount = flags.filter(
      (f) => f.rolloutMode === "TARGETED"
   ).length;
   const killedOrDisabledCount = flags.filter(
      (f) => f.rolloutMode === "DISABLED"
   ).length;

   // Filtered and sorted list
   const filteredFlags = useMemo(() => {
      const list = flags.filter((f) => {
         // Search query
         const query = searchQuery.toLowerCase().trim();
         if (query) {
            const matchesKey = f.key.toLowerCase().includes(query);
            const matchesName = f.name.toLowerCase().includes(query);
            const matchesDesc =
               f.description?.toLowerCase().includes(query) ?? false;
            if (!matchesKey && !matchesName && !matchesDesc) return false;
         }

         // Filter status pill
         if (activeFilter === "GLOBAL") {
            return f.rolloutMode === "GLOBAL";
         }
         if (activeFilter === "TARGETED") {
            return f.rolloutMode === "TARGETED";
         }
         if (activeFilter === "KILLED") {
            return f.rolloutMode === "DISABLED";
         }

         return true;
      });

      // Sorting
      return list.sort((a, b) => {
         switch (sortBy) {
            case "KEY_ASC":
               return a.key.localeCompare(b.key);
            case "CREATED_DESC":
               return (
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
               );
            case "TESTERS_DESC":
               return (b.targets?.length ?? 0) - (a.targets?.length ?? 0);
            case "UPDATED":
            default:
               return (
                  new Date(b.updatedAt).getTime() -
                  new Date(a.updatedAt).getTime()
               );
         }
      });
   }, [flags, searchQuery, activeFilter, sortBy]);

   // Rollout mode handler
   const handleSetRolloutMode = async (
      flagId: string,
      mode: RolloutModeType
   ) => {
      const oldMode = flags.find((f) => f.id === flagId)?.rolloutMode;

      // Optimistic update
      setFlags((prev) =>
         prev.map((f) => (f.id === flagId ? { ...f, rolloutMode: mode } : f))
      );

      const res = await setRolloutModeAction({ flagId, rolloutMode: mode });
      if (!res.ok) {
         // Rollback
         if (oldMode) {
            setFlags((prev) =>
               prev.map((f) =>
                  f.id === flagId ? { ...f, rolloutMode: oldMode } : f
               )
            );
         }
         toast.error(res.error || "Failed to change rollout mode.");
      }
   };

   // Editor submit
   const handleEditorSubmit = async (data: {
      flagId?: string;
      key: string;
      name: string;
      description?: string;
      rolloutMode: RolloutModeType;
   }) => {
      if (data.flagId) {
         const res = await updateFeatureFlagAction({
            flagId: data.flagId,
            name: data.name,
            description: data.description,
         });
         if (!res.ok) throw new Error(res.error);

         setFlags((prev) =>
            prev.map((f) =>
               f.id === data.flagId
                  ? { ...f, name: data.name, description: data.description }
                  : f
            )
         );
      } else {
         const res = await createFeatureFlagAction({
            key: data.key,
            name: data.name,
            description: data.description,
            rolloutMode: data.rolloutMode,
         });
         if (!res.ok) throw new Error(res.error);

         const created = res.data as FeatureFlagEntity;
         setFlags((prev) => [created, ...prev]);
      }
   };

   // Assign tester
   const handleAssignTester = async (flagId: string, userId: string) => {
      const res = await assignTesterAction({ flagId, targetUserId: userId });
      if (!res.ok) {
         toast.error(res.error || "Failed to assign tester.");
         return;
      }

      const newTarget = res.data as {
         flagId: string;
         userId: string;
         createdBy: string;
         createdAt: string;
         user?: {
            id: string;
            username?: string;
            displayName?: string;
            image?: string;
         };
      };

      setFlags((prev) =>
         prev.map((f) => {
            if (f.id !== flagId) return f;
            const currentTargets = f.targets || [];
            if (currentTargets.some((t) => t.userId === userId)) return f;
            return {
               ...f,
               targets: [...currentTargets, newTarget as never],
            };
         })
      );

      if (testerFlag?.id === flagId) {
         setTesterFlag((prev) =>
            prev
               ? {
                    ...prev,
                    targets: [...(prev.targets || []), newTarget as never],
                 }
               : null
         );
      }
   };

   // Remove tester
   const handleRemoveTester = async (flagId: string, userId: string) => {
      const res = await removeTesterAction({ flagId, targetUserId: userId });
      if (!res.ok) {
         toast.error(res.error || "Failed to remove tester.");
         return;
      }

      setFlags((prev) =>
         prev.map((f) => {
            if (f.id !== flagId) return f;
            return {
               ...f,
               targets: f.targets?.filter((t) => t.userId !== userId) || [],
            };
         })
      );

      if (testerFlag?.id === flagId) {
         setTesterFlag((prev) =>
            prev
               ? {
                    ...prev,
                    targets:
                       prev.targets?.filter((t) => t.userId !== userId) || [],
                 }
               : null
         );
      }
   };

   // Delete flag: open the confirm dialog, then execute on confirm.
   const handleDelete = async (flagId: string) => {
      const flag = flags.find((f) => f.id === flagId);
      if (!flag) return;
      setPendingDelete(flag);
   };

   const confirmDelete = async () => {
      if (!pendingDelete) return;
      const target = pendingDelete;
      setPendingDelete(null);

      const res = await deleteFeatureFlagAction(target.id);
      if (!res.ok) {
         toast.error(res.error || "Failed to delete flag.");
         return;
      }

      setFlags((prev) => prev.filter((f) => f.id !== target.id));
      setSelectedFlagIds((prev) => {
         const next = new Set(prev);
         next.delete(target.id);
         return next;
      });
   };

   // Selection handlers
   const handleToggleSelectAll = () => {
      if (
         selectedFlagIds.size === filteredFlags.length &&
         filteredFlags.length > 0
      ) {
         setSelectedFlagIds(new Set());
      } else {
         setSelectedFlagIds(new Set(filteredFlags.map((f) => f.id)));
      }
   };

   const handleToggleSelectRow = (flagId: string) => {
      setSelectedFlagIds((prev) => {
         const next = new Set(prev);
         if (next.has(flagId)) {
            next.delete(flagId);
         } else {
            next.add(flagId);
         }
         return next;
      });
   };

   return (
      <div className="space-y-6">
         {/* Section Switcher: Feature Flags | YPT Verification */}
         <div
            role="tablist"
            aria-label="DevBoard sections"
            className="inline-flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-surface-primary border border-border-default"
         >
            <button
               type="button"
               role="tab"
               aria-selected={section === "flags"}
               id="devboard-tab-flags"
               aria-controls="devboard-panel-flags"
               onClick={() => setSection("flags")}
               className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
                  section === "flags"
                     ? "bg-surface-nested text-text-primary border border-border-strong"
                     : "text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary"
               }`}
            >
               <Flag className="h-3.5 w-3.5" />
               Feature Flags
            </button>
            <button
               type="button"
               role="tab"
               aria-selected={section === "ypt"}
               id="devboard-tab-ypt"
               aria-controls="devboard-panel-ypt"
               onClick={() => setSection("ypt")}
               className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
                  section === "ypt"
                     ? "bg-surface-nested text-text-primary border border-border-strong"
                     : "text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary"
               }`}
            >
               <UserCheck className="h-3.5 w-3.5" />
               YPT Verification
            </button>
         </div>

         {section === "flags" ? (
            <div
               id="devboard-panel-flags"
               role="tabpanel"
               aria-labelledby="devboard-tab-flags"
               className="space-y-6"
            >
               {/* DevBoard Header with Status Pills, New Flag, and Search/Filters */}
               <DevBoardHeader
                  totalCount={totalCount}
                  globalCount={globalCount}
                  targetedCount={targetedCount}
                  killedOrDisabledCount={killedOrDisabledCount}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  activeFilter={activeFilter}
                  onFilterChange={setActiveFilter}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  onCreateClick={() => {
                     setEditingFlag(null);
                     setIsEditorOpen(true);
                  }}
               />

               {/* Flag Table or Empty State */}
               {filteredFlags.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border-default bg-surface-page p-12 text-center">
                     <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-secondary border border-border-strong text-text-tertiary">
                        <Flag className="h-6 w-6" />
                     </div>
                     <h3 className="mt-4 text-base font-semibold text-text-primary">
                        {searchQuery || activeFilter !== "ALL"
                           ? "No matching flags found"
                           : "No feature flags configured"}
                     </h3>
                     <p className="mt-1 text-xs text-text-tertiary max-w-sm mx-auto text-wrap:balance">
                        {searchQuery || activeFilter !== "ALL"
                           ? "Try clearing your search query or switching filters to view other release toggles."
                           : "Create your first feature flag to safely control production rollouts without redeployments."}
                     </p>
                     <div className="mt-6">
                        <Button
                           onClick={() => {
                              setEditingFlag(null);
                              setIsEditorOpen(true);
                           }}
                           className="bg-white hover:bg-neutral-200 text-black rounded-xl text-xs font-semibold px-4 py-2 inline-flex items-center gap-1.5 active:scale-[0.96] transition-transform duration-150"
                        >
                           <Plus className="h-4 w-4 text-black" />
                           <span>Create Feature Flag</span>
                        </Button>
                     </div>
                  </div>
               ) : (
                  <FlagTable
                     flags={filteredFlags}
                     selectedFlagIds={selectedFlagIds}
                     onToggleSelectAll={handleToggleSelectAll}
                     onToggleSelectRow={handleToggleSelectRow}
                     onSetRolloutMode={handleSetRolloutMode}
                     onManageTesters={(f) => setTesterFlag(f)}
                     onViewAuditLogs={(f) => setAuditFlag(f)}
                     onEdit={(f) => {
                        setEditingFlag(f);
                        setIsEditorOpen(true);
                     }}
                     onDelete={handleDelete}
                  />
               )}
            </div>
         ) : (
            <div
               id="devboard-panel-ypt"
               role="tabpanel"
               aria-labelledby="devboard-tab-ypt"
            >
               <YptVerificationPanel />
            </div>
         )}

         {/* Editor Modal */}
         <FlagEditorModal
            isOpen={isEditorOpen}
            onClose={() => {
               setIsEditorOpen(false);
               setEditingFlag(null);
            }}
            onSubmit={handleEditorSubmit}
            editingFlag={editingFlag}
         />

         {/* Tester Selector Dialog */}
         <TesterSelectorDialog
            isOpen={Boolean(testerFlag)}
            onClose={() => setTesterFlag(null)}
            flag={testerFlag}
            onAssignTester={handleAssignTester}
            onRemoveTester={handleRemoveTester}
         />

         {/* Audit Drawer */}
         <FlagAuditDrawer
            isOpen={Boolean(auditFlag)}
            onClose={() => setAuditFlag(null)}
            flag={auditFlag}
         />

         {/* Delete Flag Confirmation */}
         <AlertDialog
            open={Boolean(pendingDelete)}
            onOpenChange={(open) => {
               if (!open) setPendingDelete(null);
            }}
         >
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>Delete feature flag?</AlertDialogTitle>
                  <AlertDialogDescription>
                     This will delete and decommission{" "}
                     <span className="text-white">{pendingDelete?.key}</span>.
                     This action cannot be undone.
                  </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void confirmDelete()}>
                     Delete flag
                  </AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      </div>
   );
}
