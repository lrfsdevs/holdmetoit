"use client";

import { useCallback, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

import { toggleParticipantPreviewAction } from "@/features/auth/api/preview-mode.actions";
import {
   isParticipantPreviewHotkey,
   PARTICIPANT_PREVIEW_COOKIE,
} from "@/features/auth/domain/preview-mode";

export function PreviewModeHotkey({
   isActualAdmin,
   isPreviewActive,
}: {
   isActualAdmin: boolean;
   isPreviewActive: boolean;
}) {
   const router = useRouter();
   const [, startTransition] = useTransition();

   const toggle = useCallback(() => {
      startTransition(async () => {
         const nextState = !isPreviewActive;

         if (typeof document !== "undefined") {
            if (nextState) {
               document.cookie = `${PARTICIPANT_PREVIEW_COOKIE}=true; path=/; max-age=86400; SameSite=Lax`;
            } else {
               document.cookie = `${PARTICIPANT_PREVIEW_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
            }
         }

         await toggleParticipantPreviewAction(nextState);

         if (
            typeof window !== "undefined" &&
            window.location.search.includes("as=participant")
         ) {
            const url = new URL(window.location.href);
            url.searchParams.delete("as");
            router.replace(url.pathname + (url.search ? url.search : ""));
            return;
         }

         router.refresh();
      });
   }, [isPreviewActive, router]);

   useEffect(() => {
      if (!isActualAdmin) return;

      const handleKeyDown = (event: KeyboardEvent) => {
         if (isParticipantPreviewHotkey(event)) {
            event.preventDefault();
            event.stopPropagation();
            if (!event.repeat) {
               toggle();
            }
         }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
   }, [isActualAdmin, toggle]);

   return null;
}
