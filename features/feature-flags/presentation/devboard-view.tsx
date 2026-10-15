"use client";

import { useMemo, useState } from "react";
import { Flag, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
   assignTesterAction,
   createFeatureFlagAction,
   deleteFeatureFlagAction,
   removeTesterAction,
   setRolloutModeAction,
   toggleMasterSwitchAction,
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

interface DevBoardViewProps {
   initialFlags: FeatureFlagEntity[];
}

export function DevBoardView({ initialFlags }: DevBoardViewProps) {
   const [flags, setFlags] = useState<FeatureFlagEntity[]>(initialFlags);
   const [searchQuery, setSearchQuery] = useState("");
   const [activeFilter, setActiveFilter] = useState<FilterStatus>("ALL");
   const [sortBy, setSortBy] = useState<SortOption>("UPDATED");
   const [selectedFlagIds, setSelectedFlagIds] = useState<Set<string>>(
      () => new Set()
   );

   // Modals state
   const [isEditorOpen, setIsEditorOpen] = useState(false);
   const [editingFlag, setEditingFlag] = useState<FeatureFlagEntity | null>(
      null
   );

   const [testerFlag, setTesterFlag] = useState<FeatureFlagEntity | null>(null);
   const [auditFlag, setAuditFlag] = useState<FeatureFlagEntity | null>(null);

   // Counters
   const totalCount = flags.length;
   const globalCount = flags.filter(
      (f) => f.isEnabled && f.rolloutMode === "GLOBAL"
   ).length;
   const targetedCount = flags.filter(
      (f) => f.isEnabled && f.rolloutMode === "TARGETED"
   ).length;
   const killedOrDisabledCount = flags.filter(
      (f) => !f.isEnabled || f.rolloutMode === "DISABLED"
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
            return f.isEnabled && f.rolloutMode === "GLOBAL";
         }
         if (activeFilter === "TARGETED") {
            return f.isEnabled && f.rolloutMode === "TARGETED";
         }
         if (activeFilter === "KILLED") {
            return !f.isEnabled || f.rolloutMode === "DISABLED";
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

   // Master switch handler
   const handleToggleMaster = async (flagId: string, isEnabled: boolean) => {
      // Optimistic update
      setFlags((prev) =>
         prev.map((f) => (f.id === flagId ? { ...f, isEnabled } : f))
      );

      const res = await toggleMasterSwitchAction({ flagId, isEnabled });
      if (!res.ok) {
         // Rollback on failure
         setFlags((prev) =>
            prev.map((f) =>
               f.id === flagId ? { ...f, isEnabled: !isEnabled } : f
            )
         );
         alert(res.error || "Failed to toggle switch.");
      }
   };

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
         alert(res.error || "Failed to change rollout mode.");
      }
   };

   // Editor submit
   const handleEditorSubmit = async (data: {
      flagId?: string;
      key: string;
      name: string;
      description?: string;
      isEnabled: boolean;
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
            isEnabled: data.isEnabled,
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
         alert(res.error || "Failed to assign tester.");
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
         alert(res.error || "Failed to remove tester.");
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

   // Delete flag
   const handleDelete = async (flagId: string) => {
      const flag = flags.find((f) => f.id === flagId);
      if (!flag) return;

      const confirmed = window.confirm(
         `Are you sure you want to delete and decommission feature flag "${flag.key}"?`
      );
      if (!confirmed) return;

      const res = await deleteFeatureFlagAction(flagId);
      if (!res.ok) {
         alert(res.error || "Failed to delete flag.");
         return;
      }

      setFlags((prev) => prev.filter((f) => f.id !== flagId));
      setSelectedFlagIds((prev) => {
         const next = new Set(prev);
         next.delete(flagId);
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
            <div className="rounded-2xl border border-dashed border-[#292929] bg-[#101010] p-12 text-center">
               <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#181818] border border-[#2e2e2e] text-[#868686]">
                  <Flag className="h-6 w-6" />
               </div>
               <h3 className="mt-4 text-base font-semibold text-[#f4f3f6]">
                  {searchQuery || activeFilter !== "ALL"
                     ? "No matching flags found"
                     : "No feature flags configured"}
               </h3>
               <p className="mt-1 text-xs text-[#868686] max-w-sm mx-auto text-wrap:balance">
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
               onToggleMaster={handleToggleMaster}
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
      </div>
   );
}
