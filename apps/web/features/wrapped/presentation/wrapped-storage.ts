import { useEffect, useState, useCallback } from "react";
import {
   DEFAULT_WRAPPED_MASCOT,
   normalizeWrappedMascot,
   type WrappedMascotVariant,
} from "../domain/wrapped-mascot.types";

/**
 * localStorage mirror for the wrapped flags. local-first: the client reads
 * this first and only seeds from the server values when the entry is missing.
 */

export interface WrappedLocalState {
   seen: boolean;
   feedback: boolean;
}

const KEY_PREFIX = "hmt:wrapped:";

function storageKey(challengeId: string): string {
   return `${KEY_PREFIX}${challengeId}`;
}

export function readWrappedLocalState(
   challengeId: string
): WrappedLocalState | null {
   if (typeof window === "undefined") {
      return null;
   }

   try {
      const raw = window.localStorage.getItem(storageKey(challengeId));
      if (!raw) {
         return null;
      }

      const parsed = JSON.parse(raw) as {
         v?: number;
         seen?: boolean;
         feedback?: boolean;
      };

      if (parsed.v !== 1) {
         return null;
      }

      return {
         seen: Boolean(parsed.seen),
         feedback: Boolean(parsed.feedback),
      };
   } catch {
      return null;
   }
}

export function writeWrappedLocalState(
   challengeId: string,
   patch: Partial<WrappedLocalState>
): void {
   if (typeof window === "undefined") {
      return;
   }

   try {
      const previous = readWrappedLocalState(challengeId) ?? {
         seen: false,
         feedback: false,
      };

      const next = {
         v: 1,
         ...previous,
         ...patch,
      };

      window.localStorage.setItem(
         storageKey(challengeId),
         JSON.stringify(next)
      );
   } catch {
      // Storage may be unavailable (quota/private mode) — never break the UI.
   }
}

// ---------------------------------------------------------------------------
// Mascot Preferences Persistence & Reactive Hook
// ---------------------------------------------------------------------------

export const WRAPPED_MASCOT_STORAGE_KEY = "hmt:wrapped:mascot_preference";
export const WRAPPED_MASCOT_CHANGE_EVENT = "wrapped-mascot-change";

let memoryMascotPreference: WrappedMascotVariant = DEFAULT_WRAPPED_MASCOT;

/**
 * Reads the preferred Wrapped Mascot variant from local storage with memory fallback.
 */
export function getWrappedMascotPreference(): WrappedMascotVariant {
   if (typeof window === "undefined") {
      return memoryMascotPreference;
   }
   try {
      const raw = window.localStorage.getItem(WRAPPED_MASCOT_STORAGE_KEY);
      if (!raw) {
         return memoryMascotPreference;
      }
      return normalizeWrappedMascot(raw, memoryMascotPreference);
   } catch {
      return memoryMascotPreference;
   }
}

/**
 * Writes the chosen Wrapped Mascot variant to local storage and broadcasts
 * an event so all mounted components react immediately without reload.
 */
export function setWrappedMascotPreference(
   variant: WrappedMascotVariant
): void {
   const normalized = normalizeWrappedMascot(variant);
   memoryMascotPreference = normalized;

   if (typeof window !== "undefined") {
      try {
         window.localStorage.setItem(WRAPPED_MASCOT_STORAGE_KEY, normalized);
      } catch {
         // Silently keep memory fallback if quota or security prevents writing
      }

      try {
         window.dispatchEvent(
            new CustomEvent(WRAPPED_MASCOT_CHANGE_EVENT, {
               detail: normalized,
            })
         );
      } catch {
         // Browser event dispatch error boundary
      }
   }
}

/**
 * Reactive React hook that provides the user's active wrapped mascot preference
 * and stays in sync across component boundaries, custom events, and browser storage tabs.
 */
export function useWrappedMascotPreference(
   overrideVariant?: WrappedMascotVariant
): {
   variant: WrappedMascotVariant;
   setVariant: (variant: WrappedMascotVariant) => void;
} {
   const [variant, setVariantState] = useState<WrappedMascotVariant>(() => {
      if (overrideVariant) return overrideVariant;
      return getWrappedMascotPreference();
   });

   useEffect(() => {
      if (overrideVariant) {
         setVariantState(overrideVariant);
         return;
      }

      // Sync initial state on client mount
      setVariantState(getWrappedMascotPreference());

      const handleStorage = (event: StorageEvent) => {
         if (event.key === WRAPPED_MASCOT_STORAGE_KEY && event.newValue) {
            setVariantState(normalizeWrappedMascot(event.newValue));
         }
      };

      const handleCustom = (event: Event) => {
         const detail = (event as CustomEvent<WrappedMascotVariant>).detail;
         if (detail) {
            setVariantState(normalizeWrappedMascot(detail));
         } else {
            setVariantState(getWrappedMascotPreference());
         }
      };

      window.addEventListener("storage", handleStorage);
      window.addEventListener(WRAPPED_MASCOT_CHANGE_EVENT, handleCustom);

      return () => {
         window.removeEventListener("storage", handleStorage);
         window.removeEventListener(WRAPPED_MASCOT_CHANGE_EVENT, handleCustom);
      };
   }, [overrideVariant]);

   const setVariant = useCallback((newVariant: WrappedMascotVariant) => {
      setWrappedMascotPreference(newVariant);
      setVariantState(newVariant);
   }, []);

   return {
      variant: overrideVariant ?? variant,
      setVariant,
   };
}
