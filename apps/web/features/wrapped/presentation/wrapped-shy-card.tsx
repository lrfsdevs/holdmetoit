"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Trophy, ExternalLink, X } from "lucide-react";
import type { ChallengeWrappedViewModel } from "../domain/wrapped";

interface WrappedShyCardProps {
   wrapped: ChallengeWrappedViewModel;
   onReplayStory: () => void;
}

/**
 * Shy Card: A curious, parked card sitting on the right edge of the dashboard.
 * Its eyes peek out and blink, gently nudging periodically. When clicked or
 * focused, it slides into the center with an ambient scrim to present a rich
 * recap of the participant's challenge performance, with actions to replay the
 * story or view the full summary.
 */
export function WrappedShyCard({
   wrapped,
   onReplayStory,
}: WrappedShyCardProps) {
   const [isOpen, setIsOpen] = useState(false);
   const cardRef = useRef<HTMLDivElement | null>(null);
   const hideBtnRef = useRef<HTMLButtonElement | null>(null);

   const viewer = wrapped.viewer;

   const setOpen = useCallback((open: boolean) => {
      setIsOpen(open);
      if (open) {
         window.setTimeout(() => {
            hideBtnRef.current?.focus({ preventScroll: true });
         }, 350);
      } else {
         cardRef.current?.focus({ preventScroll: true });
      }
   }, []);

   // Keyboard accessibility: Escape to close when open
   useEffect(() => {
      if (!isOpen) {
         return;
      }

      const onKeyDown = (event: KeyboardEvent) => {
         if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
         }
      };

      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
   }, [isOpen, setOpen]);

   const verdictConfig = {
      saved: {
         label: "Saved",
         icon: "🎉",
         className: "bg-[#144520] text-[#85ff93] border-[#22c55e]/40",
      },
      punished: {
         label: "Punished",
         icon: "💀",
         className: "bg-[#401010] text-[#ff5757] border-[#ef4444]/40",
      },
      excused: {
         label: "Excused",
         icon: "🛡️",
         className: "bg-[#102d40] text-[#85d6ff] border-[#3b82f6]/40",
      },
   }[viewer?.verdict ?? "saved"];

   return (
      <>
         {/* Scrim overlay */}
         <div
            className={`fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm transition-opacity duration-400 ${
               isOpen
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none"
            }`}
            onClick={() => setOpen(false)}
            aria-hidden="true"
         />

         {/* Shy Card Container */}
         <div
            ref={cardRef}
            id="wrapped-shy-card"
            role={isOpen ? "dialog" : "button"}
            tabIndex={0}
            aria-expanded={isOpen}
            aria-label={
               isOpen
                  ? `Challenge wrapped summary for ${wrapped.title}`
                  : "Reveal your hidden challenge wrapped card"
            }
            onClick={() => {
               if (!isOpen) {
                  setOpen(true);
               }
            }}
            onKeyDown={(e) => {
               if (
                  !isOpen &&
                  (e.key === "Enter" || e.key === " ") &&
                  e.target === cardRef.current
               ) {
                  e.preventDefault();
                  setOpen(true);
               }
            }}
            className={`fixed z-[60] outline-none transition-[left,right,top,bottom,width,transform] duration-600 ease-[cubic-bezier(0.2,0.9,0.2,1)] ${
               isOpen
                  ? "left-1/2 right-auto top-1/2 bottom-auto w-[min(340px,calc(100vw-32px))] max-h-[calc(100dvh-2rem)] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rotate-0 scale-100 cursor-default"
                  : "bottom-[calc(5rem+env(safe-area-inset-bottom))] right-3 left-auto top-auto w-[72px] origin-bottom-right -rotate-6 scale-100 cursor-pointer hover:scale-105 focus-visible:outline-2 focus-visible:outline-[#22c55e] sm:left-full sm:right-auto sm:top-1/2 sm:bottom-auto sm:origin-top-left sm:w-[min(340px,calc(100vw-32px))] sm:-translate-x-[64px] sm:-translate-y-[16px] sm:-rotate-12 sm:scale-75 sm:hover:-translate-x-[76px] sm:hover:-rotate-8"
            }`}
         >
            <div
               className={`card-body bg-[#141414] border-2 rounded-2xl p-3 sm:p-5 flex flex-col gap-3.5 shadow-2xl shadow-black/80 transition-all duration-400 ${
                  isOpen
                     ? "border-[#292929] bg-[#141414]"
                     : "border-[#22c55e] animate-shy-nudge hover:border-[#85ff93]"
               }`}
            >
               {/* Animated Eyes Header */}
               <div
                  className={`flex items-center w-full ${
                     isOpen
                        ? "justify-between"
                        : "justify-center sm:justify-between"
                  }`}
               >
                  <div
                     className="eyes flex gap-1.5"
                     aria-hidden="true"
                     title="Peek peek"
                  >
                     <span className="w-5 h-5 bg-[#f4f3f6] border-2 border-[#0d0d0d] rounded-full grid place-items-center animate-shy-blink">
                        <span
                           className={`w-2 h-2 bg-[#0d0d0d] rounded-full transition-transform duration-400 delay-300 ${
                              isOpen ? "translate-x-0" : "-translate-x-[3px]"
                           }`}
                        />
                     </span>
                     <span className="w-5 h-5 bg-[#f4f3f6] border-2 border-[#0d0d0d] rounded-full grid place-items-center animate-shy-blink">
                        <span
                           className={`w-2 h-2 bg-[#0d0d0d] rounded-full transition-transform duration-400 delay-300 ${
                              isOpen ? "translate-x-0" : "-translate-x-[3px]"
                           }`}
                        />
                     </span>
                  </div>

                  {isOpen && (
                     <button
                        ref={hideBtnRef}
                        type="button"
                        onClick={(e) => {
                           e.stopPropagation();
                           setOpen(false);
                        }}
                        className="w-7 h-7 rounded-lg border border-[#292929] bg-[#1c1c1c] text-[#868686] hover:text-[#f4f3f6] hover:border-[#434343] grid place-items-center cursor-pointer transition-colors"
                        aria-label="Hide wrapped card"
                     >
                        <X className="w-3.5 h-3.5" />
                     </button>
                  )}
               </div>

               {/* Card Revealed Content */}
               <div
                  className={`flex flex-col gap-3 transition-opacity duration-350 ${
                     isOpen
                        ? "opacity-100 visible delay-150"
                        : "opacity-0 invisible pointer-events-none h-0 overflow-hidden"
                  }`}
               >
                  <div>
                     <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#22c55e]">
                        <Sparkles className="w-3 h-3" />
                        <span>Challenge Wrapped</span>
                     </div>
                     <h3 className="mt-0.5 text-base font-bold font-display text-[#f4f3f6] tracking-tight truncate">
                        {wrapped.title}
                     </h3>
                  </div>

                  {viewer && (
                     <>
                        {/* Verdict Banner */}
                        <div
                           className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold tracking-wide ${verdictConfig.className}`}
                        >
                           <span>{verdictConfig.icon}</span>
                           <span>Accountability: {verdictConfig.label}</span>
                        </div>

                        {/* Performance Details Box */}
                        <div className="rounded-xl border border-[#292929] bg-[#1c1c1c] p-3 text-xs space-y-2">
                           <div className="flex items-center justify-between">
                              <span className="text-[#868686]">Study Time</span>
                              <span className="font-sans font-sans-tabular font-bold text-[#f4f3f6]">
                                 {viewer.totalClock}{" "}
                                 <span className="text-[#868686] font-normal">
                                    / {viewer.targetClock}
                                 </span>
                              </span>
                           </div>

                           <div className="flex items-center justify-between">
                              <span className="text-[#868686]">
                                 Leaderboard Rank
                              </span>
                              <span className="font-sans font-sans-tabular font-bold text-[#f4f3f6]">
                                 #{viewer.rank}{" "}
                                 <span className="text-[#868686] font-normal">
                                    of {viewer.totalParticipants}
                                 </span>
                              </span>
                           </div>

                           <div className="flex items-center justify-between">
                              <span className="text-[#868686]">Team</span>
                              <span className="font-semibold text-[#f4f3f6] inline-flex items-center gap-1">
                                 {viewer.teamIcon && (
                                    <span>{viewer.teamIcon}</span>
                                 )}
                                 <span>{viewer.teamName}</span>
                                 {viewer.teamResult === "winner" && (
                                    <Trophy className="w-3 h-3 text-amber-400 inline" />
                                 )}
                              </span>
                           </div>
                        </div>
                     </>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 pt-1">
                     <button
                        type="button"
                        onClick={(e) => {
                           e.stopPropagation();
                           setOpen(false);
                           onReplayStory();
                        }}
                        className="w-full h-10 rounded-xl bg-[#22c55e] text-[#0d0d0d] font-bold text-xs cursor-pointer inline-flex items-center justify-center gap-2 hover:bg-[#16a34a] transition-all shadow-md shadow-[#22c55e]/10"
                     >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Replay Wrapped Story</span>
                     </button>

                     <Link
                        href={`/challenge/${wrapped.challengeId}?tab=summary`}
                        onClick={() => setOpen(false)}
                        className="w-full h-9 rounded-xl border border-[#292929] bg-[#1c1c1c] text-[#f4f3f6] font-medium text-xs inline-flex items-center justify-center gap-1.5 hover:border-[#434343] hover:bg-[#252525] transition-colors"
                     >
                        <span>View Full Summary</span>
                        <ExternalLink className="w-3 h-3 text-[#868686]" />
                     </Link>

                     <button
                        type="button"
                        onClick={(e) => {
                           e.stopPropagation();
                           setOpen(false);
                        }}
                        className="text-[11px] text-[#868686] hover:text-[#f4f3f6] transition-colors py-1 cursor-pointer text-center"
                     >
                        Hide again
                     </button>
                  </div>
               </div>
            </div>
         </div>
      </>
   );
}
