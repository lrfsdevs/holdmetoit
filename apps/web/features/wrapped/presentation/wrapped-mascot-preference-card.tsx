"use client";

import { useCallback } from "react";
import { Sparkles, Check, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
   WRAPPED_MASCOT_OPTIONS,
   type WrappedMascotOption,
   type WrappedMascotVariant,
} from "../domain/wrapped-mascot.types";
import { WrappedMascot } from "./wrapped-mascot";
import { useWrappedMascotPreference } from "./wrapped-storage";

export interface WrappedMascotPreferenceCardProps {
   className?: string;
   onVariantChange?: (variant: WrappedMascotVariant) => void;
}

/**
 * Interactive preference selector card for user's preferred Wrapped Mascot.
 * Displays live interactive previews of all 4 doodle and OG mascots that track
 * the cursor and react to hover. Immediately persists the selection and notifies
 * all components across the application.
 */
export function WrappedMascotPreferenceCard({
   className = "",
   onVariantChange,
}: WrappedMascotPreferenceCardProps) {
   const { variant: selectedVariant, setVariant } =
      useWrappedMascotPreference();

   const handleSelect = useCallback(
      (option: WrappedMascotOption) => {
         if (option.id === selectedVariant) return;
         setVariant(option.id);
         onVariantChange?.(option.id);
         toast.success(`Wrapped mascot updated to ${option.label}!`);
      },
      [selectedVariant, setVariant, onVariantChange]
   );

   const activeOption =
      WRAPPED_MASCOT_OPTIONS.find((opt) => opt.id === selectedVariant) ??
      WRAPPED_MASCOT_OPTIONS[0];

   return (
      <div
         className={`rounded-2xl border border-border-default bg-surface-primary p-5 shadow-lg backdrop-blur-md ${className}`}
         data-testid="wrapped-mascot-preference-card"
      >
         {/* Card Header */}
         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border-subtle">
            <div>
               <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-1/10 text-brand-1 font-bold text-xs">
                     <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  Wrapped Mascot Companion
               </h3>
               <p className="text-xs text-text-tertiary mt-1">
                  Choose your animated companion for Event Wrapped cards,
                  celebration recaps, and story dialogs.
               </p>
            </div>

            {/* Current Active Badge */}
            <div className="shrink-0 flex items-center gap-2">
               <span
                  data-testid="active-mascot-badge"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border text-feedback-success bg-feedback-success-bg border-feedback-success/30 shadow-xs"
               >
                  <span className="w-1.5 h-1.5 rounded-full bg-feedback-success animate-pulse" />
                  Active: {activeOption.label}
               </span>
            </div>
         </div>

         {/* 4-Option Interactive Selector Grid */}
         <div
            role="radiogroup"
            aria-label="Wrapped Mascot Options"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5"
         >
            {WRAPPED_MASCOT_OPTIONS.map((option) => {
               const isSelected = option.id === selectedVariant;

               return (
                  <button
                     key={option.id}
                     type="button"
                     role="radio"
                     aria-checked={isSelected}
                     onClick={() => handleSelect(option)}
                     data-testid={`mascot-option-${option.id.toLowerCase()}`}
                     className={`group relative flex flex-col justify-between items-center text-center p-4 rounded-2xl border cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-feedback-success ${
                        isSelected
                           ? "border-feedback-success bg-feedback-success/5 shadow-md shadow-feedback-success/10 ring-1 ring-feedback-success/40"
                           : "border-border-default bg-surface-elevated hover:border-border-strong hover:bg-surface-nested"
                     }`}
                  >
                     {/* Top Badges / Selected Icon */}
                     <div className="w-full flex items-center justify-between gap-1 text-[10px] font-bold tracking-wider uppercase mb-2">
                        {option.badge ? (
                           <span className="px-1.5 py-0.5 rounded-md bg-surface-nested text-text-tertiary border border-border-subtle group-hover:text-text-secondary transition-colors">
                              {option.badge}
                           </span>
                        ) : (
                           <span />
                        )}

                        {isSelected ? (
                           <span
                              className="text-feedback-success inline-flex items-center"
                              title="Active Choice"
                           >
                              <CheckCircle2 className="w-4 h-4" />
                           </span>
                        ) : (
                           <span className="w-4 h-4 rounded-full border border-border-strong group-hover:border-text-secondary transition-colors" />
                        )}
                     </div>

                     {/* Live Interactive Mascot Preview Box */}
                     <div className="h-28 sm:h-32 w-full flex items-end justify-center p-2 pb-2 rounded-xl bg-surface-primary/60 border border-border-subtle/50 group-hover:border-border-strong/70 transition-colors">
                        <WrappedMascot
                           variant={option.id}
                           size="lg"
                           data-testid={`mascot-preview-${option.id.toLowerCase()}`}
                        />
                     </div>

                     {/* Info / Description */}
                     <div className="mt-3 w-full space-y-1">
                        <h4 className="text-sm font-bold text-text-primary group-hover:text-white transition-colors">
                           {option.label}
                        </h4>
                        <p className="text-xs text-text-tertiary leading-snug line-clamp-2">
                           {option.description}
                        </p>
                     </div>

                     {/* Status indicator bar */}
                     <div className="mt-3 pt-2 w-full border-t border-border-subtle/60 flex items-center justify-center">
                        {isSelected ? (
                           <span className="inline-flex items-center gap-1 text-xs font-bold text-feedback-success">
                              <Check className="w-3.5 h-3.5" /> Selected
                           </span>
                        ) : (
                           <span className="text-[11px] font-medium text-text-tertiary group-hover:text-text-secondary transition-colors">
                              Click to select
                           </span>
                        )}
                     </div>
                  </button>
               );
            })}
         </div>
      </div>
   );
}
