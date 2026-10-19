"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ChallengeDescriptionContent } from "./challenge-description-content";

const MAX_DESCRIPTION_LENGTH = 5000;

interface ChallengeDescriptionEditorProps {
   id: string;
   value: string;
   onChange: (value: string) => void;
   rows?: number;
   disabled?: boolean;
   placeholder?: string;
   textareaClassName?: string;
   helperText?: string;
}

/** Constrained description editor with a rendered preview. */
export function ChallengeDescriptionEditor({
   id,
   value,
   onChange,
   rows = 14,
   disabled = false,
   placeholder = "# How it works\n\n1. First step\n2. Second step\n\n---\n\n[Link](https://example.com)",
   textareaClassName,
   helperText = "# Heading · ## Subheading · --- divider · [label](https://...) link",
}: ChallengeDescriptionEditorProps) {
   const [mode, setMode] = useState<"write" | "preview">("preview");
   const isOverLimit = value.length > MAX_DESCRIPTION_LENGTH;
   const tabClassName =
      "h-6 rounded-md px-2.5 py-0.5 text-label! leading-none focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-nested";

   return (
      <div className="space-y-3">
         <div className="flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-nested p-1">
               <Button
                  type="button"
                  variant={mode === "preview" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setMode("preview")}
                  aria-pressed={mode === "preview"}
                  className={cn(
                     tabClassName,
                     mode !== "preview" && "text-text-tertiary hover:text-white"
                  )}
               >
                  Preview
               </Button>
               <Button
                  type="button"
                  variant={mode === "write" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setMode("write")}
                  aria-pressed={mode === "write"}
                  className={cn(
                     tabClassName,
                     mode !== "write" && "text-text-tertiary hover:text-white"
                  )}
               >
                  Write
               </Button>
            </div>

            <span
               className={cn(
                  "text-meta font-sans",
                  isOverLimit
                     ? "text-feedback-error-text"
                     : "text-text-tertiary"
               )}
            >
               {value.length}/{MAX_DESCRIPTION_LENGTH}
            </span>
         </div>

         {mode === "write" ? (
            <Textarea
               id={id}
               rows={rows}
               value={value}
               onChange={(event) => onChange(event.target.value)}
               placeholder={placeholder}
               disabled={disabled}
               maxLength={MAX_DESCRIPTION_LENGTH}
               className={cn(
                  "break-words bg-input-bg border-input-border text-text-primary placeholder:text-text-secondary rounded-xl p-3 text-xs leading-relaxed focus:bg-input-bg",
                  textareaClassName
               )}
            />
         ) : (
            <div className="min-h-[8rem] rounded-xl border border-border-default bg-surface-nested p-4">
               <ChallengeDescriptionContent source={value} />
            </div>
         )}

         <p className="text-meta text-text-tertiary">{helperText}</p>
      </div>
   );
}
