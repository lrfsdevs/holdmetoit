"use client";

import {
   useCallback,
   useEffect,
   useRef,
   useState,
   type HTMLAttributes,
} from "react";
import type {
   WrappedMascotMood,
   WrappedMascotVariant,
} from "../domain/wrapped-mascot.types";

export interface WrappedMascotProps extends Omit<
   HTMLAttributes<HTMLDivElement>,
   "children"
> {
   variant?: WrappedMascotVariant;
   mood?: WrappedMascotMood;
   size?: "sm" | "md" | "lg" | "xl";
   trackingDisabled?: boolean;
   forceReducedMotion?: boolean;
   "data-testid"?: string;
}

const SIZE_CLASSES = {
   sm: "w-16 h-12 sm:w-20 sm:h-16",
   md: "w-24 h-20 sm:w-28 sm:h-24",
   lg: "w-32 h-24 sm:w-36 sm:h-28",
   xl: "w-40 h-32 sm:w-44 sm:h-36",
};

/**
 * Unified Wrapped Mascot Component.
 * Supports the classic OG Googly Eyes and 3 animated hand-drawn doodle mascots:
 * Cat, Dog, and Bunny. Features expressive character illustrations, smooth cursor pupil-tracking,
 * mood reactions, and prefers-reduced-motion accessibility support.
 */
