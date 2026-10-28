"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@/components/ui/dialog";
import { updateDuoTeamIdentityAction } from "@/features/challenges/api/update-duo-team-identity.actions";
import {
   DUO_TEAM_EMOJI_MAX_INPUT_LENGTH,
   DUO_TEAM_NAME_MAX_LENGTH,
   validateDuoTeamEmoji,
   validateDuoTeamName,
} from "@/features/challenges/domain/duo-team-identity";

const DUO_EMOJI_PRESETS = [
   "🔥",
   "❄️",
   "🌿",
   "⚡",
   "🌙",
   "☀️",
   "🐝",
   "🦋",
   "🦊",
   "🦉",
   "🐢",
   "🐉",
] as const;

interface EditDuoTeamModalProps {
   challengeId: string;
   currentName: string;
   currentEmoji: string;
   isOpen: boolean;
   onOpenChange: (open: boolean) => void;
}

/** Lets either partner edit their duo team name and emoji while unlocked. */
export function EditDuoTeamModal({
   challengeId,
   currentName,
   currentEmoji,
   isOpen,
   onOpenChange,
}: EditDuoTeamModalProps) {
   const router = useRouter();
   const [name, setName] = useState(currentName);
   const [emoji, setEmoji] = useState(currentEmoji);
   const [errorMsg, setErrorMsg] = useState<string | null>(null);
   const [isPending, startTransition] = useTransition();

   useEffect(() => {
      if (isOpen) {
         setName(currentName);
         setEmoji(currentEmoji);
         setErrorMsg(null);
      }
   }, [isOpen, currentName, currentEmoji]);

   const handleOpenChange = (open: boolean) => {
      if (isPending) return;
      onOpenChange(open);
      if (!open) setErrorMsg(null);
   };

   const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setErrorMsg(null);

      const nameValidation = validateDuoTeamName(name);
      if (!nameValidation.ok) {
         setErrorMsg(nameValidation.message);
         return;
      }

      const emojiValidation = validateDuoTeamEmoji(emoji);
      if (!emojiValidation.ok) {
         setErrorMsg(emojiValidation.message);
         return;
      }

      startTransition(async () => {
         try {
            const result = await updateDuoTeamIdentityAction({
               challengeId,
               name: nameValidation.name,
               iconEmoji: emojiValidation.emoji,
            });

            if (!result.ok) {
               setErrorMsg(result.message);
               return;
            }

            onOpenChange(false);
            router.refresh();
         } catch {
            setErrorMsg("Could not update your duo team. Please try again.");
         }
      });
   };

   const previewEmoji = emoji.trim() || "🛡️";
   const previewName = name.trim() || "Your duo name";

   return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
         <DialogContent>
            <form onSubmit={handleSubmit} className="space-y-4">
               <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                     <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-strong bg-surface-nested text-text-secondary">
                        <Pencil className="h-4 w-4" />
                     </span>
                     Edit your duo
                  </DialogTitle>
                  <DialogDescription>
                     Both partners share this name and emoji. They stay editable
                     until the host locks final results.
                  </DialogDescription>
               </DialogHeader>

               <div className="flex items-center gap-3 rounded-2xl border border-border-default bg-surface-secondary p-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border-strong bg-surface-elevated text-2xl">
                     {previewEmoji}
                  </span>
                  <div className="min-w-0">
                     <p className="text-label uppercase tracking-wider text-text-tertiary">
                        Preview
                     </p>
                     <p className="truncate text-sm font-bold text-white">
                        {previewName}
                     </p>
                  </div>
               </div>

               <div className="space-y-1.5">
                  <label
                     htmlFor="duo-team-name"
                     className="text-xs font-semibold text-text-secondary"
                  >
                     Duo name
                  </label>
                  <Input
                     id="duo-team-name"
                     data-testid="duo-team-name-input"
                     value={name}
                     onChange={(event) => setName(event.target.value)}
                     maxLength={DUO_TEAM_NAME_MAX_LENGTH}
                     disabled={isPending}
                     autoFocus
                  />
                  <p className="text-right text-meta font-sans font-sans-tabular text-text-tertiary">
                     {name.trim().length}/{DUO_TEAM_NAME_MAX_LENGTH}
                  </p>
               </div>

               <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                     <label
                        htmlFor="duo-team-emoji"
                        className="text-xs font-semibold text-text-secondary"
                     >
                        Emoji
                     </label>
                     <button
                        type="button"
                        onClick={() => setEmoji("")}
                        disabled={isPending || !emoji}
                        className="text-meta font-semibold text-text-tertiary underline underline-offset-2 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                     >
                        Clear
                     </button>
                  </div>

                  <div className="flex items-center gap-2">
                     <Input
                        id="duo-team-emoji"
                        data-testid="duo-team-emoji-input"
                        value={emoji}
                        onChange={(event) => setEmoji(event.target.value)}
                        maxLength={DUO_TEAM_EMOJI_MAX_INPUT_LENGTH}
                        disabled={isPending}
                        placeholder="🔥"
                        className="w-20 text-center text-xl"
                     />
                     <div className="flex flex-1 flex-wrap gap-1.5">
                        {DUO_EMOJI_PRESETS.map((preset) => (
                           <button
                              key={preset}
                              type="button"
                              onClick={() => setEmoji(preset)}
                              disabled={isPending}
                              aria-label={`Use ${preset} as duo emoji`}
                              data-testid={`duo-emoji-preset-${preset}`}
                              className={`flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                 emoji === preset
                                    ? "border-feedback-success/50 bg-feedback-success-bg"
                                    : "border-border-strong bg-surface-elevated hover:border-border-strong hover:bg-surface-nested"
                              }`}
                           >
                              {preset}
                           </button>
                        ))}
                     </div>
                  </div>
                  <p className="text-meta text-text-tertiary">
                     One emoji, or clear it to use the default shield.
                  </p>
               </div>

               {errorMsg && (
                  <div
                     role="alert"
                     data-testid="duo-team-identity-error"
                     className="rounded-xl border border-feedback-error/40 bg-feedback-error-bg/30 p-3 text-xs text-feedback-error-text"
                  >
                     {errorMsg}
                  </div>
               )}

               <DialogFooter>
                  <Button
                     type="button"
                     variant="outline"
                     onClick={() => handleOpenChange(false)}
                     disabled={isPending}
                  >
                     Cancel
                  </Button>
                  <Button
                     type="submit"
                     disabled={isPending || !name.trim()}
                     data-testid="duo-team-identity-submit"
                     className="gap-2"
                  >
                     {isPending && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                     )}
                     Save changes
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>
   );
}
