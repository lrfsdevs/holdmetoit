"use client";

import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
      isEnabled: boolean;
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
   const [isEnabled, setIsEnabled] = useState(false);
   const [rolloutMode, setRolloutMode] = useState<RolloutModeType>("DISABLED");
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [errorMessage, setErrorMessage] = useState<string | null>(null);

   useEffect(() => {
      if (editingFlag) {
         setKey(editingFlag.key);
         setName(editingFlag.name);
         setDescription(editingFlag.description || "");
         setIsEnabled(editingFlag.isEnabled);
         setRolloutMode(editingFlag.rolloutMode);
      } else {
         setKey("");
         setName("");
         setDescription("");
         setIsEnabled(false);
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
            isEnabled,
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in-0 duration-150">
         <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="flag-editor-title"
            className="w-full max-w-lg rounded-2xl border border-[#2e2e2e] bg-[#161616] p-6 shadow-2xl relative text-[#f4f3f6]"
         >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
               <h2
                  id="flag-editor-title"
                  className="text-xl font-semibold font-display leading-tight tracking-tight text-[#f4f3f6]"
               >
                  {isEditing ? "Edit Feature Flag" : "Create Feature Flag"}
               </h2>
               <button
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="rounded-lg p-1 text-[#868686] hover:bg-[#262626] hover:text-white transition-colors active:scale-[0.96]"
               >
                  <X className="h-5 w-5" />
               </button>
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#868686] mb-1.5">
                     Flag Key {isEditing && "(Immutable)"}
                  </label>
                  <Input
                     value={key}
                     onChange={(e) => setKey(e.target.value)}
                     disabled={isEditing}
                     placeholder="e.g. voice_study_logging"
                     className={`text-xs rounded-xl bg-[#111111] border-[#292929] ${
                        isEditing
                           ? "text-[#868686] cursor-not-allowed opacity-80"
                           : "text-[#f4f3f6]"
                     }`}
                  />
                  <p className="mt-1 text-[11px] text-[#868686]">
                     {isEditing
                        ? "Flag keys are immutable to protect code contracts in production."
                        : "Unique identifier referenced in codebase (snake_case recommended)."}
                  </p>
               </div>

               <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#868686] mb-1.5">
                     Display Name
                  </label>
                  <Input
                     value={name}
                     onChange={(e) => setName(e.target.value)}
                     placeholder="e.g. Voice Study Hours Input"
                     className="rounded-xl bg-[#111111] border-[#292929] text-[#f4f3f6] text-sm"
                  />
               </div>

               <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#868686] mb-1.5">
                     Description
                  </label>
                  <Textarea
                     value={description}
                     onChange={(e) => setDescription(e.target.value)}
                     placeholder="Explain what this feature controls and rollout intentions..."
                     rows={3}
                     className="rounded-xl bg-[#111111] border-[#292929] p-3 text-xs text-[#f4f3f6] placeholder:text-[#666666] focus:border-emerald-500/50 focus:bg-[#111111]"
                  />
               </div>

               {!isEditing && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                     <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#868686] mb-1.5">
                           Initial Master Switch
                        </label>
                        <button
                           type="button"
                           onClick={() => setIsEnabled(!isEnabled)}
                           className={`w-full rounded-xl border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#868686] focus-visible:ring-offset-0 ${
                              isEnabled
                                 ? "border-emerald-600 bg-emerald-950/40 text-emerald-400"
                                 : "border-[#333333] bg-[#1a1a1a] text-[#868686]"
                           }`}
                        >
                           {isEnabled ? "ON (Active)" : "OFF (Safe Initial)"}
                        </button>
                     </div>

                     <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#868686] mb-1.5">
                           Initial Mode
                        </label>
                        <Select
                           value={rolloutMode}
                           onValueChange={(v) =>
                              setRolloutMode(v as RolloutModeType)
                           }
                        >
                           <SelectTrigger className="h-9 rounded-xl border-[#292929] bg-[#111111] text-xs text-[#f4f3f6]">
                              <SelectValue placeholder="Disabled" />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="DISABLED">Disabled</SelectItem>
                              <SelectItem value="TARGETED">Targeted</SelectItem>
                              <SelectItem value="GLOBAL">Global</SelectItem>
                           </SelectContent>
                        </Select>
                     </div>
                  </div>
               )}

               {/* Footer actions */}
               <div className="mt-6 pt-4 border-t border-[#262626] flex items-center justify-end gap-2.5">
                  <Button
                     type="button"
                     variant="ghost"
                     onClick={onClose}
                     disabled={isSubmitting}
                     className="text-[#868686] hover:text-white rounded-xl text-xs active:scale-[0.96]"
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
         </div>
      </div>
   );
}