export function WrappedMascot({
   variant = "GOOGLY_EYES",
   mood: controlledMood,
   size = "md",
   trackingDisabled = false,
   forceReducedMotion = false,
   className = "",
   "data-testid": testId,
   ...rest
}: WrappedMascotProps) {
   const containerRef = useRef<HTMLDivElement | null>(null);
   const [isHovered, setIsHovered] = useState(false);
   const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
   const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

   // Check reduced motion preference safely
   useEffect(() => {
      if (
         typeof window === "undefined" ||
         typeof window.matchMedia !== "function"
      )
         return;
      try {
         const media = window.matchMedia("(prefers-reduced-motion: reduce)");
         setPrefersReducedMotion(media.matches);

         const listener = (e: MediaQueryListEvent) => {
            setPrefersReducedMotion(e.matches);
         };

         if (media.addEventListener) {
            media.addEventListener("change", listener);
            return () => media.removeEventListener("change", listener);
         }
      } catch {
         // Fallback for mock environments
      }
   }, []);

   const isMotionReduced = forceReducedMotion || prefersReducedMotion;

   // Global cursor tracking calculation
   useEffect(() => {
      if (
         trackingDisabled ||
         isMotionReduced ||
         typeof window === "undefined"
      ) {
         setPupilOffset({ x: 0, y: 0 });
         return;
      }

      const handlePointerMove = (e: PointerEvent) => {
         const el = containerRef.current;
         if (!el) return;

         const rect = el.getBoundingClientRect();
         const centerX = rect.left + rect.width / 2;
         const centerY = rect.top + rect.height / 2;

         const dx = e.clientX - centerX;
         const dy = e.clientY - centerY;
         const distance = Math.hypot(dx, dy);

         const maxRadius =
            size === "sm" ? 2.5 : size === "lg" || size === "xl" ? 4 : 3.2;

         if (distance > 0) {
            const factor = Math.min(distance / 20, maxRadius);
            setPupilOffset({
               x: Number(((dx / distance) * factor).toFixed(2)),
               y: Number(((dy / distance) * factor).toFixed(2)),
            });
         }
      };

      window.addEventListener("pointermove", handlePointerMove, {
         passive: true,
      });

      return () => {
         window.removeEventListener("pointermove", handlePointerMove);
      };
   }, [trackingDisabled, isMotionReduced, size]);

   const effectiveMood: WrappedMascotMood =
      controlledMood ?? (isHovered ? "shy" : "idle");

   const handleMouseEnter = useCallback(() => setIsHovered(true), []);
   const handleMouseLeave = useCallback(() => setIsHovered(false), []);

   // -------------------------------------------------------------------------
   // Variant 1: OG Googly Eyes
   // Preserves the exact markup & animation hooks from wrapped-shy-card.tsx
   // -------------------------------------------------------------------------
   if (variant === "GOOGLY_EYES") {
      const isStaticCentered = effectiveMood === "proud" || isMotionReduced;
      const eyeSizeClass =
         size === "sm"
            ? "w-7 h-7"
            : size === "lg"
              ? "w-14 h-14"
              : size === "xl"
                ? "w-16 h-16"
                : "w-10 h-10";

      const pupilSizeClass =
         size === "sm"
            ? "w-3 h-3"
            : size === "lg"
              ? "w-6 h-6"
              : size === "xl"
                ? "w-7 h-7"
                : "w-4 h-4";

      const staticGlance =
         effectiveMood === "shy"
            ? "translate-x-[-2px] translate-y-[2px]"
            : effectiveMood === "hyped"
              ? "scale-125"
              : "";

      return (
         <div
            ref={containerRef}
            data-testid={testId ?? "wrapped-mascot-googly-eyes"}
            data-variant="GOOGLY_EYES"
            data-mood={effectiveMood}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`eyes flex items-center gap-1.5 select-none transition-transform duration-200 ${
               isHovered ? "scale-105" : ""
            } ${className}`}
            aria-hidden="true"
            title="Peek peek"
            {...rest}
         >
            <span
               className={`${eyeSizeClass} bg-white border-2 border-border-subtle rounded-full grid place-items-center animate-shy-blink shadow-xs`}
            >
               <span
                  className={`${pupilSizeClass} bg-surface-page rounded-full transition-transform duration-150 ${staticGlance}`}
                  style={
                     !isStaticCentered &&
                     (pupilOffset.x !== 0 || pupilOffset.y !== 0)
                        ? {
                             transform: `translate(${pupilOffset.x}px, ${pupilOffset.y}px)`,
                          }
                        : undefined
                  }
               />
            </span>
            <span
               className={`${eyeSizeClass} bg-white border-2 border-border-subtle rounded-full grid place-items-center animate-shy-blink shadow-xs`}
            >
               <span
                  className={`${pupilSizeClass} bg-surface-page rounded-full transition-transform duration-150 ${staticGlance}`}
                  style={
                     !isStaticCentered &&
                     (pupilOffset.x !== 0 || pupilOffset.y !== 0)
                        ? {
                             transform: `translate(${pupilOffset.x}px, ${pupilOffset.y}px)`,
                          }
                        : undefined
                  }
               />
            </span>
         </div>
      );
   }

   // -------------------------------------------------------------------------
   // Variant 2: Doodle Cat
   // -------------------------------------------------------------------------
   if (variant === "CAT") {
      const isShy = effectiveMood === "shy" || effectiveMood === "hover";
      const isProud = effectiveMood === "proud";
      const isSleepy = effectiveMood === "sleepy";
      const isHyped = effectiveMood === "hyped";

      return (
         <div
            ref={containerRef}
            data-testid={testId ?? "wrapped-mascot-cat"}
            data-variant="CAT"
            data-mood={effectiveMood}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`relative inline-flex items-end justify-center select-none ${SIZE_CLASSES[size]} ${className}`}
            {...rest}
         >
            <svg
               viewBox="0 0 100 75"
               preserveAspectRatio="xMidYMax meet"
               fill="none"
               className="w-full h-full overflow-visible text-text-primary drop-shadow-md"
               aria-hidden="true"
            >
               {/* Left Ear */}
               <path
                  d={
                     isShy
                        ? "M22 36 L10 24 L32 28 Z" // Flattened shy ear
                        : "M22 34 L16 10 L38 24 Z" // Perky triangular cat ear
                  }
                  fill="white"
                  stroke="var(--color-surface-page)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={
                     !isMotionReduced ? "transition-all duration-300" : ""
                  }
               />
               {/* Inner Left Ear Pink Fluff */}
               <path
                  d={
                     isShy ? "M20 32 L14 24 L29 27 Z" : "M23 29 L19 15 L34 23 Z"
                  }
                  fill="var(--color-brand-3)"
                  fillOpacity="0.45"
                  stroke="var(--color-brand-3)"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
               />

               {/* Right Ear */}
               <path
                  d={
                     isShy
                        ? "M78 36 L90 24 L68 28 Z" // Flattened shy ear
                        : "M78 34 L84 10 L62 24 Z" // Perky triangular cat ear
                  }
                  fill="white"
                  stroke="var(--color-surface-page)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={
                     !isMotionReduced ? "transition-all duration-300" : ""
                  }
               />
               {/* Inner Right Ear Pink Fluff */}
               <path
                  d={
                     isShy ? "M80 32 L86 24 L71 27 Z" : "M77 29 L81 15 L66 23 Z"
                  }
                  fill="var(--color-brand-3)"
                  fillOpacity="0.45"
                  stroke="var(--color-brand-3)"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
               />

               {/* Head body dome with chubby cheeks */}
               <path
                  d="M18 70 C16 48 20 28 50 28 C80 28 84 48 82 70 Z"
                  fill="white"
                  stroke="var(--color-surface-page)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
               />

               {/* Cheerful Whiskers */}
               <g
                  stroke="var(--color-surface-page)"
                  strokeWidth="2"
                  strokeLinecap="round"
               >
                  <path d="M22 46 L6 43" />
                  <path d="M22 51 L5 52" />
                  <path d="M22 56 L8 61" />
                  <path d="M78 46 L94 43" />
                  <path d="M78 51 L95 52" />
                  <path d="M78 56 L92 61" />
               </g>

               {/* Eyes */}
               {isProud ? (
                  // Proud / Happy eyes (^ ^)
                  <g
                     stroke="var(--color-surface-page)"
                     strokeWidth="2.8"
                     strokeLinecap="round"
                     fill="none"
                  >
                     <path d="M28 44 Q36 34 44 44" />
                     <path d="M56 44 Q64 34 72 44" />
                  </g>
               ) : isSleepy ? (
                  // Sleepy slits (- -)
                  <g
                     stroke="var(--color-surface-page)"
                     strokeWidth="2.8"
                     strokeLinecap="round"
                  >
                     <path d="M28 44 H44" />
                     <path d="M56 44 H72" />
                  </g>
               ) : (
                  // Open tracking expressive eyes
                  <g className="animate-shy-blink origin-center">
                     {/* Left Eye Socket */}
                     <ellipse
                        cx="36"
                        cy="42"
                        rx="7.5"
                        ry="9"
                        fill="white"
                        stroke="var(--color-surface-page)"
                        strokeWidth="2.2"
                     />
                     {/* Left Pupil */}
                     <circle
                        cx={36 + (isMotionReduced ? 0 : pupilOffset.x)}
                        cy={42 + (isMotionReduced ? 0 : pupilOffset.y)}
                        r={isHyped ? "4.5" : "3.5"}
                        fill="var(--color-surface-page)"
                        className="transition-transform duration-100"
                     />
                     {/* Left Eye Sparkle Reflection 1 */}
                     <circle
                        cx={36 + (isMotionReduced ? 0 : pupilOffset.x) - 1.2}
                        cy={42 + (isMotionReduced ? 0 : pupilOffset.y) - 1.2}
                        r="1.2"
                        fill="white"
                     />
                     {/* Left Eye Sparkle Reflection 2 */}
                     <circle
                        cx={36 + (isMotionReduced ? 0 : pupilOffset.x) + 1.2}
                        cy={42 + (isMotionReduced ? 0 : pupilOffset.y) + 1.2}
                        r="0.6"
                        fill="white"
                     />

                     {/* Right Eye Socket */}
                     <ellipse
                        cx="64"
                        cy="42"
                        rx="7.5"
                        ry="9"
                        fill="white"
                        stroke="var(--color-surface-page)"
                        strokeWidth="2.2"
                     />
                     {/* Right Pupil */}
                     <circle
                        cx={64 + (isMotionReduced ? 0 : pupilOffset.x)}
                        cy={42 + (isMotionReduced ? 0 : pupilOffset.y)}
                        r={isHyped ? "4.5" : "3.5"}
                        fill="var(--color-surface-page)"
                        className="transition-transform duration-100"
                     />
                     {/* Right Eye Sparkle Reflection 1 */}
                     <circle
                        cx={64 + (isMotionReduced ? 0 : pupilOffset.x) - 1.2}
                        cy={42 + (isMotionReduced ? 0 : pupilOffset.y) - 1.2}
                        r="1.2"
                        fill="white"
                     />
                     {/* Right Eye Sparkle Reflection 2 */}
                     <circle
                        cx={64 + (isMotionReduced ? 0 : pupilOffset.x) + 1.2}
                        cy={42 + (isMotionReduced ? 0 : pupilOffset.y) + 1.2}
                        r="0.6"
                        fill="white"
                     />
                  </g>
               )}

               {/* Cute Pink Cat Nose */}
               <path
                  d="M50 49 L46 45 H54 Z"
                  fill="var(--color-brand-3)"
                  stroke="var(--color-brand-3)"
                  strokeWidth="1"
                  strokeLinejoin="round"
               />

               {/* Classic :3 Cat Mouth */}
               <path
                  d="M44 50 Q47 54 50 51 Q53 54 56 50"
                  stroke="var(--color-surface-page)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />

               {/* Cheeks blush (visible on shy/hover or hyped) */}
               {(isShy || isHyped) && (
                  <g fill="var(--color-brand-3)" fillOpacity="0.45">
                     <ellipse cx="24" cy="51" rx="5" ry="3.5" />
                     <ellipse cx="76" cy="51" rx="5" ry="3.5" />
                  </g>
               )}

               {/* Paws resting on bottom card edge */}
               <g
                  fill="white"
                  stroke="var(--color-surface-page)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
               >
                  <path d="M24 70 C24 58 38 58 38 70 Z" />
                  <path d="M62 70 C62 58 76 58 76 70 Z" />
               </g>
               {/* Pink Toe Beans / Paw Pads */}
               <g fill="var(--color-brand-3)" fillOpacity="0.45">
                  <ellipse cx="31" cy="65" rx="3.5" ry="2.5" />
                  <circle cx="27" cy="61" r="1.2" />
                  <circle cx="31" cy="60" r="1.2" />
                  <circle cx="35" cy="61" r="1.2" />

                  <ellipse cx="69" cy="65" rx="3.5" ry="2.5" />
                  <circle cx="65" cy="61" r="1.2" />
                  <circle cx="69" cy="60" r="1.2" />
                  <circle cx="73" cy="61" r="1.2" />
               </g>
            </svg>
         </div>
      );
   }

   // -------------------------------------------------------------------------
   // Variant 3: Doodle Dog
   // -------------------------------------------------------------------------
   if (variant === "DOG") {
      const isShy = effectiveMood === "shy" || effectiveMood === "hover";
      const isProud = effectiveMood === "proud";
      const isSleepy = effectiveMood === "sleepy";
      const isHyped = effectiveMood === "hyped";

      return (
         <div
            ref={containerRef}
            data-testid={testId ?? "wrapped-mascot-dog"}
            data-variant="DOG"
            data-mood={effectiveMood}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`relative inline-flex items-end justify-center select-none ${SIZE_CLASSES[size]} ${className}`}
            {...rest}
         >
            <svg
               viewBox="0 0 100 75"
               preserveAspectRatio="xMidYMax meet"
               fill="none"
               className="w-full h-full overflow-visible text-text-primary drop-shadow-md"
               aria-hidden="true"
            >
               {/* Head Group with interactive Head-Tilt */}
               <g
                  className={
                     !isMotionReduced
                        ? "transition-transform duration-300 origin-[50px_45px]"
                        : ""
                  }
                  style={
                     isShy
                        ? { transform: "rotate(-8deg)" }
                        : isHyped
                          ? { transform: "rotate(8deg)" }
                          : undefined
                  }
               >
                  {/* Left Floppy Hound Ear */}
                  <path
                     d={
                        isHyped
                           ? "M26 32 C12 24 4 44 14 56 C20 62 27 52 25 42 Z"
                           : "M26 32 C10 30 6 50 16 62 C22 68 28 58 26 44 Z"
                     }
                     fill="var(--color-brand-1-dark)"
                     stroke="var(--color-surface-page)"
                     strokeWidth="2.5"
                     strokeLinecap="round"
                     strokeLinejoin="round"
                  />

                  {/* Right Floppy Hound Ear */}
                  <path
                     d={
                        isHyped
                           ? "M74 32 C88 24 96 44 86 56 C80 62 73 52 75 42 Z"
                           : "M74 32 C90 30 94 50 84 62 C78 68 72 58 74 44 Z"
                     }
                     fill="var(--color-brand-1-dark)"
                     stroke="var(--color-surface-page)"
                     strokeWidth="2.5"
                     strokeLinecap="round"
                     strokeLinejoin="round"
                  />

                  {/* Head Dome */}
                  <path
                     d="M20 70 C16 46 22 26 50 26 C78 26 84 46 80 70 Z"
                     fill="white"
                     stroke="var(--color-surface-page)"
                     strokeWidth="2.5"
                     strokeLinecap="round"
                     strokeLinejoin="round"
                  />

                  {/* Eyes */}
                  {isProud ? (
                     <g
                        stroke="var(--color-surface-page)"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        fill="none"
                     >
                        <path d="M28 42 Q36 32 44 42" />
                        <path d="M56 42 Q64 32 72 42" />
                     </g>
                  ) : isSleepy ? (
                     <g
                        stroke="var(--color-surface-page)"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                     >
                        <path d="M28 42 H44" />
                        <path d="M56 42 H72" />
                     </g>
                  ) : (
                     <g className="animate-shy-blink origin-center">
                        {/* Left Eye */}
                        <ellipse
                           cx="36"
                           cy="40"
                           rx="7.5"
                           ry="8.5"
                           fill="white"
                           stroke="var(--color-surface-page)"
                           strokeWidth="2.2"
                        />
                        <circle
                           cx={36 + (isMotionReduced ? 0 : pupilOffset.x)}
                           cy={40 + (isMotionReduced ? 0 : pupilOffset.y)}
                           r={isHyped ? "4.5" : "3.6"}
                           fill="var(--color-surface-page)"
                           className="transition-transform duration-100"
                        />
                        <circle
                           cx={36 + (isMotionReduced ? 0 : pupilOffset.x) - 1.2}
                           cy={40 + (isMotionReduced ? 0 : pupilOffset.y) - 1.2}
                           r="1.2"
                           fill="white"
                        />
                        <circle
                           cx={36 + (isMotionReduced ? 0 : pupilOffset.x) + 1.2}
                           cy={40 + (isMotionReduced ? 0 : pupilOffset.y) + 1.2}
                           r="0.6"
                           fill="white"
                        />

                        {/* Right Eye */}
                        <ellipse
                           cx="64"
                           cy="40"
                           rx="7.5"
                           ry="8.5"
                           fill="white"
                           stroke="var(--color-surface-page)"
                           strokeWidth="2.2"
                        />
                        <circle
                           cx={64 + (isMotionReduced ? 0 : pupilOffset.x)}
                           cy={40 + (isMotionReduced ? 0 : pupilOffset.y)}
                           r={isHyped ? "4.5" : "3.6"}
                           fill="var(--color-surface-page)"
                           className="transition-transform duration-100"
                        />
                        <circle
                           cx={64 + (isMotionReduced ? 0 : pupilOffset.x) - 1.2}
                           cy={40 + (isMotionReduced ? 0 : pupilOffset.y) - 1.2}
                           r="1.2"
                           fill="white"
                        />
                        <circle
                           cx={64 + (isMotionReduced ? 0 : pupilOffset.x) + 1.2}
                           cy={40 + (isMotionReduced ? 0 : pupilOffset.y) + 1.2}
                           r="0.6"
                           fill="white"
                        />
                     </g>
                  )}

                  {/* Snout Muzzle */}
                  <ellipse
                     cx="50"
                     cy="52"
                     rx="14"
                     ry="10"
                     fill="white"
                     stroke="var(--color-surface-page)"
                     strokeWidth="2"
                  />

                  {/* Shiny Puppy Nose */}
                  <path
                     d="M45 47 C45 44 55 44 55 47 C55 51 51 53 50 53 C49 53 45 51 45 47 Z"
                     fill="var(--color-surface-page)"
                  />
                  <circle cx="48" cy="46" r="1.2" fill="white" />

                  {/* Tongue blep or cute smile */}
                  {isShy || isHyped ? (
                     <g>
                        <path
                           d="M47 55 C47 64 53 64 53 55 Z"
                           fill="var(--color-brand-3)"
                           stroke="var(--color-brand-3)"
                           strokeWidth="1.5"
                        />
                        <path
                           d="M50 55 V60"
                           stroke="var(--color-brand-3)"
                           strokeWidth="1"
                           strokeLinecap="round"
                        />
                     </g>
                  ) : (
                     <path
                        d="M46 54 Q50 58 54 54"
                        stroke="var(--color-surface-page)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        fill="none"
                     />
                  )}
               </g>

               {/* Paws */}
               <g
                  fill="white"
                  stroke="var(--color-surface-page)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
               >
                  <path d="M24 70 C24 58 38 58 38 70 Z" />
                  <path d="M29 64 V68" strokeWidth="1.5" />
                  <path d="M33 64 V68" strokeWidth="1.5" />

                  <path d="M62 70 C62 58 76 58 76 70 Z" />
                  <path d="M67 64 V68" strokeWidth="1.5" />
                  <path d="M71 64 V68" strokeWidth="1.5" />
               </g>
            </svg>
         </div>
      );
   }

   // -------------------------------------------------------------------------
   // Variant 4: Doodle Bunny
   // -------------------------------------------------------------------------
   const isShy = effectiveMood === "shy" || effectiveMood === "hover";
   const isProud = effectiveMood === "proud";
   const isSleepy = effectiveMood === "sleepy";
   const isHyped = effectiveMood === "hyped";

   return (
      <div
         ref={containerRef}
         data-testid={testId ?? "wrapped-mascot-bunny"}
         data-variant="BUNNY"
         data-mood={effectiveMood}
         onMouseEnter={handleMouseEnter}
         onMouseLeave={handleMouseLeave}
         className={`relative inline-flex items-end justify-center select-none ${SIZE_CLASSES[size]} ${className}`}
         {...rest}
      >
         <svg
            viewBox="0 0 100 85"
            preserveAspectRatio="xMidYMax meet"
            fill="none"
            className="w-full h-full overflow-visible text-text-primary drop-shadow-md"
            aria-hidden="true"
         >
            {/* Left Tall Upright Ear */}
            <path
               d={
                  isShy
                     ? "M32 44 C22 24 26 10 34 10 C42 10 44 24 40 44 Z"
                     : "M34 44 C26 20 30 6 38 6 C46 6 48 20 44 44 Z"
               }
               fill="white"
               stroke="var(--color-surface-page)"
               strokeWidth="2.5"
               strokeLinecap="round"
               strokeLinejoin="round"
               className={!isMotionReduced ? "transition-all duration-300" : ""}
            />
            {/* Inner Left Ear Pink Contour */}
            <path
               d={
                  isShy
                     ? "M34 40 C28 26 30 15 34 15 C38 15 40 26 38 40 Z"
                     : "M36 40 C30 22 33 11 38 11 C43 11 44 22 41 40 Z"
               }
               fill="var(--color-brand-3)"
               fillOpacity="0.45"
               stroke="var(--color-brand-3)"
               strokeWidth="1.2"
               strokeLinejoin="round"
            />

            {/* Right Expressive Lop Ear (Folds over gracefully) */}
            <path
               d={
                  isShy
                     ? "M56 44 C56 26 66 18 73 24 C77 28 75 38 67 42 Z"
                     : "M56 44 C56 20 68 12 75 20 C80 26 78 38 70 42 Z"
               }
               fill="white"
               stroke="var(--color-surface-page)"
               strokeWidth="2.5"
               strokeLinecap="round"
               strokeLinejoin="round"
               className={!isMotionReduced ? "transition-all duration-300" : ""}
            />
            {/* Inner Right Ear Pink Pad */}
            <path
               d={
                  isShy
                     ? "M58 40 C58 28 65 22 69 26 C72 30 70 36 65 39 Z"
                     : "M58 40 C58 23 66 16 71 22 C75 27 73 36 67 39 Z"
               }
               fill="var(--color-brand-3)"
               fillOpacity="0.45"
               stroke="var(--color-brand-3)"
               strokeWidth="1.2"
               strokeLinejoin="round"
            />

            {/* Bunny Head Dome with Chubby Cheeks */}
            <path
               d="M20 80 C16 54 24 38 50 38 C76 38 84 54 80 80 Z"
               fill="white"
               stroke="var(--color-surface-page)"
               strokeWidth="2.5"
               strokeLinecap="round"
               strokeLinejoin="round"
            />

            {/* Eyes */}
            {isProud ? (
               <g
                  stroke="var(--color-surface-page)"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  fill="none"
               >
                  <path d="M28 54 Q36 44 44 54" />
                  <path d="M56 54 Q64 44 72 54" />
               </g>
            ) : isSleepy ? (
               <g
                  stroke="var(--color-surface-page)"
                  strokeWidth="2.8"
                  strokeLinecap="round"
               >
                  <path d="M28 54 H44" />
                  <path d="M56 54 H72" />
               </g>
            ) : (
               <g className="animate-shy-blink origin-center">
                  {/* Left Eye */}
                  <ellipse
                     cx="36"
                     cy="52"
                     rx="7.5"
                     ry="8.5"
                     fill="white"
                     stroke="var(--color-surface-page)"
                     strokeWidth="2.2"
                  />
                  <circle
                     cx={36 + (isMotionReduced ? 0 : pupilOffset.x)}
                     cy={52 + (isMotionReduced ? 0 : pupilOffset.y)}
                     r={isHyped ? "4.5" : "3.6"}
                     fill="var(--color-surface-page)"
                     className="transition-transform duration-100"
                  />
                  <circle
                     cx={36 + (isMotionReduced ? 0 : pupilOffset.x) - 1.2}
                     cy={52 + (isMotionReduced ? 0 : pupilOffset.y) - 1.2}
                     r="1.2"
                     fill="white"
                  />
                  <circle
                     cx={36 + (isMotionReduced ? 0 : pupilOffset.x) + 1.2}
                     cy={52 + (isMotionReduced ? 0 : pupilOffset.y) + 1.2}
                     r="0.6"
                     fill="white"
                  />

                  {/* Right Eye */}
                  <ellipse
                     cx="64"
                     cy="52"
                     rx="7.5"
                     ry="8.5"
                     fill="white"
                     stroke="var(--color-surface-page)"
                     strokeWidth="2.2"
                  />
                  <circle
                     cx={64 + (isMotionReduced ? 0 : pupilOffset.x)}
                     cy={52 + (isMotionReduced ? 0 : pupilOffset.y)}
                     r={isHyped ? "4.5" : "3.6"}
                     fill="var(--color-surface-page)"
                     className="transition-transform duration-100"
                  />
                  <circle
                     cx={64 + (isMotionReduced ? 0 : pupilOffset.x) - 1.2}
                     cy={52 + (isMotionReduced ? 0 : pupilOffset.y) - 1.2}
                     r="1.2"
                     fill="white"
                  />
                  <circle
                     cx={64 + (isMotionReduced ? 0 : pupilOffset.x) + 1.2}
                     cy={52 + (isMotionReduced ? 0 : pupilOffset.y) + 1.2}
                     r="0.6"
                     fill="white"
                  />
               </g>
            )}

            {/* Twitching Pink Nose */}
            <path
               d="M50 60 L46 56 H54 Z"
               fill="var(--color-brand-3)"
               stroke="var(--color-brand-3)"
               strokeWidth="1"
               strokeLinejoin="round"
            />

            {/* Cute Y-shaped Bunny Mouth */}
            <path
               d="M50 61 V64 M45 66 Q50 64 50 64 Q50 64 55 66"
               stroke="var(--color-surface-page)"
               strokeWidth="2.2"
               strokeLinecap="round"
               strokeLinejoin="round"
               fill="none"
            />

            {/* Rosy Cheeks */}
            {(isShy || isHyped) && (
               <g fill="var(--color-brand-3)" fillOpacity="0.45">
                  <ellipse cx="24" cy="62" rx="5" ry="3.5" />
                  <ellipse cx="76" cy="62" rx="5" ry="3.5" />
               </g>
            )}

            {/* Round Bunny Paws on border */}
            <g
               fill="white"
               stroke="var(--color-surface-page)"
               strokeWidth="2.2"
               strokeLinecap="round"
               strokeLinejoin="round"
            >
               <path d="M26 80 C26 68 40 68 40 80 Z" />
               <path d="M60 80 C60 68 74 68 74 80 Z" />
            </g>
            <g fill="var(--color-brand-3)" fillOpacity="0.45">
               <circle cx="33" cy="74" r="2.5" />
               <circle cx="67" cy="74" r="2.5" />
            </g>
         </svg>
      </div>
   );
}
