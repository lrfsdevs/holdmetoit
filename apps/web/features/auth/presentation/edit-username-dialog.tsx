"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Loader2, Pencil, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
   checkUsernameAvailabilityAction,
   updateUsernameAction,
} from "@/features/auth/api/username.actions";
import { isUsernameChangeAllowed } from "@/features/auth/domain/username";

export interface EditUsernameDialogProps {
   currentUsername?: string | null;
   usernameChangedAt?: Date | string | null;
   onUsernameUpdated?: (newUsername: string) => void;
   trigger?: React.ReactNode;
}

export function EditUsernameDialog({
   currentUsername,
   usernameChangedAt,
   onUsernameUpdated,
   trigger,
}: EditUsernameDialogProps) {
   const [open, setOpen] = useState(false);
   const [candidate, setCandidate] = useState(currentUsername ?? "");
   const [checkResult, setCheckResult] = useState<{
      available: boolean;
      reason?: string;
   } | null>(null);
   const [isChecking, setIsChecking] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [isPending, startTransition] = useTransition();

   const cooldown = isUsernameChangeAllowed(usernameChangedAt);

   // Sync candidate when dialog opens
   useEffect(() => {
      if (open) {
         setCandidate(currentUsername ?? "");
         setCheckResult(null);
         setError(null);
      }
   }, [open, currentUsername]);

   // Real-time debounced availability check
   useEffect(() => {
      let cancelled = false;
      const trimmed = candidate.trim();
      if (!trimmed || trimmed === currentUsername) {
         setCheckResult(null);
         setIsChecking(false);
         return;
      }

      setIsChecking(true);
      const timer = setTimeout(async () => {
         try {
            const res = await checkUsernameAvailabilityAction(trimmed);
            if (cancelled) return;
            if (res.ok) {
               setCheckResult({
                  available: res.data.available,
                  reason: res.data.reason,
               });
            } else {
               setCheckResult({
                  available: false,
                  reason: res.message,
               });
            }
         } catch {
            if (cancelled) return;
            setCheckResult({
               available: false,
               reason: "Failed to check availability.",
            });
         } finally {
            if (!cancelled) {
               setIsChecking(false);
            }
         }
      }, 350);

      return () => {
         cancelled = true;
         clearTimeout(timer);
      };
   }, [candidate, currentUsername]);

   const handleSave = () => {
      const trimmed = candidate.trim();
      if (!trimmed || trimmed === currentUsername) {
         setOpen(false);
         return;
      }

      setError(null);
      startTransition(async () => {
         const res = await updateUsernameAction(trimmed);
         if (res.ok) {
            toast.success(`Username updated to @${res.data.username}`);
            onUsernameUpdated?.(res.data.username);
            setOpen(false);
         } else {
            setError(res.message);
            toast.error(res.message);
         }
      });
   };

   const isCleanAndUnchanged =
      candidate.trim() === (currentUsername ?? "") || !candidate.trim();
   const isAvailable = checkResult ? checkResult.available : false;
   const canSubmit =
      !isPending &&
      !isChecking &&
      !isCleanAndUnchanged &&
      cooldown.allowed &&
      (checkResult ? checkResult.available : true);

   return (
      <Dialog open={open} onOpenChange={setOpen}>
         <DialogTrigger asChild>
            {trigger ?? (
               <button
                  type="button"
                  className="inline-flex items-center justify-center h-6 w-6 rounded-md text-text-tertiary hover:text-white hover:bg-surface-nested transition-colors"
                  title="Change username"
                  aria-label="Change username"
                  data-testid="edit-username-trigger"
               >
                  <Pencil className="h-3.5 w-3.5" />
               </button>
            )}
         </DialogTrigger>

         <DialogContent className="sm:max-w-md">
            <DialogHeader>
               <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-brand-1" />
                  <span>Edit Platform Username</span>
               </DialogTitle>
               <DialogDescription className="text-text-secondary text-xs">
                  Your platform username is your unique scholar handle across
                  leaderboards and challenges.
               </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
               {!cooldown.allowed && (
                  <div
                     className="rounded-xl border border-feedback-warning/30 bg-feedback-warning/10 p-3 text-xs text-feedback-warning flex items-start gap-2.5"
                     data-testid="cooldown-notice"
                  >
                     <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                     <div>
                        <span className="font-semibold block">
                           Username Cooldown Active
                        </span>
                        <span>
                           You can change your username again in{" "}
                           {cooldown.remainingDays} day(s).
                        </span>
                     </div>
                  </div>
               )}

               <div className="space-y-1.5">
                  <label
                     htmlFor="platform-username-input"
                     className="text-xs font-semibold text-text-secondary"
                  >
                     Username
                  </label>
                  <div className="relative">
                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm font-mono select-none">
                        @
                     </span>
                     <Input
                        id="platform-username-input"
                        data-testid="platform-username-input"
                        value={candidate}
                        disabled={!cooldown.allowed || isPending}
                        onChange={(e) => setCandidate(e.target.value)}
                        placeholder="scholar_name"
                        maxLength={20}
                        className="pl-8 pr-10 font-mono text-sm bg-surface-nested border-border-default focus-visible:ring-brand-1 text-white"
                     />
                     <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                        {isChecking && (
                           <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
                        )}
                        {!isChecking && checkResult && isAvailable && (
                           <Check className="h-4 w-4 text-feedback-success" />
                        )}
                     </div>
                  </div>

                  {/* Feedback text */}
                  {checkResult && !isAvailable && checkResult.reason && (
                     <p
                        className="text-xs text-feedback-error flex items-center gap-1 mt-1"
                        data-testid="username-check-error"
                     >
                        <span>{checkResult.reason}</span>
                     </p>
                  )}

                  {error && (
                     <p
                        className="text-xs text-feedback-error mt-1"
                        data-testid="username-submit-error"
                     >
                        {error}
                     </p>
                  )}

                  <p className="text-text-tertiary text-caption pt-1">
                     3–20 characters, alphanumeric and single underscores.
                     Changes are allowed once every 7 days.
                  </p>
               </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
               <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="border-border-default text-text-secondary hover:text-white"
               >
                  Cancel
               </Button>
               <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={!canSubmit}
                  data-testid="save-username-btn"
                  className="bg-brand-1 hover:bg-brand-1/90 text-black font-semibold"
               >
                  {isPending ? (
                     <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        Saving...
                     </>
                  ) : (
                     "Save Username"
                  )}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
}
