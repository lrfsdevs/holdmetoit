"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { withdrawFromChallengeAction } from "@/features/challenges/api/withdraw-participant.actions";

interface WithdrawChallengeButtonProps {
   challengeId: string;
   challengeTitle: string;
}

/** Renders the participant self-withdrawal action and its confirmation modal. */
export function WithdrawChallengeButton({
   challengeId,
   challengeTitle,
}: WithdrawChallengeButtonProps) {
   const router = useRouter();
   const [isOpen, setIsOpen] = useState(false);
   const [errorMsg, setErrorMsg] = useState<string | null>(null);
   const [isPending, startTransition] = useTransition();

   const handleOpenChange = (open: boolean) => {
      if (isPending) return;
      setIsOpen(open);
      if (!open) setErrorMsg(null);
   };

   const handleConfirm = (event: React.MouseEvent) => {
      event.preventDefault();
      setErrorMsg(null);

      startTransition(async () => {
         try {
            const result = await withdrawFromChallengeAction({ challengeId });

            if (!result.ok) {
               setErrorMsg(result.message);
               return;
            }

            setIsOpen(false);
            router.refresh();
         } catch {
            setErrorMsg(
               "Could not withdraw from this challenge. Please try again."
            );
         }
      });
   };

   return (
      <>
         <Button
            type="button"
            variant="destructive"
            data-testid="withdraw-challenge-button"
            onClick={() => setIsOpen(true)}
            className="w-full h-11 rounded-2xl font-bold"
         >
            Withdraw
         </Button>

         <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-3">
                     <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-feedback-error/10 border border-feedback-error/30 text-feedback-error-text shrink-0">
                        <AlertTriangle className="h-5 w-5" />
                     </span>
                     Withdraw from {challengeTitle}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                     You will be removed from the public standings and team
                     totals, and you will no longer be able to log study time
                     for this challenge. Your existing logs are preserved, but
                     you cannot rejoin once you withdraw.
                  </AlertDialogDescription>
               </AlertDialogHeader>

               {errorMsg && (
                  <div className="rounded-xl border border-feedback-error/40 bg-feedback-error-bg/30 p-3 text-xs text-feedback-error-text">
                     {errorMsg}
                  </div>
               )}

               <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPending}>
                     Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                     disabled={isPending}
                     onClick={handleConfirm}
                     className="gap-2 border border-feedback-error/40 bg-feedback-error-bg text-feedback-error-text hover:bg-feedback-error-bg"
                  >
                     {isPending && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                     )}
                     Yes, Withdraw
                  </AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      </>
   );
}
