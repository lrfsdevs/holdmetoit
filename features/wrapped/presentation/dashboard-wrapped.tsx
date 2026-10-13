"use client";

import { useMemo, useState } from "react";
import type { ChallengeScoreboardViewModel } from "@/features/leaderboard/data/leaderboard-data";
import {
   buildChallengeWrappedViewModel,
   isChallengeCompleted,
   isWrappedWindowExpired,
} from "../domain/wrapped";
import { WrappedShyCard } from "./wrapped-shy-card";
import { ChallengeWrappedModal } from "./challenge-wrapped-modal";

interface DashboardWrappedProps {
   challenge: ChallengeScoreboardViewModel;
}

/**
 * DashboardWrapped: Coordinates the post-event challenge wrapped experience
 * on the home dashboard. Automatically triggers the full story modal on page
 * load if the participant hasn't seen it yet, and maintains the Shy Card parked
 * on the side of the screen throughout the 3-day post-completion window.
 */
export function DashboardWrapped({ challenge }: DashboardWrappedProps) {
   const [isModalOpen, setIsModalOpen] = useState(false);

   const isCompleted = isChallengeCompleted(challenge);
   const completionDate = challenge.resultsLockedAt ?? challenge.endAt;
   const isExpired = isWrappedWindowExpired(completionDate);
   const isEnrolled = challenge.currentUser.isEnrolled;

   const wrapped = useMemo(() => {
      if (challenge.isDeleted || !isCompleted || isExpired || !isEnrolled) {
         return null;
      }
      return buildChallengeWrappedViewModel(
         challenge,
         challenge.currentUser.participantId
      );
   }, [challenge, isCompleted, isExpired, isEnrolled]);

   if (
      challenge.isDeleted ||
      !wrapped ||
      !isCompleted ||
      isExpired ||
      !isEnrolled
   ) {
      return null;
   }

   return (
      <>
         {/* Story Modal: auto-opens on load if unseen & due, or triggered via Shy Card */}
         <ChallengeWrappedModal
            challenge={challenge}
            isOpen={isModalOpen ? true : undefined}
            onClose={() => setIsModalOpen(false)}
         />

         {/* Shy Card parked on the right edge */}
         <WrappedShyCard
            wrapped={wrapped}
            onReplayStory={() => setIsModalOpen(true)}
         />
      </>
   );
}
