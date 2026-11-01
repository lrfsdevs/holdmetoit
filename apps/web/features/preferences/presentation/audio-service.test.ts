// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
   saveStoredPreferences,
   resetStoredPreferences,
} from "../data/preferences-storage";
import { COMPLETION_SFX_ASSET_URL, playCompletionAudio } from "./audio-service";

describe("audio-service", () => {
   let playMock: ReturnType<typeof vi.fn>;

   beforeEach(() => {
      resetStoredPreferences();
      playMock = vi.fn().mockResolvedValue(undefined);

      // Mock HTMLAudioElement / window.Audio
      class MockAudio {
         src: string;
         volume: number = 1.0;
         currentTime: number = 0;
         constructor(src: string) {
            this.src = src;
         }
         play = playMock;
      }

      vi.stubGlobal("Audio", MockAudio);
   });

   afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
   });

   it("does NOT play audio when preference is disabled (default)", async () => {
      const result = await playCompletionAudio();
      expect(result).toBe(false);
      expect(playMock).not.toHaveBeenCalled();
   });

   it("plays audio when preference is enabled", async () => {
      saveStoredPreferences((prev) => ({
         ...prev,
         sound: { ...prev.sound, todoCompletionSfx: true },
      }));

      const result = await playCompletionAudio();
      expect(result).toBe(true);
      expect(playMock).toHaveBeenCalledTimes(1);
   });

   it("plays audio when preview: true even if preference is disabled", async () => {
      const result = await playCompletionAudio({ preview: true });
      expect(result).toBe(true);
      expect(playMock).toHaveBeenCalledTimes(1);
   });

   it("handles audio.play() rejection gracefully without throwing", async () => {
      playMock.mockRejectedValue(
         new Error("NotAllowedError: Autoplay blocked")
      );

      const result = await playCompletionAudio({ preview: true });
      expect(result).toBe(false);
   });

   it("uses correct asset url", () => {
      expect(COMPLETION_SFX_ASSET_URL).toBe("/sounds/yippee.mp3");
   });
});
