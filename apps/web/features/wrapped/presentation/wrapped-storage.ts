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
