/**
 * @file wrapped-mascot.types.ts
 * Pure domain definitions and guards for the customizable Wrapped Mascot system.
 * Adheres strictly to Law L7 (Pure Domain Isolation): zero framework, React, or DOM imports.
 */

export type WrappedMascotVariant = "GOOGLY_EYES" | "CAT" | "DOG" | "BUNNY";

export type WrappedMascotMood =
   "idle" | "shy" | "hover" | "hyped" | "proud" | "sleepy";

export interface WrappedMascotOption {
   readonly id: WrappedMascotVariant;
   readonly label: string;
   readonly description: string;
   readonly badge?: string;
}

export const DEFAULT_WRAPPED_MASCOT: WrappedMascotVariant = "GOOGLY_EYES";

export const WRAPPED_MASCOT_OPTIONS: readonly WrappedMascotOption[] = [
   {
      id: "GOOGLY_EYES",
      label: "OG Googly Eyes",
      description: "Classic chaotic tracking eyes",
      badge: "Classic",
   },
   {
      id: "CAT",
      label: "Doodle Cat",
      description: "Curious peeking kitty with twitching ears",
      badge: "Cozy",
   },
   {
      id: "DOG",
      label: "Doodle Dog",
      description: "Happy pup with floppy ears and head tilt",
      badge: "Playful",
   },
   {
      id: "BUNNY",
      label: "Doodle Bunny",
      description: "Shy lop-eared bunny with a twitching nose",
      badge: "Sweet",
   },
] as const;

const VALID_VARIANTS = new Set<string>(["GOOGLY_EYES", "CAT", "DOG", "BUNNY"]);

/**
 * Pure domain type guard to validate whether an unknown value is a valid WrappedMascotVariant.
 */
export function isWrappedMascotVariant(
   value: unknown
): value is WrappedMascotVariant {
   return typeof value === "string" && VALID_VARIANTS.has(value);
}

/**
 * Pure domain sanitizer that ensures a valid WrappedMascotVariant is returned,
 * safely falling back to DEFAULT_WRAPPED_MASCOT ("GOOGLY_EYES").
 */
export function normalizeWrappedMascot(
   value: unknown,
   fallback: WrappedMascotVariant = DEFAULT_WRAPPED_MASCOT
): WrappedMascotVariant {
   if (isWrappedMascotVariant(value)) {
      return value;
   }
   return fallback;
}
