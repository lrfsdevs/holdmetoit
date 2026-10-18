import Link from "next/link";
import {
   Compass,
   Trophy,
   ArrowRight,
   LayoutDashboard,
   CalendarX2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ParticipantProfileHeader } from "../domain/participant-stats.types";

interface ParticipantFallbackBannerProps {
   profile: ParticipantProfileHeader;
   viewer: {
      isAdmin: boolean;
      isOwner: boolean;
   };
}

/**
 * Renders a friendly zero-state banner on the challenge participant profile
 * when a user has no participation data (e.g. joined after event concluded or is unenrolled).
 */
export function ParticipantFallbackBanner({
   profile,
   viewer,
}: ParticipantFallbackBannerProps) {
   const isCompleted = profile.challengeStatus === "COMPLETED";

   const title = viewer.isOwner
      ? isCompleted
         ? "You Were Not Enrolled in This Challenge"
         : "You Are Not Enrolled in This Challenge Yet"
      : isCompleted
        ? "No Participation Record in This Challenge"
        : "Scholar Not Enrolled in This Challenge";

   const description = viewer.isOwner
      ? isCompleted
         ? `This challenge concluded on record. Because your account was registered after the event finished or was not assigned to a roster, no study hours or target commitments were logged for ${profile.challengeTitle}.`
         : `You haven't declared your target study hours or joined a roster for ${profile.challengeTitle}. Enroll now to track study hours and climb the live scoreboard!`
      : `This scholar does not have an active participation record for ${profile.challengeTitle}. No study logs or target goals were registered for this event.`;

   return (
      <div
         className="rounded-3xl border border-border-default bg-surface-primary p-5 sm:p-7 shadow-xl space-y-5"
         role="region"
         aria-label="Challenge Enrollment Status Notice"
      >
         <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-surface-elevated border border-border-strong flex items-center justify-center shrink-0 text-feedback-success shadow-md">
               {isCompleted ? (
                  <CalendarX2 className="h-5 w-5 sm:h-6 sm:w-6 text-text-tertiary" />
               ) : (
                  <Compass className="h-5 w-5 sm:h-6 sm:w-6 text-feedback-success" />
               )}
            </div>

            <div className="space-y-1.5 flex-1 min-w-0">
               <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                     {title}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-label font-semibold uppercase tracking-wider bg-surface-elevated border border-border-strong text-text-tertiary">
                     {isCompleted ? "Event Concluded" : "Open for Enrollment"}
                  </span>
               </div>
               <p className="text-xs sm:text-sm text-text-secondary leading-relaxed max-w-3xl">
                  {description}
               </p>
            </div>
         </div>

         {/* Call to Action Controls */}
         <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-border-default">
            {!isCompleted && viewer.isOwner ? (
               <Button asChild variant="default" className="min-h-control-sm">
                  <Link
                     href={`/challenge/${profile.challengeId}`}
                     className="inline-flex items-center gap-2"
                  >
                     <span>Go to Challenge to Enroll</span>
                     <ArrowRight className="h-4 w-4" />
                  </Link>
               </Button>
            ) : (
               <Button asChild variant="default" className="min-h-control-sm">
                  <Link
                     href="/challenges"
                     className="inline-flex items-center gap-2"
                  >
                     <Compass className="h-4 w-4" />
                     <span>Browse Challenges Directory</span>
                  </Link>
               </Button>
            )}

            <Button asChild variant="secondary" className="min-h-control-sm">
               <Link
                  href={`/challenge/${profile.challengeId}?tab=leaderboard`}
                  className="inline-flex items-center gap-2"
               >
                  <Trophy className="h-4 w-4 text-text-tertiary" />
                  <span>View Challenge Scoreboard</span>
               </Link>
            </Button>

            <Button
               asChild
               variant="ghost"
               className="min-h-control-sm text-text-tertiary hover:text-white hover:bg-surface-elevated"
            >
               <Link href="/" className="inline-flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Return to Lounge</span>
               </Link>
            </Button>
         </div>
      </div>
   );
}
