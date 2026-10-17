"use client";

import {
   useCallback,
   useEffect,
   useMemo,
   useRef,
   useState,
   type PointerEvent as ReactPointerEvent,
} from "react";

import type { ChallengeScoreboardViewModel } from "@/features/leaderboard/domain/leaderboard.types";
import {
   buildChallengeWrappedViewModel,
   getChallengeCompletionDate,
   isChallengeCompleted,
   isWrappedPopupDue,
   isWrappedWindowExpired,
} from "@/features/wrapped/domain/wrapped";
import {
   buildWrappedStory,
   type WrappedStoryChart,
} from "@/features/wrapped/domain/wrapped-story";
import {
   markWrappedSeenAction,
   markWrappedSeenIfExpiredAction,
} from "@/features/wrapped/api/wrapped.actions";
import {
   readWrappedLocalState,
   writeWrappedLocalState,
} from "./wrapped-storage";
import { ChallengeFeedbackDialog } from "./challenge-feedback-dialog";

const FEEDBACK_SLIDE_INDEX = 4;
const VERDICT_SLIDE_INDEX = 3;
const LAST_SLIDE_INDEX = FEEDBACK_SLIDE_INDEX;
const HOLD_MS = 1200;
/** 2πr for the ring radius 88 (ported from the reference). */
const RING_CIRCUMFERENCE = 552.92;

