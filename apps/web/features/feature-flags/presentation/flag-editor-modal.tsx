"use client";

import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@/components/ui/select";
import type {
   FeatureFlagEntity,
   RolloutModeType,
} from "../domain/feature-flags.types";

interface FlagEditorModalProps {
   isOpen: boolean;
   onClose: () => void;
   onSubmit: (data: {
      flagId?: string;
      key: string;
      name: string;
      description?: string;
      rolloutMode: RolloutModeType;
   }) => Promise<void>;
   editingFlag?: FeatureFlagEntity | null;
}

/** Renders the create/edit form for a feature flag. */
export function FlagEditorModal({
   isOpen,
   onClose,
   onSubmit,
   editingFlag,
}: FlagEditorModalProps) {
   const isEditing = Boolean(editingFlag);
   const [key, setKey] = useState("");
   const [name, setName] = useState("");
   const [description, setDescription] = useState("");
   const [rolloutMode, setRolloutMode] = useState<RolloutModeType>("DISABLED");
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [errorMessage, setErrorMessage] = useState<string | null>(null);

   useEffect(() => {
      if (editingFlag) {
         setKey(editingFlag.key);
         setName(editingFlag.name);
         setDescription(editingFlag.description || "");
         setRolloutMode(editingFlag.rolloutMode);
      } else {
         setKey("");
         setName("");
         setDescription("");
         setRolloutMode("DISABLED");
      }
      setErrorMessage(null);
   }, [editingFlag, isOpen]);

   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         if (e.key === "Escape" && isOpen) {
            onClose();
         }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
   }, [isOpen, onClose]);

   if (!isOpen) return null;

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMessage(null);

      if (!isEditing && !/^[a-z0-9_-]+$/.test(key)) {
         setErrorMessage(
            "Key must contain only lowercase letters, numbers, underscores, or hyphens."
         );
         return;
      }

      if (!name.trim()) {
         setErrorMessage("Please enter a name for the flag.");
         return;
      }

      try {
         setIsSubmitting(true);
         await onSubmit({
            flagId: editingFlag?.id,
            key: key.trim().toLowerCase(),
            name: name.trim(),
            description: description.trim() || undefined,
            rolloutMode,
         });
         onClose();
      } catch (err) {
         setErrorMessage(
            err instanceof Error ? err.message : "Failed to save flag."
         );
      } finally {
         setIsSubmitting(false);
      }
   };

   return (
      <Dialog
         open={isOpen}
         onOpenChange={(open) => {
            if (!open) onClose();
         }}
      >
         <DialogContent className="max-w-lg rounded-2xl border-border-strong bg-surface-primary p-6 text-text-primary">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border-default">
               <DialogTitle
                  id="flag-editor-title"
                  className="text-xl font-semibold font-display leading-tight tracking-tight text-text-primary"
               >
                  {isEditing ? "Edit Feature Flag" : "Create Feature Flag"}
               </DialogTitle>
            </div>

            {/* Error message */}
            {errorMessage && (
               <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-900/50 bg-red-950/40 p-3 text-xs text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
               </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
               <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">
                     Flag Key {isEditing && "(Immutable)"}
                  </label>
                  <Input
                     value={key}
                     onChange={(e) => setKey(e.target.value)}
                     disabled={isEditing}
                     placeholder="e.g. voice_study_logging"
                     className={`text-xs rounded-xl bg-surface-primary border-border-default ${
                        isEditing
                           ? "text-text-tertiary cursor-not-allowed opacity-80"
                           : "text-text-primary"
                     }`}
                  />
                  <p className="mt-1 text-meta text-text-tertiary">
                     {isEditing
                        ? "Flag keys are immutable to protect code contracts in production."
                        : "Unique identifier referenced in codebase (snake_case recommended)."}
                  </p>
               </div>

               <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">
                     Display Name
                  </label>
                  <Input
                     value={name}
                     onChange={(e) => setName(e.target.value)}
                     placeholder="e.g. Voice Study Hours Input"
                     className="rounded-xl bg-surface-primary border-border-default text-text-primary text-sm"
                  />
               </div>

               <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">
                     Description
                  </label>
                  <Textarea
                     value={description}
                     onChange={(e) => setDescription(e.target.value)}
                     placeholder="Explain what this feature controls and rollout intentions..."
                     rows={3}
                     className="rounded-xl bg-surface-primary border-border-default p-3 text-xs text-text-primary placeholder:text-text-tertiary focus:border-emerald-500/50 focus:bg-surface-primary"
                  />
               </div>

               {!isEditing && (
                  <div className="pt-2">
                     <label className="block text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">
                        Initial Rollout
                     </label>
                     <Select
                        value={rolloutMode}
                        onValueChange={(v) =>
                           setRolloutMode(v as RolloutModeType)
                        }
                     >
                        <SelectTrigger className="h-9 rounded-xl border-border-default bg-surface-primary text-xs text-text-primary">
                           <SelectValue placeholder="Disabled" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="DISABLED">Disabled</SelectItem>
                           <SelectItem value="TARGETED">Targeted</SelectItem>
                           <SelectItem value="GLOBAL">Global</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
               )}

               {/* Footer actions */}
               <div className="mt-6 pt-4 border-t border-border-default flex items-center justify-end gap-2.5">
                  <Button
                     type="button"
                     variant="ghost"
                     onClick={onClose}
                     disabled={isSubmitting}
                     className="text-text-tertiary hover:text-white rounded-xl text-xs active:scale-[0.96]"
                  >
                     Cancel
                  </Button>
                  <Button
                     type="submit"
                     disabled={isSubmitting}
                     className="rounded-xl bg-white text-xs font-semibold text-black shadow-sm transition-transform duration-150 hover:bg-neutral-200 focus-visible:ring-1 focus-visible:ring-white focus-visible:ring-offset-0 active:scale-[0.96]"
                  >
                     {isSubmitting
                        ? "Saving..."
                        : isEditing
                          ? "Save Changes"
                          : "Create Flag"}
                  </Button>
               </div>
            </form>
         </DialogContent>
      </Dialog>
   );
}
