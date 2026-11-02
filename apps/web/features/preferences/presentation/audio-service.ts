/**
 * @file audio-service.ts
 * Browser audio playback controller for task completion celebrations.
 * Respects user preferences (opt-in only), handles browser autoplay policies safely,
 * and fails silently without interrupting UI workflows or task state mutations.
 */

import {
   clampVolume,
   isTodoCompletionSfxEnabled,
} from "../domain/user-preferences";
import { loadStoredPreferences } from "../data/preferences-storage";

export const COMPLETION_SFX_ASSET_URL = "/sounds/yippee.mp3";

export interface PlayCompletionAudioOptions {
   /**
    * If true, bypasses the user preference check (used for preview buttons in Settings).
    * Default: false.
    */
   preview?: boolean;
   /**
    * Optional explicit volume override (0.0 to 1.0).
    */
   volume?: number;
}

/**
 * Triggers celebratory task completion sound if enabled in user preferences or previewed.
 * Never throws an error; fails silently if playback is blocked or unsupported.
 *
 * @returns Promise<boolean> indicating whether playback successfully commenced.
 */
export async function playCompletionAudio(
   options: PlayCompletionAudioOptions = {}
): Promise<boolean> {
   if (typeof window === "undefined" || typeof Audio === "undefined") {
      return false;
   }

   const { preview = false, volume } = options;
   const preferences = loadStoredPreferences();

   if (!preview && !isTodoCompletionSfxEnabled(preferences)) {
      return false;
   }

   try {
      const audio = new Audio(COMPLETION_SFX_ASSET_URL);
      const targetVolume = clampVolume(volume ?? preferences.sound.volume, 1.0);
      audio.volume = targetVolume;
      audio.currentTime = 0;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
         await playPromise;
      }
      return true;
   } catch {
      // Autoplay blocked by browser policy or missing audio codec - fail silently
      return false;
   }
}