function formatMinutes(minutes: number): string {
   if (minutes <= 0) {
      return "";
   }

   const hours = Math.floor(minutes / 60);
   const rest = minutes % 60;

   if (hours === 0) {
      return `${rest}m`;
   }
   return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function ArrowRightIcon({
   className = "w-4 h-4 shrink-0",
}: { className?: string } = {}) {
   return (
      <svg
         viewBox="0 0 24 24"
         fill="none"
         stroke="currentColor"
         strokeWidth="2.5"
         strokeLinecap="round"
         strokeLinejoin="round"
         aria-hidden="true"
         className={className}
      >
         <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
   );
}

function ArrowLeftIcon({
   className = "w-4 h-4 shrink-0",
}: { className?: string } = {}) {
   return (
      <svg
         viewBox="0 0 24 24"
         fill="none"
         stroke="currentColor"
         strokeWidth="2.5"
         strokeLinecap="round"
         strokeLinejoin="round"
         aria-hidden="true"
         className={className}
      >
         <path d="M19 12H5M11 6l-6 6 6 6" />
      </svg>
   );
}

interface ChallengeWrappedModalProps {
   challenge: ChallengeScoreboardViewModel;
   isOpen?: boolean;
   onClose?: () => void;
}

/**
 * Auto-opening story popup shown to enrolled participants once the host locks
 * the results. Visual/motion port of `holdmetoit Wrapped.html` (Obsidian
 * theme). Reappears until the wrapped has been seen AND the feedback is
 * filled, and never after the 3-day window closes (page-load auto-seen).
 */
export function ChallengeWrappedModal({
   challenge,
   isOpen: controlledIsOpen,
   onClose,
}: ChallengeWrappedModalProps) {
   const [isOpen, setIsOpen] = useState(controlledIsOpen ?? false);
   const [slideIndex, setSlideIndex] = useState(0);
   const [dismissedThisVisit, setDismissedThisVisit] = useState(false);
   const [revealed, setRevealed] = useState(false);
   const [displayedMinutes, setDisplayedMinutes] = useState(0);
   const [hoverIndex, setHoverIndex] = useState<number | null>(null);
   const [toast, setToast] = useState<string | null>(null);
   const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);

   const seenReportedRef = useRef(false);
   const lastFocusRef = useRef<HTMLElement | null>(null);
   const cardRef = useRef<HTMLDivElement | null>(null);
   const slideRefs = useRef<Array<HTMLElement | null>>([]);
   const holdRef = useRef<HTMLButtonElement | null>(null);
   const ringRef = useRef<SVGCircleElement | null>(null);
   const holdTextRef = useRef<HTMLSpanElement | null>(null);
   const svgRef = useRef<SVGSVGElement | null>(null);
   const holdProgressRef = useRef(0);
   const holdingRef = useRef(false);
   const holdRafRef = useRef(0);
   const holdLastTRef = useRef(0);
   const revealedRef = useRef(false);
   const toastTimerRef = useRef<number | null>(null);

   const wrapped = useMemo(() => {
      const isCompleted = isChallengeCompleted(challenge);
      if (!isCompleted || !challenge.currentUser.isEnrolled) {
         return null;
      }

      return buildChallengeWrappedViewModel(
         challenge,
         challenge.currentUser.participantId
      );
   }, [challenge]);

   const story = useMemo(
      () => (wrapped ? buildWrappedStory(wrapped) : null),
      [wrapped]
   );

   const { id, resultsLockedAt } = challenge;
   const { isEnrolled, isWrappedSeen, isFeedbackFilled } =
      challenge.currentUser;

   const showToast = useCallback((message: string) => {
      if (toastTimerRef.current !== null) {
         window.clearTimeout(toastTimerRef.current);
      }
      setToast(message);
      toastTimerRef.current = window.setTimeout(() => {
         setToast(null);
         toastTimerRef.current = null;
      }, 2600);
   }, []);

   useEffect(() => {
      if (controlledIsOpen !== undefined) {
         if (controlledIsOpen) {
            setDismissedThisVisit(false);
            setSlideIndex(0);
            revealedRef.current = false;
            setRevealed(false);
            setIsOpen(true);
         } else {
            setIsOpen(false);
         }
      }
   }, [controlledIsOpen]);

   // Page load: seed localStorage from the server, run the 3-day auto-seen
   // check, and auto-open the story while it is still due.
   useEffect(() => {
      if (controlledIsOpen !== undefined) {
         return;
      }

      const completionDate = getChallengeCompletionDate(challenge);
      if (!completionDate || !isEnrolled || dismissedThisVisit || isOpen) {
         return;
      }

      // Reconcile localStorage with database if server indicates flags are false.
      // This ensures database resets (e.g. testing, host relocks) are not overridden by stale browser cache.
      const local = readWrappedLocalState(id);
      if (isWrappedSeen === false && local?.seen === true) {
         writeWrappedLocalState(id, { seen: false });
      }
      if (isFeedbackFilled === false && local?.feedback === true) {
         writeWrappedLocalState(id, { feedback: false });
      }

      const activeLocal = readWrappedLocalState(id);
      if (!activeLocal) {
         writeWrappedLocalState(id, {
            seen: isWrappedSeen,
            feedback: isFeedbackFilled,
         });
      }

      const effectiveSeen = activeLocal?.seen ?? isWrappedSeen;
      const effectiveFeedback = activeLocal?.feedback ?? isFeedbackFilled;

      if (!effectiveSeen && isWrappedWindowExpired(completionDate)) {
         writeWrappedLocalState(id, { seen: true });
         void markWrappedSeenIfExpiredAction(id);
         return;
      }

      const due = isWrappedPopupDue({
         resultsLockedAt,
         endAt: challenge.endAt,
         isWrappedSeen,
         isFeedbackFilled,
         localSeen: effectiveSeen,
         localFeedback: effectiveFeedback,
      });

      if (due) {
         lastFocusRef.current = document.activeElement as HTMLElement | null;
         revealedRef.current = false;
         setRevealed(false);
         setHoverIndex(null);
         seenReportedRef.current = effectiveSeen;
         setSlideIndex(0);
         setIsOpen(true);
      }
   }, [
      id,
      resultsLockedAt,
      challenge,
      controlledIsOpen,
      isEnrolled,
      isWrappedSeen,
      isFeedbackFilled,
      dismissedThisVisit,
      isOpen,
   ]);

   // Reaching the feedback slide counts as "seen" (localStorage + server).
   useEffect(() => {
      if (
         !isOpen ||
         slideIndex < FEEDBACK_SLIDE_INDEX ||
         seenReportedRef.current
      ) {
         return;
      }

      seenReportedRef.current = true;
      writeWrappedLocalState(id, { seen: true });
      void markWrappedSeenAction(id);
   }, [isOpen, slideIndex, id]);

   const close = useCallback(() => {
      setIsOpen(false);
      setDismissedThisVisit(true);
      onClose?.();

      const previous = lastFocusRef.current;
      if (previous?.focus) {
         window.requestAnimationFrame(() => previous.focus());
      }
   }, [onClose]);

   const paintHold = useCallback(() => {
      const progress = holdProgressRef.current;
      if (ringRef.current) {
         ringRef.current.style.strokeDashoffset = (
            RING_CIRCUMFERENCE *
            (1 - progress)
         ).toFixed(2);
      }
      if (holdRef.current) {
         holdRef.current.style.transform = `scale(${(1 - progress * 0.05).toFixed(3)})`;
      }
      if (!revealedRef.current && holdTextRef.current) {
         holdTextRef.current.textContent =
            progress > 0.03 ? "Keep holding" : "Hold to reveal";
      }
   }, []);

   const reveal = useCallback(() => {
      if (revealedRef.current) {
         return;
      }

      revealedRef.current = true;
      holdingRef.current = false;
      holdProgressRef.current = 1;
      paintHold();
      setRevealed(true);

      try {
         navigator.vibrate?.(30);
      } catch {
         // Vibration is best-effort.
      }

      window.requestAnimationFrame(() => {
         cardRef.current
            ?.querySelector<HTMLButtonElement>("[data-verdict-next]")
            ?.focus({ preventScroll: true });
      });
   }, [paintHold]);

   const loopHold = useCallback(
      (now: number) => {
         const dt = Math.min(64, now - holdLastTRef.current);
         holdLastTRef.current = now;

         holdProgressRef.current = holdingRef.current
            ? Math.min(1, holdProgressRef.current + dt / HOLD_MS)
            : Math.max(0, holdProgressRef.current - dt / 450);

         paintHold();

         if (holdingRef.current && holdProgressRef.current >= 1) {
            holdingRef.current = false;
            holdRafRef.current = 0;
            reveal();
            return;
         }

         holdRafRef.current =
            holdingRef.current || holdProgressRef.current > 0
               ? window.requestAnimationFrame(loopHold)
               : 0;
      },
      [paintHold, reveal]
   );

   const startHold = useCallback(() => {
      if (revealedRef.current || holdingRef.current) {
         return;
      }

      holdingRef.current = true;
      holdLastTRef.current = performance.now();

      if (!holdRafRef.current) {
         holdRafRef.current = window.requestAnimationFrame(loopHold);
      }
   }, [loopHold]);

   const endHold = useCallback(() => {
      holdingRef.current = false;
   }, []);

   useEffect(() => {
      return () => {
         if (holdRafRef.current) {
            window.cancelAnimationFrame(holdRafRef.current);
         }
         if (toastTimerRef.current !== null) {
            window.clearTimeout(toastTimerRef.current);
         }
      };
   }, []);

   const go = useCallback(
      (next: number) => {
         let target = Math.max(0, Math.min(LAST_SLIDE_INDEX, next));

         if (target > VERDICT_SLIDE_INDEX && !revealed) {
            target = VERDICT_SLIDE_INDEX;

            if (slideIndex === VERDICT_SLIDE_INDEX) {
               const hold = holdRef.current;
               if (hold) {
                  hold.classList.remove("animate-wrapped-nudge");
                  void hold.offsetWidth;
                  hold.classList.add("animate-wrapped-nudge");
               }
               showToast("Hold the card to reveal your result first.");
               return;
            }
         }

         if (target === slideIndex) {
            return;
         }

         setSlideIndex(target);
      },
      [revealed, slideIndex, showToast]
   );

   // Keep only the active slide focusable.
   useEffect(() => {
      slideRefs.current.forEach((element, index) => {
         if (!element) {
            return;
         }
         if (index === slideIndex) {
            element.removeAttribute("inert");
         } else {
            element.setAttribute("inert", "");
         }
      });
   }, [isOpen, slideIndex, story]);

   // Focus the active slide's primary action whenever the slide changes.
   useEffect(() => {
      if (!isOpen) {
         return;
      }

      const slide = slideRefs.current[slideIndex];
      const focusTarget =
         slide?.querySelector<HTMLButtonElement>("[data-focus-target]") ??
         slide?.querySelector<HTMLButtonElement>("button:not(:disabled)");
      focusTarget?.focus({ preventScroll: true });
   }, [isOpen, slideIndex]);

   // Count-up for the "time studied" stat.
   useEffect(() => {
      if (!isOpen || slideIndex !== 1 || !story) {
         return;
      }

      const total = story.time.minutes;

      if (
         typeof window !== "undefined" &&
         window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
         setDisplayedMinutes(total);
         return;
      }

      let raf = 0;
      const start = performance.now();
      const duration = 1000;
      setDisplayedMinutes(0);

      const step = (now: number) => {
         const k = Math.min(1, (now - start) / duration);
         const eased = 1 - Math.pow(1 - k, 3);
         setDisplayedMinutes(Math.round(total * eased));
         if (k < 1) {
            raf = window.requestAnimationFrame(step);
         }
      };

      raf = window.requestAnimationFrame(step);
      return () => window.cancelAnimationFrame(raf);
   }, [isOpen, slideIndex, story]);

   // Keyboard: Escape / arrows / focus trap.
   useEffect(() => {
      if (!isOpen) {
         return;
      }

      const onKeyDown = (event: KeyboardEvent) => {
         if (event.key === "Escape") {
            event.preventDefault();
            close();
            return;
         }
         if (event.key === "ArrowRight") {
            event.preventDefault();
            go(slideIndex + 1);
            return;
         }
         if (event.key === "ArrowLeft") {
            event.preventDefault();
            go(slideIndex - 1);
            return;
         }
         if (event.key !== "Tab") {
            return;
         }

         const card = cardRef.current;
         if (!card) {
            return;
         }

         const focusables = Array.from(
            card.querySelectorAll<HTMLElement>("button:not(:disabled)")
         ).filter((element) => !element.closest("[inert]"));
         if (focusables.length === 0) {
            return;
         }

         const first = focusables[0];
         const last = focusables[focusables.length - 1];
         const active = document.activeElement as HTMLElement | null;

         if (!active || !card.contains(active)) {
            event.preventDefault();
            first.focus();
         } else if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
         } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
         }
      };

      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
   }, [isOpen, close, go, slideIndex]);

   // Touch swipe between slides.
   const swipeRef = useRef<{ x: number; y: number; t: number } | null>(null);

   const onCardPointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
         if (event.pointerType !== "touch") {
            return;
         }
         if (
            (event.target as HTMLElement).closest(
               "button, [data-no-swipe], table"
            )
         ) {
            return;
         }
         swipeRef.current = {
            x: event.clientX,
            y: event.clientY,
            t: performance.now(),
         };
      },
      []
   );

   const onCardPointerUp = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
         const swipe = swipeRef.current;
         swipeRef.current = null;
         if (!swipe) {
            return;
         }

         const dx = event.clientX - swipe.x;
         const dy = event.clientY - swipe.y;
         if (
            Math.abs(dx) > 60 &&
            Math.abs(dy) < 50 &&
            performance.now() - swipe.t < 700
         ) {
            go(slideIndex + (dx < 0 ? 1 : -1));
         }
      },
      [go, slideIndex]
   );

   const handleChartPointer = useCallback(
      (event: ReactPointerEvent<SVGRectElement>) => {
         const chartData = story?.chart;
         const svg = svgRef.current;
         if (!chartData || !svg || chartData.days.length === 0) {
            return;
         }

         const rect = svg.getBoundingClientRect();
         const scale = rect.width > 0 ? rect.width / chartData.width : 1;
         const last = chartData.days.length - 1;
         const raw =
            last === 0
               ? 0
               : Math.round(
                    (((event.clientX - rect.left) / scale - chartData.x0) /
                       (chartData.x1 - chartData.x0)) *
                       last
                 );

         setHoverIndex(
            Math.max(0, Math.min(last, Number.isFinite(raw) ? raw : 0))
         );
      },
      [story]
   );

   if (!story || !isOpen) {
      return null;
   }

   const chart: WrappedStoryChart = story.chart;
   const verdict = story.verdict;

   const verdictToneColors = {
      saved: {
         ring: "#22c55e",
         stampBorder: "border-[#22c55e]",
         stampText: "text-[#22c55e]",
         stampBg: "bg-[#144520]/80",
         highlight: "text-[#22c55e]",
      },
      punished: {
         ring: "#ef4444",
         stampBorder: "border-[#ef4444]",
         stampText: "text-[#ef4444]",
         stampBg: "bg-[#401010]/80",
         highlight: "text-[#ef4444]",
      },
      excused: {
         ring: "#3b82f6",
         stampBorder: "border-[#3b82f6]",
         stampText: "text-[#3b82f6]",
         stampBg: "bg-[#102d40]/80",
         highlight: "text-[#3b82f6]",
      },
   }[verdict.tone] ?? {
      ring: "#22c55e",
      stampBorder: "border-[#22c55e]",
      stampText: "text-[#22c55e]",
      stampBg: "bg-[#144520]/80",
      highlight: "text-[#22c55e]",
   };

   const slideClass = (index: number) =>
      `absolute inset-0 pt-[70px] pb-6 px-6 flex flex-col gap-4 transition-all duration-400 ease-out max-h-[640px]:pt-16 max-h-[640px]:gap-3 md:pt-[64px] md:pb-6 md:px-8 md:grid md:grid-cols-2 md:gap-8 md:items-center ${
         index < slideIndex
            ? "-translate-x-[30px] opacity-0 invisible pointer-events-none"
            : index > slideIndex
              ? "translate-x-[30px] opacity-0 invisible pointer-events-none"
              : "translate-x-0 opacity-100 visible"
      }`;

   const hoverDay = hoverIndex !== null ? chart.days[hoverIndex] : null;

   const isBestDayOnRight =
      chart.bestIndex >= 0 &&
      chart.x[chart.bestIndex] > (chart.x0 + chart.x1) / 2;
   const bestTextX =
      chart.bestIndex >= 0
         ? chart.x[chart.bestIndex] + (isBestDayOnRight ? -9 : 9)
         : 0;
   const bestTextAnchor = isBestDayOnRight ? "end" : "start";

   return (
      <div
         className="fixed inset-0 z-[60] grid place-items-center p-4 bg-black/80 backdrop-blur-md"
         role="dialog"
         aria-modal="true"
         aria-label="Your challenge wrapped"
         onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
               close();
            }
         }}
      >
         <svg
            width="0"
            height="0"
            style={{ position: "absolute" }}
            aria-hidden="true"
            focusable="false"
         >
            <filter
               id="wrapped-rough"
               x="-10%"
               y="-10%"
               width="120%"
               height="120%"
            >
               <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.9"
                  numOctaves="2"
                  seed="3"
                  result="n"
               />
               <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" />
            </filter>
            <symbol id="wrapped-stopwatch" viewBox="0 0 160 160">
               <rect
                  x="60"
                  y="6"
                  width="40"
                  height="13"
                  rx="4"
                  fill="#434343"
               />
               <rect x="73" y="16" width="14" height="16" fill="#434343" />
               <circle
                  cx="80"
                  cy="95"
                  r="58"
                  fill="#1c1c1c"
                  stroke="#434343"
                  strokeWidth="6"
               />
               <path
                  d="M80 95 L80 45 A50 50 0 0 1 123.3 120 Z"
                  fill="#22c55e"
                  fillOpacity="0.25"
                  stroke="#22c55e"
                  strokeWidth="4"
                  strokeLinejoin="round"
               />
               <path
                  d="M80 45 V57 M80 133 V145 M30 95 H42 M118 95 H130"
                  stroke="#868686"
                  strokeWidth="5"
                  strokeLinecap="round"
               />
               <circle cx="80" cy="95" r="7" fill="#f4f3f6" />
            </symbol>
         </svg>

         <div
            ref={cardRef}
            className="relative w-full max-w-[400px] h-[min(calc(100vh-32px),700px)] h-[min(calc(100dvh-32px),700px)] rounded-[30px] overflow-hidden bg-[#141414] border border-[#292929] text-[#f4f3f6] shadow-2xl touch-pan-y [&_button:focus-visible]:outline-[2px] [&_button:focus-visible]:outline-[#22c55e] [&_button:focus-visible]:outline-offset-[2px] md:max-w-[840px] md:w-full md:aspect-[16/9] md:h-auto md:max-h-[min(520px,calc(100dvh-48px))] md:rounded-[32px]"
            data-i={slideIndex}
            onPointerDown={onCardPointerDown}
            onPointerUp={onCardPointerUp}
         >
            <div className="absolute z-10 top-0 inset-x-0 flex items-center gap-3 pt-4 px-4 md:pt-4 md:px-6">
               <button
                  type="button"
                  className="w-[38px] h-[38px] rounded-xl border border-[#292929] bg-[#1c1c1c] text-[#868686] hover:text-[#f4f3f6] hover:border-[#434343] cursor-pointer grid place-items-center p-0 shrink-0 transition-colors"
                  onClick={close}
                  aria-label="Close wrapped"
               >
                  <svg
                     viewBox="0 0 16 16"
                     fill="none"
                     stroke="currentColor"
                     strokeWidth="2.4"
                     strokeLinecap="round"
                     aria-hidden="true"
                     className="w-4 h-4"
                  >
                     <path d="M3 3l10 10M13 3L3 13" />
                  </svg>
               </button>
               <div className="flex-1 flex justify-center gap-2 pr-[38px]">
                  {Array.from({ length: LAST_SLIDE_INDEX + 1 }, (_, index) => (
                     <button
                        key={index}
                        type="button"
                        className={`relative h-2 p-0 rounded-full border cursor-pointer transition-all duration-250 before:content-[''] before:absolute before:-inset-y-2.5 before:-inset-x-1 ${
                           slideIndex === index
                              ? "w-6 bg-[#22c55e] border-[#22c55e]"
                              : "w-2 bg-[#292929] border-[#434343] hover:border-[#868686]"
                        }`}
                        aria-label={`Go to slide ${index + 1} of ${
                           LAST_SLIDE_INDEX + 1
                        }`}
                        aria-current={slideIndex === index ? "step" : "false"}
                        onClick={() => go(index)}
                     />
                  ))}
               </div>
            </div>

            {/* 1 · intro */}
            <section
               ref={(element) => {
                  slideRefs.current[0] = element;
               }}
               className={slideClass(0)}
               aria-label="Intro"
            >
               <div className="flex-1 min-h-0 grid place-items-center md:h-full [&>svg]:w-full [&>svg]:max-w-[200px] md:[&>svg]:max-w-[240px] [&>svg]:max-h-full">
                  <svg viewBox="0 0 160 160" aria-hidden="true">
                     <use href="#wrapped-stopwatch" />
                  </svg>
               </div>
               <div className="flex flex-col justify-between gap-4 md:h-full md:py-3">
                  <div className="grid gap-2.5">
                     <p className="font-sans text-xs font-semibold uppercase tracking-wider text-[#868686] m-0">
                        {story.periodLabel}
                     </p>
                     <h2 className="font-display font-extrabold text-[clamp(30px,8vw,40px)] md:text-[38px] leading-[1.05] tracking-tight text-[#f4f3f6] m-0 text-balance max-h-[720px]:text-[clamp(26px,7vw,34px)]">
                        Your challenge wrapped is here!
                     </h2>
                  </div>
                  <div className="flex gap-2.5 mt-auto">
                     <button
                        type="button"
                        className="flex-1 h-[50px] rounded-xl bg-[#22c55e] text-[#0d0d0d] font-bold text-[15px] cursor-pointer inline-flex items-center justify-center gap-2 transition-all hover:bg-[#16a34a] hover:-translate-y-0.5 shadow-md shadow-[#22c55e]/10 whitespace-nowrap"
                        data-focus-target
                        onClick={() => go(1)}
                     >
                        <span>Show me</span>
                        <ArrowRightIcon className="w-4 h-4 shrink-0" />
                     </button>
                  </div>
               </div>
            </section>

            {/* 2 · time */}
            <section
               ref={(element) => {
                  slideRefs.current[1] = element;
               }}
               className={slideClass(1)}
               aria-label="Time studied"
            >
               <div className="flex-1 min-h-0 grid place-items-center md:h-full [&>svg]:w-full [&>svg]:max-w-[200px] md:[&>svg]:max-w-[240px] [&>svg]:max-h-full">
                  <svg viewBox="0 0 160 160" fill="none" aria-hidden="true">
                     <rect
                        x="14"
                        y="108"
                        width="132"
                        height="30"
                        rx="6"
                        fill="#1c1c1c"
                        stroke="#434343"
                        strokeWidth="4"
                     />
                     <path
                        d="M36 108v30M124 108v30"
                        stroke="#292929"
                        strokeWidth="4"
                     />
                     <rect
                        x="30"
                        y="76"
                        width="104"
                        height="30"
                        rx="6"
                        fill="#3b82f6"
                        fillOpacity="0.2"
                        stroke="#3b82f6"
                        strokeWidth="4"
                     />
                     <path d="M52 76v30" stroke="#3b82f6" strokeWidth="4" />
                     <rect
                        x="22"
                        y="44"
                        width="116"
                        height="30"
                        rx="6"
                        fill="#22c55e"
                        fillOpacity="0.2"
                        stroke="#22c55e"
                        strokeWidth="4"
                     />
                     <path d="M120 44v30" stroke="#22c55e" strokeWidth="4" />
                     <path
                        d="M54 22c10-8 20 8 30 0s20 8 30 0"
                        stroke="#868686"
                        strokeWidth="4"
                        strokeLinecap="round"
                     />
                  </svg>
               </div>
               <div className="flex flex-col justify-between gap-4 md:h-full md:py-3">
                  <div className="grid gap-2.5">
                     <p className="font-sans text-xs font-semibold uppercase tracking-wider text-[#868686] m-0">
                        Time studied
                     </p>
                     <p className="font-display font-extrabold text-[clamp(64px,19vw,92px)] md:text-[80px] leading-[0.88] tracking-tight text-[#f4f3f6] m-0 font-sans font-sans-tabular flex items-baseline max-h-[640px]:text-[60px]">
                        <span>{displayedMinutes.toLocaleString("en-US")}</span>
                        <small className="text-[0.3em] font-medium tracking-normal text-[#868686] ml-[0.15em]">
                           mins
                        </small>
                     </p>
                     <p className="font-sans font-medium text-[15px] md:text-[16px] leading-[1.4] text-[#f4f3f6] m-0 text-pretty">
                        Over this challenge, you studied for{" "}
                        <span className="font-bold text-[#22c55e]">
                           {story.time.totalHuman}
                        </span>
                        . That&apos;s a lot of showing up.
                     </p>
                  </div>
                  <div className="flex gap-2.5 mt-auto">
                     <button
                        type="button"
                        className="flex-none w-[50px] h-[50px] rounded-xl border border-[#292929] bg-[#1c1c1c] text-[#868686] hover:text-[#f4f3f6] hover:border-[#434343] cursor-pointer inline-flex items-center justify-center transition-colors"
                        aria-label="Previous"
                        onClick={() => go(slideIndex - 1)}
                     >
                        <ArrowLeftIcon className="w-4 h-4 shrink-0" />
                     </button>
                     <button
                        type="button"
                        className="flex-1 h-[50px] rounded-xl bg-[#22c55e] text-[#0d0d0d] font-bold text-[15px] cursor-pointer inline-flex items-center justify-center gap-2 transition-all hover:bg-[#16a34a] hover:-translate-y-0.5 shadow-md shadow-[#22c55e]/10 whitespace-nowrap"
                        data-focus-target
                        onClick={() => go(slideIndex + 1)}
                     >
                        <span>Next</span>
                        <ArrowRightIcon className="w-4 h-4 shrink-0" />
                     </button>
                  </div>
               </div>
            </section>

            {/* 3 · chart */}
            <section
               ref={(element) => {
                  slideRefs.current[2] = element;
               }}
               className={slideClass(2)}
               aria-label="Your study days"
            >
               <div className="flex-1 min-h-0 grid place-items-center md:h-full [&>div]:w-full">
                  <div style={{ width: "100%" }}>
                     <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-2.5 font-sans font-medium text-xs">
                        <ul className="flex gap-4 list-none m-0 p-0">
                           <li className="inline-flex items-center gap-1.5 text-[#f4f3f6]">
                              <i
                                 className="inline-block w-[18px] h-0 border-t-[3px] border-[#22c55e] rounded-xs"
                                 aria-hidden="true"
                              />
                              You
                           </li>
                           <li className="inline-flex items-center gap-1.5 text-[#868686]">
                              <i
                                 className="inline-block w-[18px] h-0 border-t-2 border-[#868686] rounded-xs"
                                 aria-hidden="true"
                              />
                              Average person
                           </li>
                        </ul>
                        <span className="font-sans text-[11px] uppercase tracking-wider text-[#868686] font-medium">
                           hours per day
                        </span>
                     </div>
                     <div className="relative w-full" data-no-swipe>
                        <svg
                           ref={svgRef}
                           viewBox={`0 0 ${chart.width} ${chart.height}`}
                           role="img"
                           className="w-full h-auto block overflow-visible"
                           aria-label={`Line chart of hours studied on each challenge day. You studied ${story.time.totalHuman} in total.`}
                        >
                           {Array.from(
                              { length: Math.max(0, chart.yMax - 1) },
                              (_, index) => {
                                 const value = index + 1;
                                 const y =
                                    chart.base -
                                    (value / chart.yMax) *
                                       (chart.base - chart.top);
                                 return (
                                    <g key={value}>
                                       <line
                                          className="stroke-[#292929] stroke-[1]"
                                          x1={chart.x0}
                                          x2={chart.x1}
                                          y1={y}
                                          y2={y}
                                       />
                                       <text
                                          className="font-sans text-[10px] fill-[#868686] font-medium"
                                          x={chart.x0 - 6}
                                          y={y + 3}
                                          textAnchor="end"
                                       >
                                          {value}h
                                       </text>
                                    </g>
                                 );
                              }
                           )}
                           <line
                              className="stroke-[#434343] stroke-[1]"
                              x1={chart.x0}
                              x2={chart.x1}
                              y1={chart.base}
                              y2={chart.base}
                           />
                           <text
                              className="font-sans text-[10px] fill-[#868686] font-medium"
                              x={chart.x0 - 6}
                              y={chart.base + 3}
                              textAnchor="end"
                           >
                              0
                           </text>
                           {chart.ticks.map((dayIndex) => (
                              <text
                                 key={dayIndex}
                                 className="font-sans text-[10px] fill-[#868686] font-medium"
                                 x={chart.x[dayIndex]}
                                 y={chart.base + 17}
                                 textAnchor="middle"
                              >
                                 {dayIndex === 0
                                    ? chart.days[dayIndex]?.label
                                    : chart.days[dayIndex]?.dayNumber}
                              </text>
                           ))}
                           <path
                              className={`fill-[#22c55e] fill-opacity-10 stroke-none ${slideIndex === 2 ? "animate-wrapped-fadein" : ""}`}
                              d={chart.areaPath}
                           />
                           <path
                              className={`fill-none stroke-[#868686] stroke-linecap-round stroke-linejoin-round stroke-[2] ${slideIndex === 2 ? "animate-wrapped-draw" : ""}`}
                              pathLength={1}
                              d={chart.avgPath}
                           />
                           <path
                              className={`fill-none stroke-[#22c55e] stroke-linecap-round stroke-linejoin-round stroke-[3] ${slideIndex === 2 ? "animate-wrapped-draw" : ""}`}
                              pathLength={1}
                              d={chart.youPath}
                           />
                           {chart.bestIndex >= 0 && (
                              <g
                                 className={
                                    slideIndex === 2
                                       ? "animate-wrapped-fadein"
                                       : ""
                                 }
                              >
                                 <circle
                                    className="stroke-[#141414] stroke-2 fill-[#22c55e]"
                                    cx={chart.x[chart.bestIndex]}
                                    cy={chart.yYou[chart.bestIndex]}
                                    r={4}
                                 />
                                 <text
                                    className="font-sans text-[10px] fill-[#22c55e] font-semibold"
                                    x={bestTextX}
                                    y={chart.yYou[chart.bestIndex] + 3}
                                    textAnchor={bestTextAnchor}
                                 >
                                    Best day · {chart.bestLabel} ·{" "}
                                    {chart.bestHuman}
                                 </text>
                              </g>
                           )}
                           {hoverIndex !== null && (
                              <line
                                 className="stroke-[#434343] stroke-[1] stroke-dasharray-[2_2]"
                                 x1={chart.x[hoverIndex]}
                                 x2={chart.x[hoverIndex]}
                                 y1={chart.top}
                                 y2={chart.base}
                              />
                           )}
                           {hoverIndex !== null && (
                              <>
                                 <circle
                                    className="stroke-[#141414] stroke-2 fill-[#22c55e]"
                                    cx={chart.x[hoverIndex]}
                                    cy={chart.yYou[hoverIndex]}
                                    r={4}
                                 />
                                 <circle
                                    className="stroke-[#141414] stroke-2 fill-[#868686]"
                                    cx={chart.x[hoverIndex]}
                                    cy={chart.yAvg[hoverIndex]}
                                    r={4}
                                 />
                              </>
                           )}
                           <rect
                              className="touch-pan-y cursor-crosshair"
                              x={chart.x0 - 8}
                              y={0}
                              width={chart.x1 - chart.x0 + 16}
                              height={chart.base + 4}
                              fill="transparent"
                              onPointerMove={handleChartPointer}
                              onPointerDown={handleChartPointer}
                              onPointerLeave={() => setHoverIndex(null)}
                              onPointerCancel={() => setHoverIndex(null)}
                           />
                        </svg>
                        {hoverDay && (
                           <div
                              className={`absolute z-10 pointer-events-none -translate-y-full whitespace-nowrap bg-[#1c1c1c] border border-[#292929] text-[#f4f3f6] shadow-xl rounded-xl py-2 px-3 font-sans text-xs leading-snug font-medium ${
                                 chart.days.length > 1 && hoverDay.index === 0
                                    ? "translate-x-0"
                                    : chart.days.length > 1 &&
                                        hoverDay.index === chart.days.length - 1
                                      ? "-translate-x-full"
                                      : "-translate-x-1/2"
                              }`}
                              style={{
                                 left: `${
                                    (chart.x[hoverDay.index] / chart.width) *
                                    100
                                 }%`,
                                 top: "-6px",
                              }}
                           >
                              <div className="font-sans text-[10px] tracking-wider uppercase text-[#868686] font-semibold mb-1">
                                 {hoverDay.label}
                              </div>
                              <div className="flex items-center gap-1.5">
                                 <i className="inline-block w-3 border-t-[3px] border-[#22c55e] rounded-xs" />
                                 <b className="text-[#f4f3f6]">
                                    {formatMinutes(hoverDay.minutesYou) ||
                                       "No study"}
                                 </b>
                                 <span className="text-[#868686]">You</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                 <i className="inline-block w-3 border-t-2 border-[#868686] rounded-xs" />
                                 <b className="text-[#868686]">
                                    {formatMinutes(hoverDay.minutesAvg) ||
                                       "No study"}
                                 </b>
                                 <span className="text-[#5a5a5a]">
                                    Average person
                                 </span>
                              </div>
                           </div>
                        )}
                        <table className="sr-only">
                           <caption>Time studied on each challenge day</caption>
                           <thead>
                              <tr>
                                 <th>Day</th>
                                 <th>You</th>
                                 <th>Average person</th>
                              </tr>
                           </thead>
                           <tbody>
                              {chart.days.map((day) => (
                                 <tr key={day.index}>
                                    <td>{day.label}</td>
                                    <td>
                                       {formatMinutes(day.minutesYou) ||
                                          "No study"}
                                    </td>
                                    <td>
                                       {formatMinutes(day.minutesAvg) ||
                                          "No study"}
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
               </div>
               <div className="flex flex-col justify-between gap-4 md:h-full md:py-3">
                  <div className="grid gap-2.5">
                     <p className="font-sans text-xs font-semibold uppercase tracking-wider text-[#868686] m-0">
                        You vs the average person
                     </p>
                     {story.chartCopy.timesVsAverage !== null ? (
                        <p className="font-sans font-medium text-[15px] md:text-[16px] leading-[1.4] text-[#f4f3f6] m-0 text-pretty">
                           You studied{" "}
                           <span className="font-bold text-[#22c55e]">
                              {story.chartCopy.timesVsAverage}× as much
                           </span>{" "}
                           as the average person. Seriously good work,{" "}
                           {wrapped?.viewer?.displayName ?? "friend"}.
                        </p>
                     ) : (
                        <p className="font-sans font-medium text-[15px] md:text-[16px] leading-[1.4] text-[#868686] m-0 text-pretty">
                           The average-person comparison unlocks once more study
                           time is logged.
                        </p>
                     )}
                     <p className="font-sans font-medium text-[15px] md:text-[16px] leading-[1.4] text-[#f4f3f6] m-0 text-pretty">
                        {chart.bestIndex >= 0 ? (
                           <>
                              Your best day was{" "}
                              <span className="font-bold text-[#22c55e]">
                                 {chart.bestLabel}
                              </span>
                              , and you carried{" "}
                              <span className="font-bold text-[#22c55e]">
                                 {story.chartCopy.contributionPercent}%
                              </span>{" "}
                              of {story.chartCopy.teamName}&apos;s growth.
                           </>
                        ) : (
                           "No study days were logged this time — the next challenge is a fresh start."
                        )}
                     </p>
                     <div
                        className="h-2.5 rounded-full bg-[#1c1c1c] border border-[#292929] overflow-hidden mt-1"
                        aria-hidden="true"
                     >
                        <i
                           className="block h-full bg-[#22c55e] rounded-full transition-[width] duration-900 delay-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                           style={{
                              width:
                                 slideIndex === 2
                                    ? `${story.chartCopy.contributionPercent}%`
                                    : "0%",
                           }}
                        />
                     </div>
                  </div>
                  <div className="flex gap-2.5 mt-auto">
                     <button
                        type="button"
                        className="flex-none w-[50px] h-[50px] rounded-xl border border-[#292929] bg-[#1c1c1c] text-[#868686] hover:text-[#f4f3f6] hover:border-[#434343] cursor-pointer inline-flex items-center justify-center transition-colors"
                        aria-label="Previous"
                        onClick={() => go(slideIndex - 1)}
                     >
                        <ArrowLeftIcon className="w-4 h-4 shrink-0" />
                     </button>
                     <button
                        type="button"
                        className="flex-1 h-[50px] rounded-xl bg-[#22c55e] text-[#0d0d0d] font-bold text-[15px] cursor-pointer inline-flex items-center justify-center gap-2 transition-all hover:bg-[#16a34a] hover:-translate-y-0.5 shadow-md shadow-[#22c55e]/10 whitespace-nowrap"
                        data-focus-target
                        onClick={() => go(slideIndex + 1)}
                     >
                        <span>Next</span>
                        <ArrowRightIcon className="w-4 h-4 shrink-0" />
                     </button>
                  </div>
               </div>
            </section>

            {/* 4 · verdict */}
            <section
               ref={(element) => {
                  slideRefs.current[3] = element;
               }}
               className={slideClass(3)}
               aria-label="Saved or punished"
            >
               <div
                  className="flex-1 min-h-0 grid place-items-center gap-3.5 content-center md:h-full"
                  data-no-swipe
               >
                  <button
                     ref={holdRef}
                     type="button"
                     className={`relative w-full max-w-[210px] md:max-w-[240px] aspect-square rounded-[32px] border-2 border-dashed border-[#434343] bg-[#1c1c1c]/50 text-[#f4f3f6] cursor-pointer p-0 grid place-items-center select-none touch-none transition-colors hover:border-[#868686] ${
                        revealed
                           ? "border-solid !border-transparent bg-transparent animate-wrapped-hit"
                           : ""
                     }`}
                     aria-label="Press and hold to reveal your result"
                     onPointerDown={(event) => {
                        if (event.button > 0) {
                           return;
                        }
                        try {
                           event.currentTarget.setPointerCapture(
                              event.pointerId
                           );
                        } catch {
                           // Pointer capture is best-effort.
                        }
                        startHold();
                     }}
                     onPointerUp={endHold}
                     onPointerCancel={endHold}
                     onLostPointerCapture={endHold}
                     onContextMenu={(event) => event.preventDefault()}
                     onKeyDown={(event) => {
                        if (
                           (event.key === " " || event.key === "Enter") &&
                           !event.repeat
                        ) {
                           event.preventDefault();
                           startHold();
                        }
                     }}
                     onKeyUp={(event) => {
                        if (event.key === " " || event.key === "Enter") {
                           event.preventDefault();
                           endHold();
                        }
                     }}
                     onBlur={endHold}
                  >
                     <svg
                        className={`absolute inset-3 w-[calc(100%-24px)] h-[calc(100%-24px)] -rotate-90 ${
                           revealed
                              ? "opacity-0 transition-opacity duration-200"
                              : ""
                        }`}
                        viewBox="0 0 200 200"
                        aria-hidden="true"
                     >
                        <circle
                           className="fill-none stroke-[#292929] stroke-[8]"
                           cx="100"
                           cy="100"
                           r="88"
                        />
                        <circle
                           ref={ringRef}
                           className="fill-none stroke-[8] stroke-linecap-round"
                           stroke={verdictToneColors.ring}
                           style={{
                              strokeDasharray: RING_CIRCUMFERENCE,
                              strokeDashoffset: RING_CIRCUMFERENCE,
                           }}
                           cx="100"
                           cy="100"
                           r="88"
                        />
                     </svg>
                     <span
                        className={`relative grid gap-1.5 justify-items-center text-center font-sans text-xs leading-tight tracking-wider uppercase font-semibold text-[#868686] ${
                           revealed
                              ? "opacity-0 transition-opacity duration-200"
                              : ""
                        }`}
                        aria-hidden="true"
                     >
                        <svg
                           viewBox="0 0 48 48"
                           fill="none"
                           stroke="currentColor"
                           strokeWidth="3"
                           strokeLinecap="round"
                           strokeLinejoin="round"
                           className="w-10 h-10 md:w-11 md:h-11 text-[#868686]"
                        >
                           <path d="M17 26V12a3 3 0 0 1 6 0v10M23 20v-3a3 3 0 0 1 6 0v5M29 22a3 3 0 0 1 6 0v8c0 7-5 12-12 12-5 0-8-2-11-6l-5-8a3 3 0 0 1 5-3l3 4" />
                        </svg>
                        <span ref={holdTextRef}>Hold to reveal</span>
                     </span>
                     <span
                        className="absolute inset-0 grid place-items-center pointer-events-none"
                        aria-hidden="true"
                     >
                        <span
                           className={`block font-display font-black text-[clamp(26px,7.5vw,34px)] md:text-[32px] leading-none tracking-wider uppercase py-2 px-3.5 border-[5px] rounded-xl -rotate-6 shadow-xl backdrop-blur-xs opacity-0 filter-[url(#wrapped-rough)] ${verdictToneColors.stampBorder} ${verdictToneColors.stampText} ${verdictToneColors.stampBg} ${revealed ? "animate-wrapped-slam opacity-100" : ""}`}
                        >
                           {revealed ? verdict.stamp : ""}
                        </span>
                     </span>
                  </button>
               </div>
               <div className="flex flex-col justify-between gap-4 md:h-full md:py-3">
                  <div className="grid gap-2" aria-live="polite">
                     <p className="font-sans text-xs font-semibold uppercase tracking-wider text-[#868686] m-0">
                        The verdict
                     </p>
                     <h2 className="font-display font-extrabold text-[clamp(28px,8vw,38px)] md:text-[36px] leading-[1.05] tracking-tight text-[#f4f3f6] m-0 text-balance">
                        {revealed
                           ? verdict.headline
                           : "Did you hit the target?"}
                     </h2>
                     <p className="font-sans font-medium text-[15px] md:text-[16px] leading-[1.4] text-[#f4f3f6] m-0 text-pretty">
                        {revealed ? (
                           <>
                              <span
                                 className={`font-bold ${verdictToneColors.highlight}`}
                              >
                                 {verdict.totalHuman}
                              </span>{" "}
                              against a {verdict.targetHuman} target.
                           </>
                        ) : (
                           "Press and hold the card until the ring closes."
                        )}
                     </p>
                     <p className="font-sans text-sm text-[#868686] m-0 text-pretty font-medium empty:hidden">
                        {revealed ? verdict.note : ""}
                     </p>
                     {!revealed && (
                        <button
                           type="button"
                           className="self-start bg-transparent border-0 py-1 px-0 cursor-pointer font-sans text-xs text-[#868686] underline underline-offset-[3px] hover:text-[#f4f3f6] transition-colors"
                           onClick={reveal}
                        >
                           Can&apos;t hold? Tap to reveal
                        </button>
                     )}
                  </div>
                  <div className="flex gap-2.5 mt-auto">
                     <button
                        type="button"
                        className="flex-none w-[50px] h-[50px] rounded-xl border border-[#292929] bg-[#1c1c1c] text-[#868686] hover:text-[#f4f3f6] hover:border-[#434343] cursor-pointer inline-flex items-center justify-center transition-colors"
                        aria-label="Previous"
                        onClick={() => go(slideIndex - 1)}
                     >
                        <ArrowLeftIcon className="w-4 h-4 shrink-0" />
                     </button>
                     <button
                        type="button"
                        className="flex-1 h-[50px] rounded-xl bg-[#22c55e] text-[#0d0d0d] font-bold text-[15px] cursor-pointer inline-flex items-center justify-center gap-2 transition-all hover:bg-[#16a34a] hover:-translate-y-0.5 shadow-md shadow-[#22c55e]/10 disabled:opacity-30 disabled:pointer-events-none whitespace-nowrap"
                        data-verdict-next
                        disabled={!revealed}
                        onClick={() => go(slideIndex + 1)}
                     >
                        <span>Next</span>
                        <ArrowRightIcon className="w-4 h-4 shrink-0" />
                     </button>
                  </div>
               </div>
            </section>

            {/* 5 · feedback */}
            <section
               ref={(element) => {
                  slideRefs.current[4] = element;
               }}
               className={slideClass(4)}
               aria-label="Feedback"
            >
               <div className="flex-1 min-h-0 grid place-items-center md:h-full [&>svg]:w-full [&>svg]:max-w-[200px] md:[&>svg]:max-w-[240px] [&>svg]:max-h-full">
                  <svg viewBox="0 0 160 160" fill="none" aria-hidden="true">
                     <circle
                        cx="116"
                        cy="40"
                        r="26"
                        fill="#3b82f6"
                        fillOpacity="0.25"
                     />
                     <path
                        d="M26 30h108a10 10 0 0 1 10 10v62a10 10 0 0 1-10 10H78l-28 24v-24H26a10 10 0 0 1-10-10V40a10 10 0 0 1 10-10Z"
                        fill="#1c1c1c"
                        stroke="#434343"
                        strokeWidth="4"
                        strokeLinejoin="round"
                     />
                     <path
                        d="M40 58h80M40 74h60M40 90h42"
                        stroke="#868686"
                        strokeWidth="4"
                        strokeLinecap="round"
                     />
                  </svg>
               </div>
               <div className="flex flex-col justify-between gap-4 md:h-full md:py-3">
                  <div className="grid gap-2.5">
                     <p className="font-sans text-xs font-semibold uppercase tracking-wider text-[#868686] m-0">
                        Anonymous · 2 minutes
                     </p>
                     <h2 className="font-display font-extrabold text-[clamp(30px,8vw,40px)] md:text-[38px] leading-[1.05] tracking-tight text-[#f4f3f6] m-0 text-balance">
                        How was this challenge?
                     </h2>
                     <p className="font-sans font-medium text-[15px] md:text-[16px] leading-[1.4] text-[#868686] m-0 text-pretty">
                        Tell us what worked and what didn&apos;t. Your answers
                        aren&apos;t tied to your name.
                     </p>
                  </div>
                  <div className="flex gap-2.5 mt-auto">
                     <button
                        type="button"
                        className="flex-none w-[50px] h-[50px] rounded-xl border border-[#292929] bg-[#1c1c1c] text-[#868686] hover:text-[#f4f3f6] hover:border-[#434343] cursor-pointer inline-flex items-center justify-center transition-colors"
                        aria-label="Previous"
                        onClick={() => go(slideIndex - 1)}
                     >
                        <ArrowLeftIcon className="w-4 h-4 shrink-0" />
                     </button>
                     <button
                        type="button"
                        className="flex-1 h-[50px] rounded-xl border border-[#292929] bg-[#1c1c1c] text-[#f4f3f6] hover:border-[#434343] font-semibold text-[15px] cursor-pointer inline-flex items-center justify-center transition-colors whitespace-nowrap"
                        data-focus-target
                        onClick={close}
                     >
                        Maybe later
                     </button>
                     <button
                        type="button"
                        className="flex-[1.4] h-[50px] rounded-xl bg-[#22c55e] text-[#0d0d0d] font-bold text-[15px] cursor-pointer inline-flex items-center justify-center gap-2 transition-all hover:bg-[#16a34a] hover:-translate-y-0.5 shadow-md shadow-[#22c55e]/10 whitespace-nowrap"
                        onClick={() => setIsFeedbackDialogOpen(true)}
                     >
                        Give feedback
                     </button>
                  </div>
               </div>
            </section>
         </div>

         <div
            className={`fixed left-1/2 bottom-[calc(20px+env(safe-area-inset-bottom,0px))] z-70 max-w-[calc(100%-32px)] bg-[#1c1c1c] border border-[#292929] text-[#f4f3f6] shadow-xl py-2.5 px-4 rounded-xl font-sans font-medium text-sm -translate-x-1/2 pointer-events-none transition-all duration-250 ${
               toast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            role="status"
            aria-live="polite"
         >
            {toast}
         </div>

         <ChallengeFeedbackDialog
            isOpen={isFeedbackDialogOpen}
            challengeId={challenge.id}
            challengeTitle={challenge.title}
            onClose={() => setIsFeedbackDialogOpen(false)}
            onSuccess={() => {
               showToast("Thank you for your feedback!");
               setTimeout(() => {
                  close();
               }, 600);
            }}
         />
      </div>
   );
}
