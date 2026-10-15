"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EnrollmentModal } from "./enrollment-modal";
import type { ChallengeScoreboardViewModel } from "@/features/leaderboard/domain/leaderboard.types";

interface ChallengeHeroBannerProps {
   challenge: ChallengeScoreboardViewModel;
   onQuickLog?: () => void;
}

function ChallengeHeroImage({ src }: { src: string | null }) {
   const [status, setStatus] = useState<"loading" | "loaded" | "error">(
      "loading"
   );
   const [attempt, setAttempt] = useState(0);

   return (
      <>
         <div className="absolute inset-0 z-0">
            {src && status === "loading" && (
               <div
                  role="status"
                  aria-label="Loading challenge image"
                  className="absolute inset-0 animate-pulse bg-[#292929] motion-reduce:animate-none"
               />
            )}
            {src && status !== "error" && (
               <Image
                  key={attempt}
                  src={src}
                  alt=""
                  fill
                  priority
                  unoptimized
                  sizes="(max-width: 1200px) 100vw, 1200px"
                  onLoad={() => setStatus("loaded")}
                  onError={() => setStatus("error")}
                  className={`object-cover object-center transition-opacity motion-reduce:transition-none ${
                     status === "loaded" ? "opacity-[0.66]" : "opacity-0"
                  }`}
               />
            )}
         </div>
         {src && status === "error" && (
            <div
               role="status"
               className="relative z-10 flex flex-wrap items-center gap-2 px-6 pt-4 text-xs text-[#d1d1d1] sm:px-8"
            >
               <span>Challenge image unavailable.</span>
               <button
                  type="button"
                  onClick={() => {
                     setAttempt((previous) => previous + 1);
                     setStatus("loading");
                  }}
                  className="min-h-[44px] rounded-md px-2 font-medium underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
               >
                  Retry image
               </button>
            </div>
         )}
      </>
   );
}

function formatChallengeDate(dateString: string): string {
   const d = new Date(dateString);
   const day = d.getUTCDate();
   const month = d.toLocaleDateString("en-US", {
      month: "short",
      timeZone: "UTC",
   });
   return `${day} ${month}`;
}

function ChallengeHeroActions({ challenge }: ChallengeHeroBannerProps) {
   const router = useRouter();
   const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
   const { currentUser } = challenge;

   if (currentUser.isEnrolled) {
      return null;
   }

   return (
      <>
         <div className="w-36 sm:w-44 rounded-2xl bg-[#351517] border border-[#ff5757]/20 shadow-xl overflow-hidden shrink-0 self-start sm:self-center flex flex-col">
            {challenge.status !== "COMPLETED" ? (
               currentUser.isLoggedIn ? (
                  <Button
                     type="button"
                     onClick={() => setIsEnrollModalOpen(true)}
                     className="w-full h-11 sm:h-12 rounded-2xl bg-[#ffffff] text-[#0d0d0d] hover:bg-[#e0e0e0] text-sm sm:text-base font-bold shadow-md transition-colors flex items-center justify-center border-none"
                  >
                     Enroll Now
                  </Button>
               ) : (
                  <Button
                     asChild
                     className="w-full h-11 sm:h-12 rounded-2xl bg-[#ffffff] text-[#0d0d0d] hover:bg-[#e0e0e0] text-sm sm:text-base font-bold shadow-md transition-colors flex items-center justify-center border-none"
                  >
                     <Link
                        href={`/api/auth/signin?callbackUrl=/challenge/${challenge.id}`}
                     >
                        Enroll Now
                     </Link>
                  </Button>
               )
            ) : null}

            <div className="w-full py-2 sm:py-2.5 px-3 text-center text-xs sm:text-sm font-semibold text-[#ff5c5c]">
               {challenge.status === "COMPLETED"
                  ? "Completed"
                  : challenge.status === "UPCOMING" &&
                      challenge.daysRemaining === 0
                    ? "Starts Today"
                    : `${challenge.daysRemaining} ${challenge.daysRemaining === 1 ? "Day" : "Days"} Left`}
            </div>
         </div>

         {currentUser.isLoggedIn &&
            !currentUser.isEnrolled &&
            challenge.status !== "COMPLETED" && (
               <EnrollmentModal
                  challengeId={challenge.id}
                  challengeTitle={challenge.title}
                  format={challenge.format}
                  teams={challenge.teams}
                  isOpen={isEnrollModalOpen}
                  onOpenChange={setIsEnrollModalOpen}
                  showTrigger={false}
                  onSuccess={() => router.refresh()}
               />
            )}
      </>
   );
}

/** Renders the challenge hero banner with image and fallback presentation. */
export function ChallengeHeroBanner({ challenge }: ChallengeHeroBannerProps) {
   const { matchHeader, teams } = challenge;
   const teamA = matchHeader.teamA ?? teams[0];
   const teamB = matchHeader.teamB ?? teams[1];

   const matchupText =
      teamA && teamB
         ? `${teamA.name} VS ${teamB.name}`
         : challenge.format === "DUOS"
           ? "Duos Battle"
           : challenge.format === "SOLOS"
             ? "Solos FFA"
             : "House Battle";

   const dateRangeFormatted = `${formatChallengeDate(challenge.startAt)} - ${formatChallengeDate(challenge.endAt)}`;

   return (
      <div className="relative overflow-hidden rounded-3xl border border-[#262626] bg-[#0e0e10] shadow-2xl min-h-[220px]">
         <ChallengeHeroImage
            key={challenge.heroImageUrl}
            src={challenge.heroImageUrl}
         />

         <div className="relative z-10 p-6 sm:p-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 min-h-[220px]">
            <div className="flex flex-col justify-center">
               <Link
                  href="/challenges"
                  className="group inline-flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-full border border-white/15 bg-black/50 hover:bg-black/75 hover:border-white/30 text-xs sm:text-sm font-medium text-[#f4f3f6] hover:text-white backdrop-blur-md shadow-md transition-all duration-200 mb-3 sm:mb-4 w-fit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
               >
                  <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#d1d1d1] group-hover:text-white transition-transform group-hover:-translate-x-0.5" />
                  <span>Back to challenges</span>
               </Link>

               <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#ffffff] tracking-tight">
                  {challenge.title}
               </h1>

               <p className="text-sm sm:text-base font-medium text-[#d1d1d1] mt-2">
                  {matchupText}
               </p>

               <p className="text-xs sm:text-sm text-[#a3a3a3] mt-1">
                  {dateRangeFormatted}
               </p>
            </div>

            <ChallengeHeroActions challenge={challenge} />
         </div>
      </div>
   );
}
